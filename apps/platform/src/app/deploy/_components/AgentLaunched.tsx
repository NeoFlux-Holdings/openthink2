"use client";

import {
  AlertCircle,
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TerminalSquare
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import type {
  DeploymentEvent,
  DeploymentResource
} from "@/lib/deployment-engine";
import { DeploymentTimeline } from "./DeploymentTimeline";

export interface AgentLaunchedProps {
  agentName: string;
  agentUrl: string | null;
  deploymentId: string | null;
  events: DeploymentEvent[];
  resources: DeploymentResource[];
  isDeploying: boolean;
  error: string | null;
  onStartOver: () => void;
}

export function AgentLaunched({
  agentName,
  agentUrl,
  deploymentId,
  events,
  isDeploying,
  error,
  onStartOver
}: AgentLaunchedProps) {
  const isComplete =
    !isDeploying && events.length > 0 && events.every((e) => e.status === "complete");
  const hasError = events.some((e) => e.status === "error") || !!error;

  const [autoUpdate, setAutoUpdate] = useState(true);
  const [updateState, setUpdateState] = useState<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    setUpdateState("running");
    setUpdateMessage(null);
    try {
      const response = await fetch("/api/sync/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pull" })
      });
      const body = (await response.json().catch(() => null)) as
        | {
            result?: { message?: string; ok?: boolean; updates?: number };
            error?: string;
          }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Update check failed.");
      }
      setUpdateState("done");
      setUpdateMessage(
        body?.result?.message ??
          (body?.result?.updates && body.result.updates > 0
            ? `${body.result.updates} update(s) pulled.`
            : "Already up to date.")
      );
    } catch (caught) {
      setUpdateState("error");
      setUpdateMessage(
        caught instanceof Error ? caught.message : "Update check failed."
      );
    }
  }, []);

  return (
    <div className="ot-launched">
      <header className="ot-launched__head" data-state={hasError ? "error" : isComplete ? "ready" : "active"}>
        <span className="ot-launched__icon" aria-hidden="true">
          {hasError ? (
            <AlertCircle size={22} />
          ) : isComplete ? (
            <Sparkles size={22} />
          ) : (
            <Loader2 size={22} className="ot-spin" />
          )}
        </span>
        <div>
          <h2>
            {hasError
              ? "Launch needs a look"
              : isComplete
                ? `${agentName} is live`
                : `Launching ${agentName}`}
          </h2>
          <p>
            {hasError
              ? "Something stopped the launch. See the steps below."
              : isComplete
                ? "Your agent is deployed and waiting for you."
                : "Streaming each step into your Cloudflare account."}
          </p>
        </div>
      </header>

      {error ? <p className="ot-alert ot-alert--error">{error}</p> : null}

      {isComplete && agentUrl ? (
        <a
          className="ot-button ot-button--primary ot-button--block ot-button--giant ot-button--launch"
          href={agentUrl}
          target="_blank"
          rel="noreferrer"
        >
          Visit your agent
          <ArrowRight size={18} aria-hidden="true" />
        </a>
      ) : null}

      <div className="ot-launched__timeline">
        <DeploymentTimeline events={events} isDeploying={isDeploying} />
      </div>

      {isComplete ? (
        <>
          <article className="ot-card" aria-labelledby="ot-updates-title">
            <header className="ot-card__head">
              <div>
                <h3 id="ot-updates-title">
                  <RefreshCw size={16} aria-hidden="true" />
                  Updates
                </h3>
                <p>
                  Your agent can pull improvements from the public repo without
                  needing a redeploy. Keep this on and we'll check daily; or
                  push the button whenever you want.
                </p>
              </div>
              <label className="ot-switch ot-switch--inline">
                <input
                  type="checkbox"
                  checked={autoUpdate}
                  onChange={(event) => setAutoUpdate(event.target.checked)}
                  aria-label="Auto-update"
                />
                <span aria-hidden="true" />
              </label>
            </header>
            <button
              type="button"
              className="ot-button ot-button--ghost ot-button--block"
              onClick={checkForUpdates}
              disabled={updateState === "running"}
            >
              {updateState === "running" ? (
                <>
                  <Loader2 size={16} aria-hidden="true" className="ot-spin" />
                  Checking…
                </>
              ) : (
                <>
                  <RefreshCw size={16} aria-hidden="true" />
                  Check for updates now
                </>
              )}
            </button>
            {updateMessage ? (
              <p
                className={
                  updateState === "error"
                    ? "ot-alert ot-alert--error"
                    : "ot-alert ot-alert--ok"
                }
              >
                {updateState === "done" ? (
                  <CheckCircle2 size={14} aria-hidden="true" />
                ) : updateState === "error" ? (
                  <AlertCircle size={14} aria-hidden="true" />
                ) : null}
                {updateMessage}
              </p>
            ) : null}
          </article>

          <article className="ot-card" aria-labelledby="ot-manage-title">
            <header className="ot-card__head">
              <div>
                <h3 id="ot-manage-title">
                  <ShieldCheck size={16} aria-hidden="true" />
                  Manage
                </h3>
                <p>Jump to anything you need to tune or watch.</p>
              </div>
            </header>
            <ul className="ot-manage-grid">
              <li>
                <Link className="ot-manage-tile" href="/chat">
                  <Bot size={18} aria-hidden="true" />
                  <span>
                    <strong>Chat</strong>
                    <small>Talk to your agent</small>
                  </span>
                </Link>
              </li>
              <li>
                <Link className="ot-manage-tile" href="/learning">
                  <Brain size={18} aria-hidden="true" />
                  <span>
                    <strong>Learning</strong>
                    <small>Memory & training</small>
                  </span>
                </Link>
              </li>
              <li>
                <Link className="ot-manage-tile" href="/terminal">
                  <TerminalSquare size={18} aria-hidden="true" />
                  <span>
                    <strong>Terminal</strong>
                    <small>Shell handoff</small>
                  </span>
                </Link>
              </li>
              <li>
                <Link className="ot-manage-tile" href="/sync">
                  <GitBranch size={18} aria-hidden="true" />
                  <span>
                    <strong>Sync</strong>
                    <small>Repo & code</small>
                  </span>
                </Link>
              </li>
              <li>
                <Link className="ot-manage-tile" href="/admin">
                  <ShieldCheck size={18} aria-hidden="true" />
                  <span>
                    <strong>Admin</strong>
                    <small>Spend & reset</small>
                  </span>
                </Link>
              </li>
            </ul>
          </article>
        </>
      ) : null}

      <footer className="ot-launched__foot">
        {deploymentId ? (
          <small className="ot-fineprint">
            Deployment <code>{deploymentId}</code>
          </small>
        ) : null}
        {agentUrl ? (
          <a
            className="ot-textlink"
            href={agentUrl}
            target="_blank"
            rel="noreferrer"
          >
            {agentUrl}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : null}
        <button
          type="button"
          className="ot-button ot-button--ghost ot-button--small"
          onClick={onStartOver}
        >
          <RotateCcw size={14} aria-hidden="true" />
          Start a new launch
        </button>
      </footer>
    </div>
  );
}
