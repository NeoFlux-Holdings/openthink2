// Auto-generated. Do not edit by hand.
// Run `node tools/regen-orchestrator-runtime-source.mjs` to regenerate.
// Source: starters/personal-agent/src/orchestrator-runtime.ts and its transitive
//         `export *` imports.
//
// This module exports the inlined source text of the orchestrator runtime
// that the agents-sdk-runtime-template emits into generated user-agent
// Workers. Keeping the source as a single TypeScript string constant lets
// the template renderer ship the runtime without taking a workspace
// dependency on @open-think/starter-personal-agent.

export const ORCHESTRATOR_RUNTIME_SOURCE = `/**
 * orchestrator-runtime — bundled, standalone runtime module emitted into
 * generated user-agent Workers.
 *
 * Mirrors starters/personal-agent/src/orchestrator-runtime.ts but inlines
 * the source so the deployed Worker bundle does not require a workspace
 * dependency on @open-think/starter-personal-agent.
 *
 * Re-exports: orchestrator (types, store, mcp-rpc, agent), goal, skills,
 * approval, code-mode, executor, evolve, smithery, learning-routes.
 *
 * Do not edit by hand — this file is produced by
 * tools/regen-orchestrator-runtime-source.mjs.
 */

import { z } from "zod";

/**
 * Shared Durable Object storage shape used by every internal module.
 * Hoisted to the top so the inlined modules don't redeclare it.
 */
interface DoStorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>>;
}

import { Schema } from "effect";
import type { Schema } from "effect";
import { Data, Effect, Schema } from "effect";
import type { ParseError } from "effect/ParseResult";
import { Effect } from "effect";

/**
 * Shared Durable Object storage shape used by every internal module.
 * Hoisted to the top so the inlined modules don't redeclare it.
 */
interface DoStorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>>;
}

// === starters/personal-agent/src/orchestrator-runtime.ts ===
/**
 * orchestrator-runtime — single-file re-export hub for the generated
 * user-agent Worker.
 *
 * The generated agent Worker (see apps/platform/src/lib/agents-sdk-runtime-template.ts)
 * imports the orchestrator runtime helpers from a sibling \`./orchestrator-runtime\`
 * module. This file is the in-starter source of truth for those re-exports;
 * the platform's runtime template emits a standalone copy alongside the
 * generated server.ts so the deployed bundle does not depend on the
 * \`@open-think/starter-personal-agent\` workspace package.
 *
 * Keep this file as a single barrel — no logic — so the template renderer
 * can predict its shape and so additions on the orchestrator side flow
 * straight through to the generated Worker.
 */

// === starters/personal-agent/src/orchestrator/agent.ts ===
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
 * Imports from \`agents\` (the Cloudflare SDK) are kept inside a tiny
 * shim so this file typechecks before the agents@^0.12.4 types are
 * installed. The actual concrete Agent class is plugged in at runtime
 * via the deployed agent worker template.
 */

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
 * \`onStart()\`. Returns the runtime handles so the agent can keep
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
    sections.push(\`# Working doc\\n\${ctx.workingDoc}\`);
  }
  if (ctx.goals.length > 0) {
    const goalLines = ctx.goals
      .filter((g) => g.status === "active")
      .map((g) => \`  • \${g.title}\`);
    if (goalLines.length > 0) {
      sections.push(\`# Active goals\\n\${goalLines.join("\\n")}\`);
    }
  }
  return sections.join("\\n\\n");
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

// === starters/personal-agent/src/orchestrator/index.ts ===

// === starters/personal-agent/src/goal.ts ===
/**
 * /goal — the agent's internal goal-management command.
 *
 * Used by the orchestrator to track the user's active objective(s).
 * Goals are persisted in the orchestrator's Durable Object storage
 * (via OrchestratorStateStore.upsertGoal). The /goal command is
 * routed through the chat composer when the user types \`/goal …\`,
 * or invoked programmatically by sub-agents that need to record
 * progress for the orchestrator to surface in the working doc.
 */

export const goalCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("set"),
    title: z.string().min(1),
    detail: z.string().optional()
  }),
  z.object({ kind: z.literal("list") }),
  z.object({
    kind: z.literal("complete"),
    id: z.string().min(1)
  }),
  z.object({
    kind: z.literal("block"),
    id: z.string().min(1),
    reason: z.string().optional()
  }),
  z.object({ kind: z.literal("evolve") })
]);

export type GoalCommand = z.infer<typeof goalCommandSchema>;

export function parseGoalCommand(input: string): GoalCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/goal")) return null;
  const tail = trimmed.slice(5).trim();
  if (tail === "" || tail === "list") return { kind: "list" };
  if (tail === "evolve") return { kind: "evolve" };

  const completeMatch = /^complete\\s+(\\S+)$/.exec(tail);
  if (completeMatch) return { kind: "complete", id: completeMatch[1]! };

  const blockMatch = /^block\\s+(\\S+)(?:\\s+(.+))?$/.exec(tail);
  if (blockMatch) {
    const cmd: GoalCommand = { kind: "block", id: blockMatch[1]! };
    if (blockMatch[2]) (cmd as { reason?: string }).reason = blockMatch[2];
    return cmd;
  }

  // Anything else is "set"
  const [titlePart, ...rest] = tail.split(" — ");
  const title = (titlePart ?? tail).trim();
  if (!title) return { kind: "list" };
  const cmd: GoalCommand = { kind: "set", title };
  const detail = rest.join(" — ").trim();
  if (detail) (cmd as { detail?: string }).detail = detail;
  return cmd;
}

export interface GoalRecord {
  id: string;
  title: string;
  status: "active" | "done" | "blocked";
  detail?: string;
  blockedReason?: string;
  updatedAt: string;
}

export interface GoalStore {
  list(): Promise<GoalRecord[]>;
  upsert(record: GoalRecord): Promise<GoalRecord>;
}

export async function runGoalCommand(
  command: GoalCommand,
  store: GoalStore
): Promise<{ message: string; goals: GoalRecord[] }> {
  if (command.kind === "list") {
    const goals = await store.list();
    return { message: formatGoalList(goals), goals };
  }
  if (command.kind === "set") {
    const record: GoalRecord = {
      id: \`goal-\${Date.now()}\`,
      title: command.title,
      status: "active",
      updatedAt: new Date().toISOString()
    };
    if (command.detail) record.detail = command.detail;
    await store.upsert(record);
    const goals = await store.list();
    return { message: \`Goal set: \${record.title}\`, goals };
  }
  if (command.kind === "complete") {
    const current = (await store.list()).find((g) => g.id === command.id);
    if (!current) return { message: \`No goal \${command.id}\`, goals: await store.list() };
    const next: GoalRecord = { ...current, status: "done", updatedAt: new Date().toISOString() };
    await store.upsert(next);
    return { message: \`Goal \${command.id} marked done.\`, goals: await store.list() };
  }
  if (command.kind === "block") {
    const current = (await store.list()).find((g) => g.id === command.id);
    if (!current) return { message: \`No goal \${command.id}\`, goals: await store.list() };
    const next: GoalRecord = {
      ...current,
      status: "blocked",
      updatedAt: new Date().toISOString()
    };
    if (command.reason) next.blockedReason = command.reason;
    await store.upsert(next);
    return { message: \`Goal \${command.id} blocked.\`, goals: await store.list() };
  }
  // evolve
  return {
    message:
      "Triggering the evolve loop — the agent will review recent traces and propose skill / rubric / prompt edits. See the Learning page.",
    goals: await store.list()
  };
}

function formatGoalList(goals: GoalRecord[]): string {
  if (goals.length === 0) return "No active goals. Use \`/goal <title>\` to set one.";
  const lines = goals.map((g) => {
    const tick = g.status === "done" ? "✓" : g.status === "blocked" ? "⊘" : "•";
    return \`\${tick} \${g.id}  \${g.title}\${g.detail ? \` — \${g.detail}\` : ""}\`;
  });
  return lines.join("\\n");
}

// === starters/personal-agent/src/skills/index.ts ===

// === starters/personal-agent/src/approval.ts ===
/**
 * Approval modes for the personal agent.
 *
 * Three policies are surfaced to users:
 *   - full-auto  : never ask, every tool call is allowed
 *   - smart-auto : the agent decides per call based on risk + history,
 *                  and remembers "always allow" decisions
 *   - manual     : every tool call must be approved by the user
 *
 * Spending policies layer on top — even in full-auto the agent will
 * stop and prompt the user when projected spend exceeds the configured
 * cap.
 */

export const approvalModes = ["full-auto", "smart-auto", "manual"] as const;
export type ApprovalMode = (typeof approvalModes)[number];

export const spendPolicyKinds = ["unlimited", "cap-per-task", "cap-per-day"] as const;
export type SpendPolicyKind = (typeof spendPolicyKinds)[number];

export interface SpendPolicy {
  kind: SpendPolicyKind;
  capUsd?: number;
  requireApprovalOver?: number;
}

export interface ApprovalConfig {
  mode: ApprovalMode;
  spend: SpendPolicy;
  alwaysAllow: string[];
  neverAllow: string[];
}

export const defaultApprovalConfig: ApprovalConfig = {
  mode: "smart-auto",
  spend: { kind: "cap-per-task", capUsd: 5, requireApprovalOver: 1 },
  alwaysAllow: ["web.search", "memory.read", "files.read", "skills.list"],
  neverAllow: []
};

export interface ApprovalDecisionContext {
  toolName: string;
  toolNamespace?: string;
  estimatedCostUsd?: number;
  reversible?: boolean;
  affects?: ("user-data" | "external-service" | "money" | "shared-state")[];
}

export interface ApprovalDecision {
  allow: boolean;
  reason: string;
  rememberKey?: string;
}

const RISKY_NAMESPACES = new Set(["payments", "stripe", "billing", "dns", "access"]);
const RISKY_KEYWORDS = ["delete", "purge", "drop", "revoke", "transfer", "wire"];

export function evaluateApproval(
  config: ApprovalConfig,
  ctx: ApprovalDecisionContext
): ApprovalDecision {
  const fullName = ctx.toolNamespace ? \`\${ctx.toolNamespace}.\${ctx.toolName}\` : ctx.toolName;
  if (config.neverAllow.includes(fullName)) {
    return { allow: false, reason: \`Blocked by neverAllow rule for \${fullName}\` };
  }
  if (config.alwaysAllow.includes(fullName)) {
    return { allow: true, reason: \`alwaysAllow rule for \${fullName}\` };
  }

  const overSpendThreshold =
    typeof config.spend.requireApprovalOver === "number" &&
    typeof ctx.estimatedCostUsd === "number" &&
    ctx.estimatedCostUsd > config.spend.requireApprovalOver;

  if (config.mode === "manual") {
    return { allow: false, reason: "manual mode — every call requires approval" };
  }

  if (config.mode === "full-auto") {
    if (overSpendThreshold) {
      return {
        allow: false,
        reason: \`cost \${ctx.estimatedCostUsd!.toFixed(2)} USD exceeds requireApprovalOver\`
      };
    }
    return { allow: true, reason: "full-auto" };
  }

  // smart-auto
  const risky =
    overSpendThreshold ||
    (ctx.toolNamespace && RISKY_NAMESPACES.has(ctx.toolNamespace)) ||
    RISKY_KEYWORDS.some((kw) => fullName.toLowerCase().includes(kw)) ||
    (ctx.affects?.includes("money") ?? false) ||
    (ctx.reversible === false && (ctx.affects?.includes("user-data") ?? false));

  if (risky) {
    return {
      allow: false,
      reason: "smart-auto flagged risky operation",
      rememberKey: fullName
    };
  }
  return {
    allow: true,
    reason: "smart-auto allowed",
    rememberKey: fullName
  };
}

export interface ApprovalStore {
  get(): Promise<ApprovalConfig>;
  update(patch: Partial<ApprovalConfig>): Promise<ApprovalConfig>;
  recordDecision(key: string, decision: "allow" | "block"): Promise<void>;
}

/**
 * Translates the legacy PersonalAgentToolApprovalPolicy ("auto" /
 * "ask-every-time" / "allow-all") that the platform deploy form
 * already collects into the new tri-mode model. Keeps users who
 * configured an agent on the legacy form working without re-prompting.
 */
export function approvalModeFromLegacyPolicy(
  legacy: string | undefined | null
): ApprovalMode {
  switch (legacy) {
    case "allow-all":
      return "full-auto";
    case "ask-every-time":
      return "manual";
    case "auto":
    default:
      return "smart-auto";
  }
}

export function legacyPolicyFromApprovalMode(mode: ApprovalMode): "auto" | "ask-every-time" | "allow-all" {
  switch (mode) {
    case "full-auto":
      return "allow-all";
    case "manual":
      return "ask-every-time";
    case "smart-auto":
    default:
      return "auto";
  }
}

export function createInMemoryApprovalStore(
  initial: ApprovalConfig = defaultApprovalConfig
): ApprovalStore {
  let state: ApprovalConfig = {
    ...initial,
    alwaysAllow: [...initial.alwaysAllow],
    neverAllow: [...initial.neverAllow]
  };
  return {
    async get() {
      return state;
    },
    async update(patch) {
      state = {
        ...state,
        ...patch,
        spend: patch.spend ? { ...state.spend, ...patch.spend } : state.spend,
        alwaysAllow: patch.alwaysAllow ?? state.alwaysAllow,
        neverAllow: patch.neverAllow ?? state.neverAllow
      };
      return state;
    },
    async recordDecision(key, decision) {
      if (decision === "allow" && !state.alwaysAllow.includes(key)) {
        state.alwaysAllow = [...state.alwaysAllow, key];
      } else if (decision === "block" && !state.neverAllow.includes(key)) {
        state.neverAllow = [...state.neverAllow, key];
      }
    }
  };
}

// === starters/personal-agent/src/code-mode.ts ===
/**
 * Code-mode MCP wrapper.
 *
 * Cloudflare's "code-mode" pattern lets an agent express a multi-step
 * tool plan as a single TypeScript snippet that runs inside an isolate.
 * Instead of round-tripping each tool call through the LLM, the LLM
 * emits a chunk of code that calls the bound MCP tools directly.
 *
 * Reference: https://blog.cloudflare.com/code-mode-mcp/
 *
 * We expose code-mode as an *advanced* feature with three modes:
 *   - off            : standard one-tool-per-turn calls (default for new users)
 *   - assisted       : LLM may choose code-mode for batch plans
 *   - always         : LLM always emits code-mode for tool execution
 */

export const codeModePolicies = ["off", "assisted", "always"] as const;
export type CodeModePolicy = (typeof codeModePolicies)[number];

export interface CodeModeConfig {
  policy: CodeModePolicy;
  sandboxBinding?: string;
  maxRunMs: number;
  allowFetch: boolean;
  allowMcpTools: string[];
}

export const defaultCodeModeConfig: CodeModeConfig = {
  policy: "assisted",
  maxRunMs: 30_000,
  allowFetch: true,
  allowMcpTools: ["*"]
};

export interface CodeModePromptInjection {
  enabled: boolean;
  systemPromptFragment: string;
}

export function buildCodeModeInjection(
  config: CodeModeConfig,
  approval: ApprovalConfig
): CodeModePromptInjection {
  if (config.policy === "off") {
    return { enabled: false, systemPromptFragment: "" };
  }
  const lines = [
    "## Code-mode tool execution",
    "When several tool calls share inputs or you need to fan out, you may emit a single fenced",
    "\`\`\`code-mode\\\\nasync function plan({ tools, fetch }) { /* … */ }\\\\n\`\`\`",
    "block. The harness will run it inside a sandboxed isolate with",
    \`a \${config.maxRunMs}ms budget. Bound tools: \${config.allowMcpTools.join(", ")}.\`,
    approval.mode === "manual"
      ? "Approval mode is manual — the code-mode plan will still be reviewed before execution."
      : \`Approval mode is \${approval.mode} — code-mode runs follow the same allow/deny rules.\`
  ];
  if (config.policy === "assisted") {
    lines.push("Use code-mode when it is clearly more efficient; otherwise call tools one at a time.");
  } else {
    lines.push("Always emit a code-mode plan for tool execution.");
  }
  return { enabled: true, systemPromptFragment: lines.join("\\n") };
}

export interface CodeModeRunner {
  run(args: { code: string; bindings: Record<string, unknown> }): Promise<{
    ok: boolean;
    output: string;
    durationMs: number;
    diagnostics?: string;
  }>;
}

/**
 * Sandbox-GA runner (Cloudflare Sandbox). Falls back to a stub that
 * refuses execution if the sandbox binding is missing.
 *
 * See https://blog.cloudflare.com/sandbox-ga/
 */
export function createSandboxCodeModeRunner(
  sandbox: { run(input: { code: string; bindings: Record<string, unknown>; timeoutMs?: number }): Promise<{ stdout: string; exitCode: number; }> } | undefined,
  config: CodeModeConfig
): CodeModeRunner {
  if (!sandbox) {
    return {
      async run() {
        return {
          ok: false,
          output: "",
          durationMs: 0,
          diagnostics:
            "Cloudflare Sandbox binding not configured. Bind a sandbox in wrangler.jsonc to enable code-mode execution."
        };
      }
    };
  }
  return {
    async run({ code, bindings }) {
      const started = Date.now();
      try {
        const result = await sandbox.run({ code, bindings, timeoutMs: config.maxRunMs });
        return {
          ok: result.exitCode === 0,
          output: result.stdout,
          durationMs: Date.now() - started
        };
      } catch (error) {
        return {
          ok: false,
          output: "",
          durationMs: Date.now() - started,
          diagnostics: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };
}

// === starters/personal-agent/src/executor.ts ===
/**
 * executor.sh MCP client.
 *
 * Connects a Cloudflare-hosted agent to the public executor cloud MCP
 * gateway at https://executor.sh/mcp. The gateway is itself a CF Worker;
 * auth is a WorkOS Bearer JWT. The user authenticates once through the
 * executor web app (WorkOS AuthKit) and the resulting session token is
 * stored as the OPEN_THINK_EXECUTOR_WORKOS_TOKEN secret on the deployed
 * agent Worker.
 *
 * Wire-up (from the openthink2 brief):
 *
 *     Your CF Agent Worker
 *           │  POST https://executor.sh/mcp
 *           │  Authorization: Bearer <workos-token>
 *           ▼
 *      executor.sh (CF Worker)
 *           │  mcpFetch → verifyBearer → McpSessionDO
 *           ▼
 *      McpSessionDO (Durable Object)
 *           │  DynamicWorkerExecutor (sandboxed isolate)
 *           ▼
 *      Tool execution result (SSE stream)
 */

export interface ExecutorClientConfig {
  endpoint: string;
  workosToken: string;
  defaultHeaders?: Record<string, string>;
}

export interface ExecutorMcpServerConfig {
  url: string;
  headers: { Authorization: string } & Record<string, string>;
}

export const DEFAULT_EXECUTOR_ENDPOINT = "https://executor.sh/mcp";

export function buildExecutorMcpServerConfig(
  config: ExecutorClientConfig
): ExecutorMcpServerConfig {
  if (!config.workosToken) {
    throw new Error(
      "executor.sh requires a WorkOS bearer token. Set OPEN_THINK_EXECUTOR_WORKOS_TOKEN on the Worker."
    );
  }
  return {
    url: config.endpoint || DEFAULT_EXECUTOR_ENDPOINT,
    headers: {
      Authorization: \`Bearer \${config.workosToken}\`,
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      ...(config.defaultHeaders ?? {})
    }
  };
}

export interface ExecutorReadiness {
  ready: boolean;
  endpoint: string;
  message: string;
}

export async function probeExecutor(
  config: ExecutorClientConfig,
  options: { fetchImpl?: typeof fetch } = {}
): Promise<ExecutorReadiness> {
  const endpoint = config.endpoint || DEFAULT_EXECUTOR_ENDPOINT;
  if (!config.workosToken) {
    return {
      ready: false,
      endpoint,
      message: "missing WorkOS token (OPEN_THINK_EXECUTOR_WORKOS_TOKEN)"
    };
  }
  const f = options.fetchImpl ?? fetch;
  try {
    const response = await f(endpoint, {
      method: "POST",
      headers: {
        Authorization: \`Bearer \${config.workosToken}\`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping", params: {} })
    });
    if (response.status === 401 || response.status === 403) {
      return {
        ready: false,
        endpoint,
        message: \`auth rejected (HTTP \${response.status}) — log in at executor.sh and refresh the token\`
      };
    }
    return {
      ready: response.ok,
      endpoint,
      message: response.ok ? "ok" : \`unexpected status \${response.status}\`
    };
  } catch (error) {
    return {
      ready: false,
      endpoint,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

// === starters/personal-agent/src/smithery.ts ===
/**
 * Smithery client — the third execution lane.
 *
 * openthink2 mounts three classes of MCP servers:
 *
 *   1. In-Worker McpAgents      — RPC transport, zero network hop.
 *                                  This is the default for our own
 *                                  specialist sub-agents (coder,
 *                                  researcher, browser, …).
 *   2. executor.sh               — Cloud MCP gateway over HTTPS,
 *                                  WorkOS JWT auth. Useful when the
 *                                  user wants the executor.sh tool
 *                                  surface alongside Sandbox.
 *   3. Smithery (this module)    — The MCP server registry at
 *                                  smithery.ai. Over 7,000 servers,
 *                                  hosted by Smithery, mounted via
 *                                  Streamable-HTTP transport from
 *                                  inside the agent. Auth is a
 *                                  per-user Smithery API key.
 *
 * This file is a typed client + a \`buildSmitheryServerConfig\` helper
 * that returns the \`{ url, headers }\` shape \`addMcpServer()\` accepts.
 *
 * Per-server install state (api keys, server settings) lives in
 * Durable Object storage via SmitheryStore.
 */

export interface SmitheryServerDescriptor {
  /** Stable id used in URL paths, e.g. "@smithery-ai/github". */
  qualifiedName: string;
  /** Human-friendly display name. */
  displayName: string;
  /** Short description from the registry. */
  description: string;
  /** Marketing tags ("github", "developer-tools", "communication"). */
  tags: string[];
  /** True when Smithery hosts the server for you. */
  hosted: boolean;
  /** Latest version string from the registry, if known. */
  version?: string;
  /** Author / publisher. */
  author?: string;
  /** Direct URL of the canonical hosted endpoint, if known. Falls back
   * to the convention \`https://server.smithery.ai/<qualifiedName>/mcp\`. */
  endpointUrl?: string;
}

export interface SmitheryInstallation {
  qualifiedName: string;
  /** Per-server configuration (e.g. \`{ token: "ghp_…" }\`). Encrypted
   *  at rest by the deploying Worker — never stored in plaintext D1. */
  config: Record<string, unknown>;
  enabled: boolean;
  installedAt: string;
}

export interface SmitheryClientConfig {
  /** User's Smithery API key. Sent as \`Authorization: Bearer …\`. */
  apiKey: string;
  /** Registry endpoint. Defaults to https://server.smithery.ai. */
  registryBase?: string;
  /** Custom fetch (used by tests). */
  fetchImpl?: typeof fetch;
}

export const DEFAULT_SMITHERY_REGISTRY = "https://server.smithery.ai";

/** Build the MCP server config to hand to Agent.addMcpServer(). */
export function buildSmitheryServerConfig(input: {
  qualifiedName: string;
  apiKey: string;
  registryBase?: string;
  installation?: SmitheryInstallation;
}): { url: string; headers: Record<string, string> } {
  if (!input.apiKey) {
    throw new Error("Smithery requires an API key — set OPEN_THINK_SMITHERY_API_KEY on the Worker.");
  }
  const base = input.registryBase ?? DEFAULT_SMITHERY_REGISTRY;
  const url = new URL(\`\${base.replace(/\\/$/, "")}/\${input.qualifiedName}/mcp\`);
  if (input.installation && Object.keys(input.installation.config).length > 0) {
    // Smithery accepts JSON-encoded base64 config as a query param so the
    // server knows what credentials to use without persisting state.
    const cfg = btoa(JSON.stringify(input.installation.config));
    url.searchParams.set("config", cfg);
  }
  return {
    url: url.toString(),
    headers: {
      Authorization: \`Bearer \${input.apiKey}\`,
      Accept: "text/event-stream",
      "Content-Type": "application/json"
    }
  };
}

export interface SmitheryClient {
  /** Search the registry. Empty query returns the curated front page. */
  search(query: string, opts?: { limit?: number }): Promise<SmitheryServerDescriptor[]>;
  /** Fetch a single server's metadata. */
  get(qualifiedName: string): Promise<SmitheryServerDescriptor | null>;
}

export function createSmitheryClient(config: SmitheryClientConfig): SmitheryClient {
  const f = config.fetchImpl ?? fetch;
  const base = config.registryBase ?? DEFAULT_SMITHERY_REGISTRY;
  const headers: Record<string, string> = {
    Authorization: \`Bearer \${config.apiKey}\`,
    Accept: "application/json"
  };
  return {
    async search(query, opts = {}) {
      const url = new URL(\`\${base.replace(/\\/$/, "")}/registry/search\`);
      if (query) url.searchParams.set("q", query);
      url.searchParams.set("limit", String(opts.limit ?? 24));
      const res = await f(url.toString(), { headers });
      if (!res.ok) throw new Error(\`Smithery search failed: \${res.status}\`);
      const body = (await res.json()) as { servers?: SmitheryServerDescriptor[] };
      return body.servers ?? [];
    },
    async get(qualifiedName) {
      const url = \`\${base.replace(/\\/$/, "")}/registry/servers/\${encodeURIComponent(qualifiedName)}\`;
      const res = await f(url, { headers });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(\`Smithery get failed: \${res.status}\`);
      return (await res.json()) as SmitheryServerDescriptor;
    }
  };
}

/**
 * Durable Object–backed store of which Smithery servers a workspace
 * has installed and how they're configured.
 */
export interface SmitheryStore {
  list(): Promise<SmitheryInstallation[]>;
  get(qualifiedName: string): Promise<SmitheryInstallation | null>;
  install(record: Omit<SmitheryInstallation, "installedAt">): Promise<SmitheryInstallation>;
  uninstall(qualifiedName: string): Promise<void>;
  setEnabled(qualifiedName: string, enabled: boolean): Promise<SmitheryInstallation | null>;
}

interface DoStorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>>;
}

const SMITHERY_PREFIX = "smithery:";

export function createSmitheryStore(storage: DoStorageLike): SmitheryStore {
  return {
    async list() {
      const map = await storage.list<SmitheryInstallation>({ prefix: SMITHERY_PREFIX });
      return Array.from(map.values());
    },
    async get(qualifiedName) {
      const value = await storage.get<SmitheryInstallation>(SMITHERY_PREFIX + qualifiedName);
      return value ?? null;
    },
    async install(record) {
      const stamped: SmitheryInstallation = { ...record, installedAt: new Date().toISOString() };
      await storage.put(SMITHERY_PREFIX + record.qualifiedName, stamped);
      return stamped;
    },
    async uninstall(qualifiedName) {
      await storage.delete(SMITHERY_PREFIX + qualifiedName);
    },
    async setEnabled(qualifiedName, enabled) {
      const existing = await this.get(qualifiedName);
      if (!existing) return null;
      const next: SmitheryInstallation = { ...existing, enabled };
      await storage.put(SMITHERY_PREFIX + qualifiedName, next);
      return next;
    }
  };
}

/**
 * Build the addMcpServer() calls for every enabled Smithery
 * installation on a workspace. Used by the OrchestratorAgent at
 * startup to mount the user's curated Smithery servers as MCP clients.
 */
export interface SmitheryMountCall {
  name: string;
  url: string;
  headers: Record<string, string>;
}

export async function buildSmitheryMountCalls(input: {
  store: SmitheryStore;
  apiKey: string;
  registryBase?: string;
}): Promise<SmitheryMountCall[]> {
  if (!input.apiKey) return [];
  const installations = await input.store.list();
  return installations
    .filter((i) => i.enabled)
    .map((i) => {
      const cfg: { qualifiedName: string; apiKey: string; registryBase?: string; installation: SmitheryInstallation } = {
        qualifiedName: i.qualifiedName,
        apiKey: input.apiKey,
        installation: i
      };
      if (input.registryBase) cfg.registryBase = input.registryBase;
      const built = buildSmitheryServerConfig(cfg);
      return {
        name: \`smithery:\${i.qualifiedName}\`,
        url: built.url,
        headers: built.headers
      };
    });
}

// === starters/personal-agent/src/learning-routes.ts ===
/**
 * Learning routes — exposes the self-evolve suggestion feed and
 * decision endpoints used by the platform's Learning page.
 *
 * The orchestrator's evolve loop persists suggestions to DO storage
 * under the key \`ws:suggestions\` (see
 * \`orchestrator/agent.ts:recordTraceAndMaybeEvolve\`). These routes are
 * the read/write surface over that key:
 *
 *   - GET  /learning/pending    → list pending suggestions
 *   - POST /learning/decisions  → accept / reject / edit a suggestion
 *   - GET  /learning/summary    → counts by status
 *
 * The router is kept narrow (\`get\` / \`post\`) so this file does not
 * bind to a specific HTTP framework. Callers wire it into whatever
 * router / \`fetch\` table the agent worker uses.
 */

/** Storage shape provided by the agent's DO ctx. Identical to the
 * interface used in \`orchestrator/agent.ts\` — kept duplicated here so
 * this module has no cross-dependency on the orchestrator. */
export interface DoStorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>>;
}

/** Minimal request shape — a subset of the Web \`Request\` interface so
 * the routes work with both \`fetch\`-style handlers and tests that
 * don't bother constructing a full \`Request\`. */
export interface LearningRouteRequest {
  json(): Promise<unknown>;
}

/** Minimal handler signature. Returns either a body (auto-JSON) or
 * a \`{ status, body }\` envelope so handlers can express 4xx errors
 * without depending on a Response factory. */
export type LearningHandlerResult =
  | { status?: number; body: unknown }
  | { status: number; body?: unknown };

export type LearningHandler = (request: LearningRouteRequest) => Promise<LearningHandlerResult>;

/** The shape \`registerLearningRoutes\` expects of the host router.
 * Two methods (\`get\` / \`post\`) keep this module independent of a
 * specific framework. The host adapter is responsible for translating
 * \`LearningHandlerResult\` into a real \`Response\`. */
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
 * adapting the returned \`LearningHandlerResult\` into a real
 * \`Response\`; see \`respondLearning\` for a convenience converter.
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
 * Convenience adapter: invoke the matching handler from \`router\` and
 * return a \`Response\`. Useful when callers want to translate a
 * \`fetch\`-style URL into a learning route hit without instantiating a
 * full router.
 *
 * The returned \`Response\` is \`null\` when no learning route matches;
 * the host can then fall through to its other routes.
 */
export async function respondLearning(
  request: Request,
  store: DoStorageLike
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/learning/")) return null;

  // We use a tiny in-line router so this helper has the same surface
  // as \`registerLearningRoutes\` — the host can choose either path.
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

/** Translate a \`LearningHandlerResult\` into a fetch \`Response\`. */
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
  // recorded \`decisionAction\` lets the summary distinguish "edited"
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
  // structural fields (\`id\`, \`kind\`, \`evidenceTraceIds\`, \`status\`)
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
    return { ok: false, error: "\`id\` must be a non-empty string." };
  }
  if (decision !== "accept" && decision !== "reject" && decision !== "edit") {
    return { ok: false, error: "\`decision\` must be 'accept' | 'reject' | 'edit'." };
  }
  const editedFields = record.editedFields;
  if (editedFields !== undefined && (editedFields === null || typeof editedFields !== "object" || Array.isArray(editedFields))) {
    return { ok: false, error: "\`editedFields\` must be an object when present." };
  }
  const value: DecisionRequest = { id, decision };
  if (editedFields !== undefined) {
    value.editedFields = editedFields as Record<string, unknown>;
  }
  return { ok: true, value };
}

// === starters/personal-agent/src/document-stream.ts ===
/**
 * Framework-agnostic SSE document-stream endpoint.
 *
 * Each deployed agent that owns documents (or any model-generated
 * artifact) can expose a \`/documents/:id/stream\` route. The Persona
 * document viewer subscribes via EventSource and re-renders through
 * Streamdown as chunks arrive.
 *
 * Contract:
 *   - The producer is an async generator that yields string chunks.
 *     Yield resolution = SSE frame emit, so the server doesn't have
 *     to buffer the full document.
 *   - When the generator returns, the route emits an \`event: done\`
 *     frame and closes the stream.
 *   - When the generator throws, the route emits an \`event: error\`
 *     frame with the message and closes.
 *
 * The route handler is exposed two ways:
 *   - \`respondDocumentStream(request, producer)\` — returns a Response
 *     ready to send back. Use from any fetch-style handler.
 *   - \`createDocumentStreamRoute(getProducer)\` — returns a router
 *     function \`(request) => Promise<Response | null>\` that matches
 *     \`GET /documents/:id/stream\` and dispatches to the producer.
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
  if (options.event) lines.push(\`event: \${options.event}\`);
  if (options.id) lines.push(\`id: \${options.id}\`);
  for (const line of data.split(/\\r?\\n/)) {
    lines.push(\`data: \${line}\`);
  }
  lines.push("");
  lines.push("");
  return encoder.encode(lines.join("\\n"));
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
            controller.enqueue(encoder.encode(":keepalive\\n\\n"));
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
          controller.enqueue(encodeFrame(chunk, { id: \`\${prefix}-\${counter}\` }));
        }
        controller.enqueue(encodeFrame("", { event: "done", id: \`\${prefix}-done\` }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        controller.enqueue(encodeFrame(message, { event: "error", id: \`\${prefix}-error\` }));
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
 * Build a router that matches \`GET /documents/<id>/stream\` and
 * dispatches to the supplied producer factory. Returns \`null\` for
 * non-matching requests so the caller can compose with other routes.
 */
export function createDocumentStreamRoute(
  getProducer: (ctx: DocumentStreamRouteContext) => DocumentChunkProducer | Promise<DocumentChunkProducer>,
  defaults: DocumentStreamMetadata = {}
): (request: Request) => Promise<Response | null> {
  return async (request) => {
    if (request.method !== "GET") return null;
    const url = new URL(request.url);
    const match = /^\\/documents\\/([^/]+)\\/stream\\/?$/.exec(url.pathname);
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

// === starters/personal-agent/src/workflows/index.ts ===

// === starters/personal-agent/src/propose-pr.ts ===
/**
 * propose-pr — agent-authored GitHub pull-request automation.
 *
 * Lives in the deployed-agent runtime so a user's own agent can open
 * PRs against any repo their GitHub token has access to. The platform
 * itself never sees the token.
 *
 * Strategy: rather than shelling out to \`git\` (the Sandbox-GA isolate
 * doesn't ship it), we drive GitHub's low-level Git Data API — blob /
 * tree / commit / ref. That lets us assemble a single commit with N
 * file writes + M deletions atomically, without any local checkout.
 *
 * The Contents API would have been simpler per-file, but it requires
 * one PUT per file and serializes the SHA chain awkwardly when we want
 * a multi-file commit. Git Data API gives us one commit per call.
 *
 * The Sandbox-GA binding is wired in as an *advisory* pre-check hook —
 * future plans will run \`npm test\` / linters in the isolate before
 * we publish a PR. Failures there are logged but never block the PR;
 * the orchestrator surfaces them to the user.
 */

export interface PrAuthor {
  name: string;
  email: string;
}

export interface PrTarget {
  owner: string;
  repo: string;
  baseBranch: string;
  /**
   * When set, push the branch to the fork and open the PR
   * cross-repo. The fork is auto-created (idempotent on GitHub's side).
   */
  fork?: { owner: string };
}

export interface ProposePrInput {
  target: PrTarget;
  /** Branch name to create on the head ref. Will be unique-suffixed if needed. */
  headBranch: string;
  /** PR title. */
  title: string;
  /** PR body (markdown). */
  body: string;
  /** Map of repo-relative paths → new file content. */
  files: Record<string, string>;
  /** Files to delete from the head branch, if any. */
  deletePaths?: string[];
  /** GitHub token with repo + workflow scopes. */
  githubToken: string;
  /** Commit author. */
  author: PrAuthor;
  /** Optional commit message; defaults to the title. */
  commitMessage?: string;
}

export interface ProposePrLogEntry {
  step: string;
  status: "ok" | "skipped" | "error";
  detail: string;
}

export interface ProposePrResult {
  ok: boolean;
  prUrl?: string;
  prNumber?: number;
  headBranch: string;
  error?: string;
  /** Run log: each entry is one step (clone, write, commit, push, open). */
  log: ProposePrLogEntry[];
}

export interface ProposePrSandbox {
  run(input: {
    code: string;
    bindings: Record<string, unknown>;
    timeoutMs?: number;
  }): Promise<{ stdout: string; exitCode: number }>;
}

export interface ProposePrIdempotencyStore {
  get(key: string): Promise<{ prUrl: string; prNumber: number } | undefined>;
  put(key: string, value: { prUrl: string; prNumber: number }): Promise<void>;
}

export interface ProposePrConfig {
  /** Sandbox binding (same shape as code-mode.ts uses). Optional. */
  sandbox?: ProposePrSandbox;
  /** GitHub API base. Defaults to https://api.github.com. */
  githubApiBase?: string;
  /** Custom fetch (tests inject). */
  fetchImpl?: typeof fetch;
  /**
   * Idempotency hook — if the same (target, headBranch, title) was
   * already opened, return the existing PR instead of opening a
   * duplicate.
   */
  idempotencyStore?: ProposePrIdempotencyStore;
}

const DEFAULT_GITHUB_API = "https://api.github.com";
const MAX_BRANCH_SUFFIX_TRIES = 32;

interface GitRefResponse {
  ref: string;
  object: { sha: string; type: string };
}

interface GitCommitResponse {
  sha: string;
  tree: { sha: string };
}

interface GitBlobResponse {
  sha: string;
  url: string;
}

interface GitTreeResponse {
  sha: string;
}

interface GitNewCommitResponse {
  sha: string;
}

interface GitHubPullResponse {
  html_url: string;
  number: number;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  acceptStatuses?: readonly number[];
}

class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly responseText: string
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export function createProposePr(
  config: ProposePrConfig
): (input: ProposePrInput) => Promise<ProposePrResult> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const apiBase = (config.githubApiBase ?? DEFAULT_GITHUB_API).replace(/\\/+$/, "");
  const sandbox = config.sandbox;
  const idempotencyStore = config.idempotencyStore;

  async function request<T>(
    token: string,
    path: string,
    options: RequestOptions = {}
  ): Promise<{ data: T; status: number }> {
    const method = options.method ?? "GET";
    const headers: Record<string, string> = {
      Authorization: \`Bearer \${token}\`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "openthink2-propose-pr"
    };
    const init: RequestInit = { method, headers };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }
    const response = await fetchImpl(\`\${apiBase}\${path}\`, init);
    const text = await response.text();
    const allowed = options.acceptStatuses;
    const ok =
      (response.status >= 200 && response.status < 300) ||
      (allowed !== undefined && allowed.includes(response.status));
    if (!ok) {
      throw new GitHubApiError(
        \`GitHub \${method} \${path} failed with \${response.status}\`,
        response.status,
        text
      );
    }
    let data: unknown = undefined;
    if (text.length > 0) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { data: data as T, status: response.status };
  }

  async function tryGetRef(
    token: string,
    owner: string,
    repo: string,
    branch: string
  ): Promise<GitRefResponse | undefined> {
    const { data, status } = await request<GitRefResponse>(
      token,
      \`/repos/\${enc(owner)}/\${enc(repo)}/git/ref/heads/\${encBranch(branch)}\`,
      { acceptStatuses: [404] }
    );
    if (status === 404) return undefined;
    return data;
  }

  async function ensureFork(
    token: string,
    upstreamOwner: string,
    repo: string,
    forkOwner: string
  ): Promise<void> {
    // POST /repos/{owner}/{repo}/forks is idempotent: returns 202 if a
    // fork already exists for the authenticated user. We don't need
    // forkOwner for the call itself — it's reserved for the future
    // case where we fork into an org.
    void forkOwner;
    await request<unknown>(
      token,
      \`/repos/\${enc(upstreamOwner)}/\${enc(repo)}/forks\`,
      { method: "POST", acceptStatuses: [202] }
    );
  }

  /** Hash the idempotency key with crypto.subtle.digest (Workers global). */
  async function hashTitle(title: string): Promise<string> {
    const bytes = new TextEncoder().encode(title);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return bufferToHex(digest);
  }

  function idempotencyKey(
    target: PrTarget,
    headBranch: string,
    titleHash: string
  ): string {
    return \`\${target.owner}/\${target.repo}#\${headBranch}#\${titleHash}\`;
  }

  return async function proposePr(input: ProposePrInput): Promise<ProposePrResult> {
    const log: ProposePrLogEntry[] = [];
    const finalize = (
      ok: boolean,
      headBranch: string,
      extras: Partial<ProposePrResult> = {}
    ): ProposePrResult => {
      const result: ProposePrResult = { ok, headBranch, log };
      if (extras.prUrl !== undefined) result.prUrl = extras.prUrl;
      if (extras.prNumber !== undefined) result.prNumber = extras.prNumber;
      if (extras.error !== undefined) result.error = extras.error;
      return result;
    };

    // ----- Step 0: idempotency cache lookup -----
    let cacheKey: string | undefined;
    if (idempotencyStore) {
      try {
        const titleHash = await hashTitle(input.title);
        cacheKey = idempotencyKey(input.target, input.headBranch, titleHash);
        const cached = await idempotencyStore.get(cacheKey);
        if (cached) {
          log.push({
            step: "idempotency-cache",
            status: "ok",
            detail: \`cache hit: \${cached.prUrl}\`
          });
          return finalize(true, input.headBranch, {
            prUrl: cached.prUrl,
            prNumber: cached.prNumber
          });
        }
        log.push({
          step: "idempotency-cache",
          status: "skipped",
          detail: "no cached PR for this (target, branch, title)"
        });
      } catch (error) {
        log.push({
          step: "idempotency-cache",
          status: "error",
          detail: stringifyError(error)
        });
        // continue — cache failures must never block PR creation
      }
    }

    // ----- Step 1: sandbox pre-checks (advisory only) -----
    // Pre-checks are advisory: failures here are logged but do not
    // block PR creation. We still run them so the orchestrator can
    // surface lint/test results in the PR body or as a separate
    // notification.
    if (sandbox) {
      try {
        await sandbox.run({
          code: "/* propose-pr sandbox pre-check hook (no-op) */",
          bindings: { files: input.files },
          timeoutMs: 5_000
        });
        log.push({
          step: "sandbox-pre-checks",
          status: "ok",
          detail: "sandbox pre-check hook completed"
        });
      } catch (error) {
        log.push({
          step: "sandbox-pre-checks",
          status: "error",
          detail: \`advisory failure: \${stringifyError(error)}\`
        });
        // intentionally do not return — see comment above
      }
    } else {
      log.push({
        step: "sandbox-pre-checks",
        status: "skipped",
        detail: "no sandbox binding configured"
      });
    }

    const token = input.githubToken;
    const headOwner = input.target.fork?.owner ?? input.target.owner;
    const repo = input.target.repo;

    let baseSha: string;
    let baseTreeSha: string;

    // ----- Step 2: resolve base branch SHA on the upstream -----
    try {
      const baseRef = await tryGetRef(
        token,
        input.target.owner,
        repo,
        input.target.baseBranch
      );
      if (!baseRef) {
        const detail = \`base branch '\${input.target.baseBranch}' not found on \${input.target.owner}/\${repo}\`;
        log.push({ step: "resolve-base", status: "error", detail });
        return finalize(false, input.headBranch, { error: detail });
      }
      baseSha = baseRef.object.sha;
      log.push({
        step: "resolve-base",
        status: "ok",
        detail: \`base \${input.target.baseBranch}@\${shortSha(baseSha)}\`
      });
    } catch (error) {
      const detail = stringifyError(error);
      log.push({ step: "resolve-base", status: "error", detail });
      return finalize(false, input.headBranch, { error: detail });
    }

    // ----- Step 2.5: fetch base commit's tree SHA (we need it to compose the new tree) -----
    try {
      const { data: baseCommit } = await request<GitCommitResponse>(
        token,
        \`/repos/\${enc(input.target.owner)}/\${enc(repo)}/git/commits/\${enc(baseSha)}\`
      );
      baseTreeSha = baseCommit.tree.sha;
      log.push({
        step: "resolve-base-tree",
        status: "ok",
        detail: \`base tree \${shortSha(baseTreeSha)}\`
      });
    } catch (error) {
      const detail = stringifyError(error);
      log.push({ step: "resolve-base-tree", status: "error", detail });
      return finalize(false, input.headBranch, { error: detail });
    }

    // ----- Step 3: ensure fork exists if we're pushing to one -----
    if (input.target.fork) {
      try {
        await ensureFork(token, input.target.owner, repo, input.target.fork.owner);
        log.push({
          step: "ensure-fork",
          status: "ok",
          detail: \`fork \${input.target.fork.owner}/\${repo}\`
        });
      } catch (error) {
        const detail = stringifyError(error);
        log.push({ step: "ensure-fork", status: "error", detail });
        return finalize(false, input.headBranch, { error: detail });
      }
    }

    // ----- Step 4: pick a non-colliding head branch name -----
    let headBranch = input.headBranch;
    try {
      let suffix = 0;
      while (suffix < MAX_BRANCH_SUFFIX_TRIES) {
        const candidate = suffix === 0 ? input.headBranch : \`\${input.headBranch}-\${suffix}\`;
        const existing = await tryGetRef(token, headOwner, repo, candidate);
        if (!existing) {
          headBranch = candidate;
          break;
        }
        // Branch already exists. If it points at baseSha we could
        // reuse it, but to keep semantics simple we always bump the
        // suffix so we get a clean ref to update.
        if (existing.object.sha === baseSha) {
          headBranch = candidate;
          break;
        }
        suffix += 1;
        headBranch = \`\${input.headBranch}-\${suffix}\`;
      }
      if (suffix >= MAX_BRANCH_SUFFIX_TRIES) {
        const detail = \`could not find a free branch name within \${MAX_BRANCH_SUFFIX_TRIES} tries (last tried: \${headBranch})\`;
        log.push({ step: "pick-head-branch", status: "error", detail });
        return finalize(false, headBranch, { error: detail });
      }
      log.push({
        step: "pick-head-branch",
        status: "ok",
        detail: \`head \${headOwner}/\${repo}:\${headBranch}\`
      });
    } catch (error) {
      const detail = stringifyError(error);
      log.push({ step: "pick-head-branch", status: "error", detail });
      return finalize(false, headBranch, { error: detail });
    }

    // ----- Step 5: ensure the branch exists, pointing at baseSha -----
    try {
      const existing = await tryGetRef(token, headOwner, repo, headBranch);
      if (!existing) {
        await request<GitRefResponse>(
          token,
          \`/repos/\${enc(headOwner)}/\${enc(repo)}/git/refs\`,
          {
            method: "POST",
            body: { ref: \`refs/heads/\${headBranch}\`, sha: baseSha }
          }
        );
        log.push({
          step: "create-branch",
          status: "ok",
          detail: \`created \${headBranch} @ \${shortSha(baseSha)}\`
        });
      } else {
        log.push({
          step: "create-branch",
          status: "skipped",
          detail: \`\${headBranch} already exists @ \${shortSha(existing.object.sha)}\`
        });
      }
    } catch (error) {
      const detail = stringifyError(error);
      log.push({ step: "create-branch", status: "error", detail });
      return finalize(false, headBranch, { error: detail });
    }

    // ----- Step 6: create blobs for each new/changed file -----
    const fileEntries = Object.entries(input.files);
    const blobShas: Array<{ path: string; sha: string }> = [];
    try {
      for (const [path, content] of fileEntries) {
        const { data: blob } = await request<GitBlobResponse>(
          token,
          \`/repos/\${enc(headOwner)}/\${enc(repo)}/git/blobs\`,
          {
            method: "POST",
            body: {
              content: base64Encode(content),
              encoding: "base64"
            }
          }
        );
        blobShas.push({ path, sha: blob.sha });
      }
      log.push({
        step: "create-blobs",
        status: fileEntries.length > 0 ? "ok" : "skipped",
        detail:
          fileEntries.length > 0
            ? \`created \${fileEntries.length} blob(s)\`
            : "no files to write"
      });
    } catch (error) {
      const detail = stringifyError(error);
      log.push({ step: "create-blobs", status: "error", detail });
      return finalize(false, headBranch, { error: detail });
    }

    // ----- Step 7: assemble a new tree -----
    let newTreeSha: string;
    try {
      const treeEntries: Array<{
        path: string;
        mode: string;
        type: "blob";
        sha: string | null;
      }> = [];
      for (const entry of blobShas) {
        treeEntries.push({
          path: entry.path,
          mode: "100644",
          type: "blob",
          sha: entry.sha
        });
      }
      for (const deletePath of input.deletePaths ?? []) {
        treeEntries.push({
          path: deletePath,
          mode: "100644",
          type: "blob",
          sha: null
        });
      }
      if (treeEntries.length === 0) {
        const detail = "nothing to commit (no files and no deletions)";
        log.push({ step: "create-tree", status: "error", detail });
        return finalize(false, headBranch, { error: detail });
      }
      const { data: tree } = await request<GitTreeResponse>(
        token,
        \`/repos/\${enc(headOwner)}/\${enc(repo)}/git/trees\`,
        {
          method: "POST",
          body: {
            base_tree: baseTreeSha,
            tree: treeEntries
          }
        }
      );
      newTreeSha = tree.sha;
      log.push({
        step: "create-tree",
        status: "ok",
        detail: \`tree \${shortSha(newTreeSha)} (\${treeEntries.length} entries)\`
      });
    } catch (error) {
      const detail = stringifyError(error);
      log.push({ step: "create-tree", status: "error", detail });
      return finalize(false, headBranch, { error: detail });
    }

    // ----- Step 8: create the commit -----
    let commitSha: string;
    try {
      const message = input.commitMessage ?? input.title;
      const { data: commit } = await request<GitNewCommitResponse>(
        token,
        \`/repos/\${enc(headOwner)}/\${enc(repo)}/git/commits\`,
        {
          method: "POST",
          body: {
            message,
            tree: newTreeSha,
            parents: [baseSha],
            author: {
              name: input.author.name,
              email: input.author.email
            }
          }
        }
      );
      commitSha = commit.sha;
      log.push({
        step: "create-commit",
        status: "ok",
        detail: \`commit \${shortSha(commitSha)}\`
      });
    } catch (error) {
      const detail = stringifyError(error);
      log.push({ step: "create-commit", status: "error", detail });
      return finalize(false, headBranch, { error: detail });
    }

    // ----- Step 9: update the head ref to point at the new commit -----
    try {
      await request<GitRefResponse>(
        token,
        \`/repos/\${enc(headOwner)}/\${enc(repo)}/git/refs/heads/\${encBranch(headBranch)}\`,
        {
          method: "PATCH",
          body: { sha: commitSha, force: false }
        }
      );
      log.push({
        step: "update-ref",
        status: "ok",
        detail: \`\${headBranch} → \${shortSha(commitSha)}\`
      });
    } catch (error) {
      const detail = stringifyError(error);
      log.push({ step: "update-ref", status: "error", detail });
      return finalize(false, headBranch, { error: detail });
    }

    // ----- Step 10: open the PR on the upstream -----
    let prUrl: string;
    let prNumber: number;
    try {
      const head = input.target.fork ? \`\${input.target.fork.owner}:\${headBranch}\` : headBranch;
      const { data: pr } = await request<GitHubPullResponse>(
        token,
        \`/repos/\${enc(input.target.owner)}/\${enc(repo)}/pulls\`,
        {
          method: "POST",
          body: {
            title: input.title,
            body: input.body,
            head,
            base: input.target.baseBranch
          }
        }
      );
      prUrl = pr.html_url;
      prNumber = pr.number;
      log.push({
        step: "open-pr",
        status: "ok",
        detail: \`#\${prNumber} \${prUrl}\`
      });
    } catch (error) {
      const detail = stringifyError(error);
      log.push({ step: "open-pr", status: "error", detail });
      return finalize(false, headBranch, { error: detail });
    }

    // ----- Step 11: persist idempotency entry (best-effort) -----
    if (idempotencyStore && cacheKey) {
      try {
        await idempotencyStore.put(cacheKey, { prUrl, prNumber });
        log.push({
          step: "idempotency-store",
          status: "ok",
          detail: \`cached PR #\${prNumber}\`
        });
      } catch (error) {
        log.push({
          step: "idempotency-store",
          status: "error",
          detail: stringifyError(error)
        });
        // do not fail the overall PR for a cache write error
      }
    }

    return finalize(true, headBranch, { prUrl, prNumber });
  };
}

// ----- helpers -----

function enc(segment: string): string {
  return encodeURIComponent(segment);
}

/**
 * Encode a branch name for a URL path. Slashes inside the branch
 * (e.g. \`claude/foo-bar\`) must be preserved.
 */
function encBranch(branch: string): string {
  return branch
    .split("/")
    .map((piece) => encodeURIComponent(piece))
    .join("/");
}

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

function stringifyError(error: unknown): string {
  if (error instanceof GitHubApiError) {
    const tail = error.responseText ? \` body=\${truncate(error.responseText, 200)}\` : "";
    return \`\${error.message}\${tail}\`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return \`\${value.slice(0, max)}…\`;
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Base64-encode a UTF-8 string. GitHub's blob API expects the file
 * payload to be base64; we always send \`encoding: "base64"\` so binary
 * content survives the round-trip.
 */
function base64Encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  // btoa is available in Workers + browsers + modern Node.
  return btoa(binary);
}

// === starters/personal-agent/src/voice.ts ===
/**
 * Voice agent — wires Cloudflare's @cloudflare/voice into the
 * openthink2 orchestrator.
 *
 * Architecture:
 *
 *   [Browser]                                [Worker]
 *   useVoiceAgent  ──── WebSocket ───▶  VoiceAgent extends withVoice(Agent)
 *      • mic capture                        • Workers AI STT (transcribe)
 *      • audio playback                     • orchestrator.onTurn(text)
 *      • interim transcript                 • Workers AI TTS (speak)
 *      • interrupt detection                • interruption / mute / end
 *
 * The voice agent reuses the orchestrator runtime — same skills,
 * approval modes, working doc, /goal handler. Voice is just an
 * alternate input/output channel.
 *
 * v0.12.4 Voice connection control: the client passes \`enabled: false\`
 * until mic permission is granted, so the WebSocket only opens once
 * the user has actually consented to record audio.
 */

/** Minimal shape of the connection handle @cloudflare/voice gives us. */
export interface VoiceConnectionLike {
  id?: string;
  send?(message: string | ArrayBuffer): void;
}

export interface VoiceTurnContextLike {
  connection: VoiceConnectionLike;
  messages: { role: string; content: string }[];
  signal: AbortSignal;
}

export interface VoiceTurnLLM {
  /** Stream a completion as \`AsyncIterable<string>\` so withVoice can
   *  start the TTS pipe before the model is done. */
  stream(input: { system: string; messages: { role: string; content: string }[] }): Promise<AsyncIterable<string>>;
}

export interface VoiceTurnHandlerInput<TEnv extends OrchestratorEnvBase> {
  runtime: OrchestratorRuntime<TEnv>;
  llm: VoiceTurnLLM;
}

/**
 * Build the onTurn handler the VoiceAgent class will use. Separates
 * the wiring from the Agents SDK subclassing so the same logic can
 * be exercised in unit tests without instantiating an Agent.
 */
export function buildVoiceTurnHandler<TEnv extends OrchestratorEnvBase>(
  input: VoiceTurnHandlerInput<TEnv>
): (transcript: string, ctx: VoiceTurnContextLike) => Promise<AsyncIterable<string>> {
  return async (transcript, ctx) => {
    // /goal works inside voice too — handle the command before the
    // text reaches the model.
    const slash = await handleSlashCommand(transcript, input.runtime);
    if (slash.handled && slash.message) {
      return stringToAsyncIterable(slash.message);
    }

    const system = await buildOrchestratorSystemPrompt(input.runtime);
    const messages = [...ctx.messages, { role: "user", content: transcript }];

    const stream = await input.llm.stream({ system, messages });
    return abortableStream(stream, ctx.signal);
  };
}

async function* stringToAsyncIterable(text: string): AsyncIterable<string> {
  yield text;
}

async function* abortableStream(
  stream: AsyncIterable<string>,
  signal: AbortSignal
): AsyncIterable<string> {
  for await (const chunk of stream) {
    if (signal.aborted) return;
    yield chunk;
  }
}

/**
 * Pipeline tuning that maps to the @cloudflare/voice client + server
 * options. Surfaced on the Settings page so users can dial it in for
 * their environment.
 */
export interface VoicePipelineSettings {
  /** Microphone volume below which is considered silence. */
  silenceThreshold: number;
  /** How long silence must persist before the turn closes. */
  silenceDurationMs: number;
  /** Volume that triggers a user interruption mid-speech. */
  interruptThreshold: number;
  /** How many consecutive interrupt-loud chunks before we accept. */
  interruptChunks: number;
  /** Cap conversation history sent to the model. */
  historyLimit: number;
  /** Audio format produced by the TTS step. */
  audioFormat: "mp3" | "wav" | "opus";
}

export const defaultVoiceSettings: VoicePipelineSettings = {
  silenceThreshold: 0.04,
  silenceDurationMs: 500,
  interruptThreshold: 0.05,
  interruptChunks: 2,
  historyLimit: 20,
  audioFormat: "mp3"
};

/** Validation guard surfaced in the client + server: keeps settings
 *  inside the ranges @cloudflare/voice will accept. */
export function clampVoiceSettings(input: Partial<VoicePipelineSettings>): VoicePipelineSettings {
  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
  return {
    silenceThreshold: clamp(input.silenceThreshold ?? defaultVoiceSettings.silenceThreshold, 0, 1),
    silenceDurationMs: clamp(
      input.silenceDurationMs ?? defaultVoiceSettings.silenceDurationMs,
      100,
      5000
    ),
    interruptThreshold: clamp(
      input.interruptThreshold ?? defaultVoiceSettings.interruptThreshold,
      0,
      1
    ),
    interruptChunks: clamp(input.interruptChunks ?? defaultVoiceSettings.interruptChunks, 1, 10),
    historyLimit: clamp(input.historyLimit ?? defaultVoiceSettings.historyLimit, 1, 100),
    audioFormat: (["mp3", "wav", "opus"] as const).includes(
      (input.audioFormat ?? defaultVoiceSettings.audioFormat) as "mp3" | "wav" | "opus"
    )
      ? (input.audioFormat ?? defaultVoiceSettings.audioFormat)
      : defaultVoiceSettings.audioFormat
  };
}

/**
 * Hibernation attachment for the voice connection: when the agent's
 * Durable Object hibernates, the per-connection workspace + thread
 * id is preserved via \`serializeAttachment\` so reconnection lands in
 * the same context. The attachment must be JSON-serialisable.
 */
export interface VoiceConnectionAttachment {
  workspaceId: string;
  threadId?: string;
  ownerEmail?: string;
  voiceSettings: VoicePipelineSettings;
}

export function buildVoiceAttachment(
  runtime: OrchestratorRuntime<OrchestratorEnvBase>,
  threadId: string | undefined,
  voiceSettings: VoicePipelineSettings
): VoiceConnectionAttachment {
  const ws = (runtime.env.OPEN_THINK_WORKSPACE_ID as string | undefined) ?? "default";
  const att: VoiceConnectionAttachment = {
    workspaceId: ws,
    voiceSettings
  };
  if (threadId) att.threadId = threadId;
  if (runtime.env.OPEN_THINK_OWNER_EMAIL) att.ownerEmail = String(runtime.env.OPEN_THINK_OWNER_EMAIL);
  return att;
}

// === starters/personal-agent/src/hibernation.ts ===
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
 *   1. When a client connects, call \`attachConnectionMetadata\` with
 *      the workspace + thread + voice settings the connection needs.
 *      The metadata lands inside the WebSocket via \`serializeAttachment\`
 *      so CF persists it for us.
 *   2. After hibernation wakeup, \`readConnectionMetadata(ws)\` returns
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
 *  so this module typechecks before \`@cloudflare/workers-types\` is
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

/** Read the previously-attached metadata, or \`null\` if the socket has
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
 *  expose \`serializeAttachment\` on the WebSocket prototype. */
export function supportsHibernation(ws: unknown): ws is HibernatableWebSocket {
  return Boolean(
    ws &&
      typeof ws === "object" &&
      "serializeAttachment" in (ws as Record<string, unknown>) &&
      "deserializeAttachment" in (ws as Record<string, unknown>)
  );
}

// === starters/personal-agent/src/orchestrator/types.ts ===
/**
 * Orchestrator & workspace types.
 *
 * A workspace is the top-level container. Each workspace holds:
 *   - exactly one orchestrator agent
 *   - any number of specialist child agents
 *   - shared memory (Vectorize) + shared skills
 *
 * The orchestrator is the "always-on" agent that the user talks to by
 * default. It can dispatch to child agents over RPC MCP (no HTTP, no
 * OAuth — see ./mcp-rpc.ts).
 *
 * A single account may run multiple workspaces in parallel. Each gets
 * its own Durable Object instance keyed by workspace id.
 */

export const agentRoleKinds = [
  "orchestrator",
  "coder",
  "researcher",
  "writer",
  "browser",
  "messenger",
  "memory",
  "custom"
] as const;
export type AgentRoleKind = (typeof agentRoleKinds)[number];

export const orchestratorTrainingModes = ["off", "review", "auto-evolve"] as const;
export type OrchestratorTrainingMode = (typeof orchestratorTrainingModes)[number];

export interface AgentDescriptor {
  id: string;
  workspaceId: string;
  role: AgentRoleKind;
  name: string;
  description: string;
  bindingName: string;
  systemPromptOverride?: string;
  enabledSkillIds: string[];
  model?: string;
  pinned: boolean;
  createdAt: string;
}

export interface WorkspaceDescriptor {
  id: string;
  name: string;
  ownerEmail: string;
  description?: string;
  orchestratorId: string;
  childAgentIds: string[];
  trainingMode: OrchestratorTrainingMode;
  defaultModel: string;
  createdAt: string;
}

export const orchestratorDefaults = {
  trainingMode: "review" as OrchestratorTrainingMode,
  defaultModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
};

// === starters/personal-agent/src/orchestrator/orchestrator.ts ===
/**
 * Orchestrator agent — the workspace-level "always-on" agent.
 *
 * Owns:
 *   - the user's main thread feed
 *   - shared memory (Vectorize) read/write coordination
 *   - dispatch to child specialist agents over RPC MCP
 *   - the "working doc" / current-context summary that survives compaction
 *   - the global to-do / project board across threads
 *
 * Implemented as a thin convention layer on top of the Cloudflare
 * Agents SDK Agent class. The actual class lives in agents-sdk.ts so
 * Durable Object bindings stay co-located with the rest of the runtime.
 */

export interface OrchestratorContextSnapshot {
  workspaceId: string;
  activeThreadId: string | undefined;
  recentThreadIds: string[];
  workingDoc: string;
  goals: { id: string; title: string; status: "active" | "done" | "blocked"; updatedAt: string }[];
  trainingMode: OrchestratorTrainingMode;
  pinnedSkillIds: string[];
  childAgents: { id: string; name: string; status: "idle" | "running" | "blocked" }[];
}

export interface OrchestratorStateStore {
  getWorkspace(): Promise<WorkspaceDescriptor>;
  setWorkspace(patch: Partial<WorkspaceDescriptor>): Promise<WorkspaceDescriptor>;
  getContext(): Promise<OrchestratorContextSnapshot>;
  setWorkingDoc(text: string): Promise<void>;
  setActiveThread(threadId: string | undefined): Promise<void>;
  recordChildStatus(childId: string, status: "idle" | "running" | "blocked"): Promise<void>;
  upsertGoal(goal: OrchestratorContextSnapshot["goals"][number]): Promise<void>;
  listChildren(): Promise<AgentDescriptor[]>;
  upsertChild(descriptor: AgentDescriptor): Promise<AgentDescriptor>;
  removeChild(childId: string): Promise<void>;
}

const KEY = {
  workspace: "ws:descriptor",
  workingDoc: "ws:workingDoc",
  activeThread: "ws:activeThread",
  recentThreads: "ws:recentThreads",
  goals: "ws:goals",
  childStatuses: "ws:childStatuses",
  childPrefix: "child:"
} as const;

interface DoStorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>>;
}

export function createOrchestratorStore(
  storage: DoStorageLike,
  bootstrap: { workspaceId: string; ownerEmail: string }
): OrchestratorStateStore {
  return {
    async getWorkspace() {
      const existing = await storage.get<WorkspaceDescriptor>(KEY.workspace);
      if (existing) return existing;
      const fresh: WorkspaceDescriptor = {
        id: bootstrap.workspaceId,
        name: "Default workspace",
        ownerEmail: bootstrap.ownerEmail,
        orchestratorId: "orchestrator-" + bootstrap.workspaceId,
        childAgentIds: [],
        trainingMode: "review",
        defaultModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        createdAt: new Date().toISOString()
      };
      await storage.put(KEY.workspace, fresh);
      return fresh;
    },
    async setWorkspace(patch) {
      const current = await this.getWorkspace();
      const next = { ...current, ...patch };
      await storage.put(KEY.workspace, next);
      return next;
    },
    async getContext() {
      const ws = await this.getWorkspace();
      const workingDoc = (await storage.get<string>(KEY.workingDoc)) ?? "";
      const activeThread = await storage.get<string>(KEY.activeThread);
      const recent = (await storage.get<string[]>(KEY.recentThreads)) ?? [];
      const goals =
        (await storage.get<OrchestratorContextSnapshot["goals"]>(KEY.goals)) ?? [];
      const statuses =
        (await storage.get<Record<string, "idle" | "running" | "blocked">>(KEY.childStatuses)) ??
        {};
      const children = await this.listChildren();
      return {
        workspaceId: ws.id,
        activeThreadId: activeThread,
        recentThreadIds: recent.slice(0, 7),
        workingDoc,
        goals,
        trainingMode: ws.trainingMode,
        pinnedSkillIds: [],
        childAgents: children.map((c) => ({
          id: c.id,
          name: c.name,
          status: statuses[c.id] ?? "idle"
        }))
      };
    },
    async setWorkingDoc(text) {
      await storage.put(KEY.workingDoc, text);
    },
    async setActiveThread(threadId) {
      if (threadId) await storage.put(KEY.activeThread, threadId);
      else await storage.delete(KEY.activeThread);
      const recent = (await storage.get<string[]>(KEY.recentThreads)) ?? [];
      if (threadId && !recent.includes(threadId)) {
        const next = [threadId, ...recent].slice(0, 14);
        await storage.put(KEY.recentThreads, next);
      }
    },
    async recordChildStatus(childId, status) {
      const statuses =
        (await storage.get<Record<string, "idle" | "running" | "blocked">>(KEY.childStatuses)) ??
        {};
      statuses[childId] = status;
      await storage.put(KEY.childStatuses, statuses);
    },
    async upsertGoal(goal) {
      const goals =
        (await storage.get<OrchestratorContextSnapshot["goals"]>(KEY.goals)) ?? [];
      const i = goals.findIndex((g) => g.id === goal.id);
      if (i === -1) goals.unshift(goal);
      else goals[i] = goal;
      await storage.put(KEY.goals, goals.slice(0, 50));
    },
    async listChildren() {
      const map = await storage.list<AgentDescriptor>({ prefix: KEY.childPrefix });
      return Array.from(map.values());
    },
    async upsertChild(descriptor) {
      await storage.put(KEY.childPrefix + descriptor.id, descriptor);
      const ws = await this.getWorkspace();
      if (!ws.childAgentIds.includes(descriptor.id)) {
        await this.setWorkspace({ childAgentIds: [...ws.childAgentIds, descriptor.id] });
      }
      return descriptor;
    },
    async removeChild(childId) {
      await storage.delete(KEY.childPrefix + childId);
      const ws = await this.getWorkspace();
      await this.setWorkspace({
        childAgentIds: ws.childAgentIds.filter((id) => id !== childId)
      });
    }
  };
}

// === starters/personal-agent/src/orchestrator/mcp-rpc.ts ===
/**
 * Wire a child agent to the orchestrator over the Agents SDK's
 * Durable-Object RPC MCP transport.
 *
 * Architecture (from the openthink2 brief):
 *
 *     Agent A (MCP Client)  <—RPC—>  Agent B (McpAgent server)
 *
 *  Both run in the same Worker. Messages travel over the DO RPC
 *  binding — no public internet, no OAuth. The orchestrator binds
 *  every child agent here, and each child registers tools that the
 *  orchestrator can call as part of its own LLM turn.
 *
 * See https://developers.cloudflare.com/agents/api-reference/sub-agents/
 */

export interface RpcAgentBinding<TBinding = unknown> {
  descriptor: AgentDescriptor;
  binding: TBinding;
}

export interface OrchestratorRpcWiringInput<TEnv> {
  /** Async addMcpServer(name, binding) on the orchestrator Agent. */
  addMcpServer: (name: string, binding: unknown) => Promise<void> | void;
  env: TEnv;
  children: AgentDescriptor[];
}

/**
 * Iterate the descriptors and connect each as an RPC MCP server on the
 * orchestrator. Silently skips any descriptor whose bindingName is not
 * present on \`env\` — keeps deploys with partial subagent inventories
 * working.
 */
export async function wireOrchestratorMcpRpc<TEnv extends Record<string, unknown>>(
  input: OrchestratorRpcWiringInput<TEnv>
): Promise<RpcAgentBinding[]> {
  const wired: RpcAgentBinding[] = [];
  for (const descriptor of input.children) {
    const binding = input.env[descriptor.bindingName as keyof TEnv];
    if (!binding) continue;
    await input.addMcpServer(descriptor.name, binding);
    wired.push({ descriptor, binding });
  }
  return wired;
}

/**
 * Helper for generating wrangler bindings. Each child needs:
 *
 *   [[durable_objects.bindings]]
 *   name = "<BINDING_NAME>"
 *   class_name = "<ClassName>"
 *
 *   [[migrations]]
 *   tag = "v1"
 *   new_sqlite_classes = ["<ClassName>"]
 */
export function renderWranglerBindingsForChildren(children: AgentDescriptor[]): string {
  const blocks: string[] = [];
  for (const child of children) {
    blocks.push(
      \`[[durable_objects.bindings]]\\nname = "\${child.bindingName}"\\nclass_name = "\${camelClass(child.bindingName)}"\`
    );
  }
  return blocks.join("\\n\\n");
}

function camelClass(bindingName: string): string {
  return bindingName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .split("_")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

// === starters/personal-agent/src/skills/registry.ts ===
/**
 * Skill registry — named, reusable, swappable agent capabilities.
 *
 * A skill is a unit of agent know-how: a system-prompt snippet, a set
 * of tool bindings, a markdown playbook, or any combination. Skills can
 * be authored locally, pulled from a curated pack, or learned via
 * train-mode.
 *
 * Built-in packs are loaded from constants in this file. Custom skills
 * are persisted in the agent's Durable Object state via SkillStore.
 */

export const skillSourceKinds = [
  "builtin",
  "cloudflare",
  "anthropic",
  "openai",
  "ai-hero",
  "user",
  "learned"
] as const;
export type SkillSourceKind = (typeof skillSourceKinds)[number];

export const skillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: z.enum(skillSourceKinds),
  description: z.string(),
  enabled: z.boolean().default(true),
  pinned: z.boolean().default(false),
  systemPromptFragment: z.string().optional(),
  toolBindings: z.array(z.string()).default([]),
  knowledgeUrls: z.array(z.string().url()).default([]),
  playbookMarkdown: z.string().optional(),
  tags: z.array(z.string()).default([]),
  version: z.string().default("1.0.0"),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export type Skill = z.infer<typeof skillSchema>;

export interface SkillPack {
  id: string;
  label: string;
  source: SkillSourceKind;
  description: string;
  skills: Skill[];
}

const now = () => new Date().toISOString();

const cloudflareSkills: Skill[] = [
  {
    id: "cf.workers-best-practices",
    name: "Cloudflare Workers — best practices",
    source: "cloudflare",
    description:
      "Keep Worker handlers small, externalize state to Durable Objects / KV / D1, prefer streaming, mind isolate startup and the 30s CPU budget.",
    enabled: true,
    pinned: true,
    toolBindings: ["workers.deploy", "wrangler.run"],
    systemPromptFragment:
      "When writing Cloudflare Workers: keep handlers thin, externalize durable state, prefer streaming responses, watch CPU budget, never block the event loop on synchronous work.",
    knowledgeUrls: [
      "https://developers.cloudflare.com/workers/best-practices/workers-best-practices/",
      "https://developers.cloudflare.com/agents/",
      "https://developers.cloudflare.com/workflows/build/events-and-parameters/"
    ],
    tags: ["cloudflare", "workers", "infrastructure"],
    version: "1.0.0",
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: "cf.agents-sdk",
    name: "Cloudflare Agents SDK",
    source: "cloudflare",
    description:
      "Use the Agents SDK Agent / McpAgent classes, addMcpServer for in-worker RPC, and stateful Durable Objects for thread state.",
    enabled: true,
    pinned: true,
    knowledgeUrls: [
      "https://github.com/cloudflare/agents",
      "https://github.com/cloudflare/agents-starter",
      "https://developers.cloudflare.com/agents/api-reference/sub-agents/"
    ],
    toolBindings: ["agents.spawn", "agents.message"],
    tags: ["cloudflare", "agents", "mcp"],
    version: "1.0.0",
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: "cf.mcp-toolkit",
    name: "Cloudflare MCP toolkit",
    source: "cloudflare",
    description:
      "Build MCP servers on Workers with the cloudflare/mcp toolkit. Prefer RPC transport for same-Worker traffic, Streamable HTTP for cross-account.",
    enabled: true,
    pinned: false,
    toolBindings: [],
    knowledgeUrls: ["https://github.com/cloudflare/mcp", "https://blog.cloudflare.com/code-mode-mcp/"],
    tags: ["cloudflare", "mcp"],
    version: "1.0.0",
    createdAt: now(),
    updatedAt: now()
  }
];

const anthropicSkills: Skill[] = [
  {
    id: "anthropic.tool-use",
    name: "Anthropic tool-use patterns",
    source: "anthropic",
    description: "Best practices for Claude tool-use: tight schemas, idempotent tools, retry-on-shape-mismatch.",
    enabled: true,
    pinned: false,
    toolBindings: [],
    knowledgeUrls: ["https://github.com/anthropics/skills"],
    tags: ["anthropic", "tool-use"],
    version: "1.0.0",
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: "anthropic.coding",
    name: "Anthropic — coding playbook",
    source: "anthropic",
    description:
      "Iterative coding: read before edit, prefer Edit over Write, keep comments minimal, run tests before claiming done.",
    enabled: true,
    pinned: false,
    toolBindings: [],
    knowledgeUrls: ["https://github.com/anthropics/skills"],
    tags: ["anthropic", "coding"],
    version: "1.0.0",
    createdAt: now(),
    updatedAt: now()
  }
];

const openaiSkills: Skill[] = [
  {
    id: "openai.self-evolving",
    name: "OpenAI self-evolving agents",
    source: "openai",
    description:
      "Autonomous retraining loop: collect run traces, score outcomes, summarize wins/regressions, propose prompt+skill updates.",
    enabled: false,
    pinned: false,
    toolBindings: [],
    knowledgeUrls: [
      "https://developers.openai.com/cookbook/examples/partners/self_evolving_agents/autonomous_agent_retraining",
      "https://github.com/openai/skills"
    ],
    tags: ["openai", "evolve", "training"],
    version: "1.0.0",
    createdAt: now(),
    updatedAt: now()
  }
];

const aiHeroSkills: Skill[] = [
  {
    id: "ai-hero.starter",
    name: "AI Hero — starter skill pack",
    source: "ai-hero",
    description: "Curated starter playbooks for research, summarization, transcription, and ETL flows.",
    enabled: false,
    pinned: false,
    toolBindings: [],
    knowledgeUrls: ["https://www.aihero.dev/skills.md"],
    tags: ["ai-hero", "starter"],
    version: "1.0.0",
    createdAt: now(),
    updatedAt: now()
  }
];

export const builtinSkillPacks: SkillPack[] = [
  {
    id: "cloudflare",
    label: "Cloudflare",
    source: "cloudflare",
    description: "Cloudflare Workers, Agents SDK, MCP, and platform best practices — preloaded by default.",
    skills: cloudflareSkills
  },
  {
    id: "anthropic",
    label: "Anthropic",
    source: "anthropic",
    description: "Anthropic-curated agent skills (tool-use, coding playbooks).",
    skills: anthropicSkills
  },
  {
    id: "openai",
    label: "OpenAI",
    source: "openai",
    description: "OpenAI-curated agent skills (self-evolving loop).",
    skills: openaiSkills
  },
  {
    id: "ai-hero",
    label: "AI Hero",
    source: "ai-hero",
    description: "Community-curated AI Hero starter pack.",
    skills: aiHeroSkills
  }
];

export interface SkillStore {
  list(): Promise<Skill[]>;
  get(id: string): Promise<Skill | null>;
  put(skill: Skill): Promise<Skill>;
  remove(id: string): Promise<void>;
  preload(packIds: string[]): Promise<void>;
}

export function buildSystemPromptFromSkills(skills: Skill[]): string {
  const enabled = skills.filter((s) => s.enabled && s.systemPromptFragment);
  if (enabled.length === 0) return "";
  const lines = ["# Active skills"];
  for (const skill of enabled) {
    lines.push(\`## \${skill.name}\`);
    lines.push(skill.systemPromptFragment!);
    lines.push("");
  }
  return lines.join("\\n");
}

export function flattenPacks(packs: SkillPack[]): Skill[] {
  return packs.flatMap((pack) => pack.skills);
}

export function defaultPreloadPackIds(): string[] {
  // Cloudflare loads by default for everyone; the rest are opt-in.
  return ["cloudflare"];
}

// === starters/personal-agent/src/skills/store.ts ===
/**
 * Durable Object–backed SkillStore.
 *
 * Skills are stored as JSON in the DO's sqlite-backed key/value storage
 * so they survive restarts and migrate with the agent.
 */

const PREFIX = "skill:";

interface DoStorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>>;
}

export function createDoSkillStore(storage: DoStorageLike): SkillStore {
  return {
    async list() {
      const map = await storage.list<Skill>({ prefix: PREFIX });
      return Array.from(map.values());
    },
    async get(id) {
      const value = await storage.get<Skill>(PREFIX + id);
      return value ?? null;
    },
    async put(skill) {
      const stamped: Skill = {
        ...skill,
        createdAt: skill.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await storage.put(PREFIX + stamped.id, stamped);
      return stamped;
    },
    async remove(id) {
      await storage.delete(PREFIX + id);
    },
    async preload(packIds) {
      const wanted = new Set(packIds);
      const packs: SkillPack[] = builtinSkillPacks.filter((p) => wanted.has(p.id));
      const existing = await storage.list<Skill>({ prefix: PREFIX });
      const have = new Set(Array.from(existing.keys()));
      for (const skill of flattenPacks(packs)) {
        const key = PREFIX + skill.id;
        if (have.has(key)) continue;
        await storage.put(key, {
          ...skill,
          createdAt: skill.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }
  };
}

// === starters/personal-agent/src/workflows/ir.ts ===
/**
 * Workflow IR — the runtime-neutral intermediate representation that
 * the JSX / function DSL compiles into.
 *
 * Nodes are tagged unions so a runtime can switch on \`kind\` and an
 * interpreter can implement each operator without coupling to the
 * authoring syntax (JSX, fluent builders, or hand-written IR).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [k: string]: Json }
  | Json[];

export interface IRTask<TIn = unknown, TOut = unknown> {
  kind: "task";
  name: string;
  /** Optional Effect Schema for the task's input/output. The runner
   *  validates the resolved input *before* calling \`handler\` and the
   *  produced output *before* persisting it. */
  input?: Schema.Schema<TIn, unknown>;
  output?: Schema.Schema<TOut, unknown>;
  /** Pure handler; the runner is responsible for durability. */
  handler: (input: TIn, ctx: TaskContext) => Promise<TOut>;
  /** Per-task retry override (\`{ limit, backoff?: "exponential" | "linear" }\`). */
  retry?: { limit: number; backoff?: "exponential" | "linear" };
}

export interface IRSequence {
  kind: "sequence";
  name?: string;
  children: WorkflowNode[];
}

export interface IRParallel {
  kind: "parallel";
  name?: string;
  children: WorkflowNode[];
  /** Concurrency cap. Defaults to unbounded (Effect.all default). */
  concurrency?: number;
}

export interface IRBranch {
  kind: "branch";
  name?: string;
  /** Predicate is evaluated against the workflow scope on every run. */
  predicate: (scope: WorkflowScope) => boolean;
  whenTrue: WorkflowNode;
  whenFalse?: WorkflowNode;
}

export interface IRRalph {
  kind: "ralph";
  name?: string;
  /** Loop body — re-runs while \`condition\` returns true. */
  body: WorkflowNode;
  condition: (scope: WorkflowScope, iteration: number) => boolean;
  maxIterations: number;
}

export interface IRWorkflow {
  kind: "workflow";
  name: string;
  version: string;
  input?: Schema.Schema<unknown, unknown>;
  output?: Schema.Schema<unknown, unknown>;
  body: WorkflowNode;
}

export type WorkflowNode =
  | IRTask<unknown, unknown>
  | IRSequence
  | IRParallel
  | IRBranch
  | IRRalph;

/**
 * Per-task context handed to the handler. Carries the workflow's
 * scope (so handlers can read earlier task outputs) plus durability
 * hooks the runner injects.
 */
export interface TaskContext {
  scope: WorkflowScope;
  /** Persist a key/value pair that survives a workflow restart. */
  persist: (key: string, value: Json) => Promise<void>;
  /** Read previously-persisted value. */
  recall: (key: string) => Promise<Json | undefined>;
  /** Structured logger — routed to the workflow's run log. */
  log: (level: "debug" | "info" | "warn" | "error", message: string, extra?: Json) => void;
}

/** Read-only view of the running workflow's named task outputs. */
export interface WorkflowScope {
  get<T = unknown>(taskName: string): T | undefined;
  has(taskName: string): boolean;
  /** Workflow input. */
  input: unknown;
  /** All outputs keyed by task name, for debugging / branching. */
  outputs: Readonly<Record<string, unknown>>;
}

// === starters/personal-agent/src/workflows/dsl.ts ===
/**
 * Workflow DSL — author workflows two ways with the same IR output.
 *
 * Function API (recommended for tests + plain TS):
 *
 *   workflow("greet", { version: "1.0.0" },
 *     sequence(
 *       task("fetch-user", { handler: async (input) => ... }),
 *       parallel(
 *         task("score-a", { handler: ... }),
 *         task("score-b", { handler: ... })
 *       ),
 *       branch(scope => scope.get("score-a")! > 0.5,
 *         task("congratulate", { handler: ... }),
 *         task("retry",        { handler: ... })
 *       )
 *     )
 *   );
 *
 * JSX-compatible API (for tsx files using a @jsxImportSource pragma
 * to bind to our \`h\` factory):
 *
 *   <Workflow name="greet" version="1.0.0">
 *     <Sequence>
 *       <Task name="fetch-user" handler={…} />
 *       <Parallel>
 *         <Task name="score-a" handler={…} />
 *         <Task name="score-b" handler={…} />
 *       </Parallel>
 *     </Sequence>
 *   </Workflow>
 *
 * Both produce the same IR; the runner doesn't care which path
 * you used.
 */

// ----- function API --------------------------------------------------------

export interface TaskOptions<TIn, TOut> {
  input?: Schema.Schema<TIn, unknown>;
  output?: Schema.Schema<TOut, unknown>;
  handler: (input: TIn, ctx: TaskContext) => Promise<TOut>;
  retry?: { limit: number; backoff?: "exponential" | "linear" };
}

export function task<TIn = unknown, TOut = unknown>(
  name: string,
  options: TaskOptions<TIn, TOut>
): IRTask<unknown, unknown> {
  // Erase the precise input/output generics at the boundary so the
  // resulting node fits inside the WorkflowNode union without
  // exactOptionalPropertyTypes variance complaints. \`as never\` then
  // \`as IRTask<unknown, unknown>\` is intentional — TypeScript is
  // strict here and Schema is invariant in its first parameter, so
  // we accept the precise schema at the call site and store the
  // erased form on the node.
  const node: Record<string, unknown> = {
    kind: "task",
    name,
    handler: options.handler
  };
  if (options.input) node.input = options.input;
  if (options.output) node.output = options.output;
  if (options.retry) node.retry = options.retry;
  return node as unknown as IRTask<unknown, unknown>;
}

export function sequence(...children: WorkflowNode[]): IRSequence;
export function sequence(opts: { name?: string }, ...children: WorkflowNode[]): IRSequence;
export function sequence(
  first?: WorkflowNode | { name?: string },
  ...rest: WorkflowNode[]
): IRSequence {
  if (first && !("kind" in first)) {
    const node: IRSequence = { kind: "sequence", children: rest };
    if (first.name) node.name = first.name;
    return node;
  }
  const children = first ? [first as WorkflowNode, ...rest] : rest;
  return { kind: "sequence", children };
}

export function parallel(...children: WorkflowNode[]): IRParallel;
export function parallel(
  opts: { name?: string; concurrency?: number },
  ...children: WorkflowNode[]
): IRParallel;
export function parallel(
  first?: WorkflowNode | { name?: string; concurrency?: number },
  ...rest: WorkflowNode[]
): IRParallel {
  if (first && !("kind" in first)) {
    const node: IRParallel = { kind: "parallel", children: rest };
    if (first.name) node.name = first.name;
    if (first.concurrency) node.concurrency = first.concurrency;
    return node;
  }
  const children = first ? [first as WorkflowNode, ...rest] : rest;
  return { kind: "parallel", children };
}

export function branch(
  predicate: (scope: WorkflowScope) => boolean,
  whenTrue: WorkflowNode,
  whenFalse?: WorkflowNode
): IRBranch {
  const node: IRBranch = { kind: "branch", predicate, whenTrue };
  if (whenFalse) node.whenFalse = whenFalse;
  return node;
}

export function ralph(input: {
  name?: string;
  body: WorkflowNode;
  condition: (scope: WorkflowScope, iteration: number) => boolean;
  maxIterations?: number;
}): IRRalph {
  const node: IRRalph = {
    kind: "ralph",
    body: input.body,
    condition: input.condition,
    maxIterations: input.maxIterations ?? 32
  };
  if (input.name) node.name = input.name;
  return node;
}

export function workflow(
  name: string,
  options: {
    version?: string;
    input?: Schema.Schema<unknown, unknown>;
    output?: Schema.Schema<unknown, unknown>;
  } = {},
  body: WorkflowNode
): IRWorkflow {
  const node: IRWorkflow = {
    kind: "workflow",
    name,
    version: options.version ?? "1.0.0",
    body
  };
  if (options.input) node.input = options.input;
  if (options.output) node.output = options.output;
  return node;
}

// ----- JSX-compatible h() factory ------------------------------------------

/**
 * JSX factory that produces our IR. Bind via per-file pragmas
 * (\`@jsxRuntime classic\` + \`@jsx h\`) or set \`jsxFactory: "h"\` in
 * tsconfig.json (we keep React for the rest of the UI — workflow
 * files opt in per-file).
 *
 * Usage (pragmas omitted from the example to avoid nesting comments):
 *
 *   import { h, Workflow, Task, Sequence } from "./workflows";
 *   const greet = (
 *     <Workflow name="greet" version="1.0.0">
 *       <Sequence>
 *         <Task name="hello" handler={async () => "hi"} />
 *       </Sequence>
 *     </Workflow>
 *   );
 */
// We deliberately type the h() factory loosely because each component
// has a different props shape — the runtime safety comes from the
// individual factory functions (Task, Workflow, etc).
type LooseFactory = (props: never, ...children: unknown[]) => WorkflowNode | IRWorkflow;

export function h(
  type: LooseFactory | string,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): WorkflowNode | IRWorkflow {
  if (typeof type !== "function") {
    throw new Error(\`Workflow JSX: unknown element <\${String(type)}>\`);
  }
  const flat = flattenChildren(children);
  return type({ ...(props ?? {}), children: flat } as never, ...flat);
}

function flattenChildren(children: unknown[]): WorkflowNode[] {
  const out: WorkflowNode[] = [];
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) {
      out.push(...flattenChildren(child));
    } else {
      out.push(child as WorkflowNode);
    }
  }
  return out;
}

interface JsxChildren {
  children?: WorkflowNode | WorkflowNode[];
}

export function Task<TIn = unknown, TOut = unknown>(
  props: TaskOptions<TIn, TOut> & { name: string }
): IRTask<unknown, unknown> {
  const { name, ...rest } = props;
  return task(name, rest);
}

export function Sequence(props: { name?: string } & JsxChildren): IRSequence {
  const opts: { name?: string } = {};
  if (props.name) opts.name = props.name;
  return sequence(opts, ...toArray(props.children));
}

export function Parallel(
  props: { name?: string; concurrency?: number } & JsxChildren
): IRParallel {
  const opts: { name?: string; concurrency?: number } = {};
  if (props.name) opts.name = props.name;
  if (props.concurrency) opts.concurrency = props.concurrency;
  return parallel(opts, ...toArray(props.children));
}

export function Branch(props: {
  predicate: (scope: WorkflowScope) => boolean;
  children: [WorkflowNode] | [WorkflowNode, WorkflowNode];
}): IRBranch {
  const [whenTrue, whenFalse] = toArray(props.children) as [WorkflowNode, WorkflowNode?];
  return branch(props.predicate, whenTrue, whenFalse);
}

export function Ralph(props: {
  name?: string;
  condition: (scope: WorkflowScope, iteration: number) => boolean;
  maxIterations?: number;
  children: WorkflowNode;
}): IRRalph {
  const input: Parameters<typeof ralph>[0] = {
    body: Array.isArray(props.children) ? props.children[0]! : props.children,
    condition: props.condition
  };
  if (props.name) input.name = props.name;
  if (props.maxIterations) input.maxIterations = props.maxIterations;
  return ralph(input);
}

export function Workflow(
  props: {
    name: string;
    version?: string;
    input?: Schema.Schema<unknown, unknown>;
    output?: Schema.Schema<unknown, unknown>;
  } & JsxChildren
): IRWorkflow {
  const children = toArray(props.children);
  if (children.length !== 1) {
    throw new Error(\`<Workflow name="\${props.name}"> requires exactly one child node, got \${children.length}.\`);
  }
  const opts: Parameters<typeof workflow>[1] = {};
  if (props.version) opts.version = props.version;
  if (props.input) opts.input = props.input;
  if (props.output) opts.output = props.output;
  return workflow(props.name, opts, children[0]!);
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

// === starters/personal-agent/src/workflows/interpreter.ts ===
/**
 * Effect-based interpreter for the workflow IR.
 *
 * Each IR node maps to an Effect:
 *   - task      → Effect.tryPromise of the handler, with Schema-validated
 *                 input/output and optional retry schedule.
 *   - sequence  → Effect.gen, yields each child in order, threads the
 *                 scope forward.
 *   - parallel  → Effect.all with optional concurrency cap.
 *   - branch    → Match.value over the predicate result.
 *   - ralph     → Effect.iterate over the body up to maxIterations.
 *
 * The interpreter is durability-agnostic: the runner (see runner.ts)
 * injects a TaskContext whose \`persist\` / \`recall\` are wired to
 * Cloudflare Workflows' \`step.do()\` checkpoints so a crash mid-run
 * resumes from the last completed task.
 */

export class WorkflowTaskError extends Data.TaggedError("WorkflowTaskError")<{
  readonly taskName: string;
  readonly cause: unknown;
  readonly message: string;
}> {}

export class WorkflowSchemaError extends Data.TaggedError("WorkflowSchemaError")<{
  readonly taskName: string;
  readonly stage: "input" | "output";
  readonly cause: ParseError;
}> {}

export interface InterpreterDeps {
  buildTaskContext: (task: IRTask, scope: WorkflowScope) => TaskContext;
  /** Optional callback fired around every task — useful for the runner
   *  to insert CF Workflows \`step.do\` boundaries. */
  withStep?: <A, E>(
    task: IRTask,
    body: Effect.Effect<A, E>
  ) => Effect.Effect<A, E>;
}

interface MutableScope {
  input: unknown;
  outputs: Record<string, unknown>;
}

function freezeScope(state: MutableScope): WorkflowScope {
  return {
    input: state.input,
    outputs: state.outputs,
    has(taskName) {
      return Object.prototype.hasOwnProperty.call(state.outputs, taskName);
    },
    get(taskName) {
      return state.outputs[taskName] as never;
    }
  };
}

export function interpret(
  workflow: IRWorkflow,
  input: unknown,
  deps: InterpreterDeps
): Effect.Effect<Record<string, unknown>, WorkflowTaskError | WorkflowSchemaError> {
  const state: MutableScope = { input, outputs: {} };

  return Effect.gen(function* () {
    if (workflow.input) {
      yield* decode(workflow.input, input, workflow.name, "input");
    }
    yield* interpretNode(workflow.body, state, deps);
    if (workflow.output) {
      yield* decode(workflow.output, state.outputs, workflow.name, "output");
    }
    return state.outputs;
  });
}

function interpretNode(
  node: WorkflowNode,
  state: MutableScope,
  deps: InterpreterDeps
): Effect.Effect<void, WorkflowTaskError | WorkflowSchemaError> {
  switch (node.kind) {
    case "task":
      return interpretTask(node, state, deps);
    case "sequence":
      return interpretSequence(node, state, deps);
    case "parallel":
      return interpretParallel(node, state, deps);
    case "branch":
      return interpretBranch(node, state, deps);
    case "ralph":
      return interpretRalph(node, state, deps);
  }
}

function interpretTask(
  node: IRTask,
  state: MutableScope,
  deps: InterpreterDeps
): Effect.Effect<void, WorkflowTaskError | WorkflowSchemaError> {
  const body = Effect.gen(function* () {
    const scope = freezeScope(state);
    let resolvedInput: unknown = state.input;
    if (node.input) {
      resolvedInput = yield* decode(node.input, state.input, node.name, "input");
    }
    const ctx = deps.buildTaskContext(node, scope);
    const raw = yield* Effect.tryPromise({
      try: () => (node.handler as (i: unknown, c: TaskContext) => Promise<unknown>)(resolvedInput, ctx),
      catch: (error) =>
        new WorkflowTaskError({
          taskName: node.name,
          cause: error,
          message: error instanceof Error ? error.message : String(error)
        })
    });
    const validated = node.output
      ? yield* decode(node.output, raw, node.name, "output")
      : raw;
    state.outputs[node.name] = validated;
  });
  return deps.withStep ? deps.withStep(node, body) : body;
}

function interpretSequence(
  node: IRSequence,
  state: MutableScope,
  deps: InterpreterDeps
): Effect.Effect<void, WorkflowTaskError | WorkflowSchemaError> {
  return Effect.gen(function* () {
    for (const child of node.children) {
      yield* interpretNode(child, state, deps);
    }
  });
}

function interpretParallel(
  node: IRParallel,
  state: MutableScope,
  deps: InterpreterDeps
): Effect.Effect<void, WorkflowTaskError | WorkflowSchemaError> {
  // Each parallel branch sees the *current* outputs but writes back
  // into a per-branch copy that's merged at join time. This keeps
  // the IR semantics deterministic even when branches finish out of
  // order.
  const snapshot = { ...state.outputs };
  const children = node.children.map((child) => {
    const local: MutableScope = { input: state.input, outputs: { ...snapshot } };
    return interpretNode(child, local, deps).pipe(
      Effect.map(() => local.outputs)
    );
  });

  const options: { concurrency?: number } = {};
  if (typeof node.concurrency === "number") options.concurrency = node.concurrency;

  return Effect.gen(function* () {
    const results = yield* Effect.all(children, options);
    for (const localOutputs of results) {
      for (const [name, value] of Object.entries(localOutputs)) {
        if (!Object.prototype.hasOwnProperty.call(snapshot, name)) {
          state.outputs[name] = value;
        }
      }
    }
  });
}

function interpretBranch(
  node: IRBranch,
  state: MutableScope,
  deps: InterpreterDeps
): Effect.Effect<void, WorkflowTaskError | WorkflowSchemaError> {
  return Effect.gen(function* () {
    const took = node.predicate(freezeScope(state));
    if (took) {
      yield* interpretNode(node.whenTrue, state, deps);
    } else if (node.whenFalse) {
      yield* interpretNode(node.whenFalse, state, deps);
    }
  });
}

function interpretRalph(
  node: IRRalph,
  state: MutableScope,
  deps: InterpreterDeps
): Effect.Effect<void, WorkflowTaskError | WorkflowSchemaError> {
  return Effect.gen(function* () {
    let iteration = 0;
    while (iteration < node.maxIterations && node.condition(freezeScope(state), iteration)) {
      yield* interpretNode(node.body, state, deps);
      iteration += 1;
    }
  });
}

function decode<A>(
  schema: Schema.Schema<A, unknown>,
  value: unknown,
  taskName: string,
  stage: "input" | "output"
): Effect.Effect<A, WorkflowSchemaError> {
  return Effect.mapError(Schema.decodeUnknown(schema)(value), (cause) =>
    new WorkflowSchemaError({ taskName, stage, cause })
  );
}

// === starters/personal-agent/src/workflows/runner.ts ===
/**
 * Runners for the workflow IR.
 *
 *  - runWorkflow(workflow, input)        — pure Effect runner, in-memory.
 *                                          Use for tests + same-isolate work.
 *  - runWorkflowOnCloudflare(...)        — adapts each \`<Task>\` to a
 *                                          Cloudflare Workflow \`step.do()\`
 *                                          checkpoint so a crash mid-run
 *                                          resumes from the last completed
 *                                          task. Reference:
 *                                          https://developers.cloudflare.com/workflows/
 */

interface MemoryStore {
  data: Map<string, Json>;
}

function buildMemoryTaskContext(
  _task: IRTask,
  scope: WorkflowScope,
  store: MemoryStore,
  logger?: TaskContext["log"]
): TaskContext {
  return {
    scope,
    async persist(key, value) {
      store.data.set(key, value);
    },
    async recall(key) {
      return store.data.get(key);
    },
    log: logger ?? (() => {})
  };
}

export interface RunWorkflowOptions {
  /** Custom logger; default is console-quiet. */
  logger?: TaskContext["log"];
}

export async function runWorkflow(
  workflow: IRWorkflow,
  input: unknown,
  options: RunWorkflowOptions = {}
): Promise<Record<string, unknown>> {
  const store: MemoryStore = { data: new Map() };
  const eff = interpret(workflow, input, {
    buildTaskContext: (task, scope) => buildMemoryTaskContext(task, scope, store, options.logger)
  });
  return Effect.runPromise(eff);
}

// ----- Cloudflare Workflows runner -----------------------------------------

/**
 * Minimal shape of the Cloudflare Workflows \`WorkflowStep\` we depend
 * on. Kept structural so the runner can be tested without the real
 * binding and so SDK minor-version drift doesn't break the surface.
 */
export interface CloudflareWorkflowStep {
  do<T>(
    name: string,
    options:
      | { retries?: { limit?: number; backoff?: "exponential" | "linear" } }
      | (() => T | Promise<T>),
    handler?: () => T | Promise<T>
  ): Promise<T>;
}

interface CloudflareDurableStore {
  /** Workflow-level persistence — survives restarts. CF Workflows
   *  itself does this for \`step.do\` returns; we hand the same store
   *  to tasks for ad-hoc key/value needs. */
  put(key: string, value: Json): Promise<void>;
  get(key: string): Promise<Json | undefined>;
}

export interface RunOnCloudflareInput {
  workflow: IRWorkflow;
  input: unknown;
  step: CloudflareWorkflowStep;
  store?: CloudflareDurableStore;
  logger?: TaskContext["log"];
}

export async function runWorkflowOnCloudflare(
  input: RunOnCloudflareInput
): Promise<Record<string, unknown>> {
  const memory: MemoryStore = { data: new Map() };
  const store: CloudflareDurableStore = input.store ?? {
    async put(key, value) {
      memory.data.set(key, value);
    },
    async get(key) {
      return memory.data.get(key);
    }
  };

  const eff = interpret(input.workflow, input.input, {
    buildTaskContext: (task, scope): TaskContext => ({
      scope,
      persist: (key, value) => store.put(\`\${task.name}:\${key}\`, value),
      recall: (key) => store.get(\`\${task.name}:\${key}\`),
      log: input.logger ?? (() => {})
    }),
    withStep: (task, body) => wrapStep(task, body, input.step)
  });

  return Effect.runPromise(eff);
}

function wrapStep<A, E>(
  task: IRTask,
  body: Effect.Effect<A, E>,
  step: CloudflareWorkflowStep
): Effect.Effect<A, E> {
  return Effect.tryPromise({
    try: async () => {
      const handler = async () => Effect.runPromise(body as Effect.Effect<A, never>);
      const retryOption = task.retry
        ? task.retry.backoff
          ? { retries: { limit: task.retry.limit, backoff: task.retry.backoff } }
          : { retries: { limit: task.retry.limit } }
        : undefined;
      if (retryOption) {
        return (await step.do(task.name, retryOption, handler)) as A;
      }
      return (await step.do(task.name, handler)) as A;
    },
    catch: (cause) => cause as E
  });
}
`;
