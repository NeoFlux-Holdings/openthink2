import { describe, expect, it } from "vitest";
import type { AgentDescriptor } from "../orchestrator";
import {
  buildOrchestratorSystemPrompt,
  gateToolCall,
  handleSlashCommand,
  initOrchestrator,
  recordTraceAndMaybeEvolve
} from "../orchestrator/agent";
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

function makeAgent(env: Record<string, unknown> = {}) {
  const storage = makeStorage();
  const mcpCalls: { name: string; binding: unknown }[] = [];
  return {
    agent: {
      env,
      ctx: { storage },
      addMcpServer: (name: string, binding: unknown) => {
        mcpCalls.push({ name, binding });
      }
    },
    storage,
    mcpCalls
  };
}

describe("initOrchestrator", () => {
  it("bootstraps a workspace, preloads the Cloudflare skill pack, wires children over RPC", async () => {
    const { agent, storage, mcpCalls } = makeAgent({
      OPEN_THINK_WORKSPACE_ID: "ws-1",
      OPEN_THINK_OWNER_EMAIL: "ada@example.com",
      AGENT_CODER: { kind: "fake-binding" }
    });

    const coder: AgentDescriptor = {
      id: "child-coder",
      workspaceId: "ws-1",
      role: "coder",
      name: "coder",
      description: "writes code",
      bindingName: "AGENT_CODER",
      enabledSkillIds: [],
      pinned: false,
      createdAt: new Date().toISOString()
    };

    const runtime = await initOrchestrator({ agent, children: [coder] });
    const ws = await runtime.store.getWorkspace();
    expect(ws.id).toBe("ws-1");
    expect(ws.ownerEmail).toBe("ada@example.com");

    const skills = await runtime.skills.list();
    expect(skills.some((s) => s.id === "cf.workers-best-practices")).toBe(true);

    expect(mcpCalls).toEqual([{ name: "coder", binding: { kind: "fake-binding" } }]);
    expect(await storage.get("ws:descriptor")).toBeTruthy();
  });

  it("skips child wiring when a binding is missing", async () => {
    const { agent, mcpCalls } = makeAgent({ OPEN_THINK_WORKSPACE_ID: "ws-2" });
    const ghost: AgentDescriptor = {
      id: "child-ghost",
      workspaceId: "ws-2",
      role: "researcher",
      name: "ghost",
      description: "",
      bindingName: "MISSING_BINDING",
      enabledSkillIds: [],
      pinned: false,
      createdAt: new Date().toISOString()
    };
    await initOrchestrator({ agent, children: [ghost] });
    expect(mcpCalls).toHaveLength(0);
  });

  it("honors the legacy tool-approval policy from env", async () => {
    const { agent } = makeAgent({ OPEN_THINK_TOOL_APPROVAL_POLICY: "allow-all" });
    const runtime = await initOrchestrator({ agent, children: [] });
    const config = await runtime.approval.get();
    expect(config.mode).toBe("full-auto");
  });
});

describe("handleSlashCommand", () => {
  it("routes /goal commands through the goals store", async () => {
    const { agent } = makeAgent();
    const runtime = await initOrchestrator({ agent, children: [] });

    const set = await handleSlashCommand("/goal Ship release", runtime);
    expect(set.handled).toBe(true);
    expect(set.message).toContain("Goal set");

    const list = await handleSlashCommand("/goal", runtime);
    expect(list.handled).toBe(true);
    expect(list.message).toContain("Ship release");
  });

  it("passes other input through untouched", async () => {
    const { agent } = makeAgent();
    const runtime = await initOrchestrator({ agent, children: [] });
    const result = await handleSlashCommand("hello agent", runtime);
    expect(result.handled).toBe(false);
  });
});

describe("buildOrchestratorSystemPrompt", () => {
  it("includes skill fragments, code-mode injection, and goals", async () => {
    const { agent } = makeAgent();
    const runtime = await initOrchestrator({ agent, children: [] });
    await runtime.store.setWorkingDoc("Mid-flight draft of the Q3 retrospective.");
    await runtime.store.upsertGoal({
      id: "g-1",
      title: "Ship release",
      status: "active",
      updatedAt: new Date().toISOString()
    });

    const prompt = await buildOrchestratorSystemPrompt(runtime);
    expect(prompt).toContain("code-mode");
    expect(prompt).toContain("Working doc");
    expect(prompt).toContain("Ship release");
  });
});

describe("gateToolCall", () => {
  it("delegates to evaluateApproval using the live config", async () => {
    const { agent } = makeAgent({ OPEN_THINK_TOOL_APPROVAL_POLICY: "ask-every-time" });
    const runtime = await initOrchestrator({ agent, children: [] });
    const decision = await gateToolCall(runtime, { toolName: "web_search" });
    expect(decision.allow).toBe(false);
  });
});

describe("recordTraceAndMaybeEvolve", () => {
  it("accumulates traces and only invokes the evolve loop once over threshold", async () => {
    const { agent, storage } = makeAgent();
    const runtime = await initOrchestrator({ agent, children: [] });
    let summarizeCalls = 0;
    const llm = {
      async summarize() {
        summarizeCalls++;
        return JSON.stringify({ skills: [], rubrics: [], prompts: [] });
      }
    };

    const trace = (i: number): RunTrace => ({
      id: `t${i}`,
      threadId: "thread",
      agentId: "agent",
      startedAt: new Date().toISOString(),
      goal: "ship",
      toolsUsed: ["a"],
      outcome: "success"
    });

    for (let i = 0; i < 4; i++) {
      const res = await recordTraceAndMaybeEvolve(runtime, storage, trace(i), llm, {
        evolveAfter: 5
      });
      expect(res.evolved).toBe(false);
    }
    expect(summarizeCalls).toBe(0);

    const res = await recordTraceAndMaybeEvolve(runtime, storage, trace(4), llm, {
      evolveAfter: 5
    });
    expect(summarizeCalls).toBe(1);
    expect(res.evolved).toBe(false); // empty suggestions array
    expect(((await storage.get("ws:traces")) as RunTrace[]).length).toBe(5);
  });
});
