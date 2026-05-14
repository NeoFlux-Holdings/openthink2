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
`;
