# OpenThink 2

`openthink2` is a Cloudflare-native Personal Agent OS. The v0.4 platform is
organized around a Worker entrypoint, Durable Object coordination, RPC MCP
sub-agents, and Container/Sandbox-backed execution, with first-class
deployment, chat, artifact, and terminal control surfaces.

Public source: [NeoFlux-Holdings/openthink2](https://github.com/NeoFlux-Holdings/openthink2)

This repository is the second take on the personal-agent platform. The first
two attempts at [NeoFlux-Holdings/OpenThink](https://github.com/NeoFlux-Holdings/OpenThink)
and the lowercase mirror serve as references — some pieces (Cloudflare Access
provisioning, scoped token UX) work well and were carried forward; the rest
was rewritten or extended for openthink2.

## What is included

- `apps/platform`: Next.js platform shell — marketing site, one-click deploy
  flow, chat, terminal, sync, admin, and the Cloudflare Workers entry. Runs as
  an OpenNext Worker on Cloudflare.
- `apps/docs`: VitePress documentation site.
- `packages/*`: swappable runtime contracts (state, llm, memory, retrieval,
  storage, sync, tasks, network, mcp, sandbox, terminal, ui, core).
- `starters/personal-agent`: the user-owned agent Worker that gets generated
  and deployed per launch. Now ships with orchestrator, RPC sub-agent MCP,
  skills, approval modes, code-mode, executor.sh, self-evolve.
- `tools`: provisioning helpers for the platform's own Cloudflare resources.

## The openthink2 architecture in one diagram

```
                ┌──────────────────────────────────────────────────┐
                │  apps/platform  (Next.js → Cloudflare Worker)    │
                │  - marketing + onboarding                         │
                │  - deploy flow (self / stripe / button / partner)│
                │  - chat / terminal / sync / admin                │
                └──────────────────────────────────────────────────┘
                                  │ provisions
                                  ▼
       ┌─────────────────────────────────────────────────────────────┐
       │  Per-user Cloudflare account                                 │
       │                                                              │
       │   user-owned Worker (starters/personal-agent)                │
       │   ┌───────────────────────────────────────────────────────┐  │
       │   │ Orchestrator Agent (Agents SDK v0.12.4+)              │  │
       │   │   └─ RPC MCP ─▶ Coder McpAgent                        │  │
       │   │   └─ RPC MCP ─▶ Researcher McpAgent                   │  │
       │   │   └─ RPC MCP ─▶ Browser McpAgent                      │  │
       │   └───────────────────────────────────────────────────────┘  │
       │   D1   • R2   • Queues   • Vectorize   • Workers AI          │
       │   Sandbox-GA (code-mode)    Containers (terminal, browser)   │
       │   Cloudflare Access (sign-in lockdown)                       │
       │                                                              │
       │   Outbound MCP:                                              │
       │     • cloudflare/mcp (workers / d1 / r2 / dns / access)      │
       │     • executor.sh/mcp (WorkOS JWT)                           │
       └─────────────────────────────────────────────────────────────┘
```

The orchestrator is the user-facing agent. It owns the workspace's working
doc, recent threads, project board, and shared Vectorize memory. Specialist
child agents are exposed to the orchestrator via the Agents SDK's
`addMcpServer()` RPC binding — no HTTP, no OAuth, no public hop. The full
wire diagram lives in `apps/docs/docs/guide/sub-agents.md`.

## Hosted Agent SDK

Every deployed personal agent exposes a hosted Cloud Agent surface in
addition to the chat UI:

- `/health`, `/manifest`, `/cloud-agent/profile` for discovery
- `/goal` for active objective setup
- `/subagents`, `/subagents/{id}/messages|control|summary` for delegated
  Cloud Agent children
- `/personal-agent/setup`, `/runtime/context` for customization / readiness

External apps consume the surface via `@open-think/core`:

```ts
import { createHostedCloudAgentClient } from "@open-think/core";

const agent = createHostedCloudAgentClient({
  baseUrl: "https://your-agent.workers.dev"
});

await agent.goal("Ship a hosted workflow");
const child = await agent.createSubAgent({
  name: "Scout",
  purpose: "Inspect deploy readiness",
  mode: "hybrid"
});
await agent.sendSubAgentMessage(child.subAgent.id, "Continue.");
```

## Onboarding (the deploy form)

The `/deploy` page is the one-screen onboarding flow:

1. **Agent name** — defaults to a fresh fun two-word hyphenated name (e.g.
   `amber-otter`); a Shuffle button picks another. Editable.
2. **Cloudflare API token** — a one-click button opens the Cloudflare
   dashboard pre-loaded with exactly the permissions we need (Workers,
   Artifacts, Cloudchamber/Containers, D1, R2, Queues, Vectorize, Workers
   AI, AI Gateway, Pages, KV, Access, Zone read, DNS, Workers Routes,
   Account Settings, User Details).
3. **Token verify** — we read the account id, owner email, and zones from
   the token; nothing about the raw token leaves the user's browser except a
   server-side fingerprint.
4. **Access lockdown** — defaults to the email on the token; the user can
   add more emails. The deployed Worker is fronted by a Cloudflare Access
   self-hosted application with that email allow policy.
5. **Optional custom domain** — pick a zone, accept the suggested subdomain
   (the agent slug) or write your own; DNS + Worker route are provisioned.
6. **Approval mode** — full-auto / smart-auto / manual; spend cap per task.
7. **Personal agent subsystem** — pick a preset (default
   `openthink-gbrain-gstack`) or go custom.

Every step streams progress through the redesigned deploy timeline with
status pill, animated progress bar, and resource chips for the D1 / R2 /
Worker / Access app being created.

## Run locally

```bash
pnpm install
pnpm dev
```

The platform app starts on `http://localhost:3000`.

## Deploy to Cloudflare

Configure `.env` or Worker secrets from `.env.example`, then run:

```bash
pnpm --filter @open-think/platform deploy:cf
```

`deploy:cf` provisions / reuses the platform D1 / R2 / Queue / Vectorize
resources, applies the D1 schema, writes
`apps/platform/wrangler.generated.jsonc`, builds with the Cloudflare
OpenNext adapter, and deploys the Worker.

Self-service launches enable the deployed Worker's `workers.dev` route,
resolve the real `https://<script>.<account-subdomain>.workers.dev` URL,
and create a Cloudflare Access self-hosted application with an email allow
policy. If Access creation fails, provisioning disables the route again and
fails the launch instead of leaving the Worker public.

## Sub-agents over RPC MCP

Child specialist agents live alongside the orchestrator in the same Worker.
The Agents SDK's `addMcpServer(name, binding)` connects them over Durable
Object RPC — no public internet, no auth. See
`starters/personal-agent/src/orchestrator/mcp-rpc.ts` for the wiring
helper.

```ts
// In the orchestrator (subclass of Agent)
async onStart() {
  await this.addMcpServer("coder", this.env.AGENT_CODER);
  await this.addMcpServer("researcher", this.env.AGENT_RESEARCHER);
}
```

```ts
// Each child is an McpAgent that registers tools
export class AgentCoder extends McpAgent<Env> {
  server = new McpServer({ name: "coder", version: "1.0.0" });
  async init() {
    this.server.tool(
      "edit_file",
      "Edit a file in the sandbox",
      { path: z.string(), patch: z.string() },
      async ({ path, patch }) => { /* … */ }
    );
  }
}
```

## Code mode

Code-mode lets the orchestrator emit a TypeScript plan that calls bound MCP
tools directly inside a Cloudflare Sandbox isolate, skipping the per-call
LLM round trip. Configurable in three policies:

| Policy   | Behaviour |
|----------|-----------|
| `off`      | Standard one-tool-per-turn. Default for new users. |
| `assisted` | LLM may opt in when a batch plan is cheaper than chaining calls. |
| `always`   | LLM always emits a code-mode plan. |

See `starters/personal-agent/src/code-mode.ts` and the
[`code-mode-mcp` blog post](https://blog.cloudflare.com/code-mode-mcp/).

## executor.sh integration

The deployed agent can connect to the public executor.sh MCP gateway at
`https://executor.sh/mcp` as an additional execution plane. Auth is a
WorkOS Bearer JWT obtained through the executor web app and stored as
`OPEN_THINK_EXECUTOR_WORKOS_TOKEN` on the Worker. The MCP client is in
`starters/personal-agent/src/executor.ts`. Cloudflare Sandbox-GA remains the
default; executor is opt-in for users who want the executor.sh tool surface
alongside Sandbox.

## Skills, orchestrator, train mode, self-evolve

- `starters/personal-agent/src/skills/` — a SkillStore backed by Durable
  Object storage. The Cloudflare pack (Workers best practices, Agents SDK,
  MCP toolkit) is preloaded by default; Anthropic, OpenAI, and AI Hero packs
  are available and opt-in. Custom user skills coexist with built-ins.
- `starters/personal-agent/src/orchestrator/` — workspace + orchestrator
  descriptors, the working-doc, recent threads, project goals, child-agent
  tracking, the RPC MCP wiring helper, and the `OrchestratorAgent` runtime
  glue (`initOrchestrator`, `buildOrchestratorSystemPrompt`, `gateToolCall`,
  `handleSlashCommand`, `recordTraceAndMaybeEvolve`).
- `starters/personal-agent/src/goal.ts` — `/goal` slash-command parser +
  executor (`set` / `list` / `complete` / `block` / `evolve`).
- `starters/personal-agent/src/evolve/` — `RunTrace` collection plus an
  evolve loop modeled on the OpenAI self-evolving-agents cookbook. Emits
  skill / rubric / prompt suggestions; in `auto-evolve` training mode,
  low-risk suggestions auto-apply.
- `starters/personal-agent/src/approval.ts` — full-auto / smart-auto /
  manual modes, spend caps, and an alwaysAllow / neverAllow learning
  surface that lets the agent remember "approve this kind of call from now
  on" decisions.
- `starters/personal-agent/src/learning-routes.ts` —
  framework-agnostic `GET /learning/pending`, `POST /learning/decisions`,
  `GET /learning/summary` endpoints + a `respondLearning(request, store)`
  fetch adapter for runtimes without a router. The platform's Learning
  page fetches these live (or shows a "Demo data" badge when no agent
  URL is configured).

## Persona shell — the deployed agent UI

The deployed personal agent ships with a three-column Persona shell
(opt-in via `?shell=persona` in the agent URL):

- `starters/personal-agent/src/persona-shell.tsx` — sidebar / thread
  feed / artifact canvas grid with single / grid / stack windowing.
- `starters/personal-agent/src/persona-views/*` — one viewer per
  artifact kind: document, code, browser session (live screenshot
  stream), webpage (mobile/desktop iframe toggle), slides, table
  (sortable + CSV export), image, chart (SVG polyline). Routed by
  `artifact-router.tsx`.
- `starters/personal-agent/src/persona-pages/*` — Library, Skills,
  Settings, and Search palette pages reachable from the sidebar.

The legacy single-pane chat stays the default until the per-artifact
viewers are wired into the existing chat surface.

## Sync model + update + contribute-back

Deployed personal agents use GitHub as the upstream update channel by
default. The platform checks `OPEN_THINK_UPDATE_REPOSITORY` and
`OPEN_THINK_UPDATE_BRANCH`, regenerates the Worker from the current
platform runtime, and uploads it through the Cloudflare Workers Scripts API
with secret preservation.

Cloudflare Artifacts Git is optional. Free / basic accounts can stay on the
GitHub upstream lane. Paid accounts can enable the self-edit workspace
later — that creates a per-agent Artifacts repo, stores the repo-scoped
Artifacts token as a Worker secret, and marks Sandbox / Containers as
ready-to-add. From there the agent can author code changes inside the
Cloudflare Sandbox and open pull requests against this public repo.

Default upstream: `OPEN_THINK_UPDATE_REPOSITORY=NeoFlux-Holdings/openthink2`.

## Verify

```bash
pnpm typecheck
pnpm test
pnpm build
```
