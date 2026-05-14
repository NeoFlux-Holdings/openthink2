/**
 * Tests for the Persona diff viewer. The {@link computeLineDiff}
 * helper is pure — these tests run under Node without a DOM (matching
 * `vitest.config.ts`). The React component is only checked at the
 * module surface (DiffView is a function, types are reachable).
 */
import { describe, expect, it } from "vitest";
import {
  DiffView,
  buildUnifiedPatch,
  computeLineDiff,
  type DiffData,
  type DiffLine
} from "../persona-views";

describe("computeLineDiff", () => {
  it("returns all equal rows when before === after", () => {
    const lines = computeLineDiff("a\nb\nc", "a\nb\nc");
    expect(lines).toHaveLength(3);
    expect(lines.every((l) => l.kind === "equal")).toBe(true);
    expect(lines.map((l) => l.text)).toEqual(["a", "b", "c"]);
  });

  it("marks the first line as added when a line is prepended", () => {
    const lines = computeLineDiff("a\nb", "x\na\nb");
    expect(lines.map((l) => l.kind)).toEqual(["added", "equal", "equal"]);
    expect(lines[0]?.text).toBe("x");
    expect(lines[0]?.leftLine).toBeUndefined();
    expect(lines[0]?.rightLine).toBe(1);
    expect(lines[1]?.text).toBe("a");
    expect(lines[2]?.text).toBe("b");
  });

  it("marks a deleted middle line as removed", () => {
    const lines = computeLineDiff("a\nb\nc", "a\nc");
    expect(lines.map((l) => l.kind)).toEqual(["equal", "removed", "equal"]);
    expect(lines[1]?.text).toBe("b");
    expect(lines[1]?.leftLine).toBe(2);
    expect(lines[1]?.rightLine).toBeUndefined();
  });

  it("assigns correct left/right line numbers across mixed changes", () => {
    // before:  a   b   c   d
    // after:   a   B   c   D   e
    // expect:  =a  -b  +B  =c  -d  +D  +e
    const lines = computeLineDiff("a\nb\nc\nd", "a\nB\nc\nD\ne");
    expect(lines.map((l) => l.kind)).toEqual([
      "equal",
      "removed",
      "added",
      "equal",
      "removed",
      "added",
      "added"
    ]);
    const a = lines[0]!;
    const bRemoved = lines[1]!;
    const bAdded = lines[2]!;
    const c = lines[3]!;
    const dRemoved = lines[4]!;
    const dAdded = lines[5]!;
    const eAdded = lines[6]!;
    expect(a).toMatchObject({ text: "a", leftLine: 1, rightLine: 1 });
    expect(bRemoved).toMatchObject({ text: "b", leftLine: 2 });
    expect(bRemoved.rightLine).toBeUndefined();
    expect(bAdded).toMatchObject({ text: "B", rightLine: 2 });
    expect(bAdded.leftLine).toBeUndefined();
    expect(c).toMatchObject({ text: "c", leftLine: 3, rightLine: 3 });
    expect(dRemoved).toMatchObject({ text: "d", leftLine: 4 });
    expect(dAdded).toMatchObject({ text: "D", rightLine: 4 });
    expect(eAdded).toMatchObject({ text: "e", rightLine: 5 });
  });

  it("handles empty inputs without crashing", () => {
    expect(computeLineDiff("", "")).toEqual([]);
    const onlyAdds = computeLineDiff("", "a\nb");
    expect(onlyAdds.map((l) => l.kind)).toEqual(["added", "added"]);
    expect(onlyAdds.map((l) => l.rightLine)).toEqual([1, 2]);
    const onlyRems = computeLineDiff("a\nb", "");
    expect(onlyRems.map((l) => l.kind)).toEqual(["removed", "removed"]);
    expect(onlyRems.map((l) => l.leftLine)).toEqual([1, 2]);
  });
});

describe("buildUnifiedPatch", () => {
  it("prefixes each row with +/-/space and adds a header", () => {
    const lines: DiffLine[] = [
      { kind: "equal", text: "a", leftLine: 1, rightLine: 1 },
      { kind: "removed", text: "b", leftLine: 2 },
      { kind: "added", text: "B", rightLine: 2 }
    ];
    const patch = buildUnifiedPatch(lines, "notes.md");
    expect(patch).toBe("--- a/notes.md\n+++ b/notes.md\n a\n-b\n+B");
  });

  it("falls back to a generic header when no filename is given", () => {
    const patch = buildUnifiedPatch([{ kind: "added", text: "x", rightLine: 1 }]);
    expect(patch.startsWith("--- before\n+++ after\n")).toBe(true);
    expect(patch.endsWith("+x")).toBe(true);
  });
});

describe("diff-view module surface", () => {
  it("exposes DiffView as a function", () => {
    expect(typeof DiffView).toBe("function");
  });

  it("DiffData type is reachable", () => {
    const data: DiffData = { before: "a", after: "b" };
    expect(data.before).toBe("a");
    expect(data.after).toBe("b");
  });
});
