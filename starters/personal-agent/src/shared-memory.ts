/**
 * Workspace-scoped shared memory backed by Cloudflare Vectorize.
 *
 * The orchestrator and every child agent in a workspace share a single
 * Vectorize index. Memories are tagged by the writing agent + thread so
 * the orchestrator can scope or expand recall as needed.
 *
 * This module deliberately stays transport-agnostic — pass in any
 * object that satisfies VectorizeIndexLike (the same contract used in
 * @open-think/retrieval) and Workers AI for embeddings.
 */

export interface VectorizeIndexLike {
  insert(vectors: VectorizeVector[]): Promise<unknown>;
  upsert?(vectors: VectorizeVector[]): Promise<unknown>;
  query(
    vector: number[],
    options?: { topK?: number; returnMetadata?: boolean; filter?: Record<string, unknown> }
  ): Promise<VectorizeQueryResult>;
  deleteByIds?(ids: string[]): Promise<unknown>;
}

export interface VectorizeVector {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorizeQueryResult {
  matches: { id: string; score: number; metadata?: Record<string, unknown> }[];
}

export interface SharedMemoryRecord {
  id: string;
  workspaceId: string;
  agentId: string;
  threadId: string | undefined;
  kind: "fact" | "preference" | "context" | "skill-note" | "rubric";
  text: string;
  tags: string[];
  createdAt: string;
}

export interface EmbeddingClient {
  embed(text: string): Promise<number[]>;
}

export interface SharedMemoryStore {
  remember(record: Omit<SharedMemoryRecord, "id" | "createdAt"> & { id?: string }): Promise<SharedMemoryRecord>;
  recall(
    query: string,
    options?: { topK?: number; workspaceId?: string; threadId?: string; kinds?: SharedMemoryRecord["kind"][] }
  ): Promise<{ record: SharedMemoryRecord; score: number }[]>;
  forget(ids: string[]): Promise<void>;
}

export function createSharedMemoryStore(input: {
  vectorize: VectorizeIndexLike;
  embeddings: EmbeddingClient;
  workspaceId: string;
}): SharedMemoryStore {
  const { vectorize, embeddings, workspaceId } = input;
  return {
    async remember(record) {
      const id = record.id ?? crypto.randomUUID();
      const stamped: SharedMemoryRecord = {
        id,
        workspaceId,
        agentId: record.agentId,
        threadId: record.threadId,
        kind: record.kind,
        text: record.text,
        tags: record.tags ?? [],
        createdAt: new Date().toISOString()
      };
      const values = await embeddings.embed(record.text);
      const vector: VectorizeVector = {
        id,
        values,
        metadata: {
          workspaceId,
          agentId: stamped.agentId,
          threadId: stamped.threadId,
          kind: stamped.kind,
          text: stamped.text,
          tags: stamped.tags,
          createdAt: stamped.createdAt
        }
      };
      if (vectorize.upsert) await vectorize.upsert([vector]);
      else await vectorize.insert([vector]);
      return stamped;
    },
    async recall(query, options = {}) {
      const filter: Record<string, unknown> = { workspaceId: options.workspaceId ?? workspaceId };
      if (options.threadId) filter.threadId = options.threadId;
      if (options.kinds && options.kinds.length > 0) filter.kind = { $in: options.kinds };
      const values = await embeddings.embed(query);
      const result = await vectorize.query(values, {
        topK: options.topK ?? 8,
        returnMetadata: true,
        filter
      });
      return result.matches.map((m) => ({
        score: m.score,
        record: {
          id: m.id,
          workspaceId: String(m.metadata?.workspaceId ?? workspaceId),
          agentId: String(m.metadata?.agentId ?? ""),
          threadId: m.metadata?.threadId ? String(m.metadata.threadId) : undefined,
          kind: (m.metadata?.kind as SharedMemoryRecord["kind"]) ?? "context",
          text: String(m.metadata?.text ?? ""),
          tags: Array.isArray(m.metadata?.tags) ? (m.metadata?.tags as string[]) : [],
          createdAt: String(m.metadata?.createdAt ?? new Date().toISOString())
        }
      }));
    },
    async forget(ids) {
      if (!vectorize.deleteByIds) {
        throw new Error("vectorize binding does not support deleteByIds");
      }
      await vectorize.deleteByIds(ids);
    }
  };
}

export function makeWorkersAiEmbedder(ai: {
  run(model: string, input: { text: string | string[] }): Promise<unknown>;
}, model = "@cf/baai/bge-large-en-v1.5"): EmbeddingClient {
  return {
    async embed(text) {
      const result = (await ai.run(model, { text })) as { data?: number[][] };
      if (!result?.data?.[0]) throw new Error(`Workers AI embedding model ${model} returned no data`);
      return result.data[0];
    }
  };
}
