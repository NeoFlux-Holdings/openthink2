/**
 * Persona Home — the "What do you need done?" entry surface.
 *
 * This is the empty-state for the center column of the Persona shell.
 * It shows a single big textarea, a row of quick-action chips, a small
 * Auto / Plan first / Train mode toggle, an attachment button, and
 * below the fold a Recent threads grid and a Start-from-a-template
 * carousel.
 *
 * The component is presentational: it surfaces a submit callback that
 * the surrounding Persona shell wires into `useAgentChat.sendMessage`,
 * so it can be unit-tested without React DOM.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode
} from "react";

export type PersonaComposeMode = "auto" | "plan" | "train";

export interface PersonaQuickAction {
  id: string;
  label: string;
  prompt: string;
  emoji: string;
}

export interface PersonaTemplate {
  id: string;
  label: string;
  description: string;
  prompt: string;
  emoji: string;
  agentColor?: string;
}

export interface PersonaRecentThread {
  id: string;
  title: string;
  agentName: string;
  agentColor: string;
  lastUpdated: string;
}

export interface PersonaHomeProps {
  headline?: string | undefined;
  recentThreads: PersonaRecentThread[];
  quickActions?: PersonaQuickAction[] | undefined;
  templates?: PersonaTemplate[] | undefined;
  defaultMode?: PersonaComposeMode | undefined;
  disabled?: boolean | undefined;
  /** localStorage key for textarea draft persistence. When set, the
   *  textarea is rehydrated on mount and writes mirror to the same
   *  key, so navigating to Library / Skills / Settings and returning
   *  keeps the draft. Cleared on successful submit. */
  draftStorageKey?: string | undefined;
  onSubmit: (prompt: string, mode: PersonaComposeMode, attachments: File[]) => void;
  onSelectThread?: ((id: string) => void) | undefined;
}

export const DEFAULT_QUICK_ACTIONS: PersonaQuickAction[] = [
  {
    id: "write",
    emoji: "📝",
    label: "Write something",
    prompt: "Help me draft "
  },
  {
    id: "research",
    emoji: "🔍",
    label: "Research a topic",
    prompt: "Research the following topic and produce a structured brief: "
  },
  {
    id: "image",
    emoji: "🖼️",
    label: "Generate images",
    prompt: "Generate an image of "
  },
  {
    id: "browse",
    emoji: "🌐",
    label: "Browse & summarize",
    prompt: "Browse to the URL below and summarize the key points: "
  },
  {
    id: "email",
    emoji: "✉️",
    label: "Draft an email",
    prompt: "Draft an email about "
  },
  {
    id: "more",
    emoji: "⋯",
    label: "More",
    prompt: ""
  }
];

export const DEFAULT_TEMPLATES: PersonaTemplate[] = [
  {
    id: "coder",
    emoji: "💻",
    label: "Coder",
    description: "Pair-programs with code search, edits, and tests.",
    prompt: "Help me ship a small feature. Start by asking what to build.",
    agentColor: "#3a5bd7"
  },
  {
    id: "researcher",
    emoji: "🔬",
    label: "Researcher",
    description: "Multi-source web research with a written brief.",
    prompt: "Be my research analyst. Ask what to investigate.",
    agentColor: "#176f49"
  },
  {
    id: "writer",
    emoji: "✍️",
    label: "Writer",
    description: "Drafts, edits, and tightens long-form prose.",
    prompt: "Be my writing partner. Ask what we're drafting and the tone.",
    agentColor: "#b84d12"
  },
  {
    id: "browser",
    emoji: "🧭",
    label: "Browser",
    description: "Browses real websites and acts inside them.",
    prompt: "Browse the web for me. Ask which site to visit and what to do.",
    agentColor: "#7c3aed"
  },
  {
    id: "messenger",
    emoji: "💬",
    label: "Messenger",
    description: "Drafts emails, DMs, and replies in your voice.",
    prompt: "Help me write a message. Ask the recipient, tone, and goal.",
    agentColor: "#0ea5e9"
  },
  {
    id: "planner",
    emoji: "📋",
    label: "Planner",
    description: "Breaks goals into steps and tracks them.",
    prompt: "Plan a project with me. Ask the goal, deadline, and constraints.",
    agentColor: "#e11d48"
  }
];

const MODES: ReadonlyArray<{ id: PersonaComposeMode; label: string; hint: string }> = [
  { id: "auto", label: "Auto", hint: "Default — agent decides plan vs act." },
  { id: "plan", label: "Plan first", hint: "Show a plan before acting." },
  { id: "train", label: "Train", hint: "Save this as a reusable plan." }
];

export function PersonaHome(props: PersonaHomeProps): ReactNode {
  const {
    headline = "What do you need done?",
    recentThreads,
    quickActions = DEFAULT_QUICK_ACTIONS,
    templates = DEFAULT_TEMPLATES,
    defaultMode = "auto",
    disabled = false,
    draftStorageKey,
    onSubmit,
    onSelectThread
  } = props;

  const [prompt, setPrompt] = useState<string>(() => {
    if (!draftStorageKey || typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(draftStorageKey) ?? "";
    } catch {
      return "";
    }
  });
  const [mode, setMode] = useState<PersonaComposeMode>(defaultMode);
  const [attachments, setAttachments] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Persist draft across navigations so jumping to Library / Settings
  // and back doesn't lose what the user was typing.
  useEffect(() => {
    if (!draftStorageKey || typeof window === "undefined") return;
    try {
      if (prompt) window.localStorage.setItem(draftStorageKey, prompt);
      else window.localStorage.removeItem(draftStorageKey);
    } catch {
      // ignore
    }
  }, [prompt, draftStorageKey]);

  // Auto-grow the textarea up to a sensible max height.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const target = Math.min(Math.max(el.scrollHeight, 64), 240);
    el.style.height = `${target}px`;
  }, [prompt]);

  const submit = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed, mode, attachments);
    setPrompt("");
    setAttachments([]);
    if (draftStorageKey && typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(draftStorageKey);
      } catch {
        // ignore
      }
    }
  }, [prompt, mode, attachments, disabled, onSubmit, draftStorageKey]);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    if (event.metaKey || event.ctrlKey || !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  function pickQuickAction(action: PersonaQuickAction) {
    setPrompt((current) => {
      if (!action.prompt) return current;
      const base = current.trim();
      const join = base.length === 0 ? "" : `${base}\n\n`;
      return `${join}${action.prompt}`;
    });
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function pickTemplate(template: PersonaTemplate) {
    setPrompt(template.prompt);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length > 0) setAttachments((prev) => [...prev, ...files]);
    event.target.value = "";
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <section className="persona-home" aria-label="New task">
      <header className="persona-home__hero">
        <h1>{headline}</h1>
      </header>

      <form
        className="persona-home__form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="persona-home__input-card">
          <textarea
            ref={textareaRef}
            className="persona-home__textarea"
            placeholder="Type a task, or paste a URL, idea, or screenshot…"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Task description"
            disabled={disabled}
            rows={2}
          />

          <div className="persona-home__input-row">
            <div className="persona-home__attach">
              <button
                type="button"
                className="persona-home__attach-btn"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach files"
                disabled={disabled}
              >
                +
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={onFileChange}
                style={{ display: "none" }}
              />
              {attachments.length > 0 && (
                <ul className="persona-home__attachments" aria-label="Attached files">
                  {attachments.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="persona-home__attachment">
                      <span>{file.name}</span>
                      <button
                        type="button"
                        className="persona-home__attachment-remove"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => removeAttachment(index)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="persona-home__mode" role="group" aria-label="Compose mode">
              {MODES.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={`persona-home__mode-btn${mode === option.id ? " is-active" : ""}`}
                  onClick={() => setMode(option.id)}
                  aria-pressed={mode === option.id}
                  title={option.hint}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <button
              type="submit"
              className="persona-home__send"
              disabled={disabled || prompt.trim().length === 0}
              aria-label="Send task"
            >
              ↑
            </button>
          </div>
        </div>

        <div className="persona-home__chips" aria-label="Quick actions">
          {quickActions.map((action) => (
            <button
              type="button"
              key={action.id}
              className="persona-home__chip"
              onClick={() => pickQuickAction(action)}
              disabled={disabled && action.prompt.length > 0}
            >
              <span className="persona-home__chip-emoji" aria-hidden="true">
                {action.emoji}
              </span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </form>

      {recentThreads.length > 0 && (
        <section className="persona-home__section" aria-labelledby="persona-home-recent">
          <header className="persona-home__section-header">
            <h2 id="persona-home-recent">Recent threads</h2>
          </header>
          <ul className="persona-home__recent-grid">
            {recentThreads.slice(0, 4).map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  className="persona-home__recent-card"
                  onClick={() => onSelectThread?.(thread.id)}
                >
                  <span className="persona-home__recent-dot" style={{ background: thread.agentColor }} />
                  <strong className="persona-home__recent-title">{thread.title}</strong>
                  <small className="persona-home__recent-meta">
                    <span>{thread.agentName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{thread.lastUpdated}</span>
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="persona-home__section" aria-labelledby="persona-home-templates">
        <header className="persona-home__section-header">
          <h2 id="persona-home-templates">Start from a template</h2>
          <p className="persona-home__section-hint">
            Curated starter agents with sane defaults — every template is yours to edit.
          </p>
        </header>
        <ul className="persona-home__templates" aria-label="Template carousel">
          {templates.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                className="persona-home__template"
                onClick={() => pickTemplate(template)}
                disabled={disabled}
              >
                <span
                  className="persona-home__template-emoji"
                  aria-hidden="true"
                  style={template.agentColor ? { background: hexWithAlpha(template.agentColor, 0.12) } : undefined}
                >
                  {template.emoji}
                </span>
                <span className="persona-home__template-body">
                  <strong>{template.label}</strong>
                  <small>{template.description}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  // Best-effort tint of the template emoji backdrop; falls back gracefully
  // for non-#rrggbb inputs (we just return the input string as-is).
  if (!hex.startsWith("#") || (hex.length !== 7 && hex.length !== 4)) return hex;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  } else {
    r = parseInt(hex.slice(1, 2).repeat(2), 16);
    g = parseInt(hex.slice(2, 3).repeat(2), 16);
    b = parseInt(hex.slice(3, 4).repeat(2), 16);
  }
  if ([r, g, b].some((channel) => Number.isNaN(channel))) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
