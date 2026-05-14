import { describe, expect, it } from "vitest";
import {
  buildStripeProvisioningPlan,
  createCloudflarePartnerStripeAdapter,
  createStubStripeProvisioningAdapter,
  runPlan,
  type StripeCheckoutSession,
  type StripeProvisioningStep
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

  it("registers a domain via the partner registrar endpoint", async () => {
    const calls: { url: string; method: string; body: unknown; idem?: string }[] = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      const idem = (init?.headers as Record<string, string> | undefined)?.["Idempotency-Key"];
      const entry: { url: string; method: string; body: unknown; idem?: string } = {
        url: String(input),
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : null
      };
      if (idem) entry.idem = idem;
      calls.push(entry);
      return new Response(
        JSON.stringify({ result: { id: "dom_1", name: "ada.dev" }, success: true }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };
    const adapter = createCloudflarePartnerStripeAdapter({
      partnerToken: "partner_abc",
      fetchImpl: fakeFetch,
      launchAgent: async () => ({ workerUrl: "" })
    });

    const step: StripeProvisioningStep = {
      kind: "register-domain",
      label: "Register",
      status: "pending",
      detail: "x",
      inputs: { sessionId: "cs_1", accountId: "acct_123", domain: "ada.dev" }
    };
    const result = await adapter.runStep(step);
    expect(result.status).toBe("complete");
    expect(result.inputs?.domain).toBe("ada.dev");
    expect(result.inputs?.domainId).toBe("dom_1");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toMatch(
      /\/accounts\/acct_123\/registrar\/domains\/ada\.dev\/register$/
    );
    expect(calls[0]!.body).toEqual({ years: 1, auto_renew: true, privacy: true });
    expect(calls[0]!.idem).toBe("cs_1:register-domain");
  });

  it("creates a zone with the right body and stashes nameservers", async () => {
    const calls: { url: string; method: string; body: unknown; idem?: string }[] = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      const idem = (init?.headers as Record<string, string> | undefined)?.["Idempotency-Key"];
      const entry: { url: string; method: string; body: unknown; idem?: string } = {
        url: String(input),
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : null
      };
      if (idem) entry.idem = idem;
      calls.push(entry);
      return new Response(
        JSON.stringify({
          result: {
            id: "zone_1",
            name: "ada.dev",
            name_servers: ["ns1.cloudflare.com", "ns2.cloudflare.com"]
          },
          success: true
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };
    const adapter = createCloudflarePartnerStripeAdapter({
      partnerToken: "partner_abc",
      fetchImpl: fakeFetch,
      launchAgent: async () => ({ workerUrl: "" })
    });

    const result = await adapter.runStep({
      kind: "create-zone",
      label: "Zone",
      status: "pending",
      detail: "x",
      inputs: { sessionId: "cs_1", accountId: "acct_123", domain: "ada.dev" }
    });

    expect(result.status).toBe("complete");
    expect(result.inputs?.zoneId).toBe("zone_1");
    expect(result.inputs?.nameservers).toEqual([
      "ns1.cloudflare.com",
      "ns2.cloudflare.com"
    ]);
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toMatch(/\/zones$/);
    expect(calls[0]!.body).toEqual({
      name: "ada.dev",
      account: { id: "acct_123" },
      type: "full"
    });
    expect(calls[0]!.idem).toBe("cs_1:create-zone");
  });

  it("issues a scoped token with openthink2 permission preset", async () => {
    const calls: { url: string; method: string; body: unknown; idem?: string }[] = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      const idem = (init?.headers as Record<string, string> | undefined)?.["Idempotency-Key"];
      const entry: { url: string; method: string; body: unknown; idem?: string } = {
        url: String(input),
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : null
      };
      if (idem) entry.idem = idem;
      calls.push(entry);
      return new Response(
        JSON.stringify({
          result: { id: "tok_1", value: "v1.0-secret-token-value" },
          success: true
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };
    const adapter = createCloudflarePartnerStripeAdapter({
      partnerToken: "partner_abc",
      fetchImpl: fakeFetch,
      launchAgent: async () => ({ workerUrl: "" })
    });

    const result = await adapter.runStep({
      kind: "issue-scoped-token",
      label: "Token",
      status: "pending",
      detail: "x",
      inputs: { sessionId: "cs_1", accountId: "acct_123", agentSlug: "amber-otter" }
    });

    expect(result.status).toBe("complete");
    expect(result.inputs?.apiToken).toBe("v1.0-secret-token-value");
    expect(result.inputs?.tokenId).toBe("tok_1");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toMatch(/\/user\/tokens$/);
    expect(calls[0]!.idem).toBe("cs_1:issue-scoped-token");
    const body = calls[0]!.body as {
      name: string;
      policies: { effect: string; resources: Record<string, string>; permission_groups: { name: string }[] }[];
    };
    expect(body.name).toContain("amber-otter");
    expect(body.policies.length).toBeGreaterThan(0);
    expect(body.policies[0]!.effect).toBe("allow");
    expect(body.policies[0]!.resources).toEqual({
      "com.cloudflare.api.account.acct_123": "*"
    });
    // The preset includes the "Workers Scripts Edit" group.
    expect(
      body.policies.some((p) => p.permission_groups[0]?.name === "Workers Scripts Edit")
    ).toBe(true);
  });

  it("creates an access app locked to the owner email", async () => {
    const calls: { url: string; method: string; body: unknown; idem?: string }[] = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      const idem = (init?.headers as Record<string, string> | undefined)?.["Idempotency-Key"];
      const entry: { url: string; method: string; body: unknown; idem?: string } = {
        url: String(input),
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : null
      };
      if (idem) entry.idem = idem;
      calls.push(entry);
      return new Response(
        JSON.stringify({
          result: {
            id: "app_1",
            domain: "amber-otter.ada.dev",
            policies: [{ id: "pol_1" }]
          },
          success: true
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };
    const adapter = createCloudflarePartnerStripeAdapter({
      partnerToken: "partner_abc",
      fetchImpl: fakeFetch,
      launchAgent: async () => ({ workerUrl: "" })
    });

    const result = await adapter.runStep({
      kind: "create-access-app",
      label: "Access",
      status: "pending",
      detail: "x",
      inputs: {
        sessionId: "cs_1",
        accountId: "acct_123",
        ownerEmail: "ada@example.com",
        agentSlug: "amber-otter",
        domain: "ada.dev"
      }
    });

    expect(result.status).toBe("complete");
    expect(result.inputs?.accessAppId).toBe("app_1");
    expect(result.inputs?.accessPolicyId).toBe("pol_1");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toMatch(/\/accounts\/acct_123\/access\/apps$/);
    expect(calls[0]!.idem).toBe("cs_1:create-access-app");
    expect(calls[0]!.body).toEqual({
      name: "openthink2 - amber-otter",
      domain: "amber-otter.ada.dev",
      session_duration: "24h",
      auto_redirect_to_identity: true,
      policies: [
        {
          name: "Owner",
          decision: "allow",
          include: [{ email: { email: "ada@example.com" } }]
        }
      ]
    });
  });
});

describe("runPlan", () => {
  it("threads outputs from each step into the next and stops on error", async () => {
    const calls: string[] = [];
    const adapter = {
      async prepare(session: StripeCheckoutSession) {
        return buildStripeProvisioningPlan(session, "amber-otter");
      },
      async runStep(step: StripeProvisioningStep): Promise<StripeProvisioningStep> {
        calls.push(step.kind);
        if (step.kind === "create-cloudflare-account") {
          return {
            ...step,
            status: "complete",
            detail: "ok",
            inputs: { ...(step.inputs ?? {}), accountId: "acct_xyz" }
          };
        }
        if (step.kind === "issue-scoped-token") {
          // Verify that accountId from the previous step is visible here.
          if (step.inputs?.accountId !== "acct_xyz") {
            return { ...step, status: "error", detail: "missing prior accountId" };
          }
          return { ...step, status: "error", detail: "boom" };
        }
        return { ...step, status: "complete", detail: "ok" };
      }
    };
    const plan = await adapter.prepare(baseSession);
    const result = await runPlan(plan, { adapter });
    expect(result.ok).toBe(false);
    expect(result.error?.step).toBe("issue-scoped-token");
    expect(result.error?.detail).toBe("boom");
    // We should have stopped before launch-agent.
    expect(calls).toEqual(["create-cloudflare-account", "issue-scoped-token"]);
  });

  it("returns ok:true when every step completes", async () => {
    const adapter = {
      async prepare(session: StripeCheckoutSession) {
        return buildStripeProvisioningPlan(session, "amber-otter");
      },
      async runStep(step: StripeProvisioningStep): Promise<StripeProvisioningStep> {
        return { ...step, status: "complete", detail: "ok" };
      }
    };
    const plan = await adapter.prepare(baseSession);
    const result = await runPlan(plan, { adapter });
    expect(result.ok).toBe(true);
    expect(result.plan.steps.every((s) => s.status === "complete")).toBe(true);
  });
});
