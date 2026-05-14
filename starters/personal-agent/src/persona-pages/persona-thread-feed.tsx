/**
 * Persona Thread Feed — message bubbles, agent reasoning collapsible,
 * working doc chip, tool chips, follow-up suggestion chips, and message
 * actions.
 *
 * Replaces the legacy single-pane `<Chat/>` body for the Persona shell.
 * Receives the `useAgentChat` outputs as props so it stays free of
 * transport details and is easy to unit test.
 */

import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  isTextUIPart,
  isToolUIPart,
  getToolName,
  type UIMessage
} from "ai";
import {
  getToolApproval,
  getToolCallId,
  getToolInput,
  getToolOutput,
  getToolPartState
} from "@cloudflare/ai-chat/react";

const ThreadMarkdown = lazy(async () => {
  const { Streamdown } = await import("streamdown");
  return {
    default: function ThreadMarkdown({ children }: { children: string }) {
      return <Streamdown controls={false}>{children}</Streamdown>;
    }
  };
});

export type PersonaThreadStatus = "live" | "complete" | "paused";

export interface PersonaThreadFeedProps {
  messages: UIMessage[];
  status: "idle" | "submitted" | "streaming" | "ready" | "error" | "submitted-tool" | string;
  threadTitle?: string | undefined;
  agentName?: string | undefined;
  agentColor?: string | undefined;
  modelLabel?: string | undefined;
  workingDoc?: string | undefined;
  followUpSuggestions?: ReadonlyArray<string> | undefined;
  busy?: boolean | undefined;
  onTitleChange?: ((next: string) => void) | undefined;
  onSelectFollowUp?: ((text: string) => void) | undefined;
  onOpenArtifact?: ((toolName: string, toolCallId: string | undefined) => void) | undefined;
  onMessageAction?: ((action: PersonaMessageAction, messageId: string) => void) | undefined;
}

export type PersonaMessageAction =
  | "thumbs-up"
  | "thumbs-down"
  | "retry"
  | "copy"
  | "share";

const DEFAULT_FOLLOW_UPS: ReadonlyArray<string> = [
  "Walk me through what you did",
  "Try a different approach",
  "Make it shorter",
  "Show me the source"
];

export function PersonaThreadFeed(props: PersonaThreadFeedProps): ReactNode {
  const {
    messages,
    status,
    threadTitle = "Untitled thread",
    agentName = "agent",
    agentColor = "#3a5bd7",
    modelLabel,
    workingDoc,
    followUpSuggestions = DEFAULT_FOLLOW_UPS,
    busy = false,
    onTitleChange,
    onSelectFollowUp,
    onOpenArtifact,
    onMessageAction
  } = props;

  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(threadTitle);
  const [workingDocDismissed, setWorkingDocDismissed] = useState(false);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);

  useEffect(() => {
    setTitleDraft(threadTitle);
  }, [threadTitle]);

  useEffect(() => {
    // Reset working-doc dismissal when the agent posts a fresh one.
    setWorkingDocDismissed(false);
  }, [workingDoc]);

  useEffect(() => {
    const el = feedRef.current;
    if (!el || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  function onScroll() {
    const el = feedRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  const threadStatus: PersonaThreadStatus = computeStatus(status);

  const visible = useMemo(() => collectVisibleMessages(messages), [messages]);
  const showFollowUps =
    !busy &&
    visible.length > 0 &&
    visible[visible.length - 1]?.role === "assistant" &&
    followUpSuggestions.length > 0;

  return (
    <article className="persona-thread" aria-label="Conversation">
      <header className="persona-thread__header">
        <div className="persona-thread__title-block">
          {editing ? (
            <input
              type="text"
              className="persona-thread__title-input"
              value={titleDraft}
              autoFocus
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={() => {
                setEditing(false);
                const next = titleDraft.trim() || threadTitle;
                if (next !== threadTitle) onTitleChange?.(next);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setEditing(false);
                  const next = titleDraft.trim() || threadTitle;
                  if (next !== threadTitle) onTitleChange?.(next);
                } else if (event.key === "Escape") {
                  setEditing(false);
                  setTitleDraft(threadTitle);
                }
              }}
              aria-label="Edit thread title"
            />
          ) : (
            <button
              type="button"
              className="persona-thread__title"
              onClick={() => setEditing(true)}
              title="Click to rename"
            >
              {threadTitle}
            </button>
          )}
          <span className="persona-thread__agent">
            <span className="persona-thread__agent-dot" style={{ background: agentColor }} aria-hidden="true" />
            <span>{agentName}</span>
          </span>
        </div>
        <div className="persona-thread__meta">
          <span
            className={`persona-thread__status persona-thread__status--${threadStatus}`}
            aria-label={`Status ${threadStatus}`}
          >
            <span className="persona-thread__status-dot" aria-hidden="true" />
            {threadStatus === "live" ? "Live" : threadStatus === "paused" ? "Paused" : "Complete"}
          </span>
          {modelLabel ? <span className="persona-thread__model" title="Model">{modelLabel}</span> : null}
          <button
            type="button"
            className="persona-thread__more"
            aria-label="More thread actions"
            onClick={() => onMessageAction?.("share", "thread")}
          >
            ⋯
          </button>
        </div>
        {threadStatus === "live" ? (
          <div className="persona-thread__progress" aria-hidden="true">
            <span />
          </div>
        ) : null}
      </header>

      {workingDoc && !workingDocDismissed ? (
        <div className="persona-thread__working-doc" role="note" aria-label="Working doc">
          <span className="persona-thread__working-doc-label">Working doc</span>
          <span className="persona-thread__working-doc-body">{workingDoc}</span>
          <button
            type="button"
            className="persona-thread__working-doc-close"
            aria-label="Dismiss working doc"
            onClick={() => setWorkingDocDismissed(true)}
          >
            ×
          </button>
        </div>
      ) : null}

      <div
        className="persona-thread__feed"
        ref={feedRef}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
      >
        {visible.length === 0 ? (
          <div className="persona-thread__empty">
            <p>This is a fresh thread — your first message starts the conversation.</p>
          </div>
        ) : (
          visible.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              busy={busy && message === visible[visible.length - 1]}
              onOpenArtifact={onOpenArtifact}
              onAction={onMessageAction}
            />
          ))
        )}
      </div>

      {showFollowUps ? (
        <div className="persona-thread__followups" aria-label="Suggested follow-ups">
          {followUpSuggestions.slice(0, 4).map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              className="persona-thread__followup"
              onClick={() => onSelectFollowUp?.(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function computeStatus(value: PersonaThreadFeedProps["status"]): PersonaThreadStatus {
  if (value === "streaming" || value === "submitted" || value === "submitted-tool") return "live";
  if (value === "error") return "paused";
  return "complete";
}

interface MessageBubbleProps {
  message: UIMessage;
  busy: boolean;
  onOpenArtifact?: ((toolName: string, toolCallId: string | undefined) => void) | undefined;
  onAction?: ((action: PersonaMessageAction, messageId: string) => void) | undefined;
}

function MessageBubble({ message, busy, onOpenArtifact, onAction }: MessageBubbleProps) {
  const role: "user" | "assistant" | "system" =
    message.role === "user" ? "user" : message.role === "assistant" ? "assistant" : "system";

  const parts = message.parts ?? [];
  const text = parts
    .map((part) => (isTextUIPart(part) ? part.text : ""))
    .filter(Boolean)
    .join("\n\n");
  const toolParts = parts.filter(isToolUIPart);
  const reasoningParts = parts.filter((part) => part.type === "reasoning");
  const reasoningText = reasoningParts
    .map((part) => (part as { text?: string }).text ?? "")
    .filter(Boolean)
    .join("\n\n");

  const statusLine = busy ? deriveStatusLine(toolParts) : undefined;

  return (
    <article className={`persona-bubble persona-bubble--${role}`} data-role={role}>
      {role === "assistant" && reasoningText ? <ReasonedBlock text={reasoningText} /> : null}

      {statusLine ? (
        <p className="persona-bubble__status" aria-live="polite">
          {statusLine}
        </p>
      ) : null}

      {toolParts.length > 0 ? (
        <ul className="persona-bubble__tools" aria-label="Tool activity">
          {toolParts.map((part, index) => {
            const toolName = getToolName(part) ?? "tool";
            const callId = getToolCallId(part);
            return (
              <li key={`${toolName}-${index}`}>
                <button
                  type="button"
                  className="persona-bubble__tool-chip"
                  onClick={() => onOpenArtifact?.(toolName, callId)}
                  title={toolName}
                >
                  <span className="persona-bubble__tool-emoji" aria-hidden="true">
                    {toolEmoji(toolName)}
                  </span>
                  <span className="persona-bubble__tool-label">{toolLabel(toolName)}</span>
                  <ToolStateBadge part={part} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {text ? (
        <div className="persona-bubble__text">
          <Suspense fallback={<p>{text}</p>}>
            <ThreadMarkdown>{text}</ThreadMarkdown>
          </Suspense>
        </div>
      ) : null}

      {role === "assistant" && !busy && text ? (
        <div className="persona-bubble__actions" aria-label="Message actions">
          <button type="button" aria-label="Thumbs up" onClick={() => onAction?.("thumbs-up", message.id)}>
            👍
          </button>
          <button type="button" aria-label="Thumbs down" onClick={() => onAction?.("thumbs-down", message.id)}>
            👎
          </button>
          <button type="button" aria-label="Retry" onClick={() => onAction?.("retry", message.id)}>
            ↩️
          </button>
          <button type="button" aria-label="Copy" onClick={() => onAction?.("copy", message.id)}>
            📋
          </button>
          <button type="button" aria-label="Share" onClick={() => onAction?.("share", message.id)}>
            🔗
          </button>
        </div>
      ) : null}
    </article>
  );
}

function ReasonedBlock({ text }: { text: string }) {
  return (
    <details className="persona-bubble__reasoned">
      <summary>Reasoned ▸</summary>
      <pre>{text}</pre>
    </details>
  );
}

function ToolStateBadge({ part }: { part: UIMessage["parts"][number] }) {
  if (!isToolUIPart(part)) return null;
  const state = String(getToolPartState(part));
  if (state === "result" || state === "output-available") {
    return <span className="persona-bubble__tool-state is-done" aria-label="done">done</span>;
  }
  if (state === "waiting-approval") {
    return <span className="persona-bubble__tool-state is-waiting" aria-label="waiting approval">approval</span>;
  }
  if (state === "denied") {
    return <span className="persona-bubble__tool-state is-denied" aria-label="denied">denied</span>;
  }
  return <span className="persona-bubble__tool-state is-running" aria-label="running">…</span>;
}

function toolEmoji(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("web") || lower.includes("search") || lower.includes("browse")) return "🌐";
  if (lower.includes("doc") || lower.includes("write") || lower.includes("edit")) return "📄";
  if (lower.includes("browser") || lower.includes("session")) return "🖥️";
  if (lower.includes("image") || lower.includes("picture")) return "🖼️";
  if (lower.includes("code") || lower.includes("script")) return "💻";
  if (lower.includes("email") || lower.includes("message")) return "✉️";
  if (lower.includes("memory") || lower.includes("recall")) return "🧠";
  if (lower.includes("goal")) return "🎯";
  return "🔧";
}

function toolLabel(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("websearch") || (lower.includes("web") && lower.includes("search"))) return "web search";
  if (lower.includes("document") || lower.includes("doc")) return "document updated";
  if (lower.includes("browser")) return "browser session";
  if (lower.includes("image")) return "image generated";
  if (lower.includes("code")) return "code run";
  if (lower.includes("memory")) return "memory lookup";
  if (lower.includes("goal")) return "goal updated";
  // Humanize snake/camel case.
  return name
    .replace(/^tool_[a-z0-9]+_/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
}

function deriveStatusLine(toolParts: UIMessage["parts"]): string | undefined {
  for (let i = toolParts.length - 1; i >= 0; i -= 1) {
    const part = toolParts[i];
    if (!part || !isToolUIPart(part)) continue;
    const state = String(getToolPartState(part));
    if (state === "output-available" || state === "result" || state === "denied") continue;
    const toolName = getToolName(part) ?? "";
    const input = getToolInput(part);
    const inputText = typeof input === "object" && input
      ? extractFirstStringField(input as Record<string, unknown>)
      : undefined;
    const lower = toolName.toLowerCase();
    const verb = lower.includes("browse")
      ? "Browsing"
      : lower.includes("search")
        ? "Searching"
        : lower.includes("read") || lower.includes("get")
          ? "Reading"
          : "Running";
    if (inputText) return `${verb} ${inputText}…`;
    return `${verb} ${toolLabel(toolName)}…`;
  }
  return undefined;
}

function extractFirstStringField(value: Record<string, unknown>): string | undefined {
  const keys = ["url", "query", "q", "name", "title", "path", "search", "text"];
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  for (const v of Object.values(value)) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function collectVisibleMessages(messages: UIMessage[]): UIMessage[] {
  return messages.filter((message) => {
    const parts = message.parts ?? [];
    if (parts.length === 0) return false;
    if (message.role === "system") return false;
    const hasText = parts.some((part) => isTextUIPart(part) && part.text.trim().length > 0);
    const hasTool = parts.some((part) => isToolUIPart(part));
    const hasReasoning = parts.some((part) => part.type === "reasoning");
    return hasText || hasTool || hasReasoning;
  });
}

// Exported helpers for unit tests.
export const __test = {
  toolEmoji,
  toolLabel,
  deriveStatusLine,
  collectVisibleMessages
};
