/**
 * Persona Composer — sticky chat composer for the Persona shell.
 *
 * Matches the Home screen composer surface (mode toggle, attachments,
 * send button), but is built to live in a constrained slot — no
 * headline or templates, and the textarea auto-expands to a smaller max
 * height so the thread feed above stays visible while the user types.
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
import type { PersonaComposeMode } from "./persona-home";

export interface PersonaComposerProps {
  defaultMode?: PersonaComposeMode | undefined;
  disabled?: boolean | undefined;
  busy?: boolean | undefined;
  placeholder?: string | undefined;
  costEstimate?: string | undefined;
  showCostEstimate?: boolean | undefined;
  onSubmit: (text: string, mode: PersonaComposeMode, attachments: File[]) => void;
  onStop?: (() => void) | undefined;
}

export function PersonaComposer(props: PersonaComposerProps): ReactNode {
  const {
    defaultMode = "auto",
    disabled = false,
    busy = false,
    placeholder = "Reply, or paste a URL, doc, or screenshot…",
    costEstimate,
    showCostEstimate = false,
    onSubmit,
    onStop
  } = props;

  const [text, setText] = useState("");
  const [mode, setMode] = useState<PersonaComposeMode>(defaultMode);
  const [planActive, setPlanActive] = useState(defaultMode === "plan");
  const [attachments, setAttachments] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const target = Math.min(Math.max(el.scrollHeight, 44), 180);
    el.style.height = `${target}px`;
  }, [text]);

  const submit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled || busy) return;
    onSubmit(trimmed, planActive ? "plan" : mode, attachments);
    setText("");
    setAttachments([]);
  }, [text, disabled, busy, mode, planActive, attachments, onSubmit]);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      submit();
      return;
    }
    if (!event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files ? Array.from(event.target.files) : [];
    if (next.length > 0) setAttachments((prev) => [...prev, ...next]);
    event.target.value = "";
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form
      className="persona-composer"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {attachments.length > 0 && (
        <ul className="persona-composer__attachments" aria-label="Attached files">
          {attachments.map((file, index) => (
            <li key={`${file.name}-${index}`}>
              <span>{file.name}</span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => removeAttachment(index)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="persona-composer__row">
        <button
          type="button"
          className="persona-composer__attach"
          onClick={() => fileRef.current?.click()}
          aria-label="Attach files"
          disabled={disabled}
        >
          +
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          onChange={onFileChange}
          style={{ display: "none" }}
        />

        <textarea
          ref={textareaRef}
          className="persona-composer__textarea"
          value={text}
          placeholder={placeholder}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Compose a reply"
          rows={1}
          disabled={disabled}
        />

        <div className="persona-composer__controls">
          <button
            type="button"
            className={`persona-composer__plan${planActive ? " is-active" : ""}`}
            aria-pressed={planActive}
            onClick={() => {
              setPlanActive((prev) => !prev);
              setMode((prev) => (prev === "plan" ? "auto" : "plan"));
            }}
            title="Plan first before acting"
          >
            🧩 Plan
          </button>

          {showCostEstimate && costEstimate ? (
            <span className="persona-composer__cost" aria-label="Estimated cost">
              {costEstimate}
            </span>
          ) : null}

          {busy && onStop ? (
            <button
              type="button"
              className="persona-composer__send is-stop"
              onClick={onStop}
              aria-label="Stop generation"
            >
              ◼
            </button>
          ) : (
            <button
              type="submit"
              className="persona-composer__send"
              disabled={disabled || busy || text.trim().length === 0}
              aria-label="Send (⌘/Ctrl+Enter)"
              title="⌘/Ctrl+Enter to send"
            >
              ↑
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
