# Skills, approval modes, and code-mode

openthink2 exposes three small subsystems that let the same agent be
beginner-friendly *and* something a power user would happily ship.

## Skills

A skill is a unit of agent know-how — a system-prompt fragment, a tool
binding list, a knowledge-URL set, and an optional markdown playbook.
Skills live in a Durable Object–backed `SkillStore` per workspace.

Built-in packs (selected at deploy time):

| Pack | Loaded by default | Description |
|------|-------------------|-------------|
| `cloudflare` | yes | Workers best practices, Agents SDK, MCP toolkit. |
| `anthropic` | opt-in | Anthropic-curated tool-use + coding playbooks. |
| `openai` | opt-in | OpenAI-curated self-evolving-agents pack. |
| `ai-hero` | opt-in | AI Hero starter recipes. |

Custom user skills coexist with built-ins and can be promoted from the
Learning page after a successful train-mode run.

### Loading skills at boot

```ts
import { createDoSkillStore, defaultPreloadPackIds } from "./skills";

export class OrchestratorAgent extends Agent<Env> {
  async onStart() {
    const skills = createDoSkillStore(this.ctx.storage);
    await skills.preload(defaultPreloadPackIds()); // ["cloudflare"]
  }
}
```

## Approval modes

```
full-auto  → never ask
smart-auto → auto-approve safe calls, ask for risky ones, remember
manual     → ask before every call
```

`smart-auto` is the default for new workspaces. Risk is computed from
the tool namespace, name (delete / purge / revoke / transfer / wire
trigger an ask), and any `affects: "money"` flag the tool declares.
Decisions can be remembered as `alwaysAllow` or `neverAllow` entries.

Spend policy is independent of mode — even `full-auto` will pause and
prompt when projected spend exceeds `requireApprovalOver`.

```ts
import { defaultApprovalConfig, evaluateApproval } from "./approval";

const decision = evaluateApproval(defaultApprovalConfig, {
  toolName: "deploy_worker",
  toolNamespace: "cloudflare",
  estimatedCostUsd: 0.02,
  reversible: true,
  affects: ["shared-state"]
});
// → { allow: true, reason: "smart-auto allowed", rememberKey: "cloudflare.deploy_worker" }
```

## Code-mode

Code-mode lets the orchestrator emit a single TypeScript plan that
calls bound MCP tools directly inside a Cloudflare Sandbox isolate.
It avoids the per-call LLM round trip for batchy multi-tool plans.

| Policy | Behaviour |
|--------|-----------|
| `off` | Standard one-tool-per-turn calls. Default for new users. |
| `assisted` | LLM may choose code-mode for batchy plans. **Default in advanced mode.** |
| `always` | LLM always emits code-mode for tool execution. |

```ts
import {
  buildCodeModeInjection,
  createSandboxCodeModeRunner,
  defaultCodeModeConfig
} from "./code-mode";

const injection = buildCodeModeInjection(defaultCodeModeConfig, approvalConfig);
if (injection.enabled) {
  systemPrompt += "\n\n" + injection.systemPromptFragment;
}

const runner = createSandboxCodeModeRunner(env.SANDBOX, defaultCodeModeConfig);
const result = await runner.run({
  code: planSnippetFromLlm,
  bindings: { workspaceId: ws.id }
});
```

Approval rules still apply to every tool call inside a code-mode plan;
the Sandbox runner reads them from the same `ApprovalConfig`.

## executor.sh as an alternative execution plane

Cloudflare Sandbox-GA is the default execution plane. For users who
prefer the public [executor.sh](https://executor.sh) cloud gateway,
openthink2 ships an MCP-over-HTTP client (`executor.ts`):

```ts
import { buildExecutorMcpServerConfig, probeExecutor } from "./executor";

const config = buildExecutorMcpServerConfig({
  endpoint: env.OPEN_THINK_EXECUTOR_MCP_URL,
  workosToken: env.OPEN_THINK_EXECUTOR_WORKOS_TOKEN
});

const readiness = await probeExecutor({
  endpoint: config.url,
  workosToken: env.OPEN_THINK_EXECUTOR_WORKOS_TOKEN
});
```

Auth is a WorkOS Bearer JWT obtained by signing into the executor web
app. Both planes can be enabled simultaneously — the orchestrator will
prefer Sandbox for code-mode plans and route specific tool calls
through executor.sh on demand.
