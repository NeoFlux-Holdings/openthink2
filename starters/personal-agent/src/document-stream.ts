/**
 * Framework-agnostic SSE document-stream endpoint.
 *
 * Each deployed agent that owns documents (or any model-generated
 * artifact) can expose a `/documents/:id/stream` route. The Persona
 * document viewer subscribes via EventSource and re-renders through
 * Streamdown as chunks arrive.
 *
 * Contract:
 *   - The producer is an async generator that yields string chunks.
 *     Yield resolution = SSE frame emit, so the server doesn't have
 *     to buffer the full document.
 *   - When the generator returns, the route emits an `event: done`
 *     frame and closes the stream.
 *   - When the generator throws, the route emits an `event: error`
 *     frame with the message and closes.
 *
 * The route handler is exposed two ways:
 *   - `respondDocumentStream(request, producer)` — returns a Response
 *     ready to send back. Use from any fetch-style handler.
 *   - `createDocumentStreamRoute(getProducer)` — returns a router
 *     function `(request) => Promise<Response | null>` that matches
 *     `GET /documents/:id/stream` and dispatches to the producer.
 */

export type DocumentChunkProducer = AsyncGenerator<string, void, unknown>;

export interface DocumentStreamMetadata {
  /** Optional event ID prefix. The route adds an incrementing suffix. */
  eventIdPrefix?: string;
  /** Heartbeat interval. Defaults to 15 s. Set to 0 to disable. */
  heartbeatMs?: number;
}

const encoder = new TextEncoder();

function encodeFrame(data: string, options: { event?: string; id?: string } = {}): Uint8Array {
  const lines: string[] = [];
  if (options.event) lines.push(`event: ${options.event}`);
  if (options.id) lines.push(`id: ${options.id}`);
  for (const line of data.split(/\r?\n/)) {
    lines.push(`data: ${line}`);
  }
  lines.push("");
  lines.push("");
  return encoder.encode(lines.join("\n"));
}

/**
 * Build a Response that streams the producer's chunks as SSE frames.
 * Closes on producer return / throw and respects request abort signals.
 */
export function respondDocumentStream(
  request: Request,
  producer: DocumentChunkProducer,
  metadata: DocumentStreamMetadata = {}
): Response {
  const heartbeatMs = metadata.heartbeatMs ?? 15_000;
  const prefix = metadata.eventIdPrefix ?? "doc";
  let counter = 0;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const abortSignal = request.signal;
      const close = () => {
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      if (heartbeatMs > 0) {
        heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(":keepalive\n\n"));
          } catch {
            close();
          }
        }, heartbeatMs);
      }

      abortSignal.addEventListener("abort", () => {
        producer.return?.();
        close();
      });

      try {
        for await (const chunk of producer) {
          if (abortSignal.aborted) break;
          counter += 1;
          controller.enqueue(encodeFrame(chunk, { id: `${prefix}-${counter}` }));
        }
        controller.enqueue(encodeFrame("", { event: "done", id: `${prefix}-done` }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        controller.enqueue(encodeFrame(message, { event: "error", id: `${prefix}-error` }));
      } finally {
        close();
      }
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}

export interface DocumentStreamRouteContext {
  documentId: string;
  request: Request;
}

/**
 * Build a router that matches `GET /documents/<id>/stream` and
 * dispatches to the supplied producer factory. Returns `null` for
 * non-matching requests so the caller can compose with other routes.
 */
export function createDocumentStreamRoute(
  getProducer: (ctx: DocumentStreamRouteContext) => DocumentChunkProducer | Promise<DocumentChunkProducer>,
  defaults: DocumentStreamMetadata = {}
): (request: Request) => Promise<Response | null> {
  return async (request) => {
    if (request.method !== "GET") return null;
    const url = new URL(request.url);
    const match = /^\/documents\/([^/]+)\/stream\/?$/.exec(url.pathname);
    if (!match) return null;
    const documentId = decodeURIComponent(match[1]!);
    const producer = await getProducer({ documentId, request });
    return respondDocumentStream(request, producer, defaults);
  };
}

/**
 * Tiny helper to wrap a precomputed string into a chunked producer
 * (splits on paragraphs). Useful for tests and for rendering an
 * already-finished document through the same streaming code path.
 */
export async function* chunksFromString(content: string, chunkSize = 64): DocumentChunkProducer {
  for (let i = 0; i < content.length; i += chunkSize) {
    yield content.slice(i, i + chunkSize);
  }
}
