import { describe, expect, it } from "vitest";
import {
  approvalModeFromLegacyPolicy,
  createInMemoryApprovalStore,
  defaultApprovalConfig,
  evaluateApproval,
  legacyPolicyFromApprovalMode
} from "../approval";

describe("evaluateApproval", () => {
  it("allows everything in full-auto unless spend threshold tripped", () => {
    const config = { ...defaultApprovalConfig, mode: "full-auto" as const };
    expect(
      evaluateApproval(config, { toolName: "deploy", toolNamespace: "cloudflare" }).allow
    ).toBe(true);

    const overSpend = evaluateApproval(config, {
      toolName: "buy",
      toolNamespace: "stripe",
      estimatedCostUsd: 12,
      affects: ["money"]
    });
    expect(overSpend.allow).toBe(false);
    expect(overSpend.reason).toMatch(/requireApprovalOver/);
  });

  it("blocks everything in manual mode", () => {
    const config = { ...defaultApprovalConfig, mode: "manual" as const };
    expect(evaluateApproval(config, { toolName: "anything" }).allow).toBe(false);
  });

  it("smart-auto flags risky calls and lets remembered keys flow through", () => {
    const config = { ...defaultApprovalConfig, mode: "smart-auto" as const };
    expect(
      evaluateApproval(config, { toolName: "search", toolNamespace: "web", reversible: true }).allow
    ).toBe(true);
    expect(
      evaluateApproval(config, { toolName: "purge", toolNamespace: "d1" }).allow
    ).toBe(false);
    expect(
      evaluateApproval(config, {
        toolName: "deploy",
        toolNamespace: "dns"
      }).allow
    ).toBe(false);
  });

  it("alwaysAllow / neverAllow override mode logic", () => {
    const config = {
      ...defaultApprovalConfig,
      mode: "manual" as const,
      alwaysAllow: ["web.search"]
    };
    expect(
      evaluateApproval(config, { toolName: "search", toolNamespace: "web" }).allow
    ).toBe(true);

    const blocked = {
      ...defaultApprovalConfig,
      mode: "full-auto" as const,
      neverAllow: ["stripe.transfer"]
    };
    expect(
      evaluateApproval(blocked, { toolName: "transfer", toolNamespace: "stripe" }).allow
    ).toBe(false);
  });
});

describe("approvalModeFromLegacyPolicy", () => {
  it("maps the legacy three values", () => {
    expect(approvalModeFromLegacyPolicy("allow-all")).toBe("full-auto");
    expect(approvalModeFromLegacyPolicy("ask-every-time")).toBe("manual");
    expect(approvalModeFromLegacyPolicy("auto")).toBe("smart-auto");
    expect(approvalModeFromLegacyPolicy(undefined)).toBe("smart-auto");
  });

  it("round-trips through legacyPolicyFromApprovalMode", () => {
    for (const legacy of ["allow-all", "ask-every-time", "auto"] as const) {
      const mode = approvalModeFromLegacyPolicy(legacy);
      expect(legacyPolicyFromApprovalMode(mode)).toBe(legacy);
    }
  });
});

describe("in-memory approval store", () => {
  it("records allow / block decisions into the right list", async () => {
    const store = createInMemoryApprovalStore();
    await store.recordDecision("cloudflare.workers_deploy", "allow");
    await store.recordDecision("stripe.refund", "block");
    const config = await store.get();
    expect(config.alwaysAllow).toContain("cloudflare.workers_deploy");
    expect(config.neverAllow).toContain("stripe.refund");
  });
});
