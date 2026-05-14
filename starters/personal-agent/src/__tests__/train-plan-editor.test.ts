/**
 * Unit tests for the train-mode plan editor's pure helpers. We do not
 * mount React here — the helpers are exported standalone so they can
 * be exercised in node without JSDOM. A single module-shape assertion
 * verifies that `TrainPlanEditor` itself is wired into the export
 * barrel as a function so refactors don't silently drop it.
 */
import { describe, expect, it } from "vitest";
import {
  TrainPlanEditor,
  addStep,
  removeStep,
  reorderSteps,
  updateStep,
  type PlanStep
} from "../persona-pages";

function s(id: string, overrides: Partial<PlanStep> = {}): PlanStep {
  return { id, title: `step ${id}`, status: "pending", ...overrides };
}

describe("train-plan-editor module surface", () => {
  it("TrainPlanEditor is exported as a function (React component)", () => {
    expect(typeof TrainPlanEditor).toBe("function");
  });
});

describe("reorderSteps", () => {
  it("moves index 0 → 2 in a 3-item list", () => {
    const list = [s("a"), s("b"), s("c")];
    const out = reorderSteps(list, "a", "c");
    expect(out.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("returns a fresh array without mutating the input", () => {
    const list = [s("a"), s("b")];
    const before = list.map((x) => x.id);
    const out = reorderSteps(list, "a", "b");
    expect(out).not.toBe(list);
    expect(list.map((x) => x.id)).toEqual(before);
  });

  it("is a no-op when fromId === toId", () => {
    const list = [s("a"), s("b"), s("c")];
    expect(reorderSteps(list, "b", "b").map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("is a no-op when either id is missing", () => {
    const list = [s("a"), s("b")];
    expect(reorderSteps(list, "a", "z").map((x) => x.id)).toEqual(["a", "b"]);
    expect(reorderSteps(list, "z", "a").map((x) => x.id)).toEqual(["a", "b"]);
  });
});

describe("addStep", () => {
  it("appends to the end by default", () => {
    const list = [s("a"), s("b")];
    const out = addStep(list);
    expect(out.length).toBe(3);
    expect(out.slice(0, 2).map((x) => x.id)).toEqual(["a", "b"]);
    const fresh = out[2];
    expect(fresh).toBeDefined();
    expect(fresh?.status).toBe("pending");
    expect(fresh?.title).toBe("");
    expect(typeof fresh?.id).toBe("string");
    expect((fresh?.id.length ?? 0) > 0).toBe(true);
  });

  it("inserts at the given index when provided", () => {
    const list = [s("a"), s("b"), s("c")];
    const out = addStep(list, 1);
    expect(out.length).toBe(4);
    expect(out[0]?.id).toBe("a");
    expect(out[2]?.id).toBe("b");
    expect(out[3]?.id).toBe("c");
    expect(out[1]?.title).toBe("");
    expect(out[1]?.status).toBe("pending");
  });

  it("falls back to append when atIndex is out of range", () => {
    const list = [s("a")];
    const out = addStep(list, 99);
    expect(out.length).toBe(2);
    expect(out[0]?.id).toBe("a");
    expect(out[1]?.title).toBe("");
  });

  it("does not mutate the input", () => {
    const list = [s("a"), s("b")];
    addStep(list, 1);
    expect(list.map((x) => x.id)).toEqual(["a", "b"]);
  });
});

describe("removeStep", () => {
  it("returns a list without the target id", () => {
    const list = [s("a"), s("b"), s("c")];
    expect(removeStep(list, "b").map((x) => x.id)).toEqual(["a", "c"]);
  });

  it("returns an equivalent list when id does not match", () => {
    const list = [s("a"), s("b")];
    expect(removeStep(list, "z").map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the input", () => {
    const list = [s("a"), s("b")];
    removeStep(list, "a");
    expect(list.map((x) => x.id)).toEqual(["a", "b"]);
  });
});

describe("updateStep", () => {
  it("merges the patch into the target row", () => {
    const list = [s("a", { title: "old" }), s("b")];
    const out = updateStep(list, "a", { title: "new", status: "approved" });
    expect(out[0]?.title).toBe("new");
    expect(out[0]?.status).toBe("approved");
    // unrelated fields preserved
    expect(out[0]?.id).toBe("a");
    expect(out[1]?.title).toBe("step b");
  });

  it("does not mutate the input", () => {
    const list = [s("a", { title: "old" })];
    updateStep(list, "a", { title: "new" });
    expect(list[0]?.title).toBe("old");
  });

  it("returns the same shape when id does not match", () => {
    const list = [s("a")];
    const out = updateStep(list, "z", { title: "ignored" });
    expect(out[0]?.title).toBe("step a");
  });

  it("can attach an error message with status=error", () => {
    const list = [s("a")];
    const out = updateStep(list, "a", { status: "error", error: "boom" });
    expect(out[0]?.status).toBe("error");
    expect(out[0]?.error).toBe("boom");
  });
});
