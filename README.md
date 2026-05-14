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

The `/deploy` page is a **three-step wizard** with one step visible at a time
and a dot indicator at the top. The form does the minimum we need to launch;
everything else is configured after on the deployed agent.

1. **Your agent.** Agent name (pre-filled with a fun two-word slug like
   `amber-otter`; Shuffle button picks another) and Cloudflare API token. A
   giant "Open Cloudflare dashboard" button opens the token-creation page
   pre-loaded with exactly the permissions we need (Workers, Artifacts,
   Cloudchamber/Containers, D1, R2, Queues, Vectorize, Workers AI, AI
   Gateway, Pages, KV, Access, Zone read, DNS, Workers Routes, Account
   Settings, User Details). Verify-token auto-advances on success and pulls
   the account id, owner email, and zones from the token — nothing about
   the raw token leaves the user's browser except a server-side
   fingerprint.
2. **Lock it down.** Access email auto-filled from the token, optional
   teammates (collapsed), optional custom domain (off by default; toggle
   exposes a zone picker + subdomain). An "Advanced" disclosure (closed by
   default) holds spend cap, default model, and approval mode.
3. **Launch.** Summary card + one big Launch button + a lock-icon
   fineprint about token privacy.

Once launched, the page swaps to a post-launch view that streams the
provisioning progress through the redesigned deploy timeline (status pill,
animated progress bar, resource chips for the D1 / R2 / Worker / Access
app being created). When it reaches `complete`:

- A "Visit your agent →" button to the deployed Worker URL.
- An **Updates** card with an auto-update switch (ON by default) and a
  "Check for updates now" button calling `/api/sync/manual` against the
  upstream public repo.
- A **Manage** card linking to the agent's `/chat`, `/learning`,
  `/terminal`, `/sync`, and `/admin` surfaces.

The result is persisted to `localStorage["openthink:lastLaunch"]` so a
return visit hydrates straight into the post-launch view instead of the
wizard.

## The deployed agent UI

The deployed agent ships the Persona three-column shell **as the default**
(legacy single-pane chat is opt-in via `?shell=legacy`):

- **Sidebar** — New Task, Search, Library, Learning, Skills, Recent
  threads, Settings. Collapses entirely on mobile.
- **Thread feed** — "What do you need done?" home screen (textarea, six
  quick-action chips, Auto / Plan-first / Train mode toggle, attachment,
  template carousel) when no active thread; the message stream with
  editable title, agent dot, status chip, animated progress bar,
  dismissible working-doc chip, collapsible "Reasoned ▸" sections,
  inline tool-call chips, follow-up suggestion chips, and hover actions
  when a thread is active.
- **Artifact canvas** — document / browser / webpage / slides / table /
  image / code / chart / diff viewers, single / grid / stack windowing.
- **Composer** — sticky bottom, plan-mode pill, attachment, ⌘/Ctrl+Enter,
  optional cost-estimate chip.

The whole UI is mobile-first and respects `prefers-reduced-motion`.

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

## Execution lanes — MCP servers the agent mounts

openthink2 mounts MCP servers from three classes of source. The
orchestrator's LLM sees one merged tool surface regardless of which
lane each tool came from.

| Lane | Transport | Auth | Default |
|------|-----------|------|---------|
| **In-Worker McpAgents** | Durable Object RPC | none | on |
| **executor.sh** | Streamable HTTP | WorkOS JWT | opt-in |
| **Smithery** | Streamable HTTP | per-user API key | opt-in |

The in-Worker lane is the openthink2 specialist sub-agents (coder,
researcher, browser, …). [executor.sh](https://executor.sh) is a
public cloud MCP gateway. [Smithery](https://smithery.ai) is the MCP
server *registry* — 7,000+ pre-built servers (GitHub, Linear, Notion,
Playwright, etc.) hosted by Smithery and mounted into your agent on
demand. See `apps/docs/docs/guide/smithery.md` for the wiring details.

User keys live in Worker secrets:

- `OPEN_THINK_EXECUTOR_WORKOS_TOKEN` — executor.sh bearer
- `OPEN_THINK_SMITHERY_API_KEY` — Smithery API key

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

The deployed personal agent ships with a three-column Persona shell as
the default UI. The legacy single-pane chat is still reachable via
`?shell=legacy` for backwards compatibility.

- `starters/personal-agent/src/persona-shell.tsx` — sidebar / thread
  feed / artifact canvas grid with single / grid / stack windowing.
- `starters/personal-agent/src/persona-app.tsx` — top-level wrapper
  that wires the shell slots to Persona-native Home, Thread Feed, and
  Composer components and routes sidebar callbacks to internal views.
- `starters/personal-agent/src/persona-pages/persona-home.tsx` — the
  "What do you need done?" home screen with quick actions, mode
  toggle, attachments, recent threads, and template carousel.
- `starters/personal-agent/src/persona-pages/persona-thread-feed.tsx` —
  message bubbles with reasoned collapsible, status line, tool chips,
  working doc chip, follow-up suggestions, and message actions.
- `starters/personal-agent/src/persona-pages/persona-composer.tsx` —
  sticky composer with attachment, plan toggle, and ⌘/Ctrl+Enter.
- `starters/personal-agent/src/persona-views/*` — one viewer per
  artifact kind: document, code, browser session (live screenshot
  stream), webpage (mobile/desktop iframe toggle), slides, table
  (sortable + CSV export), image, chart (SVG polyline). Routed by
  `artifact-router.tsx`.
- `starters/personal-agent/src/persona-pages/*` — Library, Skills,
  Settings, and Search palette pages reachable from the sidebar.

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
