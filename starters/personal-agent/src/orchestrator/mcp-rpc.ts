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

import type { AgentDescriptor } from "./types";

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
 * present on `env` — keeps deploys with partial subagent inventories
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
      `[[durable_objects.bindings]]\nname = "${child.bindingName}"\nclass_name = "${camelClass(child.bindingName)}"`
    );
  }
  return blocks.join("\n\n");
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
