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
