/**
 * /goal — the agent's internal goal-management command.
 *
 * Used by the orchestrator to track the user's active objective(s).
 * Goals are persisted in the orchestrator's Durable Object storage
 * (via OrchestratorStateStore.upsertGoal). The /goal command is
 * routed through the chat composer when the user types `/goal …`,
 * or invoked programmatically by sub-agents that need to record
 * progress for the orchestrator to surface in the working doc.
 */

import { z } from "zod";

export const goalCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("set"),
    title: z.string().min(1),
    detail: z.string().optional()
  }),
  z.object({ kind: z.literal("list") }),
  z.object({
    kind: z.literal("complete"),
    id: z.string().min(1)
  }),
  z.object({
    kind: z.literal("block"),
    id: z.string().min(1),
    reason: z.string().optional()
  }),
  z.object({ kind: z.literal("evolve") })
]);

export type GoalCommand = z.infer<typeof goalCommandSchema>;

export function parseGoalCommand(input: string): GoalCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/goal")) return null;
  const tail = trimmed.slice(5).trim();
  if (tail === "" || tail === "list") return { kind: "list" };
  if (tail === "evolve") return { kind: "evolve" };

  const completeMatch = /^complete\s+(\S+)$/.exec(tail);
  if (completeMatch) return { kind: "complete", id: completeMatch[1]! };

  const blockMatch = /^block\s+(\S+)(?:\s+(.+))?$/.exec(tail);
  if (blockMatch) {
    const cmd: GoalCommand = { kind: "block", id: blockMatch[1]! };
    if (blockMatch[2]) (cmd as { reason?: string }).reason = blockMatch[2];
    return cmd;
  }

  // Anything else is "set"
  const [titlePart, ...rest] = tail.split(" — ");
  const title = (titlePart ?? tail).trim();
  if (!title) return { kind: "list" };
  const cmd: GoalCommand = { kind: "set", title };
  const detail = rest.join(" — ").trim();
  if (detail) (cmd as { detail?: string }).detail = detail;
  return cmd;
}

export interface GoalRecord {
  id: string;
  title: string;
  status: "active" | "done" | "blocked";
  detail?: string;
  blockedReason?: string;
  updatedAt: string;
}

export interface GoalStore {
  list(): Promise<GoalRecord[]>;
  upsert(record: GoalRecord): Promise<GoalRecord>;
}

export async function runGoalCommand(
  command: GoalCommand,
  store: GoalStore
): Promise<{ message: string; goals: GoalRecord[] }> {
  if (command.kind === "list") {
    const goals = await store.list();
    return { message: formatGoalList(goals), goals };
  }
  if (command.kind === "set") {
    const record: GoalRecord = {
      id: `goal-${Date.now()}`,
      title: command.title,
      status: "active",
      updatedAt: new Date().toISOString()
    };
    if (command.detail) record.detail = command.detail;
    await store.upsert(record);
    const goals = await store.list();
    return { message: `Goal set: ${record.title}`, goals };
  }
  if (command.kind === "complete") {
    const current = (await store.list()).find((g) => g.id === command.id);
    if (!current) return { message: `No goal ${command.id}`, goals: await store.list() };
    const next: GoalRecord = { ...current, status: "done", updatedAt: new Date().toISOString() };
    await store.upsert(next);
    return { message: `Goal ${command.id} marked done.`, goals: await store.list() };
  }
  if (command.kind === "block") {
    const current = (await store.list()).find((g) => g.id === command.id);
    if (!current) return { message: `No goal ${command.id}`, goals: await store.list() };
    const next: GoalRecord = {
      ...current,
      status: "blocked",
      updatedAt: new Date().toISOString()
    };
    if (command.reason) next.blockedReason = command.reason;
    await store.upsert(next);
    return { message: `Goal ${command.id} blocked.`, goals: await store.list() };
  }
  // evolve
  return {
    message:
      "Triggering the evolve loop — the agent will review recent traces and propose skill / rubric / prompt edits. See the Learning page.",
    goals: await store.list()
  };
}

function formatGoalList(goals: GoalRecord[]): string {
  if (goals.length === 0) return "No active goals. Use `/goal <title>` to set one.";
  const lines = goals.map((g) => {
    const tick = g.status === "done" ? "✓" : g.status === "blocked" ? "⊘" : "•";
    return `${tick} ${g.id}  ${g.title}${g.detail ? ` — ${g.detail}` : ""}`;
  });
  return lines.join("\n");
}
