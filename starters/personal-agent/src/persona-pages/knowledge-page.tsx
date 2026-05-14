/**
 * Knowledge page — URLs + uploaded files the agent should always
 * have context on.
 *
 * Two tabs:
 *   - URLs: title / description / tags + an Add URL form
 *   - Files: drag-drop area + tag input, with a list of attachments
 *
 * Search field at the top runs against /knowledge/search; falls back
 * to client-side filtering of the loaded list when no agent URL is
 * configured.
 *
 * The page does not own ingestion — it posts to /knowledge and trusts
 * the agent to embed the entry into shared memory before responding.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent
} from "react";

export type KnowledgeKind = "url" | "file";

export interface KnowledgeView {
  id: string;
  kind: KnowledgeKind;
  title: string;
  subtitle?: string;
  tags: string[];
  addedAt: string;
  size?: number;
  mimeType?: string;
  href?: string;
}

export interface KnowledgePageProps {
  agentBaseUrl?: string | null;
  fixtures?: KnowledgeView[];
}

const fixtureKnowledge: KnowledgeView[] = [
  {
    id: "fix-1",
    kind: "url",
    title: "Cloudflare Agents docs",
    subtitle: "Reference for the orchestrator + sub-agent surface.",
    tags: ["cloudflare", "agents", "reference"],
    addedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
    href: "https://developers.cloudflare.com/agents/"
  },
  {
    id: "fix-2",
    kind: "url",
    title: "Persona product spec",
    subtitle: "The internal UX brief the Persona shell is built against.",
    tags: ["persona", "ux", "internal"],
    addedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    href: "https://github.com/NeoFlux-Holdings/openthink2/blob/main/README.md"
  },
  {
    id: "fix-3",
    kind: "file",
    title: "q3-board-deck.pdf",
    subtitle: "Slides from the Q3 board readout.",
    tags: ["board", "q3"],
    addedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
    size: 2_481_032,
    mimeType: "application/pdf"
  }
];

function formatBytes(bytes: number | undefined): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return "—";
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

type Tab = "urls" | "files";

export function KnowledgePage(props: KnowledgePageProps) {
  const [tab, setTab] = useState<Tab>("urls");
  const [items, setItems] = useState<KnowledgeView[]>(props.fixtures ?? fixtureKnowledge);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  // URL-add form
  const [newUrl, setNewUrl] = useState("");
  const [newUrlTitle, setNewUrlTitle] = useState("");
  const [newUrlTags, setNewUrlTags] = useState("");

  // File drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const dropRef = useRef<HTMLLabelElement | null>(null);

  // Initial fetch
  useEffect(() => {
    if (!props.agentBaseUrl) return;
    let cancelled = false;
    fetch(`${props.agentBaseUrl}/knowledge`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { entries: KnowledgeView[] };
        if (!cancelled) {
          setItems(body.entries ?? []);
          setIsLive(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [props.agentBaseUrl]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = items.filter((i) => (tab === "urls" ? i.kind === "url" : i.kind === "file"));
    if (!q) return base;
    return base.filter((i) => {
      const haystack = [i.title, i.subtitle ?? "", i.tags.join(" ")].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query, tab]);

  const onSubmitUrl = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedUrl = newUrl.trim();
      if (!trimmedUrl) return;
      try {
        new URL(trimmedUrl);
      } catch {
        setError("Invalid URL");
        return;
      }
      const tags = newUrlTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const localEntry: KnowledgeView = {
        id: `local-${Date.now()}`,
        kind: "url",
        title: newUrlTitle.trim() || new URL(trimmedUrl).hostname,
        tags,
        addedAt: new Date().toISOString(),
        href: trimmedUrl
      };

      setBusy(true);
      setError(null);
      try {
        if (props.agentBaseUrl) {
          const res = await fetch(`${props.agentBaseUrl}/knowledge/urls`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: trimmedUrl, title: localEntry.title, tags })
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const created = (await res.json()) as KnowledgeView;
          setItems((prev) => [{ ...created, kind: "url" }, ...prev]);
        } else {
          setItems((prev) => [localEntry, ...prev]);
        }
        setNewUrl("");
        setNewUrlTitle("");
        setNewUrlTags("");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [newUrl, newUrlTitle, newUrlTags, props.agentBaseUrl]
  );

  const onRemove = useCallback(
    async (entry: KnowledgeView) => {
      setBusy(true);
      setError(null);
      try {
        if (props.agentBaseUrl) {
          const path = entry.kind === "url" ? "urls" : "files";
          await fetch(`${props.agentBaseUrl}/knowledge/${path}/${encodeURIComponent(entry.id)}`, {
            method: "DELETE"
          });
        }
        setItems((prev) => prev.filter((i) => i.id !== entry.id));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [props.agentBaseUrl]
  );

  const onDrop = useCallback(
    async (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length === 0) return;
      setBusy(true);
      setError(null);
      try {
        for (const file of files) {
          const view: KnowledgeView = {
            id: `local-${Date.now()}-${file.name}`,
            kind: "file",
            title: file.name,
            tags: [],
            addedAt: new Date().toISOString(),
            size: file.size,
            mimeType: file.type
          };
          if (props.agentBaseUrl) {
            const form = new FormData();
            form.append("file", file);
            const res = await fetch(`${props.agentBaseUrl}/knowledge/files`, {
              method: "POST",
              body: form
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const created = (await res.json()) as KnowledgeView;
            setItems((prev) => [{ ...created, kind: "file" }, ...prev]);
          } else {
            setItems((prev) => [view, ...prev]);
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [props.agentBaseUrl]
  );

  const onSelectFiles = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (files.length === 0) return;
      const fakeEvent = {
        preventDefault: () => {},
        dataTransfer: { files: event.target.files } as DataTransfer
      } as unknown as DragEvent<HTMLLabelElement>;
      await onDrop(fakeEvent);
      event.target.value = "";
    },
    [onDrop]
  );

  return (
    <section className="persona-knowledge" aria-label="Knowledge">
      <header className="persona-knowledge__header">
        <h2>Knowledge</h2>
        <p>URLs and files the agent should always have context on. Embedded into shared memory on save.</p>
        {!isLive && !error && <span className="persona-knowledge__badge">Demo data</span>}
        {error && (
          <p className="persona-knowledge__error" role="alert">
            {error}
          </p>
        )}
      </header>

      <div className="persona-knowledge__tabs" role="tablist">
        {(["urls", "files"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`persona-knowledge__tab${tab === id ? " is-active" : ""}`}
          >
            {id === "urls" ? "URLs" : "Files"}
            <span className="persona-knowledge__tab-count">
              {items.filter((i) => (id === "urls" ? i.kind === "url" : i.kind === "file")).length}
            </span>
          </button>
        ))}
      </div>

      <input
        type="search"
        className="persona-knowledge__search"
        placeholder="Search your knowledge…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search knowledge"
      />

      {tab === "urls" ? (
        <form className="persona-knowledge__add-url" onSubmit={onSubmitUrl}>
          <input
            type="url"
            required
            placeholder="https://example.com/article"
            value={newUrl}
            onChange={(event) => setNewUrl(event.target.value)}
            aria-label="URL"
          />
          <input
            type="text"
            placeholder="Title (optional)"
            value={newUrlTitle}
            onChange={(event) => setNewUrlTitle(event.target.value)}
            aria-label="Title"
          />
          <input
            type="text"
            placeholder="tags, comma-separated"
            value={newUrlTags}
            onChange={(event) => setNewUrlTags(event.target.value)}
            aria-label="Tags"
          />
          <button type="submit" disabled={busy || !newUrl.trim()}>
            Save
          </button>
        </form>
      ) : (
        <label
          ref={dropRef}
          className={`persona-knowledge__drop${isDragOver ? " is-over" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={onDrop}
        >
          <input type="file" multiple onChange={onSelectFiles} hidden />
          <span>
            <strong>Drop files here</strong> or click to upload
          </span>
          <small>
            Text, markdown, PDF, JSON, images. We summarize on ingest and add to shared memory.
          </small>
        </label>
      )}

      <ol className="persona-knowledge__list">
        {filtered.length === 0 ? (
          <li className="persona-knowledge__empty">No entries match.</li>
        ) : (
          filtered.map((entry) => (
            <li key={entry.id} className="persona-knowledge__entry" data-kind={entry.kind}>
              <div className="persona-knowledge__entry-icon" aria-hidden="true">
                {entry.kind === "url" ? "🔗" : "📄"}
              </div>
              <div className="persona-knowledge__entry-body">
                {entry.href ? (
                  <a href={entry.href} target="_blank" rel="noopener noreferrer">
                    <strong>{entry.title}</strong>
                  </a>
                ) : (
                  <strong>{entry.title}</strong>
                )}
                {entry.subtitle && <small>{entry.subtitle}</small>}
                <div className="persona-knowledge__entry-meta">
                  {entry.tags.map((t) => (
                    <span key={t} className="persona-knowledge__tag">
                      {t}
                    </span>
                  ))}
                  <span>·</span>
                  <span>{formatRelative(entry.addedAt)}</span>
                  {entry.kind === "file" && (
                    <>
                      <span>·</span>
                      <span>{formatBytes(entry.size)}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="persona-knowledge__remove"
                onClick={() => onRemove(entry)}
                aria-label={`Remove ${entry.title}`}
                disabled={busy}
              >
                ✕
              </button>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}
