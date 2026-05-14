import { describe, expect, it } from "vitest";
import {
  buildStripeProvisioningPlan,
  createCloudflarePartnerStripeAdapter,
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

describe("cloudflare partner adapter", () => {
  it("creates an account and caches the result in the idempotency store", async () => {
    const calls: { url: string; method: string; idempotencyKey?: string }[] = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      const idem = (init?.headers as Record<string, string> | undefined)?.["Idempotency-Key"];
      const entry: { url: string; method: string; idempotencyKey?: string } = {
        url: String(input),
        method: init?.method ?? "GET"
      };
      if (idem) entry.idempotencyKey = idem;
      calls.push(entry);
      return new Response(
        JSON.stringify({ result: { id: "acct_123", name: "openthink2 - ada@example.com" }, success: true }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };
    const idempotency = new Map<string, { ok: boolean }>();
    const adapter = createCloudflarePartnerStripeAdapter({
      partnerToken: "partner_abc",
      fetchImpl: fakeFetch,
      launchAgent: async () => ({ workerUrl: "https://amber-otter.example.workers.dev" }),
      idempotencyStore: {
        async get(key) {
          return idempotency.get(key);
        },
        async put(key, value) {
          idempotency.set(key, value);
        }
      }
    });

    const step = {
      kind: "create-cloudflare-account" as const,
      label: "Create",
      status: "pending" as const,
      detail: "x",
      inputs: { sessionId: "cs_test_123", ownerEmail: "ada@example.com", ownerName: "Ada" }
    };
    const result = await adapter.runStep(step);
    expect(result.status).toBe("complete");
    expect(result.inputs?.accountId).toBe("acct_123");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toMatch(/\/accounts$/);
    expect(calls[0]!.idempotencyKey).toBe("cs_test_123:create-cloudflare-account");

    const cached = await adapter.runStep(step);
    expect(cached.status).toBe("complete");
    expect(cached.detail).toContain("(cached)");
    // Network was not called twice
    expect(calls).toHaveLength(1);
  });

  it("propagates API failures as step errors", async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ success: false, errors: [{ message: "no can do" }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    const adapter = createCloudflarePartnerStripeAdapter({
      partnerToken: "x",
      fetchImpl: fakeFetch,
      launchAgent: async () => ({ workerUrl: "" })
    });

    const result = await adapter.runStep({
      kind: "create-cloudflare-account",
      label: "Create",
      status: "pending",
      detail: "x"
    });
    expect(result.status).toBe("error");
    expect(result.detail).toContain("no can do");
  });
});
