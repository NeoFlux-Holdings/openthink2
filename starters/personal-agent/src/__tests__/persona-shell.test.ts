/**
 * Smoke tests for the Persona shell component. The CSS-heavy rendering
 * is intentionally not exercised here — we just verify the module
 * exports the expected surface so refactors don't accidentally rename
 * things.
 */
import { describe, expect, it } from "vitest";
import { PersonaShell, type PersonaArtifact, type PersonaThreadSummary } from "../persona-shell";

describe("Persona shell module", () => {
  it("exposes PersonaShell as a function (component)", () => {
    expect(typeof PersonaShell).toBe("function");
  });

  it("type contracts are stable", () => {
    const thread: PersonaThreadSummary = {
      id: "t1",
      title: "Hello",
      agentName: "amber-otter",
      agentColor: "#3a5bd7",
      status: "live",
      lastUpdated: "now",
      artifactCount: 0
    };
    const artifact: PersonaArtifact = {
      id: "a1",
      kind: "document",
      title: "Notes",
      version: 1,
      updatedAt: new Date().toISOString()
    };
    expect(thread.id).toBe("t1");
    expect(artifact.kind).toBe("document");
  });
});
