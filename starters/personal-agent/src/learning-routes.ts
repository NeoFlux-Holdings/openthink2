/**
 * Learning routes — exposes the self-evolve suggestion feed and
 * decision endpoints used by the platform's Learning page.
 *
 * The orchestrator's evolve loop persists suggestions to DO storage
 * under the key `ws:suggestions` (see
 * `orchestrator/agent.ts:recordTraceAndMaybeEvolve`). These routes are
 * the read/write surface over that key:
 *
 *   - GET  /learning/pending    → list pending suggestions
 *   - POST /learning/decisions  → accept / reject / edit a suggestion
 *   - GET  /learning/summary    → counts by status
 *
 * The router is kept narrow (`get` / `post`) so this file does not
 * bind to a specific HTTP framework. Callers wire it into whatever
 * router / `fetch` table the agent worker uses.
 */
import type { EvolveSuggestion } from "./evolve/types";

/** Storage shape provided by the agent's DO ctx. Identical to the
 * interface used in `orchestrator/agent.ts` — kept duplicated here so
 * this module has no cross-dependency on the orchestrator. */
export interface DoStorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>>;
}

/** Minimal request shape — a subset of the Web `Request` interface so
 * the routes work with both `fetch`-style handlers and tests that
 * don't bother constructing a full `Request`. */
export interface LearningRouteRequest {
  json(): Promise<unknown>;
}

/** Minimal handler signature. Returns either a body (auto-JSON) or
 * a `{ status, body }` envelope so handlers can express 4xx errors
 * without depending on a Response factory. */
export type LearningHandlerResult =
  | { status?: number; body: unknown }
  | { status: number; body?: unknown };

export type LearningHandler = (request: LearningRouteRequest) => Promise<LearningHandlerResult>;

/** The shape `registerLearningRoutes` expects of the host router.
 * Two methods (`get` / `post`) keep this module independent of a
 * specific framework. The host adapter is responsible for translating
 * `LearningHandlerResult` into a real `Response`. */
export interface LearningRouter {
  get(path: string, handler: LearningHandler): void;
  post(path: string, handler: LearningHandler): void;
}

/** Storage key the orchestrator's evolve loop writes suggestions to. */
export const SUGGESTIONS_KEY = "ws:suggestions";

export type DecisionAction = "accept" | "reject" | "edit";

export interface DecisionRequest {
  id: string;
  decision: DecisionAction;
  editedFields?: Record<string, unknown>;
}

export interface LearningSummary {
  pending: number;
  accepted: number;
  rejected: number;
  edited: number;
}

/**
 * Wire the learning routes onto a router. The host is responsible for
 * adapting the returned `LearningHandlerResult` into a real
 * `Response`; see `respondLearning` for a convenience converter.
 */
export function registerLearningRoutes(router: LearningRouter, store: DoStorageLike): void {
  router.get("/learning/pending", async () => {
    const suggestions = await readSuggestions(store);
    const pending = suggestions.filter((s) => s.status === "pending");
    return { body: { suggestions: pending } };
  });

  router.get("/learning/summary", async () => {
    const summary = await summarizeSuggestions(store);
    return { body: summary };
  });

  router.post("/learning/decisions", async (request) => {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return { status: 400, body: { error: "Request body must be JSON." } };
    }

    const decision = parseDecisionRequest(payload);
    if (!decision.ok) {
      return { status: 400, body: { error: decision.error } };
    }

    const suggestions = await readSuggestions(store);
    const index = suggestions.findIndex((s) => s.id === decision.value.id);
    if (index < 0) {
      return { status: 404, body: { error: "Suggestion not found." } };
    }

    const updated = applyDecision(suggestions[index] as EvolveSuggestion, decision.value);
    const nextSuggestions = [...suggestions];
    nextSuggestions[index] = updated;
    await store.put(SUGGESTIONS_KEY, nextSuggestions);
    return { body: { suggestion: updated } };
  });
}

/**
 * Convenience adapter: invoke the matching handler from `router` and
 * return a `Response`. Useful when callers want to translate a
 * `fetch`-style URL into a learning route hit without instantiating a
 * full router.
 *
 * The returned `Response` is `null` when no learning route matches;
 * the host can then fall through to its other routes.
 */
export async function respondLearning(
  request: Request,
  store: DoStorageLike
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/learning/")) return null;

  // We use a tiny in-line router so this helper has the same surface
  // as `registerLearningRoutes` — the host can choose either path.
  const handlers: { method: string; path: string; handler: LearningHandler }[] = [];
  const router: LearningRouter = {
    get(path, handler) {
      handlers.push({ method: "GET", path, handler });
    },
    post(path, handler) {
      handlers.push({ method: "POST", path, handler });
    }
  };
  registerLearningRoutes(router, store);

  const match = handlers.find((h) => h.method === request.method && h.path === url.pathname);
  if (!match) return null;

  const result = await match.handler({
    json: () => request.json()
  });
  return resultToResponse(result);
}

/** Translate a `LearningHandlerResult` into a fetch `Response`. */
export function resultToResponse(result: LearningHandlerResult): Response {
  const status = result.status ?? 200;
  if (result.body === undefined) {
    return new Response(null, { status });
  }
  return Response.json(result.body, { status });
}

async function readSuggestions(store: DoStorageLike): Promise<EvolveSuggestion[]> {
  const stored = await store.get<EvolveSuggestion[]>(SUGGESTIONS_KEY);
  return Array.isArray(stored) ? stored : [];
}

async function summarizeSuggestions(store: DoStorageLike): Promise<LearningSummary> {
  const suggestions = await readSuggestions(store);
  const summary: LearningSummary = { pending: 0, accepted: 0, rejected: 0, edited: 0 };
  for (const sug of suggestions) {
    const meta = (sug as { decisionAction?: DecisionAction }).decisionAction;
    if (sug.status === "rejected") summary.rejected++;
    else if (sug.status === "applied" && meta === "edit") summary.edited++;
    else if (sug.status === "applied") summary.accepted++;
    else summary.pending++;
  }
  return summary;
}

function applyDecision(
  current: EvolveSuggestion,
  decision: DecisionRequest
): EvolveSuggestion {
  if (decision.decision === "reject") {
    return { ...current, status: "rejected" } as EvolveSuggestion;
  }

  // For "accept" and "edit" the suggestion becomes applied. The
  // recorded `decisionAction` lets the summary distinguish "edited"
  // from "accepted" without changing the published EvolveSuggestion
  // union (which is shared with the evolve loop).
  const base = decision.decision === "edit" && decision.editedFields
    ? mergeEditedFields(current, decision.editedFields)
    : current;
  return { ...base, status: "applied", decisionAction: decision.decision } as unknown as EvolveSuggestion;
}

function mergeEditedFields(
  current: EvolveSuggestion,
  edits: Record<string, unknown>
): EvolveSuggestion {
  // Whitelist of fields the API allows the user to overwrite. Keeps
  // structural fields (`id`, `kind`, `evidenceTraceIds`, `status`)
  // immutable through this endpoint.
  const allowed: Record<EvolveSuggestion["kind"], readonly string[]> = {
    skill: ["name", "summary", "systemPromptFragment", "toolBindings", "confidence"],
    rubric: ["name", "criteria", "confidence"],
    prompt: ["scope", "before", "after", "rationale", "confidence"]
  };
  const allowedForKind = allowed[current.kind];
  const merged: Record<string, unknown> = { ...current };
  for (const key of allowedForKind) {
    if (key in edits) merged[key] = edits[key];
  }
  return merged as unknown as EvolveSuggestion;
}

function parseDecisionRequest(
  payload: unknown
): { ok: true; value: DecisionRequest } | { ok: false; error: string } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const record = payload as Record<string, unknown>;
  const id = record.id;
  const decision = record.decision;
  if (typeof id !== "string" || !id) {
    return { ok: false, error: "`id` must be a non-empty string." };
  }
  if (decision !== "accept" && decision !== "reject" && decision !== "edit") {
    return { ok: false, error: "`decision` must be 'accept' | 'reject' | 'edit'." };
  }
  const editedFields = record.editedFields;
  if (editedFields !== undefined && (editedFields === null || typeof editedFields !== "object" || Array.isArray(editedFields))) {
    return { ok: false, error: "`editedFields` must be an object when present." };
  }
  const value: DecisionRequest = { id, decision };
  if (editedFields !== undefined) {
    value.editedFields = editedFields as Record<string, unknown>;
  }
  return { ok: true, value };
}
