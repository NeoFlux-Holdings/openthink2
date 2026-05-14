/**
 * Framework-agnostic Invocations routes for the deployed agent.
 *
 * Routes the Persona Invocations page consumes:
 *   - GET  /invocations               → { invocations, summary }
 *   - GET  /invocations/:id           → single invocation detail
 *   - GET  /invocations/summary       → aggregate counters
 *   - POST /invocations               → record one (agents call this on
 *                                       turn completion; we don't
 *                                       require it — the evolve loop
 *                                       writes via the same store)
 *
 * Data is whatever lives at `ws:traces` (the same key the evolve
 * loop already writes). We project each `RunTrace` into an
 * `InvocationRecord` so the UI has cost / model / duration without
 * the page needing to know the evolve internals.
 */

import type { RunTrace } from "./evolve";

export interface InvocationRecord {
  id: string;
  threadId: string;
  agentId: string;
  agentName?: string;
  model?: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  toolsUsed: string[];
  toolCallCount: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  outcome: RunTrace["outcome"];
  userFeedback?: RunTrace["userFeedback"];
  goal: string;
}

export interface InvocationSummary {
  totalRuns: number;
  successCount: number;
  partialCount: number;
  failureCount: number;
  abandonedCount: number;
  averageDurationMs: number | null;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  /** Successful runs / total runs, in [0,1]; null when total=0. */
  successRate: number | null;
}

export interface InvocationsStore {
  list(options?: { limit?: number; cursor?: string }): Promise<InvocationRecord[]>;
  get(id: string): Promise<InvocationRecord | null>;
  record(input: Omit<InvocationRecord, "id">): Promise<InvocationRecord>;
  clear(): Promise<void>;
}

interface DoStorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>>;
}

const STORAGE_KEY = "ws:invocations";

export function createDoInvocationsStore(storage: DoStorageLike): InvocationsStore {
  return {
    async list(options = {}) {
      const all = (await storage.get<InvocationRecord[]>(STORAGE_KEY)) ?? [];
      return all.slice(-Math.max(1, options.limit ?? 100)).reverse();
    },
    async get(id) {
      const all = (await storage.get<InvocationRecord[]>(STORAGE_KEY)) ?? [];
      return all.find((r) => r.id === id) ?? null;
    },
    async record(input) {
      const all = (await storage.get<InvocationRecord[]>(STORAGE_KEY)) ?? [];
      const record: InvocationRecord = {
        ...input,
        id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      };
      const next = [...all, record].slice(-1000);
      await storage.put(STORAGE_KEY, next);
      return record;
    },
    async clear() {
      await storage.delete(STORAGE_KEY);
    }
  };
}

/** Project RunTraces (written by recordTraceAndMaybeEvolve) into
 *  InvocationRecords so the page can read both sources uniformly. */
export function projectTracesToInvocations(traces: RunTrace[]): InvocationRecord[] {
  return traces.map((t) => {
    const record: InvocationRecord = {
      id: t.id,
      threadId: t.threadId,
      agentId: t.agentId,
      startedAt: t.startedAt,
      toolsUsed: t.toolsUsed,
      toolCallCount: t.toolsUsed.length,
      outcome: t.outcome,
      goal: t.goal
    };
    if (t.endedAt) {
      record.endedAt = t.endedAt;
      record.durationMs = Math.max(0, new Date(t.endedAt).getTime() - new Date(t.startedAt).getTime());
    }
    if (t.userFeedback) record.userFeedback = t.userFeedback;
    return record;
  });
}

export function summarize(records: InvocationRecord[]): InvocationSummary {
  if (records.length === 0) {
    return {
      totalRuns: 0,
      successCount: 0,
      partialCount: 0,
      failureCount: 0,
      abandonedCount: 0,
      averageDurationMs: null,
      totalCostUsd: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      successRate: null
    };
  }
  let success = 0;
  let partial = 0;
  let failure = 0;
  let abandoned = 0;
  let durationSum = 0;
  let durationCount = 0;
  let costSum = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const r of records) {
    if (r.outcome === "success") success += 1;
    else if (r.outcome === "partial") partial += 1;
    else if (r.outcome === "failure") failure += 1;
    else abandoned += 1;
    if (typeof r.durationMs === "number") {
      durationSum += r.durationMs;
      durationCount += 1;
    }
    if (typeof r.costUsd === "number") costSum += r.costUsd;
    if (typeof r.inputTokens === "number") inputTokens += r.inputTokens;
    if (typeof r.outputTokens === "number") outputTokens += r.outputTokens;
  }
  return {
    totalRuns: records.length,
    successCount: success,
    partialCount: partial,
    failureCount: failure,
    abandonedCount: abandoned,
    averageDurationMs: durationCount > 0 ? durationSum / durationCount : null,
    totalCostUsd: costSum,
    totalInputTokens: inputTokens,
    totalOutputTokens: outputTokens,
    successRate: records.length > 0 ? success / records.length : null
  };
}

export interface InvocationsRouteOptions {
  store: InvocationsStore;
}

/** Returns a router function — null for non-matching requests. */
export function createInvocationsRoute(
  options: InvocationsRouteOptions
): (request: Request) => Promise<Response | null> {
  return async (request) => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/invocations")) return null;

    if (request.method === "GET" && url.pathname === "/invocations") {
      const limit = Number.parseInt(url.searchParams.get("limit") ?? "100", 10);
      const records = await options.store.list({ limit });
      return Response.json({ invocations: records, summary: summarize(records) });
    }
    if (request.method === "GET" && url.pathname === "/invocations/summary") {
      const records = await options.store.list({ limit: 1000 });
      return Response.json(summarize(records));
    }
    const match = /^\/invocations\/([^/]+)$/.exec(url.pathname);
    if (request.method === "GET" && match) {
      const record = await options.store.get(decodeURIComponent(match[1]!));
      if (!record) return new Response("Not found", { status: 404 });
      return Response.json(record);
    }
    if (request.method === "POST" && url.pathname === "/invocations") {
      const body = (await request.json().catch(() => null)) as Omit<InvocationRecord, "id"> | null;
      if (!body) return new Response("Invalid body", { status: 400 });
      const record = await options.store.record(body);
      return Response.json(record, { status: 201 });
    }
    return null;
  };
}
