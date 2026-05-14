import { describe, expect, it } from "vitest";
import { parseGoalCommand, runGoalCommand, type GoalRecord, type GoalStore } from "../goal";

function makeStore(seed: GoalRecord[] = []): GoalStore {
  const map = new Map(seed.map((g) => [g.id, g]));
  return {
    async list() {
      return Array.from(map.values());
    },
    async upsert(record) {
      map.set(record.id, record);
      return record;
    }
  };
}

describe("parseGoalCommand", () => {
  it("rejects strings that aren't /goal", () => {
    expect(parseGoalCommand("hello")).toBeNull();
    expect(parseGoalCommand("set goal X")).toBeNull();
  });

  it("treats bare /goal and /goal list as a list query", () => {
    expect(parseGoalCommand("/goal")).toEqual({ kind: "list" });
    expect(parseGoalCommand("/goal list")).toEqual({ kind: "list" });
  });

  it("parses evolve / complete / block", () => {
    expect(parseGoalCommand("/goal evolve")).toEqual({ kind: "evolve" });
    expect(parseGoalCommand("/goal complete goal-abc")).toEqual({
      kind: "complete",
      id: "goal-abc"
    });
    expect(parseGoalCommand("/goal block goal-abc waiting on finance")).toEqual({
      kind: "block",
      id: "goal-abc",
      reason: "waiting on finance"
    });
  });

  it("parses freeform titles with optional detail", () => {
    const setSimple = parseGoalCommand("/goal Draft Q3 retro");
    expect(setSimple).toEqual({ kind: "set", title: "Draft Q3 retro" });
    const setWithDetail = parseGoalCommand("/goal Ship release — by Friday EOD");
    expect(setWithDetail).toEqual({
      kind: "set",
      title: "Ship release",
      detail: "by Friday EOD"
    });
  });
});

describe("runGoalCommand", () => {
  it("creates, lists, completes, and blocks goals", async () => {
    const store = makeStore();
    const setResult = await runGoalCommand({ kind: "set", title: "Ship release" }, store);
    expect(setResult.goals).toHaveLength(1);
    expect(setResult.goals[0]!.status).toBe("active");

    const id = setResult.goals[0]!.id;
    const doneResult = await runGoalCommand({ kind: "complete", id }, store);
    expect(doneResult.goals[0]!.status).toBe("done");

    const blockResult = await runGoalCommand({ kind: "block", id, reason: "waiting" }, store);
    expect(blockResult.goals[0]!.status).toBe("blocked");
    expect(blockResult.goals[0]!.blockedReason).toBe("waiting");
  });

  it("returns a helpful message on an empty list", async () => {
    const result = await runGoalCommand({ kind: "list" }, makeStore());
    expect(result.message).toContain("No active goals");
  });

  it("evolve does not mutate goals", async () => {
    const store = makeStore([
      { id: "g1", title: "Open PR", status: "active", updatedAt: new Date().toISOString() }
    ]);
    const result = await runGoalCommand({ kind: "evolve" }, store);
    expect(result.goals).toHaveLength(1);
    expect(result.message).toContain("evolve loop");
  });
});
