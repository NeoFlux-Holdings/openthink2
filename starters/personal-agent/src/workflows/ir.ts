/**
 * Workflow IR — the runtime-neutral intermediate representation that
 * the JSX / function DSL compiles into.
 *
 * Nodes are tagged unions so a runtime can switch on `kind` and an
 * interpreter can implement each operator without coupling to the
 * authoring syntax (JSX, fluent builders, or hand-written IR).
 */

import { Schema } from "effect";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [k: string]: Json }
  | Json[];

export interface IRTask<TIn = unknown, TOut = unknown> {
  kind: "task";
  name: string;
  /** Optional Effect Schema for the task's input/output. The runner
   *  validates the resolved input *before* calling `handler` and the
   *  produced output *before* persisting it. */
  input?: Schema.Schema<TIn, unknown>;
  output?: Schema.Schema<TOut, unknown>;
  /** Pure handler; the runner is responsible for durability. */
  handler: (input: TIn, ctx: TaskContext) => Promise<TOut>;
  /** Per-task retry override (`{ limit, backoff?: "exponential" | "linear" }`). */
  retry?: { limit: number; backoff?: "exponential" | "linear" };
}

export interface IRSequence {
  kind: "sequence";
  name?: string;
  children: WorkflowNode[];
}

export interface IRParallel {
  kind: "parallel";
  name?: string;
  children: WorkflowNode[];
  /** Concurrency cap. Defaults to unbounded (Effect.all default). */
  concurrency?: number;
}

export interface IRBranch {
  kind: "branch";
  name?: string;
  /** Predicate is evaluated against the workflow scope on every run. */
  predicate: (scope: WorkflowScope) => boolean;
  whenTrue: WorkflowNode;
  whenFalse?: WorkflowNode;
}

export interface IRRalph {
  kind: "ralph";
  name?: string;
  /** Loop body — re-runs while `condition` returns true. */
  body: WorkflowNode;
  condition: (scope: WorkflowScope, iteration: number) => boolean;
  maxIterations: number;
}

export interface IRWorkflow {
  kind: "workflow";
  name: string;
  version: string;
  input?: Schema.Schema<unknown, unknown>;
  output?: Schema.Schema<unknown, unknown>;
  body: WorkflowNode;
}

export type WorkflowNode =
  | IRTask<unknown, unknown>
  | IRSequence
  | IRParallel
  | IRBranch
  | IRRalph;

/**
 * Per-task context handed to the handler. Carries the workflow's
 * scope (so handlers can read earlier task outputs) plus durability
 * hooks the runner injects.
 */
export interface TaskContext {
  scope: WorkflowScope;
  /** Persist a key/value pair that survives a workflow restart. */
  persist: (key: string, value: Json) => Promise<void>;
  /** Read previously-persisted value. */
  recall: (key: string) => Promise<Json | undefined>;
  /** Structured logger — routed to the workflow's run log. */
  log: (level: "debug" | "info" | "warn" | "error", message: string, extra?: Json) => void;
}

/** Read-only view of the running workflow's named task outputs. */
export interface WorkflowScope {
  get<T = unknown>(taskName: string): T | undefined;
  has(taskName: string): boolean;
  /** Workflow input. */
  input: unknown;
  /** All outputs keyed by task name, for debugging / branching. */
  outputs: Readonly<Record<string, unknown>>;
}
