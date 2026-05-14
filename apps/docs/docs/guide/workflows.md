# Workflows — JSX authoring on Cloudflare Workflows + Effect

openthink2 ships its own thin workflow DSL inspired by the
[Smithers](https://smithers.sh/) JSX authoring DX, compiled to an
Effect program, and executable either in-isolate (tests, side calls)
or on top of Cloudflare Workflows for production durability.

We adopted the *DX* (JSX components, typed inputs/outputs) without
adopting Smithers' runtime, which requires Bun and can't run on
Cloudflare Workers. Cloudflare Workflows + `@cloudflare/think` +
Durable Objects already provide crash-resumable orchestration on our
stack; this DSL is a writing surface on top.

## At a glance

| Component | Purpose | Effect node |
|-----------|---------|-------------|
| `<Workflow>` | Top-level container; carries name, version, optional input/output Schema | `Effect.gen` outer |
| `<Task>`     | A single unit of work; Schema-validated input/output, optional retry | `Effect.tryPromise` |
| `<Sequence>` | Run children in order; each sees earlier outputs in scope | `Effect.gen` over children |
| `<Parallel>` | Run children concurrently with optional concurrency cap | `Effect.all` |
| `<Branch>`   | Pick one of two children based on a predicate over scope | imperative `if` inside `Effect.gen` |
| `<Ralph>`    | Loop a child until `condition` returns false or `maxIterations` | bounded `while` inside `Effect.gen` |

## Authoring

Two equivalent surfaces. Pick based on whether your file already has a
TSX runtime configured.

### Function API (recommended for plain `.ts` files + tests)

```ts
import {
  workflow, sequence, parallel, branch, ralph, task, runWorkflow
} from "@open-think/starter-personal-agent/workflows";
import { Schema } from "effect";

const greet = workflow(
  "greet",
  { version: "1.0.0", input: Schema.String },
  sequence(
    task("fetch-user", {
      input: Schema.String,
      handler: async (userId, ctx) => {
        ctx.log("info", `Fetching user ${userId}`);
        return await fetchUser(userId);
      }
    }),
    parallel(
      task("score-a", { handler: async () => 0.8 }),
      task("score-b", { handler: async () => 0.4 })
    ),
    branch(
      (scope) => (scope.get<number>("score-a") ?? 0) > 0.5,
      task("congratulate", { handler: async () => "great job" }),
      task("retry",        { handler: async () => "try again" })
    )
  )
);

const outputs = await runWorkflow(greet, "user-123");
//      ^^ { "fetch-user": {...}, "score-a": 0.8, "score-b": 0.4, "congratulate": "great job" }
```

### JSX API (for `.tsx` files with a custom factory pragma)

```tsx
/** @jsxRuntime classic */
/** @jsx h */
import {
  h, Workflow, Sequence, Parallel, Branch, Ralph, Task, runWorkflow
} from "@open-think/starter-personal-agent/workflows";

const greet = (
  <Workflow name="greet" version="1.0.0">
    <Sequence>
      <Task name="fetch-user" handler={fetchUser} />
      <Parallel>
        <Task name="score-a" handler={async () => 0.8} />
        <Task name="score-b" handler={async () => 0.4} />
      </Parallel>
      <Branch predicate={(scope) => (scope.get("score-a") ?? 0) > 0.5}>
        <Task name="congratulate" handler={async () => "great job"} />
        <Task name="retry"        handler={async () => "try again"} />
      </Branch>
    </Sequence>
  </Workflow>
);

await runWorkflow(greet, "user-123");
```

Both produce the same IR. The runner doesn't care which surface you
used.

## Running on Cloudflare Workflows

Wire the runner against the `WorkflowStep` your Cloudflare Workflow
handler receives. Each `<Task>` becomes a `step.do()` call so a
mid-run crash resumes from the last completed task:

```ts
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { runWorkflowOnCloudflare } from "@open-think/starter-personal-agent/workflows";
import { greet } from "./workflows/greet";

export class GreetWorkflow extends WorkflowEntrypoint<Env, { userId: string }> {
  async run(event: WorkflowEvent<{ userId: string }>, step: WorkflowStep) {
    return runWorkflowOnCloudflare({
      workflow: greet,
      input: event.payload.userId,
      step
    });
  }
}
```

`<Task retry={{ limit: 5, backoff: "exponential" }}>` is threaded into
`step.do()`'s retry option block.

## Why both Effect and Cloudflare Workflows?

- **Cloudflare Workflows** gives us *durability* — resumable steps,
  retries, hibernation between long sleeps, durable submission via
  `@cloudflare/think.submitMessages`.
- **Effect** gives us *composability* — typed errors via
  `Data.TaggedError`, Schema-validated inputs/outputs at task
  boundaries, `Effect.all` with concurrency caps for parallel branches,
  and well-behaved error propagation.

The interpreter is the bridge: it turns our IR into an `Effect`
program, then the runner wraps each task in `step.do()` so Cloudflare
Workflows can checkpoint state between them. Same authoring surface
runs locally (tests) or in production (CF Workflows).

## See also

- `starters/personal-agent/src/workflows/` — implementation
- `starters/personal-agent/src/__tests__/workflows.test.ts` — 17 tests
  covering the function and JSX surfaces, scope threading, ralph
  bounds, Schema validation, error propagation, and the CF
  Workflows step.do() wiring
- [Cloudflare Workflows docs](https://developers.cloudflare.com/workflows/)
- [Effect docs](https://effect.website/)
- [Smithers (DX inspiration)](https://smithers.sh/)
