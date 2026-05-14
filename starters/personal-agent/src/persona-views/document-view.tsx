/**
 * Document viewer — renders markdown (or any plain-text content) inside
 * a Streamdown-backed surface with a version dropdown, inline edit
 * toggle, and an optional SSE live-stream mode.
 *
 * Two rendering paths:
 *   - **Static**: pass `data.versions[].content` or `data.content`.
 *     The viewer renders the active version through Streamdown.
 *   - **Streaming**: pass `streamUrl`. The viewer opens an EventSource
 *     and appends each `data:` chunk to a local buffer, re-rendering
 *     progressively. The `done` event closes the stream. Falls back
 *     cleanly when EventSource is unavailable (e.g. SSR / unit tests).
 *
 * Streamdown is loaded lazily so the viewer keeps initial bundle size
 * small and stays SSR/test friendly when the markdown layer is absent.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { DocumentData, DocumentVersion } from "./types";

const MarkdownRenderer = lazy(async () => {
  const mod = await import("streamdown");
  return {
    default: function MarkdownRenderer({ children }: { children: string }) {
      return <mod.Streamdown controls={false}>{children}</mod.Streamdown>;
    }
  };
});

export interface DocumentViewProps {
  data?: DocumentData | undefined;
  title?: string | undefined;
  version?: number | undefined;
  onChange?: ((next: string) => void) | undefined;
  /** SSE endpoint producing live document chunks. When set, the
   *  viewer subscribes via EventSource and renders the streamed
   *  buffer instead of the static content. */
  streamUrl?: string | undefined;
}

function buildVersionList(data: DocumentData | undefined, currentVersion: number | undefined): DocumentVersion[] {
  const versions = data?.versions ?? [];
  if (versions.length > 0) return versions;
  return [
    {
      version: currentVersion ?? 1,
      label: "Current",
      content: data?.content ?? ""
    }
  ];
}

interface StreamState {
  buffer: string;
  status: "idle" | "streaming" | "done" | "error";
  error?: string;
}

/** Subscribe to an SSE endpoint and append chunks to a string buffer.
 *  Handles `data:`, `event: done`, and `event: error` frames. Exposed
 *  for tests through the `eventSourceImpl` injection point. */
export function useDocumentStream(
  streamUrl: string | undefined,
  options: {
    eventSourceImpl?: typeof EventSource;
    onChunk?: (text: string) => void;
  } = {}
): StreamState {
  const [state, setState] = useState<StreamState>({ buffer: "", status: "idle" });
  const onChunkRef = useRef(options.onChunk);
  onChunkRef.current = options.onChunk;

  useEffect(() => {
    if (!streamUrl) {
      setState({ buffer: "", status: "idle" });
      return;
    }
    const Impl = options.eventSourceImpl ?? (typeof EventSource !== "undefined" ? EventSource : undefined);
    if (!Impl) {
      setState({ buffer: "", status: "error", error: "EventSource is not available in this runtime." });
      return;
    }
    setState({ buffer: "", status: "streaming" });
    const source = new Impl(streamUrl);
    source.onmessage = (event) => {
      const chunk = typeof event.data === "string" ? event.data : "";
      setState((prev) => ({ ...prev, buffer: prev.buffer + chunk }));
      onChunkRef.current?.(chunk);
    };
    source.addEventListener("done", () => {
      setState((prev) => ({ ...prev, status: "done" }));
      source.close();
    });
    source.addEventListener("error", () => {
      setState((prev) => ({ ...prev, status: "error", error: "Stream interrupted" }));
      source.close();
    });
    return () => source.close();
  }, [streamUrl, options.eventSourceImpl]);

  return state;
}

export function DocumentView(props: DocumentViewProps) {
  const versions = useMemo(
    () => buildVersionList(props.data, props.version),
    [props.data, props.version]
  );
  const [selectedVersion, setSelectedVersion] = useState<number>(versions[0]?.version ?? 1);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(versions[0]?.content ?? "");

  const stream = useDocumentStream(props.streamUrl);

  const activeContent = useMemo(() => {
    if (stream.status === "streaming" || stream.status === "done") return stream.buffer;
    const match = versions.find((v) => v.version === selectedVersion);
    return match?.content ?? versions[0]?.content ?? "";
  }, [versions, selectedVersion, stream.status, stream.buffer]);

  const onSelectVersion = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = Number.parseInt(event.target.value, 10);
    setSelectedVersion(next);
    setEditing(false);
    setDraft(versions.find((v) => v.version === next)?.content ?? "");
  };

  const onEditToggle = () => {
    if (editing) {
      props.onChange?.(draft);
    } else {
      setDraft(activeContent);
    }
    setEditing((prev) => !prev);
  };

  const isStreaming = stream.status === "streaming";

  return (
    <section className="pv-document" aria-label="Document viewer">
      <header className="pv-document__bar">
        <label className="pv-document__version-label">
          <span>Version</span>
          <select
            value={selectedVersion}
            onChange={onSelectVersion}
            aria-label="Select document version"
            disabled={isStreaming || editing}
          >
            {versions.map((v) => (
              <option key={v.version} value={v.version}>
                v{v.version}
                {v.label ? ` · ${v.label}` : ""}
              </option>
            ))}
          </select>
        </label>
        {isStreaming ? (
          <span className="pv-document__stream-pill" aria-live="polite">
            <span className="pv-document__stream-dot" aria-hidden="true" />
            Streaming…
          </span>
        ) : (
          <button
            type="button"
            className="pv-document__edit-toggle"
            onClick={onEditToggle}
            aria-pressed={editing}
          >
            {editing ? "Save" : "Edit"}
          </button>
        )}
      </header>

      {editing ? (
        <textarea
          className="pv-document__editor"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          spellCheck
          aria-label="Edit document"
        />
      ) : (
        <div className="pv-document__body" aria-label="Document content">
          {activeContent ? (
            <Suspense fallback={<pre className="pv-document__fallback">{activeContent}</pre>}>
              <MarkdownRenderer>{activeContent}</MarkdownRenderer>
            </Suspense>
          ) : (
            <p className="pv-document__empty">(empty)</p>
          )}
        </div>
      )}

      {stream.status === "error" && (
        <p className="pv-document__error" role="alert">
          {stream.error ?? "Stream error"}
        </p>
      )}
    </section>
  );
}

export default DocumentView;
