import { describe, expect, it, vi } from "vitest";
import { handleStripeWebhook } from "../route";
import {
  buildStripeProvisioningPlan,
  type StripeCheckoutSession,
  type StripeProvisioningAdapter,
  type StripeProvisioningStep
} from "../../../../../lib/stripe-provisioning";

async function sign(secret: string, body: string, timestamp: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`)
  );
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i] ?? 0;
    hex += byte.toString(16).padStart(2, "0");
  }
  return `t=${timestamp},v1=${hex}`;
}

function checkoutSessionPayload(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: "evt_1",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_routed_1",
        customer_email: "ada@example.com",
        customer_details: { email: "ada@example.com", name: "Ada Lovelace" },
        amount_total: 1500,
        currency: "usd",
        metadata: { desired_agent_name: "amber-otter" },
        ...extra
      }
    }
  });
}

describe("POST /api/deployment/stripe", () => {
  it("returns 401 when secret is set but signature header is missing", async () => {
    const body = checkoutSessionPayload();
    const request = new Request("https://example.com/api/deployment/stripe", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" }
    });
    const response = await handleStripeWebhook(request, {
      env: { STRIPE_WEBHOOK_SECRET: "whsec_test" }
    });
    expect(response.status).toBe(401);
    const json = (await response.json()) as { error: string };
    expect(json.error).toMatch(/signature/i);
  });

  it("returns 401 when signature does not match the secret", async () => {
    const body = checkoutSessionPayload();
    const timestamp = Math.floor(Date.now() / 1000);
    const bad = await sign("WRONG_SECRET", body, timestamp);
    const request = new Request("https://example.com/api/deployment/stripe", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "stripe-signature": bad }
    });
    const response = await handleStripeWebhook(request, {
      env: { STRIPE_WEBHOOK_SECRET: "whsec_test" }
    });
    expect(response.status).toBe(401);
  });

  it("triggers the adapter when signature is valid and event is completed", async () => {
    const secret = "whsec_test_correct";
    const body = checkoutSessionPayload();
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await sign(secret, body, timestamp);

    const seen: { sessions: StripeCheckoutSession[]; steps: StripeProvisioningStep[] } = {
      sessions: [],
      steps: []
    };
    const adapter: StripeProvisioningAdapter = {
      async prepare(session) {
        seen.sessions.push(session);
        return buildStripeProvisioningPlan(session, "amber-otter");
      },
      async runStep(step) {
        seen.steps.push(step);
        return { ...step, status: "complete", detail: "ok" };
      }
    };

    const request = new Request("https://example.com/api/deployment/stripe", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "stripe-signature": signature }
    });
    const response = await handleStripeWebhook(request, {
      env: { STRIPE_WEBHOOK_SECRET: secret },
      adapter
    });
    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; planId: string };
    expect(json.ok).toBe(true);
    expect(json.planId).toBe("cs_test_routed_1");
    expect(seen.sessions).toHaveLength(1);
    expect(seen.sessions[0]!.customerEmail).toBe("ada@example.com");
    expect(seen.sessions[0]!.desiredAgentName).toBe("amber-otter");
    expect(seen.steps.length).toBeGreaterThan(0);
  });

  it("accepts unverified webhooks when the secret is empty and logs a warning", async () => {
    const warn = vi.fn();
    const body = checkoutSessionPayload();
    const adapter: StripeProvisioningAdapter = {
      async prepare(session) {
        return buildStripeProvisioningPlan(session, "amber-otter");
      },
      async runStep(step) {
        return { ...step, status: "complete", detail: "ok" };
      }
    };
    const request = new Request("https://example.com/api/deployment/stripe", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" }
    });
    const response = await handleStripeWebhook(request, {
      env: { STRIPE_WEBHOOK_SECRET: "" },
      adapter,
      logger: { warn, error: () => undefined }
    });
    expect(response.status).toBe(200);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/STRIPE_WEBHOOK_SECRET/);
  });

  it("ignores non-completion events with 200", async () => {
    const body = JSON.stringify({
      id: "evt_other",
      type: "payment_intent.created",
      data: { object: {} }
    });
    const request = new Request("https://example.com/api/deployment/stripe", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" }
    });
    const response = await handleStripeWebhook(request, { env: {} });
    expect(response.status).toBe(200);
    const json = (await response.json()) as { ignored: boolean };
    expect(json.ignored).toBe(true);
  });

  it("returns 500 when the adapter step fails", async () => {
    const body = checkoutSessionPayload();
    const adapter: StripeProvisioningAdapter = {
      async prepare(session) {
        return buildStripeProvisioningPlan(session, "amber-otter");
      },
      async runStep(step) {
        return { ...step, status: "error", detail: "synthetic-failure" };
      }
    };
    const request = new Request("https://example.com/api/deployment/stripe", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" }
    });
    const response = await handleStripeWebhook(request, {
      env: {},
      adapter
    });
    expect(response.status).toBe(500);
    const json = (await response.json()) as {
      ok: boolean;
      error?: { step: string; detail: string };
    };
    expect(json.ok).toBe(false);
    expect(json.error?.detail).toBe("synthetic-failure");
  });
});
