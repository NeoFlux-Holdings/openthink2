/**
 * PersonaApp — the top-level wrapper that puts the Persona shell, Home,
 * Thread Feed, and Composer together for the deployed agent web UI.
 *
 * Owns:
 *   - The active routed view (`home`, `thread`, or one of the sidebar
 *     destinations: `library` / `learning` / `skills` / `settings`).
 *   - The `useAgent` + `useAgentChat` hookup that powers the thread.
 *   - The currently active thread id (the deployed PersonalChatAgent is
 *     single-room today, so the id is effectively a stable token).
 *
 * It does NOT own any artifact-canvas state — the existing
 * `PersonaShell` keeps its own windowing/active-artifact state.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import type { UIMessage } from "ai";
import { PersonaShell, type PersonaArtifact, type PersonaThreadSummary } from "./persona-shell";
import { PersonaHome, type PersonaRecentThread } from "./persona-pages/persona-home";
import { PersonaThreadFeed } from "./persona-pages/persona-thread-feed";
import { PersonaComposer } from "./persona-pages/persona-composer";
import { LibraryPage } from "./persona-pages/library-page";
import { SkillsPage } from "./persona-pages/skills-page";
import { SettingsPage, defaultPersonaSettings, type PersonaSettings } from "./persona-pages/settings-page";
import { SearchPalette } from "./persona-pages/search-palette";
import { builtinSkillPacks, flattenPacks, type Skill } from "./skills";

export type PersonaView = "home" | "thread" | "library" | "learning" | "skills" | "settings" | "search";

export interface PersonaAppProps {
  workspaceName: string;
  ownerEmail?: string;
  defaultModel: string;
  showCostEstimate?: boolean;
}

const DEFAULT_THREAD_ID = "default";
const DEFAULT_AGENT_COLOR = "#3a5bd7";

export function PersonaApp(props: PersonaAppProps): ReactNode {
  const { workspaceName, ownerEmail = "", defaultModel, showCostEstimate = false } = props;

  const [view, setView] = useState<PersonaView>("home");
  const [threadTitle, setThreadTitle] = useState<string>("New task");
  const [recentThreads, setRecentThreads] = useState<PersonaRecentThread[]>([]);
  const lastSubmitRef = useRef<{ text: string; at: number } | null>(null);

  // Persisted-in-memory persona settings. The deployed agent will pick
  // up changes for the duration of the session; durable persistence to
  // the orchestrator's DO is a follow-up.
  const [personaSettings, setPersonaSettings] = useState<PersonaSettings>(defaultPersonaSettings);
  const updatePersonaSettings = useCallback((patch: Partial<PersonaSettings>) => {
    setPersonaSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  // Skills come from the bundled registry (Cloudflare pack preloaded).
  // Manual toggle / pin lives in component state for now; durable
  // persistence is a follow-up.
  const [skillOverrides, setSkillOverrides] = useState<Record<string, { enabled?: boolean; pinned?: boolean }>>({});
  const allSkills = useMemo<Skill[]>(() => {
    const flat = flattenPacks(builtinSkillPacks);
    return flat.map((skill) => {
      const override = skillOverrides[skill.id];
      if (!override) return skill;
      return {
        ...skill,
        enabled: override.enabled ?? skill.enabled,
        pinned: override.pinned ?? skill.pinned
      };
    });
  }, [skillOverrides]);
  const activeSkills = useMemo(() => allSkills.filter((s) => s.enabled), [allSkills]);
  const pendingSkills = useMemo(() => allSkills.filter((s) => !s.enabled), [allSkills]);
  const toggleSkill = useCallback((id: string, enabled: boolean) => {
    setSkillOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), enabled } }));
  }, []);
  const pinSkill = useCallback((id: string, pinned: boolean) => {
    setSkillOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), pinned } }));
  }, []);

  const agent = useAgent({
    agent: "PersonalChatAgent",
    name: DEFAULT_THREAD_ID
  });

  const {
    messages,
    sendMessage,
    stop,
    clearError,
    status,
    error,
    isStreaming,
    isServerStreaming
  } = useAgentChat({
    agent,
    // Persona's normie default: feed every tool result back to the
    // model so the assistant produces a final answer without manual
    // continuation. The legacy chat (?shell=legacy) keeps the
    // per-tool approval flow for power users.
    autoContinueAfterToolResult: true,
    resume: false
  });

  const connected = agent.readyState === WebSocket.OPEN;
  const busy = status === "submitted" || status === "streaming" || isStreaming || isServerStreaming;

  // Promote to thread view once a user message lands, but ONLY when
  // the user is currently on the home screen. Otherwise the effect
  // would clobber any sidebar navigation (Library / Skills / Settings /
  // …) the moment the messages array updated.
  useEffect(() => {
    if (view !== "home") return;
    if (messages.some((message) => message.role === "user" && (message.parts ?? []).length > 0)) {
      setView("thread");
    }
  }, [messages, view]);

  // Keep the recent-threads chip in the sidebar in sync with the
  // current single-room thread title.
  useEffect(() => {
    const hasMessages = messages.length > 0;
    if (!hasMessages) {
      setRecentThreads([]);
      return;
    }
    setRecentThreads([
      {
        id: DEFAULT_THREAD_ID,
        title: threadTitle,
        agentName: workspaceName,
        agentColor: DEFAULT_AGENT_COLOR,
        lastUpdated: "Now"
      }
    ]);
  }, [messages.length, threadTitle, workspaceName]);

  const workingDoc = useMemo(() => extractWorkingDoc(messages), [messages]);

  // Stuck-state watchdog: when the agent has been "busy" for a long
  // time without any new content, surface a recovery banner so the
  // user can stop or retry. Resets every time the message count or
  // content fingerprint changes.
  const [stuck, setStuck] = useState(false);
  const contentSignature = useMemo(() => {
    let total = 0;
    for (const message of messages) {
      const parts = (message as { parts?: unknown[] }).parts ?? [];
      for (const part of parts) {
        if (part && typeof part === "object" && "text" in part && typeof (part as { text: unknown }).text === "string") {
          total += ((part as { text: string }).text ?? "").length;
        }
      }
    }
    return `${messages.length}:${total}`;
  }, [messages]);
  useEffect(() => {
    setStuck(false);
    if (!busy) return;
    const timer = setTimeout(() => setStuck(true), 30_000);
    return () => clearTimeout(timer);
  }, [busy, contentSignature]);

  const submitNewTask = useCallback(
    (prompt: string) => {
      if (!prompt.trim() || busy) return;
      lastSubmitRef.current = { text: prompt, at: Date.now() };
      if (threadTitle === "New task") {
        const firstLine = prompt.split("\n")[0] ?? prompt;
        const trimmed = firstLine.length > 64 ? `${firstLine.slice(0, 61)}…` : firstLine;
        setThreadTitle(trimmed);
      }
      clearError();
      sendMessage({ text: prompt });
      setView("thread");
    },
    [busy, clearError, sendMessage, threadTitle]
  );

  const sidebarRecent: PersonaThreadSummary[] = recentThreads.map((thread) => ({
    id: thread.id,
    title: thread.title,
    agentName: thread.agentName,
    agentColor: thread.agentColor,
    status: busy ? "live" : "complete",
    lastUpdated: thread.lastUpdated,
    artifactCount: 0
  }));

  const artifacts: PersonaArtifact[] = [];

  const renderCenter = () => {
    switch (view) {
      case "home":
        return (
          <PersonaHome
            recentThreads={recentThreads}
            disabled={!connected}
            draftStorageKey="openthink:persona:home-draft"
            onSubmit={(prompt, _mode, _attachments) => submitNewTask(prompt)}
            onSelectThread={() => setView("thread")}
          />
        );
      case "library":
        // LibraryPage owns its own narrower PersonaArtifact union (no
        // "diff" kind). Once we wire real artifact extraction in
        // PersonaApp we'll project shell-shaped artifacts into the
        // library shape here.
        return <LibraryPage artifacts={[]} />;
      case "learning":
        return <LearningPanel />;
      case "skills":
        return (
          <SkillsPage
            activeSkills={activeSkills}
            pendingSkills={pendingSkills}
            onToggleSkill={toggleSkill}
            onPinSkill={pinSkill}
          />
        );
      case "settings":
        return (
          <SettingsPage
            settings={personaSettings}
            onUpdate={updatePersonaSettings}
          />
        );
      case "search":
        // Search opens as a modal overlay rather than a routed page.
        // Show the home screen behind the palette so dismissing returns
        // the user to a useful surface.
        return (
          <PersonaHome
            recentThreads={recentThreads}
            disabled={!connected}
            onSubmit={(prompt, _mode, _attachments) => submitNewTask(prompt)}
            onSelectThread={() => setView("thread")}
          />
        );
      case "thread":
      default: {
        const threadProps: Parameters<typeof PersonaThreadFeed>[0] = {
          messages: messages as UIMessage[],
          status,
          busy,
          threadTitle,
          agentName: workspaceName,
          agentColor: DEFAULT_AGENT_COLOR,
          modelLabel: defaultModel,
          onTitleChange: setThreadTitle,
          onSelectFollowUp: (text: string) => submitNewTask(text)
        };
        if (workingDoc) threadProps.workingDoc = workingDoc;
        return <PersonaThreadFeed {...threadProps} />;
      }
    }
  };

  const composerProps: Parameters<typeof PersonaComposer>[0] = {
    busy,
    disabled: !connected,
    showCostEstimate,
    draftStorageKey: "openthink:persona:thread-draft",
    onSubmit: (text: string) => submitNewTask(text)
  };
  if (showCostEstimate) composerProps.costEstimate = "~$0.04";
  if (busy) composerProps.onStop = () => void stop();
  const composer = <PersonaComposer {...composerProps} />;

  const shellProps: Parameters<typeof PersonaShell>[0] = {
    workspaceName,
    ownerEmail,
    recentThreads: sidebarRecent,
    artifacts,
    workingDoc: "",
    pendingLearningCount: 0,
    pendingSkillsCount: 0,
    onSelectThread: () => setView("thread"),
    onNewTask: () => setView("home"),
    onOpenSearch: () => setView("search"),
    onOpenLibrary: () => setView("library"),
    onOpenLearning: () => setView("learning"),
    onOpenSkills: () => setView("skills"),
    onOpenSettings: () => setView("settings"),
    threadView: renderCenter(),
    composer: view === "thread" ? composer : null
  };
  if (view === "thread") shellProps.activeThreadId = DEFAULT_THREAD_ID;

  return (
    <>
      <PersonaShell {...shellProps} />
      {view === "search" ? (
        <SearchPalette
          threads={[]}
          artifacts={[]}
          memories={[]}
          onClose={() => setView("home")}
          onSelectThread={(id) => {
            setView("thread");
            void id;
          }}
          onSelectArtifact={() => setView("library")}
          onSelectMemory={() => setView("learning")}
        />
      ) : null}
      {stuck && busy ? (
        <div className="persona-app__stuck" role="status">
          <span>
            The agent has been working on this for a while. Stop and try again, or wait it out.
          </span>
          <button type="button" onClick={() => void stop()}>
            Stop
          </button>
        </div>
      ) : null}
      {error ? (
        <div className="persona-app__error" role="alert">
          <span>{error.message || String(error)}</span>
          <button type="button" onClick={() => clearError()}>
            Dismiss
          </button>
        </div>
      ) : null}
    </>
  );
}

function PersonaSimplePage({ title, description }: { title: string; description: string }) {
  return (
    <section className="persona-page" aria-label={title}>
      <header className="persona-page__header">
        <h1>{title}</h1>
        <p className="persona-page__subtitle">{description}</p>
      </header>
    </section>
  );
}

interface LearningSuggestion {
  id: string;
  kind: "skill" | "rubric" | "prompt";
  status: "pending" | "applied" | "rejected";
  summary?: string;
  name?: string;
  rationale?: string;
  confidence: number;
}

function LearningPanel() {
  const [suggestions, setSuggestions] = useState<LearningSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/learning/pending")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { suggestions?: LearningSuggestion[] };
        if (!cancelled) setSuggestions(body.suggestions ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function decide(id: string, decision: "applied" | "rejected") {
    try {
      await fetch("/learning/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision })
      });
      setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, status: decision } : s)));
    } catch {
      // best-effort; user can retry
    }
  }

  const pending = suggestions.filter((s) => s.status === "pending");

  return (
    <section className="persona-page persona-learning" aria-label="Learning">
      <header className="persona-page__header">
        <h1>Learning</h1>
        <p className="persona-page__subtitle">
          Pending lessons your agent has captured. Approve them to update its persona.
        </p>
      </header>
      {loading ? <p className="persona-page__empty">Loading…</p> : null}
      {error ? (
        <p className="persona-page__error" role="alert">
          Couldn’t load suggestions yet. The agent will surface them as it runs.
        </p>
      ) : null}
      {!loading && !error && pending.length === 0 ? (
        <p className="persona-page__empty">
          No pending lessons yet. After a few task runs, the agent will propose skills, rubrics, and
          prompt edits here.
        </p>
      ) : null}
      <ul className="persona-learning__list">
        {pending.map((s) => (
          <li key={s.id} className="persona-learning__row">
            <div className="persona-learning__row-text">
              <span className="persona-learning__kind">{s.kind}</span>
              <strong>{s.name ?? s.summary ?? "Suggested change"}</strong>
              {s.rationale ? <small>{s.rationale}</small> : null}
            </div>
            <div className="persona-learning__row-actions">
              <button type="button" onClick={() => decide(s.id, "applied")}>
                Accept
              </button>
              <button type="button" onClick={() => decide(s.id, "rejected")} className="ghost">
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function extractWorkingDoc(messages: UIMessage[]): string | undefined {
  // Look for the most recent assistant message that has a working-doc
  // chip — we encode this as a metadata field if present, otherwise
  // we fall back to a sniff for a leading "Working doc:" line.
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message) continue;
    const metadata = (message as { metadata?: Record<string, unknown> }).metadata;
    if (metadata && typeof metadata.workingDoc === "string" && metadata.workingDoc.trim()) {
      return metadata.workingDoc.trim();
    }
  }
  return undefined;
}
