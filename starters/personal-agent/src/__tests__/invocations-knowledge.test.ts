import { describe, expect, it } from "vitest";
import {
  createDoInvocationsStore,
  createInvocationsRoute,
  projectTracesToInvocations,
  summarize
} from "../invocations-routes";
import {
  createDoKnowledgeStore,
  createKnowledgeRoute,
  wrapWithIngest,
  type KnowledgeEntry
} from "../knowledge-routes";
import type { RunTrace } from "../evolve";

function makeStorage() {
  const map = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      return map.get(key) as T | undefined;
    },
    async put<T>(key: string, value: T) {
      map.set(key, value);
    },
    async delete(key: string) {
      return map.delete(key);
    },
    async list<T>(options?: { prefix?: string }) {
      const out = new Map<string, T>();
      for (const [k, v] of map) {
        if (!options?.prefix || k.startsWith(options.prefix)) out.set(k, v as T);
      }
      return out;
    }
  };
}

describe("invocations store + summary", () => {
  it("records and lists in reverse-chronological order", async () => {
    const store = createDoInvocationsStore(makeStorage());
    await store.record({
      threadId: "t1",
      agentId: "a",
      startedAt: "2026-05-01T00:00:00Z",
      toolsUsed: ["web.search"],
      toolCallCount: 1,
      outcome: "success",
      goal: "first"
    });
    await store.record({
      threadId: "t2",
      agentId: "a",
      startedAt: "2026-05-02T00:00:00Z",
      toolsUsed: [],
      toolCallCount: 0,
      outcome: "failure",
      goal: "second"
    });
    const list = await store.list();
    expect(list.map((r) => r.goal)).toEqual(["second", "first"]);
  });

  it("summarize aggregates outcomes, duration, cost, tokens", () => {
    const records = [
      {
        id: "r1",
        threadId: "t",
        agentId: "a",
        startedAt: "now",
        toolsUsed: [],
        toolCallCount: 0,
        outcome: "success" as const,
        goal: "g",
        durationMs: 1000,
        costUsd: 0.02,
        inputTokens: 100,
        outputTokens: 50
      },
      {
        id: "r2",
        threadId: "t",
        agentId: "a",
        startedAt: "now",
        toolsUsed: [],
        toolCallCount: 0,
        outcome: "failure" as const,
        goal: "g",
        durationMs: 2000,
        costUsd: 0.04
      }
    ];
    const s = summarize(records);
    expect(s.totalRuns).toBe(2);
    expect(s.successRate).toBe(0.5);
    expect(s.averageDurationMs).toBe(1500);
    expect(s.totalCostUsd).toBeCloseTo(0.06);
    expect(s.totalInputTokens).toBe(100);
    expect(s.totalOutputTokens).toBe(50);
  });

  it("projects RunTraces with computed durations", () => {
    const traces: RunTrace[] = [
      {
        id: "t1",
        threadId: "th",
        agentId: "ag",
        startedAt: "2026-05-01T00:00:00Z",
        endedAt: "2026-05-01T00:00:05Z",
        goal: "ship",
        toolsUsed: ["a"],
        outcome: "success",
        userFeedback: "thumbs-up"
      }
    ];
    const projected = projectTracesToInvocations(traces);
    expect(projected[0]!.durationMs).toBe(5000);
    expect(projected[0]!.userFeedback).toBe("thumbs-up");
  });

  it("route serves list / detail / summary / 404", async () => {
    const store = createDoInvocationsStore(makeStorage());
    const recorded = await store.record({
      threadId: "t",
      agentId: "a",
      startedAt: "now",
      toolsUsed: [],
      toolCallCount: 0,
      outcome: "success",
      goal: "g"
    });
    const route = createInvocationsRoute({ store });

    const list = await route(new Request("https://x/invocations"));
    expect(list).not.toBeNull();
    const body = await list!.json();
    expect(body.invocations).toHaveLength(1);

    const single = await route(new Request(`https://x/invocations/${recorded.id}`));
    expect(single!.status).toBe(200);

    const missing = await route(new Request("https://x/invocations/nope"));
    expect(missing!.status).toBe(404);

    const summary = await route(new Request("https://x/invocations/summary"));
    expect((await summary!.json()).totalRuns).toBe(1);

    const notMatching = await route(new Request("https://x/other"));
    expect(notMatching).toBeNull();
  });

  it("POST /invocations records a row", async () => {
    const store = createDoInvocationsStore(makeStorage());
    const route = createInvocationsRoute({ store });
    const res = await route(
      new Request("https://x/invocations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          threadId: "t",
          agentId: "a",
          startedAt: "now",
          toolsUsed: ["x"],
          toolCallCount: 1,
          outcome: "success",
          goal: "g"
        })
      })
    );
    expect(res!.status).toBe(201);
    expect((await store.list()).length).toBe(1);
  });
});

describe("knowledge store + ranking", () => {
  it("ranks exact tag match higher than partial title", async () => {
    const store = createDoKnowledgeStore(makeStorage());
    await store.put({
      id: "a",
      kind: "url",
      url: "https://example.com/cloudflare",
      title: "Cloudflare workers",
      tags: ["cloudflare", "workers"],
      addedAt: new Date().toISOString()
    });
    await store.put({
      id: "b",
      kind: "url",
      url: "https://example.com/agents",
      title: "Cloudflare agents",
      tags: ["agents"],
      addedAt: new Date().toISOString()
    });
    const hits = await store.search("cloudflare");
    expect(hits[0]!.id).toBe("a"); // wins on tag match
  });

  it("wrapWithIngest forwards put/remove and swallows ingest failures", async () => {
    const base = createDoKnowledgeStore(makeStorage());
    const ingestCalls: { op: string; id: string }[] = [];
    const wrapped = wrapWithIngest(base, {
      async upsert(entry) {
        ingestCalls.push({ op: "upsert", id: entry.id });
        if (entry.id === "fail") throw new Error("nope");
      },
      async remove(id) {
        ingestCalls.push({ op: "remove", id });
      }
    });
    const entry: KnowledgeEntry = {
      id: "ok",
      kind: "url",
      url: "https://example.com",
      title: "ok",
      tags: [],
      addedAt: new Date().toISOString()
    };
    await wrapped.put(entry);
    await wrapped.put({ ...entry, id: "fail" });
    await wrapped.remove("ok");
    expect(ingestCalls).toEqual([
      { op: "upsert", id: "ok" },
      { op: "upsert", id: "fail" },
      { op: "remove", id: "ok" }
    ]);
    expect(await base.list()).toHaveLength(1);
  });

  it("route adds + lists + deletes a URL bookmark", async () => {
    const store = createDoKnowledgeStore(makeStorage());
    const route = createKnowledgeRoute({ store });

    const added = await route(
      new Request("https://x/knowledge/urls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", title: "Example", tags: ["test"] })
      })
    );
    expect(added!.status).toBe(201);
    const bookmark = await added!.json();

    const list = await route(new Request("https://x/knowledge"));
    expect((await list!.json()).entries).toHaveLength(1);

    const removed = await route(
      new Request(`https://x/knowledge/urls/${bookmark.id}`, { method: "DELETE" })
    );
    expect(removed!.status).toBe(204);
    expect((await store.list()).length).toBe(0);
  });

  it("rejects invalid URLs", async () => {
    const store = createDoKnowledgeStore(makeStorage());
    const route = createKnowledgeRoute({ store });
    const res = await route(
      new Request("https://x/knowledge/urls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "not-a-url" })
      })
    );
    expect(res!.status).toBe(400);
  });
});
