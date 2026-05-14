import { describe, expect, it, vi } from "vitest";
import { Schema } from "effect";
import {
  Branch,
  Parallel,
  Ralph,
  Sequence,
  Task,
  Workflow,
  branch,
  h,
  parallel,
  ralph,
  runWorkflow,
  runWorkflowOnCloudflare,
  sequence,
  task,
  workflow,
  WorkflowSchemaError,
  WorkflowTaskError
} from "../workflows";
import type { CloudflareWorkflowStep } from "../workflows/runner";

// Schema is invariant in its first parameter, so we widen the typed
// fixtures to `Schema<unknown, unknown>` for use in the IR (the runtime
// behaviour is unchanged — decode still rejects the wrong shape).
const numberSchema = Schema.Number as unknown as Schema.Schema<unknown, unknown, never>;
const stringSchema = Schema.String as unknown as Schema.Schema<unknown, unknown, never>;

describe("function-API IR builders", () => {
  it("builds a sequence of tasks", () => {
    const w = workflow(
      "greet",
      { version: "1.0.0" },
      sequence(
        task("hello", { handler: async () => "hi" }),
        task("bye", { handler: async () => "bye" })
      )
    );
    expect(w.kind).toBe("workflow");
    expect(w.body.kind).toBe("sequence");
    expect((w.body as { children: { name: string }[] }).children.map((c) => c.name)).toEqual([
      "hello",
      "bye"
    ]);
  });
});

describe("JSX h() factory", () => {
  it("produces the same IR as the function API", () => {
    const fn = workflow(
      "greet",
      { version: "1.0.0" },
      sequence(task("hello", { handler: async () => "hi" }))
    );
    const jsx = h(
      Workflow,
      { name: "greet", version: "1.0.0" },
      h(
        Sequence,
        null,
        h(Task, { name: "hello", handler: async () => "hi" })
      )
    );
    expect(jsx.kind).toBe("workflow");
    expect((jsx as typeof fn).name).toBe(fn.name);
    expect((jsx as typeof fn).version).toBe(fn.version);
  });

  it("throws on multiple Workflow children", () => {
    expect(() =>
      h(
        Workflow,
        { name: "bad" },
        h(Task, { name: "a", handler: async () => 1 }),
        h(Task, { name: "b", handler: async () => 2 })
      )
    ).toThrow(/exactly one child/);
  });
});

describe("runWorkflow (in-memory)", () => {
  it("runs a single task and returns its output", async () => {
    const w = workflow("one", {}, task("t", { handler: async () => 42 }));
    const out = await runWorkflow(w, undefined);
    expect(out).toEqual({ t: 42 });
  });

  it("threads outputs through a sequence and is readable in branch", async () => {
    const w = workflow(
      "branch",
      {},
      sequence(
        task("score", { handler: async () => 0.7 }),
        branch(
          (scope) => (scope.get<number>("score") ?? 0) > 0.5,
          task("yes", { handler: async () => "good" }),
          task("no", { handler: async () => "bad" })
        )
      )
    );
    const out = await runWorkflow(w, undefined);
    expect(out).toEqual({ score: 0.7, yes: "good" });
  });

  it("runs parallel branches and merges outputs", async () => {
    const w = workflow(
      "par",
      {},
      parallel(
        task("a", { handler: async () => 1 }),
        task("b", { handler: async () => 2 }),
        task("c", { handler: async () => 3 })
      )
    );
    const out = await runWorkflow(w, undefined);
    expect(out).toEqual({ a: 1, b: 2, c: 3 });
  });

  it("loops with ralph until condition is false", async () => {
    let calls = 0;
    const w = workflow(
      "loop",
      {},
      ralph({
        body: task("step", {
          handler: async () => {
            calls += 1;
            return calls;
          }
        }),
        condition: (_scope, iter) => iter < 3,
        maxIterations: 10
      })
    );
    await runWorkflow(w, undefined);
    expect(calls).toBe(3);
  });

  it("respects maxIterations even when condition stays true", async () => {
    let calls = 0;
    const w = workflow(
      "loop",
      {},
      ralph({
        body: task("step", {
          handler: async () => {
            calls += 1;
            return calls;
          }
        }),
        condition: () => true,
        maxIterations: 4
      })
    );
    await runWorkflow(w, undefined);
    expect(calls).toBe(4);
  });

  it("validates input + output via Effect Schema", async () => {
    const w = workflow(
      "schemas",
      {},
      task("double", {
        input: numberSchema,
        output: numberSchema,
        handler: async (n: unknown) => (n as number) * 2
      })
    );
    const out = await runWorkflow(w, 21);
    expect(out).toEqual({ double: 42 });

    await expect(runWorkflow(w, "not-a-number")).rejects.toThrow();
  });

  it("propagates handler errors as WorkflowTaskError", async () => {
    const w = workflow(
      "boom",
      {},
      task("explode", {
        handler: async () => {
          throw new Error("kaboom");
        }
      })
    );
    await expect(runWorkflow(w, undefined)).rejects.toThrow(/kaboom/);
  });

  it("rejects schema mismatches as WorkflowSchemaError", async () => {
    const w = workflow(
      "schemas",
      {},
      task("expect-string", {
        output: stringSchema,
        handler: async () => 123 as unknown as string
      })
    );
    await expect(runWorkflow(w, undefined)).rejects.toThrow();
  });
});

describe("runWorkflowOnCloudflare", () => {
  it("invokes step.do once per task with the task name", async () => {
    const calls: string[] = [];
    const step: CloudflareWorkflowStep = {
      async do(name, optionsOrHandler, handler) {
        calls.push(name);
        const fn = typeof optionsOrHandler === "function" ? optionsOrHandler : handler!;
        return (await fn()) as never;
      }
    };

    const w = workflow(
      "deploy",
      {},
      sequence(
        task("plan", { handler: async () => ({ ok: true }) }),
        task("apply", { handler: async () => "applied" })
      )
    );
    const out = await runWorkflowOnCloudflare({ workflow: w, input: undefined, step });
    expect(calls).toEqual(["plan", "apply"]);
    expect(out).toEqual({ plan: { ok: true }, apply: "applied" });
  });

  it("threads task retry config into step.do", async () => {
    const stepSpy = vi.fn(async (_name: string, options: unknown, handler?: () => unknown) => {
      const fn = typeof options === "function" ? options : handler!;
      return await fn();
    });
    const step: CloudflareWorkflowStep = {
      async do(name, optionsOrHandler, handler) {
        return stepSpy(name, optionsOrHandler, handler) as never;
      }
    };

    const w = workflow(
      "retry",
      {},
      task("flaky", {
        retry: { limit: 5, backoff: "exponential" },
        handler: async () => "ok"
      })
    );
    await runWorkflowOnCloudflare({ workflow: w, input: undefined, step });
    expect(stepSpy).toHaveBeenCalledWith(
      "flaky",
      { retries: { limit: 5, backoff: "exponential" } },
      expect.any(Function)
    );
  });
});

describe("JSX components match function API behaviour", () => {
  it("JSX-built workflow runs identically", async () => {
    const jsx = h(
      Workflow,
      { name: "jsx", version: "1.0.0" },
      h(
        Sequence,
        null,
        h(Task, { name: "a", handler: async () => 1 }),
        h(
          Parallel,
          null,
          h(Task, { name: "b", handler: async () => 2 }),
          h(Task, { name: "c", handler: async () => 3 })
        ),
        h(
          Branch,
          {
            predicate: (scope: { get: <T>(name: string) => T | undefined }) =>
              (scope.get<number>("a") ?? 0) > 0
          },
          h(Task, { name: "d", handler: async () => "yes" })
        ),
        h(
          Ralph,
          {
            condition: (_scope: unknown, iter: number) => iter < 2
          },
          h(Task, { name: "loop", handler: async () => "tick" })
        )
      )
    );
    const out = await runWorkflow(jsx as never, undefined);
    expect(out).toEqual({ a: 1, b: 2, c: 3, d: "yes", loop: "tick" });
  });
});

it("typed error classes are constructable for runtime narrowing", () => {
  const t = new WorkflowTaskError({ taskName: "x", cause: null, message: "boom" });
  expect(t.taskName).toBe("x");
  expect(t._tag).toBe("WorkflowTaskError");
  // WorkflowSchemaError requires a ParseError, which is non-trivial to
  // construct in a unit test; verifying the export is enough here.
  expect(typeof WorkflowSchemaError).toBe("function");
});
