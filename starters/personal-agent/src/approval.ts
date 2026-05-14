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
  const fullName = ctx.toolNamespace ? `${ctx.toolNamespace}.${ctx.toolName}` : ctx.toolName;
  if (config.neverAllow.includes(fullName)) {
    return { allow: false, reason: `Blocked by neverAllow rule for ${fullName}` };
  }
  if (config.alwaysAllow.includes(fullName)) {
    return { allow: true, reason: `alwaysAllow rule for ${fullName}` };
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
        reason: `cost ${ctx.estimatedCostUsd!.toFixed(2)} USD exceeds requireApprovalOver`
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
