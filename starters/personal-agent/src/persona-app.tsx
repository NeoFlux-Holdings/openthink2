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
    autoContinueAfterToolResult: false,
    resume: false
  });

  const connected = agent.readyState === WebSocket.OPEN;
  const busy = status === "submitted" || status === "streaming" || isStreaming || isServerStreaming;

  // Promote to thread view once a user message lands so the home screen
  // exits even before the assistant replies.
  useEffect(() => {
    if (view === "thread") return;
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
            onSubmit={(prompt, _mode, _attachments) => submitNewTask(prompt)}
            onSelectThread={() => setView("thread")}
          />
        );
      case "library":
        return (
          <PersonaSimplePage
            title="Library"
            description="Every artifact your agent has produced will be browsable here."
          />
        );
      case "learning":
        return (
          <PersonaSimplePage
            title="Learning"
            description="Pending lessons your agent has captured. Approve them to update its persona."
          />
        );
      case "skills":
        return (
          <PersonaSimplePage
            title="Skills"
            description="Built-in and installed skills your agent can call."
          />
        );
      case "settings":
        return (
          <PersonaSimplePage
            title="Settings"
            description="Model, approvals, training mode, and other preferences."
          />
        );
      case "search":
        return (
          <PersonaSimplePage
            title="Search"
            description="Cross-workspace search palette opens with ⌘K."
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
