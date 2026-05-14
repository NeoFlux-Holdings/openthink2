/**
 * Framework-agnostic Knowledge routes for the deployed agent.
 *
 * Knowledge is a workspace-scoped list of URL bookmarks and uploaded
 * files. Both surfaces feed the shared Vectorize memory
 * (see shared-memory.ts) so the orchestrator can recall them at
 * generation time without the page having to round-trip the vectors.
 *
 * Routes:
 *   - GET    /knowledge                        → list (urls + files)
 *   - POST   /knowledge/urls                   → add a URL bookmark
 *   - DELETE /knowledge/urls/:id               → remove
 *   - POST   /knowledge/files                  → upload (multipart/form)
 *   - DELETE /knowledge/files/:id              → remove
 *   - GET    /knowledge/search?q=…             → ranked text search
 *
 * The route handler is structural (returns `Response | null` for
 * non-matches) so it composes with the other agent routes
 * (learning-routes, document-stream).
 */

export interface UrlBookmark {
  id: string;
  kind: "url";
  url: string;
  title: string;
  description?: string;
  tags: string[];
  addedAt: string;
}

export interface FileAttachment {
  id: string;
  kind: "file";
  name: string;
  mimeType: string;
  sizeBytes: number;
  tags: string[];
  /** Stored body location — either an R2 key or a data URL for
   *  embed-on-ingest flows. The route handler doesn't read the body
   *  itself, just records the pointer. */
  storage: { type: "r2"; key: string } | { type: "inline"; preview: string };
  /** Extracted text summary, used for search + embedding ingest. */
  summary?: string;
  addedAt: string;
}

export type KnowledgeEntry = UrlBookmark | FileAttachment;

export interface KnowledgeStore {
  list(): Promise<KnowledgeEntry[]>;
  get(id: string): Promise<KnowledgeEntry | null>;
  put(entry: KnowledgeEntry): Promise<KnowledgeEntry>;
  remove(id: string): Promise<void>;
  search(query: string, limit?: number): Promise<KnowledgeEntry[]>;
}

interface DoStorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>>;
}

const KNOWLEDGE_PREFIX = "knowledge:";

export function createDoKnowledgeStore(storage: DoStorageLike): KnowledgeStore {
  return {
    async list() {
      const map = await storage.list<KnowledgeEntry>({ prefix: KNOWLEDGE_PREFIX });
      return Array.from(map.values()).sort((a, b) =>
        new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      );
    },
    async get(id) {
      return (await storage.get<KnowledgeEntry>(KNOWLEDGE_PREFIX + id)) ?? null;
    },
    async put(entry) {
      await storage.put(KNOWLEDGE_PREFIX + entry.id, entry);
      return entry;
    },
    async remove(id) {
      await storage.delete(KNOWLEDGE_PREFIX + id);
    },
    async search(query, limit = 24) {
      const all = await this.list();
      const q = query.trim().toLowerCase();
      if (!q) return all.slice(0, limit);
      const scored = all
        .map((entry) => ({ entry, score: scoreEntry(entry, q) }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s) => s.entry);
      return scored;
    }
  };
}

function scoreEntry(entry: KnowledgeEntry, query: string): number {
  const targets: string[] = [];
  if (entry.kind === "url") {
    targets.push(entry.title.toLowerCase(), entry.url.toLowerCase());
    if (entry.description) targets.push(entry.description.toLowerCase());
  } else {
    targets.push(entry.name.toLowerCase());
    if (entry.summary) targets.push(entry.summary.toLowerCase());
  }
  targets.push(...entry.tags.map((t) => t.toLowerCase()));

  let score = 0;
  for (const target of targets) {
    if (target === query) score += 4;
    else if (target.startsWith(query)) score += 2;
    else if (target.includes(query)) score += 1;
  }
  return score;
}

/** Memory-backed Vectorize ingest hook. Optional — when present, every
 *  put() also writes an embedding to the shared workspace memory. */
export interface KnowledgeIngestHook {
  upsert(entry: KnowledgeEntry, text: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export function wrapWithIngest(store: KnowledgeStore, ingest: KnowledgeIngestHook): KnowledgeStore {
  return {
    list: () => store.list(),
    get: (id) => store.get(id),
    async put(entry) {
      const saved = await store.put(entry);
      const text = (() => {
        if (entry.kind === "url") {
          return [entry.title, entry.description, ...entry.tags].filter(Boolean).join("\n");
        }
        return [entry.name, entry.summary, ...entry.tags].filter(Boolean).join("\n");
      })();
      try {
        await ingest.upsert(saved, text);
      } catch {
        // Ingest is best-effort; the bookmark stays even if embedding fails.
      }
      return saved;
    },
    async remove(id) {
      await store.remove(id);
      try {
        await ingest.remove(id);
      } catch {
        // ignore
      }
    },
    search: (query, limit) => store.search(query, limit)
  };
}

export interface KnowledgeRouteOptions {
  store: KnowledgeStore;
  uploadHandler?: (file: { name: string; mimeType: string; sizeBytes: number; arrayBuffer: ArrayBuffer }) => Promise<{ type: "r2"; key: string } | { type: "inline"; preview: string }>;
}

export function createKnowledgeRoute(
  options: KnowledgeRouteOptions
): (request: Request) => Promise<Response | null> {
  return async (request) => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/knowledge")) return null;

    if (request.method === "GET" && url.pathname === "/knowledge") {
      const entries = await options.store.list();
      return Response.json({ entries });
    }
    if (request.method === "GET" && url.pathname === "/knowledge/search") {
      const q = url.searchParams.get("q") ?? "";
      const limit = Number.parseInt(url.searchParams.get("limit") ?? "24", 10);
      const entries = await options.store.search(q, limit);
      return Response.json({ entries });
    }
    if (request.method === "POST" && url.pathname === "/knowledge/urls") {
      const body = (await request.json().catch(() => null)) as Partial<UrlBookmark> | null;
      if (!body?.url) return new Response("`url` is required", { status: 400 });
      try {
        new URL(body.url);
      } catch {
        return new Response("Invalid URL", { status: 400 });
      }
      const bookmark: UrlBookmark = {
        id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: "url",
        url: body.url,
        title: body.title?.trim() || new URL(body.url).hostname,
        tags: Array.isArray(body.tags) ? body.tags : [],
        addedAt: new Date().toISOString()
      };
      if (body.description) bookmark.description = body.description;
      const saved = await options.store.put(bookmark);
      return Response.json(saved, { status: 201 });
    }
    const urlDelete = /^\/knowledge\/urls\/([^/]+)$/.exec(url.pathname);
    if (request.method === "DELETE" && urlDelete) {
      await options.store.remove(decodeURIComponent(urlDelete[1]!));
      return new Response(null, { status: 204 });
    }
    if (request.method === "POST" && url.pathname === "/knowledge/files") {
      const form = await request.formData().catch(() => null);
      const file = form?.get("file");
      if (!file || !(file instanceof File)) return new Response("`file` is required", { status: 400 });
      const buffer = await file.arrayBuffer();
      const storage = options.uploadHandler
        ? await options.uploadHandler({
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            arrayBuffer: buffer
          })
        : ({ type: "inline" as const, preview: await previewFromBuffer(buffer, file.type) });
      const attachment: FileAttachment = {
        id: `at-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: "file",
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        tags: ((form?.get("tags") as string | null) ?? "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        storage,
        addedAt: new Date().toISOString()
      };
      const summary = (form?.get("summary") as string | null)?.trim();
      if (summary) attachment.summary = summary;
      const saved = await options.store.put(attachment);
      return Response.json(saved, { status: 201 });
    }
    const fileDelete = /^\/knowledge\/files\/([^/]+)$/.exec(url.pathname);
    if (request.method === "DELETE" && fileDelete) {
      await options.store.remove(decodeURIComponent(fileDelete[1]!));
      return new Response(null, { status: 204 });
    }
    return null;
  };
}

async function previewFromBuffer(buffer: ArrayBuffer, mimeType: string): Promise<string> {
  if (mimeType.startsWith("text/") || mimeType.includes("json") || mimeType.includes("xml")) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer.slice(0, 4096));
    return text;
  }
  return `[${buffer.byteLength.toLocaleString()} bytes ${mimeType || "binary"}]`;
}
