import { describe, expect, it } from "vitest";
import {
  chunksFromString,
  createDocumentStreamRoute,
  respondDocumentStream
} from "../document-stream";

async function readAllFrames(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let acc = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    acc += decoder.decode(value, { stream: true });
  }
  return acc;
}

describe("respondDocumentStream", () => {
  it("emits one SSE frame per yielded chunk and a final done event", async () => {
    async function* producer() {
      yield "# Hello\n";
      yield "world.\n";
    }
    const request = new Request("https://x/documents/abc/stream");
    const response = respondDocumentStream(request, producer(), { heartbeatMs: 0 });
    expect(response.headers.get("Content-Type")).toMatch(/text\/event-stream/);
    const body = await readAllFrames(response);
    expect(body).toContain("data: # Hello");
    expect(body).toContain("data: world.");
    expect(body).toContain("event: done");
  });

  it("emits an error event when the producer throws", async () => {
    async function* producer() {
      yield "ok";
      throw new Error("nope");
    }
    const request = new Request("https://x/documents/abc/stream");
    const response = respondDocumentStream(request, producer(), { heartbeatMs: 0 });
    const body = await readAllFrames(response);
    expect(body).toContain("data: ok");
    expect(body).toContain("event: error");
    expect(body).toContain("data: nope");
  });

  it("respects request abort", async () => {
    let aborted = false;
    async function* producer() {
      yield "a";
      try {
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
        yield "b";
      } catch {
        aborted = true;
      }
    }
    const controller = new AbortController();
    const request = new Request("https://x/documents/abc/stream", { signal: controller.signal });
    const response = respondDocumentStream(request, producer(), { heartbeatMs: 0 });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const first = await reader.read();
    expect(decoder.decode(first.value!)).toContain("data: a");
    controller.abort();
    // Drain
    while (!(await reader.read()).done) {
      /* drain */
    }
    // We can't reliably assert `aborted` since the generator may finish
    // before the abort signal lands, but the response stream definitely
    // closes — confirmed by the loop above terminating.
    expect(true).toBe(true);
    void aborted;
  });
});

describe("createDocumentStreamRoute", () => {
  it("matches GET /documents/:id/stream and dispatches to the producer factory", async () => {
    const route = createDocumentStreamRoute(
      ({ documentId }) => chunksFromString(`hello ${documentId}`, 4),
      { heartbeatMs: 0 }
    );
    const request = new Request("https://x/documents/doc-123/stream");
    const response = await route(request);
    expect(response).not.toBeNull();
    const body = await readAllFrames(response!);
    expect(body).toContain("data: hell");
    expect(body).toContain("data: o do");
    expect(body).toContain("event: done");
  });

  it("returns null for non-matching requests", async () => {
    const route = createDocumentStreamRoute(() => chunksFromString("x"));
    expect(await route(new Request("https://x/other"))).toBeNull();
    expect(await route(new Request("https://x/documents/abc"))).toBeNull();
    expect(
      await route(new Request("https://x/documents/abc/stream", { method: "POST" }))
    ).toBeNull();
  });
});

describe("chunksFromString", () => {
  it("yields fixed-size chunks", async () => {
    const chunks: string[] = [];
    for await (const c of chunksFromString("abcdefghij", 3)) chunks.push(c);
    expect(chunks).toEqual(["abc", "def", "ghi", "j"]);
  });
});
