# Smithery — the third execution lane

openthink2 mounts three classes of MCP servers:

| Lane | Transport | Auth | Typical use |
|------|-----------|------|-------------|
| **in-worker McpAgents** | Durable Object RPC | none (same-Worker) | The orchestrator's own specialist sub-agents (coder, researcher, browser, …). Default. |
| **executor.sh** | Streamable HTTP | WorkOS JWT | Cloud MCP gateway for the executor.sh tool surface. Opt-in. |
| **Smithery** | Streamable HTTP | Per-user Smithery API key | The MCP server registry at [smithery.ai](https://smithery.ai) — 7,000+ servers, hosted by Smithery (GitHub, Linear, Slack, Notion, Playwright, …). Opt-in. |

These lanes are complementary. Cloudflare provides the runtime
(Workers / Durable Objects / Sandbox), Smithery provides the
marketplace of MCP servers you don't want to build or host yourself.

## Setup

1. Sign up at [smithery.ai](https://smithery.ai) and copy your API key.
2. In the deployed agent's Settings page, enable the **Smithery**
   execution lane and paste the key. The platform writes it as the
   `OPEN_THINK_SMITHERY_API_KEY` Worker secret.
3. Open the Skills page (or the Smithery registry surface) and install
   the servers you want. Per-server config (e.g. a GitHub token for the
   GitHub MCP server) is encrypted at rest in Durable Object storage —
   never in plaintext D1.

## How it works

`starters/personal-agent/src/smithery.ts` exposes:

- `createSmitheryClient({ apiKey })` — browse the registry, get a
  single server's metadata.
- `createSmitheryStore(storage)` — DO-backed per-installation state
  (config blob, enabled flag, install timestamp).
- `buildSmitheryServerConfig({ qualifiedName, apiKey, installation })`
  — returns the `{ url, headers }` shape the Agents SDK's
  `addMcpServer()` accepts. The per-install config is base64-encoded
  into the URL so the hosted server knows which credentials to use
  without persisting state on Smithery's side.
- `buildSmitheryMountCalls({ store, apiKey })` — returns one mount
  call per enabled installation. Called by `initOrchestrator()` at
  boot.

```ts
// inside OrchestratorAgent.onStart() (handled by initOrchestrator)
const calls = await buildSmitheryMountCalls({
  store: smitheryStore,
  apiKey: env.OPEN_THINK_SMITHERY_API_KEY
});
for (const call of calls) {
  await this.addMcpServer(call.name, { url: call.url, headers: call.headers });
}
```

A failure mounting an individual Smithery server doesn't take down
the orchestrator — the boot loop swallows per-server errors so a
broken installation can't brick the agent.

## When to pick which lane

- **In-worker McpAgents** for tight, custom logic that benefits from
  zero-latency Durable Object RPC and access to the agent's own
  state (skills store, working doc, approval config).
- **executor.sh** when you specifically want the executor.sh tool
  surface or its sandboxed isolate execution model.
- **Smithery** when there's already a high-quality MCP server in the
  registry for what you need (GitHub, Linear, Notion, Slack,
  Playwright browser automation, search providers, etc.). Always
  cheaper to install than to build.

You can run all three at once — the orchestrator's LLM sees a single
merged tool surface from every mounted MCP server regardless of lane.
