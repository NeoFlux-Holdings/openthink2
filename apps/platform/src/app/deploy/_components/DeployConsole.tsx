"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DeploymentEvent,
  DeploymentRequest,
  DeploymentResource
} from "@/lib/deployment-engine";
import { AgentLaunched } from "./AgentLaunched";
import { SteppedFlow, type StepIndex } from "./SteppedFlow";

const STORAGE_KEY = "openthink:lastLaunch";

interface PersistedLaunch {
  agentName: string;
  agentUrl: string | null;
  deploymentId: string | null;
  completedAt: string;
}

export function DeployConsole() {
  const [step, setStep] = useState<StepIndex>(0);
  const [events, setEvents] = useState<DeploymentEvent[]>([]);
  const [resources, setResources] = useState<DeploymentResource[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [agentUrl, setAgentUrl] = useState<string | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage so a return visit lands on the Live screen.
  useEffect(() => {
    setHydrated(true);
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedLaunch | null;
      if (parsed?.agentName && parsed.agentUrl) {
        setAgentName(parsed.agentName);
        setAgentUrl(parsed.agentUrl);
        setDeploymentId(parsed.deploymentId);
        setStep(3);
        // Synthesize a completed timeline so the UI looks "live"
        setEvents([
          {
            id: "restored",
            stage: "ready",
            status: "complete",
            progress: 100,
            label: "Agent is live",
            detail: `Restored from your last launch at ${new Date(parsed.completedAt).toLocaleString()}.`,
            timestamp: parsed.completedAt
          }
        ]);
      }
    } catch {
      // ignore
    }
  }, []);

  const persistLaunch = useCallback(
    (snapshot: PersistedLaunch | null) => {
      if (typeof window === "undefined") return;
      try {
        if (snapshot) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // ignore quota / privacy errors
      }
    },
    []
  );

  const startOver = useCallback(() => {
    setStep(0);
    setEvents([]);
    setResources([]);
    setAgentUrl(null);
    setDeploymentId(null);
    setAgentName("");
    setError(null);
    persistLaunch(null);
  }, [persistLaunch]);

  const startDeployment = useCallback(
    async (payload: Partial<DeploymentRequest>) => {
      setError(null);
      setEvents([]);
      setAgentUrl(null);
      setDeploymentId(null);
      setResources([]);
      setIsDeploying(true);
      setAgentName(payload.agentName ?? "your agent");
      setStep(3);

      try {
        const response = await fetch(`/api/deployment/self`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            starterTemplate: "personal-agent"
          })
        });

        if (!response.ok || !response.body) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error ?? "Deployment stream failed.");
        }

        const id = response.headers.get("X-Deployment-Id");
        const url = response.headers.get("X-Agent-Url");
        setDeploymentId(id);
        setAgentUrl(url);

        await readSse(response.body, (event) => {
          setEvents((current) => [...current, event]);
          if (event.resources) setResources(event.resources);
        });

        // Persist on completion
        if (url) {
          persistLaunch({
            agentName: payload.agentName ?? "your agent",
            agentUrl: url,
            deploymentId: id,
            completedAt: new Date().toISOString()
          });
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Deployment failed.");
      } finally {
        setIsDeploying(false);
      }
    },
    [persistLaunch]
  );

  const handleStepChange = useCallback(
    (next: StepIndex) => {
      if (isDeploying) return;
      if (step === 3 && next < 3) {
        startOver();
        return;
      }
      setStep(next);
    },
    [isDeploying, startOver, step]
  );

  // Wait for hydration so SSR matches client (no flash of step 1 when we
  // are about to render the Live screen from localStorage).
  if (!hydrated) {
    return <div className="ot-stepper ot-stepper--loading" aria-hidden="true" />;
  }

  return (
    <div className="ot-deploy-shell">
      {step < 3 ? (
        <SteppedFlow
          step={step}
          onStepChange={handleStepChange}
          isDeploying={isDeploying}
          onLaunch={startDeployment}
        />
      ) : (
        <AgentLaunched
          agentName={agentName}
          agentUrl={agentUrl}
          deploymentId={deploymentId}
          events={events}
          resources={resources}
          isDeploying={isDeploying}
          error={error}
          onStartOver={startOver}
        />
      )}
    </div>
  );
}

async function readSse(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: DeploymentEvent) => void
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const eventLine = chunk
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (!eventLine) continue;
      const parsed = JSON.parse(eventLine.slice(6)) as
        | DeploymentEvent
        | { ok: true };
      if ("id" in parsed) onEvent(parsed);
    }
  }
}
