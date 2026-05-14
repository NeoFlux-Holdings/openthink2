import { describe, expect, it } from "vitest";
import {
  buildStripeProvisioningPlan,
  createStubStripeProvisioningAdapter,
  type StripeCheckoutSession
} from "../stripe-provisioning";

const baseSession: StripeCheckoutSession = {
  id: "cs_test_123",
  customerEmail: "ada@example.com",
  customerName: "Ada Lovelace",
  amountTotal: 1500,
  currency: "usd",
  metadata: {}
};

describe("buildStripeProvisioningPlan", () => {
  it("produces a six-step plan when a domain is requested", () => {
    const plan = buildStripeProvisioningPlan(
      { ...baseSession, desiredDomain: "ada.dev" },
      "amber-otter"
    );
    expect(plan.domain).toBe("ada.dev");
    expect(plan.steps.map((s) => s.kind)).toEqual([
      "create-cloudflare-account",
      "register-domain",
      "create-zone",
      "issue-scoped-token",
      "launch-agent",
      "create-access-app"
    ]);
    expect(plan.steps.every((s) => s.status === "pending")).toBe(true);
  });

  it("skips domain steps when no domain is requested", () => {
    const plan = buildStripeProvisioningPlan(baseSession, "amber-otter");
    expect(plan.domain).toBeUndefined();
    expect(plan.steps.map((s) => s.kind)).toEqual([
      "create-cloudflare-account",
      "issue-scoped-token",
      "launch-agent",
      "create-access-app"
    ]);
  });
});

describe("stub provisioning adapter", () => {
  it("returns a runnable plan but refuses to execute without configuration", async () => {
    const adapter = createStubStripeProvisioningAdapter();
    const plan = await adapter.prepare({ ...baseSession, desiredDomain: "ada.dev" });
    expect(plan.steps.length).toBe(6);

    const first = plan.steps[0]!;
    const result = await adapter.runStep(first);
    expect(result.status).toBe("error");
    expect(result.detail).toContain("scaffolded");
  });
});
