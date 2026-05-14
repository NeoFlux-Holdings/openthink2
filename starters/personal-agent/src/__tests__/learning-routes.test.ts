import { describe, expect, it } from "vitest";
import type { EvolveSuggestion, SkillSuggestion } from "../evolve/types";
import {
  registerLearningRoutes,
  respondLearning,
  SUGGESTIONS_KEY,
  type DoStorageLike,
  type LearningHandler,
  type LearningHandlerResult
} from "../learning-routes";

function makeStorage(seed?: Map<string, unknown>): DoStorageLike {
  const map = seed ?? new Map<string, unknown>();
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

interface RegisteredRoute {
  method: "GET" | "POST";
  path: string;
  handler: LearningHandler;
}

function captureRoutes(store: DoStorageLike): RegisteredRoute[] {
  const routes: RegisteredRoute[] = [];
  registerLearningRoutes(
    {
      get(path, handler) {
        routes.push({ method: "GET", path, handler });
      },
      post(path, handler) {
        routes.push({ method: "POST", path, handler });
      }
    },
    store
  );
  return routes;
}

function invoke(routes: RegisteredRoute[], method: "GET" | "POST", path: string, body?: unknown) {
  const match = routes.find((r) => r.method === method && r.path === path);
  if (!match) throw new Error(`No route registered for ${method} ${path}`);
  return match.handler({
    async json() {
      if (body === undefined) throw new Error("No body");
      return body;
    }
  });
}

function makeSkill(id: string, status: SkillSuggestion["status"] = "pending"): SkillSuggestion {
  return {
    id,
    kind: "skill",
    name: `Skill ${id}`,
    summary: "Reusable skill",
    systemPromptFragment: "Do the thing.",
    toolBindings: ["tool.a"],
    evidenceTraceIds: ["t-1"],
    confidence: 0.7,
    status
  };
}

describe("registerLearningRoutes — GET /learning/pending", () => {
  it("returns suggestions with status='pending' from DO storage", async () => {
    const storage = makeStorage(
      new Map<string, unknown>([
        [
          SUGGESTIONS_KEY,
          [makeSkill("p-1"), makeSkill("p-2", "applied"), makeSkill("p-3", "rejected")] as EvolveSuggestion[]
        ]
      ])
    );
    const routes = captureRoutes(storage);
    const result = (await invoke(routes, "GET", "/learning/pending")) as LearningHandlerResult;
    const body = result.body as { suggestions: EvolveSuggestion[] };
    expect(body.suggestions.map((s) => s.id)).toEqual(["p-1"]);
  });

  it("returns an empty array when the storage key is missing", async () => {
    const storage = makeStorage();
    const routes = captureRoutes(storage);
    const result = (await invoke(routes, "GET", "/learning/pending")) as LearningHandlerResult;
    expect(result.body).toEqual({ suggestions: [] });
  });
});

describe("registerLearningRoutes — GET /learning/summary", () => {
  it("counts suggestions by status, distinguishing accepted vs edited", async () => {
    const storage = makeStorage(
      new Map<string, unknown>([
        [
          SUGGESTIONS_KEY,
          [
            makeSkill("s-1"),
            makeSkill("s-2"),
            { ...makeSkill("s-3", "applied"), decisionAction: "accept" },
            { ...makeSkill("s-4", "applied"), decisionAction: "edit" },
            makeSkill("s-5", "rejected")
          ] as EvolveSuggestion[]
        ]
      ])
    );
    const routes = captureRoutes(storage);
    const result = (await invoke(routes, "GET", "/learning/summary")) as LearningHandlerResult;
    expect(result.body).toEqual({ pending: 2, accepted: 1, rejected: 1, edited: 1 });
  });
});

describe("registerLearningRoutes — POST /learning/decisions", () => {
  it("marks a suggestion applied on accept and returns the updated record", async () => {
    const storage = makeStorage(
      new Map<string, unknown>([[SUGGESTIONS_KEY, [makeSkill("d-1")] as EvolveSuggestion[]]])
    );
    const routes = captureRoutes(storage);
    const result = (await invoke(routes, "POST", "/learning/decisions", {
      id: "d-1",
      decision: "accept"
    })) as LearningHandlerResult;

    const body = result.body as { suggestion: EvolveSuggestion };
    expect(body.suggestion.status).toBe("applied");
    const persisted = (await storage.get(SUGGESTIONS_KEY)) as EvolveSuggestion[];
    expect(persisted[0]?.status).toBe("applied");
  });

  it("marks a suggestion rejected on reject", async () => {
    const storage = makeStorage(
      new Map<string, unknown>([[SUGGESTIONS_KEY, [makeSkill("d-2")] as EvolveSuggestion[]]])
    );
    const routes = captureRoutes(storage);
    const result = (await invoke(routes, "POST", "/learning/decisions", {
      id: "d-2",
      decision: "reject"
    })) as LearningHandlerResult;
    const body = result.body as { suggestion: EvolveSuggestion };
    expect(body.suggestion.status).toBe("rejected");
  });

  it("merges whitelisted edits on edit", async () => {
    const storage = makeStorage(
      new Map<string, unknown>([[SUGGESTIONS_KEY, [makeSkill("d-3")] as EvolveSuggestion[]]])
    );
    const routes = captureRoutes(storage);
    const result = (await invoke(routes, "POST", "/learning/decisions", {
      id: "d-3",
      decision: "edit",
      editedFields: {
        summary: "Sharper summary",
        confidence: 0.9,
        // not whitelisted — must be ignored
        evidenceTraceIds: ["forged"]
      }
    })) as LearningHandlerResult;
    const body = result.body as { suggestion: SkillSuggestion };
    expect(body.suggestion.status).toBe("applied");
    expect(body.suggestion.summary).toBe("Sharper summary");
    expect(body.suggestion.confidence).toBe(0.9);
    expect(body.suggestion.evidenceTraceIds).toEqual(["t-1"]);
  });

  it("returns 404 when the suggestion id is unknown", async () => {
    const storage = makeStorage(
      new Map<string, unknown>([[SUGGESTIONS_KEY, [makeSkill("d-4")] as EvolveSuggestion[]]])
    );
    const routes = captureRoutes(storage);
    const result = (await invoke(routes, "POST", "/learning/decisions", {
      id: "missing",
      decision: "accept"
    })) as LearningHandlerResult;
    expect(result.status).toBe(404);
  });

  it("returns 400 when the body is malformed", async () => {
    const storage = makeStorage(
      new Map<string, unknown>([[SUGGESTIONS_KEY, [makeSkill("d-5")] as EvolveSuggestion[]]])
    );
    const routes = captureRoutes(storage);
    const result = (await invoke(routes, "POST", "/learning/decisions", {
      id: "d-5",
      decision: "yolo"
    })) as LearningHandlerResult;
    expect(result.status).toBe(400);
  });
});

describe("respondLearning fetch adapter", () => {
  it("translates a GET /learning/pending request into a JSON Response", async () => {
    const storage = makeStorage(
      new Map<string, unknown>([[SUGGESTIONS_KEY, [makeSkill("r-1")] as EvolveSuggestion[]]])
    );
    const req = new Request("https://agent.example.com/learning/pending", { method: "GET" });
    const res = await respondLearning(req, storage);
    expect(res).not.toBeNull();
    const body = (await res!.json()) as { suggestions: EvolveSuggestion[] };
    expect(body.suggestions[0]?.id).toBe("r-1");
  });

  it("returns null for non-learning paths", async () => {
    const storage = makeStorage();
    const req = new Request("https://agent.example.com/somewhere-else", { method: "GET" });
    expect(await respondLearning(req, storage)).toBeNull();
  });

  it("translates a POST decision into a 200 Response with the updated record", async () => {
    const storage = makeStorage(
      new Map<string, unknown>([[SUGGESTIONS_KEY, [makeSkill("r-2")] as EvolveSuggestion[]]])
    );
    const req = new Request("https://agent.example.com/learning/decisions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "r-2", decision: "accept" })
    });
    const res = await respondLearning(req, storage);
    expect(res?.status).toBe(200);
    const body = (await res!.json()) as { suggestion: EvolveSuggestion };
    expect(body.suggestion.status).toBe("applied");
  });
});
