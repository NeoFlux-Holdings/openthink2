# Orchestrator and sub-agents

openthink2 ships a workspace model. Every deploy creates one workspace by
default, with one orchestrator agent and zero or more specialist child
agents. The user always talks to the orchestrator; the orchestrator
dispatches to children when it makes sense.

## Why a workspace

A workspace is the durable boundary for:

- **Working doc** — a persistent summary the orchestrator maintains across
  context compaction. The Persona spec calls this the "agent's notes" for
  normies; advanced users can edit it directly.
- **Recent threads + project board** — durable lists that survive Worker
  restarts and isolate hibernation.
- **Skills** — a workspace-scoped SkillStore (Durable Object–backed).
- **Shared memory** — a Vectorize index shared by orchestrator and all
  children so they can read/write each other's context without losing
  attribution.
- **Approval policy + spend caps** — set once at the workspace level and
  enforced for every tool call.

A user can run multiple workspaces in parallel — for example one for
personal tasks, one for a side project — by spinning up multiple
orchestrator DOs keyed by workspace id.

## RPC MCP, not HTTP

Child agents live in the same Worker as the orchestrator and are exposed
as `McpAgent` Durable Objects. The orchestrator calls them via the Agents
SDK's `addMcpServer(name, binding)` helper, which uses the Durable Object
RPC transport.

```
 Agent A (MCP client) ↔ Agent B (McpAgent server)
        │
        └── messages flow directly through CF Durable Object RPC
            • no public internet hop
            • no OAuth
            • zero added latency beyond the DO-to-DO call
```

This matches the openthink2 brief and the
[Cloudflare sub-agents reference](https://developers.cloudflare.com/agents/api-reference/sub-agents/).

## Defining a child agent

```ts
// agents/coder.ts
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export class AgentCoder extends McpAgent<Env> {
  server = new McpServer({ name: "coder", version: "1.0.0" });

  async init() {
    this.server.tool(
      "edit_file",
      "Edit a file in the agent's Sandbox workspace",
      { path: z.string(), patch: z.string() },
      async ({ path, patch }) => {
        // can read this.state, this.sql, this.env directly
        return { content: [{ type: "text", text: `Applied patch to ${path}` }] };
      }
    );
  }
}
```

## Wiring children on the orchestrator

```ts
// agents/orchestrator.ts
import { Agent } from "agents";
import { wireOrchestratorMcpRpc } from "./orchestrator/mcp-rpc";

export class OrchestratorAgent extends Agent<Env> {
  async onStart() {
    const children = await this.listChildDescriptors(); // from your store
    await wireOrchestratorMcpRpc({
      env: this.env,
      children,
      addMcpServer: (name, binding) => this.addMcpServer(name, binding)
    });
  }
}
```

## Wrangler bindings

For every child class, add a Durable Object binding and a migration entry:

```jsonc
{
  "durable_objects": {
    "bindings": [
      { "name": "AGENT_CODER", "class_name": "AgentCoder" },
      { "name": "AGENT_RESEARCHER", "class_name": "AgentResearcher" }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["AgentCoder", "AgentRESEARCHER"]
    }
  ]
}
```

`renderWranglerBindingsForChildren()` in `orchestrator/mcp-rpc.ts` can
emit these blocks from a list of `AgentDescriptor`s, so adding a new
child amounts to one descriptor + one redeploy.

## Bottom-up communication

The orchestrator-as-client pattern handles top-down. For bottom-up
("child wants to ask the orchestrator a question"), expose orchestrator
context tools on the orchestrator's *own* McpAgent server side (the
Agents SDK allows an Agent to be both client and server when needed).
Children connect to the orchestrator's binding the same way.

In practice we keep the surface narrow — children call back through
named tools like `request_human_review`, `request_orchestrator_context`,
or `update_working_doc`.

## Training mode and self-evolve

The orchestrator records every run as a `RunTrace`. Periodically — on a
cron trigger or when the user clicks "review what happened" — the
`runEvolveLoop` function in `evolve/loop.ts` summarizes wins,
regressions, and emits skill / rubric / prompt suggestions. In
`auto-evolve` training mode, low-blast-radius suggestions auto-apply;
the rest land in the Learning page for user review.

The evolve loop is modeled directly on the
[OpenAI self-evolving-agents cookbook](https://developers.openai.com/cookbook/examples/partners/self_evolving_agents/autonomous_agent_retraining).
