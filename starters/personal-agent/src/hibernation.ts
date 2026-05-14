/**
 * Hibernation helpers for the openthink2 orchestrator.
 *
 * Cloudflare's WebSocket Hibernation API lets a Durable Object sleep
 * while clients stay connected — billable GB-s pauses, and a single
 * incoming frame wakes the DO. The CF Agents SDK turns this on by
 * default; openthink2 just needs to keep per-connection metadata
 * intact across hibernation cycles.
 *
 * The pattern is:
 *   1. When a client connects, call `attachConnectionMetadata` with
 *      the workspace + thread + voice settings the connection needs.
 *      The metadata lands inside the WebSocket via `serializeAttachment`
 *      so CF persists it for us.
 *   2. After hibernation wakeup, `readConnectionMetadata(ws)` returns
 *      the same object without touching DO storage. The orchestrator
 *      uses it to short-circuit the bootstrap path on hot reconnects.
 *
 * Reference:
 *   https://developers.cloudflare.com/durable-objects/best-practices/websockets/
 *   https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/
 */

export interface ConnectionMetadata {
  workspaceId: string;
  threadId?: string;
  ownerEmail?: string;
  /** When voice is active for this socket, store the pipeline tuning
   *  so wakeups don't trample user-tuned values. */
  voice?: {
    silenceThreshold: number;
    silenceDurationMs: number;
    interruptThreshold: number;
    interruptChunks: number;
  };
  /** Free-form bag — agents may stash whatever they need (last
   *  message id, model override) provided it's JSON-serialisable. */
  extras?: Record<string, unknown>;
  attachedAt: string;
}

/** Subset of the CF WebSocket API we need. Keeping the shape narrow
 *  so this module typechecks before `@cloudflare/workers-types` is
 *  installed in the consumer. */
export interface HibernatableWebSocket {
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}

/** Attach metadata to a WebSocket so it survives hibernation. */
export function attachConnectionMetadata(
  ws: HibernatableWebSocket,
  metadata: Omit<ConnectionMetadata, "attachedAt">
): ConnectionMetadata {
  const stamped: ConnectionMetadata = {
    ...metadata,
    attachedAt: new Date().toISOString()
  };
  ws.serializeAttachment(stamped);
  return stamped;
}

/** Read the previously-attached metadata, or `null` if the socket has
 *  never been tagged. */
export function readConnectionMetadata(ws: HibernatableWebSocket): ConnectionMetadata | null {
  const raw = ws.deserializeAttachment();
  if (!raw || typeof raw !== "object") return null;
  const meta = raw as Partial<ConnectionMetadata>;
  if (typeof meta.workspaceId !== "string" || typeof meta.attachedAt !== "string") return null;
  return meta as ConnectionMetadata;
}

/** Convenience: merge a patch into the existing metadata and reserialize.
 *  Used when the orchestrator wants to update e.g. the active threadId
 *  during a long-lived connection without recomputing from scratch. */
export function patchConnectionMetadata(
  ws: HibernatableWebSocket,
  patch: Partial<Omit<ConnectionMetadata, "attachedAt">>
): ConnectionMetadata {
  const current = readConnectionMetadata(ws);
  const next: ConnectionMetadata = {
    workspaceId: current?.workspaceId ?? (patch.workspaceId ?? "default"),
    attachedAt: new Date().toISOString()
  };
  const threadId = patch.threadId ?? current?.threadId;
  if (threadId) next.threadId = threadId;
  const ownerEmail = patch.ownerEmail ?? current?.ownerEmail;
  if (ownerEmail) next.ownerEmail = ownerEmail;
  const voice = patch.voice ?? current?.voice;
  if (voice) next.voice = voice;
  const extras = patch.extras ?? current?.extras;
  if (extras) next.extras = { ...(current?.extras ?? {}), ...(patch.extras ?? {}) };
  ws.serializeAttachment(next);
  return next;
}

/** Indicator: returns true when the runtime supports the Hibernation
 *  API. Falls back to false in environments (jsdom, node) that don't
 *  expose `serializeAttachment` on the WebSocket prototype. */
export function supportsHibernation(ws: unknown): ws is HibernatableWebSocket {
  return Boolean(
    ws &&
      typeof ws === "object" &&
      "serializeAttachment" in (ws as Record<string, unknown>) &&
      "deserializeAttachment" in (ws as Record<string, unknown>)
  );
}
