import { describe, expect, it } from "vitest";
import {
  deterministicFunAgentName,
  funAdjectives,
  funNouns,
  isValidAgentSlug,
  randomFunAgentName,
  suggestAgentSlug
} from "../fun-agent-name";

describe("randomFunAgentName", () => {
  it("yields a hyphenated two-word name from the curated pools", () => {
    let seq = 0.5;
    const seeded = () => {
      seq = (seq * 1.7) % 1;
      return seq;
    };
    const name = randomFunAgentName(seeded);
    const [adj, noun] = name.split("-");
    expect(adj).toBeDefined();
    expect(noun).toBeDefined();
    expect(funAdjectives).toContain(adj);
    expect(funNouns).toContain(noun);
  });

  it("is subdomain-safe", () => {
    for (let i = 0; i < 30; i++) {
      const name = randomFunAgentName();
      expect(name).toMatch(/^[a-z]+-[a-z]+$/);
      expect(name.length).toBeLessThanOrEqual(40);
    }
  });
});

describe("deterministicFunAgentName", () => {
  it("returns the same name for the same input", () => {
    const a = deterministicFunAgentName("thomas@example.com");
    const b = deterministicFunAgentName("thomas@example.com");
    expect(a).toEqual(b);
  });

  it("differs across inputs", () => {
    const seen = new Set<string>();
    for (const input of ["a", "b", "c", "d", "e", "thomas", "openthink", "ada"]) {
      seen.add(deterministicFunAgentName(input));
    }
    expect(seen.size).toBeGreaterThan(4);
  });
});

describe("isValidAgentSlug / suggestAgentSlug", () => {
  it("rejects bad slugs", () => {
    expect(isValidAgentSlug("ab")).toBe(false);
    expect(isValidAgentSlug("-leading")).toBe(false);
    expect(isValidAgentSlug("trailing-")).toBe(false);
    expect(isValidAgentSlug("Bad Case")).toBe(false);
    expect(isValidAgentSlug("www")).toBe(false);
  });

  it("accepts good slugs", () => {
    expect(isValidAgentSlug("amber-otter")).toBe(true);
    expect(isValidAgentSlug("cf123-zone")).toBe(true);
  });

  it("normalizes free-text to a slug or falls back", () => {
    expect(suggestAgentSlug("Ada Lovelace")).toEqual("ada-lovelace");
    const fallback = suggestAgentSlug("X");
    expect(fallback).toMatch(/^[a-z]+-[a-z]+$/);
  });
});
