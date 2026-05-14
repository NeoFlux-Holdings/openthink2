/**
 * Runners for the workflow IR.
 *
 *  - runWorkflow(workflow, input)        — pure Effect runner, in-memory.
 *                                          Use for tests + same-isolate work.
 *  - runWorkflowOnCloudflare(...)        — adapts each `<Task>` to a
 *                                          Cloudflare Workflow `step.do()`
 *                                          checkpoint so a crash mid-run
 *                                          resumes from the last completed
 *                                          task. Reference:
 *                                          https://developers.cloudflare.com/workflows/
 */

import { Effect } from "effect";
import type {
  IRWorkflow,
  IRTask,
  Json,
  TaskContext,
  WorkflowScope
} from "./ir";
import { interpret } from "./interpreter";

interface MemoryStore {
  data: Map<string, Json>;
}

function buildMemoryTaskContext(
  _task: IRTask,
  scope: WorkflowScope,
  store: MemoryStore,
  logger?: TaskContext["log"]
): TaskContext {
  return {
    scope,
    async persist(key, value) {
      store.data.set(key, value);
    },
    async recall(key) {
      return store.data.get(key);
    },
    log: logger ?? (() => {})
  };
}

export interface RunWorkflowOptions {
  /** Custom logger; default is console-quiet. */
  logger?: TaskContext["log"];
}

export async function runWorkflow(
  workflow: IRWorkflow,
  input: unknown,
  options: RunWorkflowOptions = {}
): Promise<Record<string, unknown>> {
  const store: MemoryStore = { data: new Map() };
  const eff = interpret(workflow, input, {
    buildTaskContext: (task, scope) => buildMemoryTaskContext(task, scope, store, options.logger)
  });
  return Effect.runPromise(eff);
}

// ----- Cloudflare Workflows runner -----------------------------------------

/**
 * Minimal shape of the Cloudflare Workflows `WorkflowStep` we depend
 * on. Kept structural so the runner can be tested without the real
 * binding and so SDK minor-version drift doesn't break the surface.
 */
export interface CloudflareWorkflowStep {
  do<T>(
    name: string,
    options:
      | { retries?: { limit?: number; backoff?: "exponential" | "linear" } }
      | (() => T | Promise<T>),
    handler?: () => T | Promise<T>
  ): Promise<T>;
}

interface CloudflareDurableStore {
  /** Workflow-level persistence — survives restarts. CF Workflows
   *  itself does this for `step.do` returns; we hand the same store
   *  to tasks for ad-hoc key/value needs. */
  put(key: string, value: Json): Promise<void>;
  get(key: string): Promise<Json | undefined>;
}

export interface RunOnCloudflareInput {
  workflow: IRWorkflow;
  input: unknown;
  step: CloudflareWorkflowStep;
  store?: CloudflareDurableStore;
  logger?: TaskContext["log"];
}

export async function runWorkflowOnCloudflare(
  input: RunOnCloudflareInput
): Promise<Record<string, unknown>> {
  const memory: MemoryStore = { data: new Map() };
  const store: CloudflareDurableStore = input.store ?? {
    async put(key, value) {
      memory.data.set(key, value);
    },
    async get(key) {
      return memory.data.get(key);
    }
  };

  const eff = interpret(input.workflow, input.input, {
    buildTaskContext: (task, scope): TaskContext => ({
      scope,
      persist: (key, value) => store.put(`${task.name}:${key}`, value),
      recall: (key) => store.get(`${task.name}:${key}`),
      log: input.logger ?? (() => {})
    }),
    withStep: (task, body) => wrapStep(task, body, input.step)
  });

  return Effect.runPromise(eff);
}

function wrapStep<A, E>(
  task: IRTask,
  body: Effect.Effect<A, E>,
  step: CloudflareWorkflowStep
): Effect.Effect<A, E> {
  return Effect.tryPromise({
    try: async () => {
      const handler = async () => Effect.runPromise(body as Effect.Effect<A, never>);
      const retryOption = task.retry
        ? task.retry.backoff
          ? { retries: { limit: task.retry.limit, backoff: task.retry.backoff } }
          : { retries: { limit: task.retry.limit } }
        : undefined;
      if (retryOption) {
        return (await step.do(task.name, retryOption, handler)) as A;
      }
      return (await step.do(task.name, handler)) as A;
    },
    catch: (cause) => cause as E
  });
}

