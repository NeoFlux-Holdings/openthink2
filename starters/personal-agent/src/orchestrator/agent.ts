/**
 * OrchestratorAgent — the user-facing Durable Object that subclasses
 * the Cloudflare Agents SDK Agent class.
 *
 * Wires together every openthink2 subsystem:
 *   - skills          (DO-backed SkillStore, preloaded with Cloudflare pack)
 *   - approval        (full-auto / smart-auto / manual, spend caps)
 *   - code-mode       (Sandbox-GA runner with system-prompt injection)
 *   - executor.sh     (MCP-over-HTTP with WorkOS JWT)
 *   - shared memory   (Vectorize, Workers-AI embeddings)
 *   - sub-agents      (RPC MCP via addMcpServer)
 *   - goals + evolve  (orchestrator working doc, /goal command, evolve loop)
 *
 * Imports from `agents` (the Cloudflare SDK) are kept inside a tiny
 * shim so this file typechecks before the agents@^0.12.4 types are
 * installed. The actual concrete Agent class is plugged in at runtime
 * via the deployed agent worker template.
 */

import type { ApprovalConfig } from "../approval";
import {
  approvalModeFromLegacyPolicy,
  createInMemoryApprovalStore,
  defaultApprovalConfig,
  evaluateApproval
} from "../approval";
import {
  buildCodeModeInjection,
  createSandboxCodeModeRunner,
  defaultCodeModeConfig,
  type CodeModeConfig
} from "../code-mode";
import { runEvolveLoop, type RunTrace } from "../evolve";
import {
  buildExecutorMcpServerConfig,
  DEFAULT_EXECUTOR_ENDPOINT,
  type ExecutorMcpServerConfig
} from "../executor";
import { parseGoalCommand, runGoalCommand, type GoalRecord, type GoalStore } from "../goal";
import {
  buildSystemPromptFromSkills,
  createDoSkillStore,
  defaultPreloadPackIds,
  type SkillStore
} from "../skills";
import {
  buildSmitheryMountCalls,
  createSmitheryStore,
  type SmitheryStore
} from "../smithery";
import {
  createOrchestratorStore,
  type OrchestratorStateStore,
  wireOrchestratorMcpRpc,
  type AgentDescriptor
} from ".";

/** Shape the Agents SDK gives us. Kept narrow so we don't bind to a
 * specific SDK minor version inside this file. */
export interface AgentBase<TEnv> {
  env: TEnv;
  ctx: { storage: DoStorageLike };
  addMcpServer: (name: string, binding: unknown) => Promise<void> | void;
}

interface DoStorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>>;
}

export interface OrchestratorEnvBase {
  AI?: { run(model: string, input: { text: string | string[] }): Promise<unknown> };
  SANDBOX?: {
    run(input: { code: string; bindings: Record<string, unknown>; timeoutMs?: number }): Promise<{
      stdout: string;
      exitCode: number;
    }>;
  };
  OPEN_THINK_EXECUTOR_MCP_URL?: string;
  OPEN_THINK_EXECUTOR_WORKOS_TOKEN?: string;
  OPEN_THINK_WORKSPACE_ID?: string;
  OPEN_THINK_OWNER_EMAIL?: string;
  OPEN_THINK_TOOL_APPROVAL_POLICY?: string;
  OPEN_THINK_SMITHERY_API_KEY?: string;
  OPEN_THINK_SMITHERY_REGISTRY?: string;
  [key: string]: unknown;
}

export interface OrchestratorInitOptions<TEnv extends OrchestratorEnvBase> {
  agent: AgentBase<TEnv>;
  children: AgentDescriptor[];
  /** Optional override of code-mode config; defaults to "assisted". */
  codeModeConfig?: Partial<CodeModeConfig>;
  /** Optional override of approval defaults. */
  approvalConfig?: Partial<ApprovalConfig>;
}

export interface OrchestratorRuntime<TEnv extends OrchestratorEnvBase> {
  store: OrchestratorStateStore;
  skills: SkillStore;
  approval: ReturnType<typeof createInMemoryApprovalStore>;
  codeMode: ReturnType<typeof createSandboxCodeModeRunner>;
  executor: ExecutorMcpServerConfig | null;
  smithery: { store: SmitheryStore; mounted: string[] };
  goals: GoalStore;
  env: TEnv;
}

/**
 * One-shot initializer the deployed OrchestratorAgent calls from
 * `onStart()`. Returns the runtime handles so the agent can keep
 * using them on subsequent requests.
 */
export async function initOrchestrator<TEnv extends OrchestratorEnvBase>(
  options: OrchestratorInitOptions<TEnv>
): Promise<OrchestratorRuntime<TEnv>> {
  const { agent, children } = options;
  const env = agent.env;

  const store = createOrchestratorStore(agent.ctx.storage, {
    workspaceId: String(env.OPEN_THINK_WORKSPACE_ID ?? "default"),
    ownerEmail: String(env.OPEN_THINK_OWNER_EMAIL ?? "owner@example.com")
  });
  await store.getWorkspace(); // bootstrap descriptor

  const skills = createDoSkillStore(agent.ctx.storage);
  await skills.preload(defaultPreloadPackIds());

  const baseApproval: ApprovalConfig = {
    ...defaultApprovalConfig,
    mode: approvalModeFromLegacyPolicy(env.OPEN_THINK_TOOL_APPROVAL_POLICY),
    ...(options.approvalConfig ?? {})
  };
  const approval = createInMemoryApprovalStore(baseApproval);

  const codeModeConfig: CodeModeConfig = {
    ...defaultCodeModeConfig,
    ...(options.codeModeConfig ?? {})
  };
  const codeMode = createSandboxCodeModeRunner(env.SANDBOX, codeModeConfig);

  let executor: ExecutorMcpServerConfig | null = null;
  if (env.OPEN_THINK_EXECUTOR_WORKOS_TOKEN) {
    executor = buildExecutorMcpServerConfig({
      endpoint: env.OPEN_THINK_EXECUTOR_MCP_URL ?? DEFAULT_EXECUTOR_ENDPOINT,
      workosToken: env.OPEN_THINK_EXECUTOR_WORKOS_TOKEN
    });
  }

  await wireOrchestratorMcpRpc({
    env: env as unknown as Record<string, unknown>,
    children,
    addMcpServer: (name, binding) => agent.addMcpServer(name, binding)
  });

  // Smithery — mount every enabled installation as an additional MCP
  // server over Streamable HTTP. Stays empty when no API key is set.
  const smitheryStore = createSmitheryStore(agent.ctx.storage);
  const smitheryMounted: string[] = [];
  if (env.OPEN_THINK_SMITHERY_API_KEY) {
    const mountInput: { store: SmitheryStore; apiKey: string; registryBase?: string } = {
      store: smitheryStore,
      apiKey: env.OPEN_THINK_SMITHERY_API_KEY
    };
    if (env.OPEN_THINK_SMITHERY_REGISTRY) mountInput.registryBase = env.OPEN_THINK_SMITHERY_REGISTRY;
    const calls = await buildSmitheryMountCalls(mountInput);
    for (const call of calls) {
      try {
        await agent.addMcpServer(call.name, { url: call.url, headers: call.headers });
        smitheryMounted.push(call.name);
      } catch {
        // Skip individual server failures so a broken Smithery
        // installation doesn't take down the orchestrator at boot.
      }
    }
  }

  const goals: GoalStore = {
    async list() {
      const ctx = await store.getContext();
      return ctx.goals as GoalRecord[];
    },
    async upsert(record) {
      await store.upsertGoal(record);
      return record;
    }
  };

  return {
    store,
    skills,
    approval,
    codeMode,
    executor,
    smithery: { store: smitheryStore, mounted: smitheryMounted },
    goals,
    env
  };
}

/**
 * Convenience helper invoked from the chat handler. Returns either a
 * regular chat input untouched, or a parsed /goal response.
 */
export async function handleSlashCommand(
  input: string,
  runtime: { goals: GoalStore }
): Promise<{ handled: boolean; message?: string }> {
  const command = parseGoalCommand(input);
  if (!command) return { handled: false };
  const result = await runGoalCommand(command, runtime.goals);
  return { handled: true, message: result.message };
}

/**
 * Builds the orchestrator's system prompt for the current turn.
 * Concatenates: skills (system-prompt fragments) → code-mode injection
 * → workspace context (working doc, active goals).
 */
export async function buildOrchestratorSystemPrompt(
  runtime: OrchestratorRuntime<OrchestratorEnvBase>
): Promise<string> {
  const skills = await runtime.skills.list();
  const skillsBlock = buildSystemPromptFromSkills(skills);
  const approval = await runtime.approval.get();
  const codeMode = buildCodeModeInjection(defaultCodeModeConfig, approval);
  const ctx = await runtime.store.getContext();

  const sections: string[] = [];
  if (skillsBlock) sections.push(skillsBlock);
  if (codeMode.enabled) sections.push(codeMode.systemPromptFragment);
  if (ctx.workingDoc) {
    sections.push(`# Working doc\n${ctx.workingDoc}`);
  }
  if (ctx.goals.length > 0) {
    const goalLines = ctx.goals
      .filter((g) => g.status === "active")
      .map((g) => `  • ${g.title}`);
    if (goalLines.length > 0) {
      sections.push(`# Active goals\n${goalLines.join("\n")}`);
    }
  }
  return sections.join("\n\n");
}

/**
 * Single-call approval gate for any tool. Returns true to proceed.
 */
export async function gateToolCall(
  runtime: OrchestratorRuntime<OrchestratorEnvBase>,
  call: { toolName: string; toolNamespace?: string; estimatedCostUsd?: number }
): Promise<{ allow: boolean; reason: string; rememberKey?: string }> {
  const config = await runtime.approval.get();
  return evaluateApproval(config, call);
}

/**
 * Convenience to record a RunTrace + opportunistically kick off the
 * evolve loop if enough traces have accumulated.
 *
 * The caller is expected to pass through the same DO storage handle
 * it gave to initOrchestrator() — we use it directly to keep traces
 * out of the OrchestratorStateStore key namespace.
 */
export async function recordTraceAndMaybeEvolve(
  runtime: OrchestratorRuntime<OrchestratorEnvBase>,
  storage: DoStorageLike,
  trace: RunTrace,
  llm: { summarize(args: { system: string; user: string }): Promise<string> },
  options: { evolveAfter?: number } = {}
): Promise<{ evolved: boolean; suggestionCount: number }> {
  const TRACE_KEY = "ws:traces";
  const stored = (await storage.get<RunTrace[]>(TRACE_KEY)) ?? [];
  const next = [...stored, trace].slice(-50);
  await storage.put(TRACE_KEY, next);

  const threshold = options.evolveAfter ?? 10;
  if (next.length < threshold) {
    return { evolved: false, suggestionCount: 0 };
  }
  const ws = await runtime.store.getWorkspace();
  const suggestions = await runEvolveLoop({
    traces: next,
    existingSkills: await runtime.skills.list(),
    trainingMode: ws.trainingMode,
    llm
  });
  if (suggestions.length > 0) {
    await storage.put("ws:suggestions", suggestions);
  }
  return { evolved: suggestions.length > 0, suggestionCount: suggestions.length };
}
