/**
 * Workflow DSL — author workflows two ways with the same IR output.
 *
 * Function API (recommended for tests + plain TS):
 *
 *   workflow("greet", { version: "1.0.0" },
 *     sequence(
 *       task("fetch-user", { handler: async (input) => ... }),
 *       parallel(
 *         task("score-a", { handler: ... }),
 *         task("score-b", { handler: ... })
 *       ),
 *       branch(scope => scope.get("score-a")! > 0.5,
 *         task("congratulate", { handler: ... }),
 *         task("retry",        { handler: ... })
 *       )
 *     )
 *   );
 *
 * JSX-compatible API (for tsx files using a @jsxImportSource pragma
 * to bind to our `h` factory):
 *
 *   <Workflow name="greet" version="1.0.0">
 *     <Sequence>
 *       <Task name="fetch-user" handler={…} />
 *       <Parallel>
 *         <Task name="score-a" handler={…} />
 *         <Task name="score-b" handler={…} />
 *       </Parallel>
 *     </Sequence>
 *   </Workflow>
 *
 * Both produce the same IR; the runner doesn't care which path
 * you used.
 */

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
import type { Schema } from "effect";

// ----- function API --------------------------------------------------------

export interface TaskOptions<TIn, TOut> {
  input?: Schema.Schema<TIn, unknown>;
  output?: Schema.Schema<TOut, unknown>;
  handler: (input: TIn, ctx: TaskContext) => Promise<TOut>;
  retry?: { limit: number; backoff?: "exponential" | "linear" };
}

export function task<TIn = unknown, TOut = unknown>(
  name: string,
  options: TaskOptions<TIn, TOut>
): IRTask<unknown, unknown> {
  // Erase the precise input/output generics at the boundary so the
  // resulting node fits inside the WorkflowNode union without
  // exactOptionalPropertyTypes variance complaints. `as never` then
  // `as IRTask<unknown, unknown>` is intentional — TypeScript is
  // strict here and Schema is invariant in its first parameter, so
  // we accept the precise schema at the call site and store the
  // erased form on the node.
  const node: Record<string, unknown> = {
    kind: "task",
    name,
    handler: options.handler
  };
  if (options.input) node.input = options.input;
  if (options.output) node.output = options.output;
  if (options.retry) node.retry = options.retry;
  return node as unknown as IRTask<unknown, unknown>;
}

export function sequence(...children: WorkflowNode[]): IRSequence;
export function sequence(opts: { name?: string }, ...children: WorkflowNode[]): IRSequence;
export function sequence(
  first?: WorkflowNode | { name?: string },
  ...rest: WorkflowNode[]
): IRSequence {
  if (first && !("kind" in first)) {
    const node: IRSequence = { kind: "sequence", children: rest };
    if (first.name) node.name = first.name;
    return node;
  }
  const children = first ? [first as WorkflowNode, ...rest] : rest;
  return { kind: "sequence", children };
}

export function parallel(...children: WorkflowNode[]): IRParallel;
export function parallel(
  opts: { name?: string; concurrency?: number },
  ...children: WorkflowNode[]
): IRParallel;
export function parallel(
  first?: WorkflowNode | { name?: string; concurrency?: number },
  ...rest: WorkflowNode[]
): IRParallel {
  if (first && !("kind" in first)) {
    const node: IRParallel = { kind: "parallel", children: rest };
    if (first.name) node.name = first.name;
    if (first.concurrency) node.concurrency = first.concurrency;
    return node;
  }
  const children = first ? [first as WorkflowNode, ...rest] : rest;
  return { kind: "parallel", children };
}

export function branch(
  predicate: (scope: WorkflowScope) => boolean,
  whenTrue: WorkflowNode,
  whenFalse?: WorkflowNode
): IRBranch {
  const node: IRBranch = { kind: "branch", predicate, whenTrue };
  if (whenFalse) node.whenFalse = whenFalse;
  return node;
}

export function ralph(input: {
  name?: string;
  body: WorkflowNode;
  condition: (scope: WorkflowScope, iteration: number) => boolean;
  maxIterations?: number;
}): IRRalph {
  const node: IRRalph = {
    kind: "ralph",
    body: input.body,
    condition: input.condition,
    maxIterations: input.maxIterations ?? 32
  };
  if (input.name) node.name = input.name;
  return node;
}

export function workflow(
  name: string,
  options: {
    version?: string;
    input?: Schema.Schema<unknown, unknown>;
    output?: Schema.Schema<unknown, unknown>;
  } = {},
  body: WorkflowNode
): IRWorkflow {
  const node: IRWorkflow = {
    kind: "workflow",
    name,
    version: options.version ?? "1.0.0",
    body
  };
  if (options.input) node.input = options.input;
  if (options.output) node.output = options.output;
  return node;
}

// ----- JSX-compatible h() factory ------------------------------------------

/**
 * JSX factory that produces our IR. Bind via per-file pragmas
 * (`@jsxRuntime classic` + `@jsx h`) or set `jsxFactory: "h"` in
 * tsconfig.json (we keep React for the rest of the UI — workflow
 * files opt in per-file).
 *
 * Usage (pragmas omitted from the example to avoid nesting comments):
 *
 *   import { h, Workflow, Task, Sequence } from "./workflows";
 *   const greet = (
 *     <Workflow name="greet" version="1.0.0">
 *       <Sequence>
 *         <Task name="hello" handler={async () => "hi"} />
 *       </Sequence>
 *     </Workflow>
 *   );
 */
// We deliberately type the h() factory loosely because each component
// has a different props shape — the runtime safety comes from the
// individual factory functions (Task, Workflow, etc).
type LooseFactory = (props: never, ...children: unknown[]) => WorkflowNode | IRWorkflow;

export function h(
  type: LooseFactory | string,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): WorkflowNode | IRWorkflow {
  if (typeof type !== "function") {
    throw new Error(`Workflow JSX: unknown element <${String(type)}>`);
  }
  const flat = flattenChildren(children);
  return type({ ...(props ?? {}), children: flat } as never, ...flat);
}

function flattenChildren(children: unknown[]): WorkflowNode[] {
  const out: WorkflowNode[] = [];
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) {
      out.push(...flattenChildren(child));
    } else {
      out.push(child as WorkflowNode);
    }
  }
  return out;
}

interface JsxChildren {
  children?: WorkflowNode | WorkflowNode[];
}

export function Task<TIn = unknown, TOut = unknown>(
  props: TaskOptions<TIn, TOut> & { name: string }
): IRTask<unknown, unknown> {
  const { name, ...rest } = props;
  return task(name, rest);
}

export function Sequence(props: { name?: string } & JsxChildren): IRSequence {
  const opts: { name?: string } = {};
  if (props.name) opts.name = props.name;
  return sequence(opts, ...toArray(props.children));
}

export function Parallel(
  props: { name?: string; concurrency?: number } & JsxChildren
): IRParallel {
  const opts: { name?: string; concurrency?: number } = {};
  if (props.name) opts.name = props.name;
  if (props.concurrency) opts.concurrency = props.concurrency;
  return parallel(opts, ...toArray(props.children));
}

export function Branch(props: {
  predicate: (scope: WorkflowScope) => boolean;
  children: [WorkflowNode] | [WorkflowNode, WorkflowNode];
}): IRBranch {
  const [whenTrue, whenFalse] = toArray(props.children) as [WorkflowNode, WorkflowNode?];
  return branch(props.predicate, whenTrue, whenFalse);
}

export function Ralph(props: {
  name?: string;
  condition: (scope: WorkflowScope, iteration: number) => boolean;
  maxIterations?: number;
  children: WorkflowNode;
}): IRRalph {
  const input: Parameters<typeof ralph>[0] = {
    body: Array.isArray(props.children) ? props.children[0]! : props.children,
    condition: props.condition
  };
  if (props.name) input.name = props.name;
  if (props.maxIterations) input.maxIterations = props.maxIterations;
  return ralph(input);
}

export function Workflow(
  props: {
    name: string;
    version?: string;
    input?: Schema.Schema<unknown, unknown>;
    output?: Schema.Schema<unknown, unknown>;
  } & JsxChildren
): IRWorkflow {
  const children = toArray(props.children);
  if (children.length !== 1) {
    throw new Error(`<Workflow name="${props.name}"> requires exactly one child node, got ${children.length}.`);
  }
  const opts: Parameters<typeof workflow>[1] = {};
  if (props.version) opts.version = props.version;
  if (props.input) opts.input = props.input;
  if (props.output) opts.output = props.output;
  return workflow(props.name, opts, children[0]!);
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}
