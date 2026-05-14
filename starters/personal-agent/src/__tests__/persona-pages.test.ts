/**
 * Smoke tests for the Persona shell's supporting pages. We deliberately
 * avoid the DOM / JSDOM here: the components are validated as functions
 * and their pure helpers are unit tested directly. The Settings page
 * proves the `onUpdate` contract by invoking `buildSettingsPatch`, which
 * is the same helper its onChange handlers call.
 */
import { describe, expect, it, vi } from "vitest";
import {
  LibraryPage,
  SearchPalette,
  SettingsPage,
  SkillsPage,
  ageBucket,
  bucketFor,
  buildSettingsPatch,
  defaultPersonaSettings,
  filterArtifacts,
  filterMemories,
  filterSearchArtifacts,
  filterThreads,
  groupByAge,
  matchesQuery,
  type PersonaArtifact,
  type SearchArtifactHit,
  type SearchMemoryHit,
  type SearchThreadHit
} from "../persona-pages";

describe("persona-pages module surface", () => {
  it("exports the four page components as functions", () => {
    expect(typeof LibraryPage).toBe("function");
    expect(typeof SkillsPage).toBe("function");
    expect(typeof SettingsPage).toBe("function");
    expect(typeof SearchPalette).toBe("function");
  });
});

describe("LibraryPage filter logic", () => {
  const now = Date.parse("2025-06-15T00:00:00Z");
  const fixtures: PersonaArtifact[] = [
    {
      id: "a1",
      kind: "document",
      title: "Project plan",
      version: 3,
      updatedAt: "2025-06-15T00:00:00Z",
      source: "agent",
      summary: "Q3 retrospective"
    },
    {
      id: "a2",
      kind: "code",
      title: "Worker handler",
      version: 1,
      updatedAt: "2025-06-10T00:00:00Z",
      source: "agent",
      summary: "Cloudflare worker code"
    },
    {
      id: "a3",
      kind: "image",
      title: "Logo draft",
      version: 2,
      updatedAt: "2025-04-01T00:00:00Z",
      source: "user"
    },
    {
      id: "a4",
      kind: "browser",
      title: "DMV form",
      version: 1,
      updatedAt: "2024-01-01T00:00:00Z",
      source: "import"
    }
  ];

  it("returns everything when filters are wide-open", () => {
    const out = filterArtifacts(
      fixtures,
      { query: "", kind: "all", source: "all", age: "all" },
      now
    );
    expect(out.map((a) => a.id)).toEqual(["a1", "a2", "a3", "a4"]);
  });

  it("filters by kind", () => {
    const out = filterArtifacts(
      fixtures,
      { query: "", kind: "code", source: "all", age: "all" },
      now
    );
    expect(out.map((a) => a.id)).toEqual(["a2"]);
  });

  it("filters by source", () => {
    const out = filterArtifacts(
      fixtures,
      { query: "", kind: "all", source: "user", age: "all" },
      now
    );
    expect(out.map((a) => a.id)).toEqual(["a3"]);
  });

  it("filters by age bucket", () => {
    const out = filterArtifacts(
      fixtures,
      { query: "", kind: "all", source: "all", age: "older" },
      now
    );
    expect(out.map((a) => a.id)).toEqual(["a3", "a4"]);
  });

  it("substring searches across title and summary", () => {
    const out = filterArtifacts(
      fixtures,
      { query: "retro", kind: "all", source: "all", age: "all" },
      now
    );
    expect(out.map((a) => a.id)).toEqual(["a1"]);
  });

  it("buckets dates correctly", () => {
    expect(bucketFor("2025-06-15T00:00:00Z", now)).toBe("today");
    expect(bucketFor("2025-06-10T00:00:00Z", now)).toBe("week");
    expect(bucketFor("2025-05-20T00:00:00Z", now)).toBe("month");
    expect(bucketFor("2024-01-01T00:00:00Z", now)).toBe("older");
    expect(bucketFor("not-a-date", now)).toBe("older");
  });
});

describe("SearchPalette substring matcher", () => {
  it("matches case-insensitively across the haystack", () => {
    expect(matchesQuery("Hello World", "hello")).toBe(true);
    expect(matchesQuery("Hello World", "WORLD")).toBe(true);
    expect(matchesQuery("Hello World", "")).toBe(true);
    expect(matchesQuery("Hello World", "  ")).toBe(true);
    expect(matchesQuery("Hello World", "xyz")).toBe(false);
  });

  it("filters threads by title or agent name", () => {
    const threads: SearchThreadHit[] = [
      { id: "t1", title: "Plan Q3", updatedAt: "2025-06-10", agentName: "amber-otter" },
      { id: "t2", title: "Shopping list", updatedAt: "2025-04-01", agentName: "blue-jay" }
    ];
    expect(filterThreads(threads, "plan").map((t) => t.id)).toEqual(["t1"]);
    expect(filterThreads(threads, "jay").map((t) => t.id)).toEqual(["t2"]);
    expect(filterThreads(threads, "").length).toBe(2);
  });

  it("filters artifacts by title or kind", () => {
    const artifacts: SearchArtifactHit[] = [
      { id: "a1", title: "Plan", kind: "document", updatedAt: "2025-06-15" },
      { id: "a2", title: "Logo", kind: "image", updatedAt: "2025-06-15" }
    ];
    expect(filterSearchArtifacts(artifacts, "image").map((a) => a.id)).toEqual(["a2"]);
  });

  it("filters memories by body", () => {
    const memories: SearchMemoryHit[] = [
      { id: "m1", body: "User prefers dark mode", updatedAt: "2025-06-10" },
      { id: "m2", body: "Time zone is Pacific", updatedAt: "2025-06-10" }
    ];
    expect(filterMemories(memories, "dark").map((m) => m.id)).toEqual(["m1"]);
    expect(filterMemories(memories, "pacific").map((m) => m.id)).toEqual(["m2"]);
  });

  it("groups items into week / month / older buckets", () => {
    const now = Date.parse("2025-06-15T00:00:00Z");
    const items = [
      { id: "x1", updatedAt: "2025-06-14T00:00:00Z" },
      { id: "x2", updatedAt: "2025-05-20T00:00:00Z" },
      { id: "x3", updatedAt: "2024-01-01T00:00:00Z" }
    ];
    const groups = groupByAge(items, now);
    expect(groups.week.map((x) => x.id)).toEqual(["x1"]);
    expect(groups.month.map((x) => x.id)).toEqual(["x2"]);
    expect(groups.older.map((x) => x.id)).toEqual(["x3"]);
  });

  it("ageBucket exposes the same buckets as groupByAge", () => {
    const now = Date.parse("2025-06-15T00:00:00Z");
    expect(ageBucket("2025-06-14T00:00:00Z", now)).toBe("week");
    expect(ageBucket("2025-05-20T00:00:00Z", now)).toBe("month");
    expect(ageBucket("2024-01-01T00:00:00Z", now)).toBe("older");
  });
});

describe("Settings page patch contract", () => {
  it("builds single-key patches preserving the value type", () => {
    expect(buildSettingsPatch("modelProvider", "openrouter")).toEqual({
      modelProvider: "openrouter"
    });
    expect(buildSettingsPatch("extendedThinking", false)).toEqual({
      extendedThinking: false
    });
    expect(buildSettingsPatch("thinkingBudgetTokens", 16_000)).toEqual({
      thinkingBudgetTokens: 16_000
    });
  });

  it("plugs into an onUpdate spy to mimic the page's wiring", () => {
    const onUpdate = vi.fn();
    onUpdate(buildSettingsPatch("approvalMode", "manual"));
    onUpdate(buildSettingsPatch("spendCapUsd", 12));
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenNthCalledWith(1, { approvalMode: "manual" });
    expect(onUpdate).toHaveBeenNthCalledWith(2, { spendCapUsd: 12 });
  });

  it("ships sensible defaults", () => {
    expect(defaultPersonaSettings.modelProvider).toBe("anthropic");
    expect(defaultPersonaSettings.thinkingBudgetTokens).toBeGreaterThanOrEqual(1000);
    expect(defaultPersonaSettings.thinkingBudgetTokens).toBeLessThanOrEqual(32_000);
    expect(defaultPersonaSettings.approvalMode).toBe("smart-auto");
  });
});
