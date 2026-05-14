/**
 * Effect-based interpreter for the workflow IR.
 *
 * Each IR node maps to an Effect:
 *   - task      → Effect.tryPromise of the handler, with Schema-validated
 *                 input/output and optional retry schedule.
 *   - sequence  → Effect.gen, yields each child in order, threads the
 *                 scope forward.
 *   - parallel  → Effect.all with optional concurrency cap.
 *   - branch    → Match.value over the predicate result.
 *   - ralph     → Effect.iterate over the body up to maxIterations.
 *
 * The interpreter is durability-agnostic: the runner (see runner.ts)
 * injects a TaskContext whose `persist` / `recall` are wired to
 * Cloudflare Workflows' `step.do()` checkpoints so a crash mid-run
 * resumes from the last completed task.
 */

import { Data, Effect, Schema } from "effect";
import type { ParseError } from "effect/ParseResult";
import type {
  IRBranch,
  IRParallel,
  IRRalph,
  IRSequence,
  IRTask,
  IRWorkflow,
  TaskContext,
  WorkflowNode,
  WorkflowScope
} from "./ir";

export class WorkflowTaskError extends Data.TaggedError("WorkflowTaskError")<{
  readonly taskName: string;
  readonly cause: unknown;
  readonly message: string;
}> {}

export class WorkflowSchemaError extends Data.TaggedError("WorkflowSchemaError")<{
  readonly taskName: string;
  readonly stage: "input" | "output";
  readonly cause: ParseError;
}> {}

export interface InterpreterDeps {
  buildTaskContext: (task: IRTask, scope: WorkflowScope) => TaskContext;
  /** Optional callback fired around every task — useful for the runner
   *  to insert CF Workflows `step.do` boundaries. */
  withStep?: <A, E>(
    task: IRTask,
    body: Effect.Effect<A, E>
  ) => Effect.Effect<A, E>;
}

interface MutableScope {
  input: unknown;
  outputs: Record<string, unknown>;
}

function freezeScope(state: MutableScope): WorkflowScope {
  return {
    input: state.input,
    outputs: state.outputs,
    has(taskName) {
      return Object.prototype.hasOwnProperty.call(state.outputs, taskName);
    },
    get(taskName) {
      return state.outputs[taskName] as never;
    }
  };
}

export function interpret(
  workflow: IRWorkflow,
  input: unknown,
  deps: InterpreterDeps
): Effect.Effect<Record<string, unknown>, WorkflowTaskError | WorkflowSchemaError> {
  const state: MutableScope = { input, outputs: {} };

  return Effect.gen(function* () {
    if (workflow.input) {
      yield* decode(workflow.input, input, workflow.name, "input");
    }
    yield* interpretNode(workflow.body, state, deps);
    if (workflow.output) {
      yield* decode(workflow.output, state.outputs, workflow.name, "output");
    }
    return state.outputs;
  });
}

function interpretNode(
  node: WorkflowNode,
  state: MutableScope,
  deps: InterpreterDeps
): Effect.Effect<void, WorkflowTaskError | WorkflowSchemaError> {
  switch (node.kind) {
    case "task":
      return interpretTask(node, state, deps);
    case "sequence":
      return interpretSequence(node, state, deps);
    case "parallel":
      return interpretParallel(node, state, deps);
    case "branch":
      return interpretBranch(node, state, deps);
    case "ralph":
      return interpretRalph(node, state, deps);
  }
}

function interpretTask(
  node: IRTask,
  state: MutableScope,
  deps: InterpreterDeps
): Effect.Effect<void, WorkflowTaskError | WorkflowSchemaError> {
  const body = Effect.gen(function* () {
    const scope = freezeScope(state);
    let resolvedInput: unknown = state.input;
    if (node.input) {
      resolvedInput = yield* decode(node.input, state.input, node.name, "input");
    }
    const ctx = deps.buildTaskContext(node, scope);
    const raw = yield* Effect.tryPromise({
      try: () => (node.handler as (i: unknown, c: TaskContext) => Promise<unknown>)(resolvedInput, ctx),
      catch: (error) =>
        new WorkflowTaskError({
          taskName: node.name,
          cause: error,
          message: error instanceof Error ? error.message : String(error)
        })
    });
    const validated = node.output
      ? yield* decode(node.output, raw, node.name, "output")
      : raw;
    state.outputs[node.name] = validated;
  });
  return deps.withStep ? deps.withStep(node, body) : body;
}

function interpretSequence(
  node: IRSequence,
  state: MutableScope,
  deps: InterpreterDeps
): Effect.Effect<void, WorkflowTaskError | WorkflowSchemaError> {
  return Effect.gen(function* () {
    for (const child of node.children) {
      yield* interpretNode(child, state, deps);
    }
  });
}

function interpretParallel(
  node: IRParallel,
  state: MutableScope,
  deps: InterpreterDeps
): Effect.Effect<void, WorkflowTaskError | WorkflowSchemaError> {
  // Each parallel branch sees the *current* outputs but writes back
  // into a per-branch copy that's merged at join time. This keeps
  // the IR semantics deterministic even when branches finish out of
  // order.
  const snapshot = { ...state.outputs };
  const children = node.children.map((child) => {
    const local: MutableScope = { input: state.input, outputs: { ...snapshot } };
    return interpretNode(child, local, deps).pipe(
      Effect.map(() => local.outputs)
    );
  });

  const options: { concurrency?: number } = {};
  if (typeof node.concurrency === "number") options.concurrency = node.concurrency;

  return Effect.gen(function* () {
    const results = yield* Effect.all(children, options);
    for (const localOutputs of results) {
      for (const [name, value] of Object.entries(localOutputs)) {
        if (!Object.prototype.hasOwnProperty.call(snapshot, name)) {
          state.outputs[name] = value;
        }
      }
    }
  });
}

function interpretBranch(
  node: IRBranch,
  state: MutableScope,
  deps: InterpreterDeps
): Effect.Effect<void, WorkflowTaskError | WorkflowSchemaError> {
  return Effect.gen(function* () {
    const took = node.predicate(freezeScope(state));
    if (took) {
      yield* interpretNode(node.whenTrue, state, deps);
    } else if (node.whenFalse) {
      yield* interpretNode(node.whenFalse, state, deps);
    }
  });
}

function interpretRalph(
  node: IRRalph,
  state: MutableScope,
  deps: InterpreterDeps
): Effect.Effect<void, WorkflowTaskError | WorkflowSchemaError> {
  return Effect.gen(function* () {
    let iteration = 0;
    while (iteration < node.maxIterations && node.condition(freezeScope(state), iteration)) {
      yield* interpretNode(node.body, state, deps);
      iteration += 1;
    }
  });
}

function decode<A>(
  schema: Schema.Schema<A, unknown>,
  value: unknown,
  taskName: string,
  stage: "input" | "output"
): Effect.Effect<A, WorkflowSchemaError> {
  return Effect.mapError(Schema.decodeUnknown(schema)(value), (cause) =>
    new WorkflowSchemaError({ taskName, stage, cause })
  );
}
