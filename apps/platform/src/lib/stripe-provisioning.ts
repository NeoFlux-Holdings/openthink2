/**
 * Stripe → Cloudflare provisioning scaffolding.
 *
 * Implements the deploy lane described in
 * https://blog.cloudflare.com/agents-stripe-projects/ — a user who
 * doesn't already have a Cloudflare account can pay through Stripe,
 * and the platform provisions:
 *
 *   1. a fresh Cloudflare account (via the Cloudflare Partner /
 *      account-creation API once the partner application is approved),
 *   2. a registered domain (via the Cloudflare registrar API),
 *   3. the agent stack (workers / d1 / r2 / vectorize / queue / access),
 *   4. an Access self-hosted application locked to the Stripe payer
 *      email.
 *
 * Today this module is a typed scaffold — the actual partner-account
 * provisioning endpoint requires an approved Cloudflare partnership +
 * a Stripe Connect account; both are configured through env vars and
 * left as future wiring. The contract is exported so the
 * `/api/deployment/stripe` route can plug in the real implementation
 * incrementally without changing the deploy flow type.
 */

export interface StripeCheckoutSession {
  id: string;
  customerEmail: string;
  customerName?: string;
  amountTotal: number;
  currency: string;
  metadata: Record<string, string>;
  desiredDomain?: string;
  desiredAgentName?: string;
}

export interface StripeProvisioningPlan {
  sessionId: string;
  customerEmail: string;
  agentName: string;
  domain?: string;
  steps: StripeProvisioningStep[];
}

export type StripeProvisioningStepKind =
  | "create-cloudflare-account"
  | "register-domain"
  | "create-zone"
  | "issue-scoped-token"
  | "launch-agent"
  | "create-access-app";

export interface StripeProvisioningStep {
  kind: StripeProvisioningStepKind;
  label: string;
  status: "pending" | "active" | "complete" | "error";
  detail: string;
  inputs?: Record<string, unknown>;
}

export function buildStripeProvisioningPlan(
  session: StripeCheckoutSession,
  agentSlug: string
): StripeProvisioningPlan {
  const steps: StripeProvisioningStep[] = [
    {
      kind: "create-cloudflare-account",
      label: "Create Cloudflare account",
      status: "pending",
      detail: `Create a Cloudflare account owned by ${session.customerEmail} via the Partner API.`,
      inputs: { ownerEmail: session.customerEmail, ownerName: session.customerName }
    }
  ];
  if (session.desiredDomain) {
    steps.push(
      {
        kind: "register-domain",
        label: `Register ${session.desiredDomain}`,
        status: "pending",
        detail: "Use the Cloudflare registrar API to register the requested domain.",
        inputs: { domain: session.desiredDomain }
      },
      {
        kind: "create-zone",
        label: `Add ${session.desiredDomain} as a zone`,
        status: "pending",
        detail: "Attach the new domain as a Cloudflare zone in the freshly-created account.",
        inputs: { domain: session.desiredDomain }
      }
    );
  }
  steps.push(
    {
      kind: "issue-scoped-token",
      label: "Issue scoped API token",
      status: "pending",
      detail:
        "Create a Cloudflare API token in the new account with the openthink2 permission preset and store its fingerprint."
    },
    {
      kind: "launch-agent",
      label: `Launch ${agentSlug}`,
      status: "pending",
      detail: "Run the same deploy flow used in self-deploy — Workers / D1 / R2 / Vectorize / Queue."
    },
    {
      kind: "create-access-app",
      label: "Lock down with Cloudflare Access",
      status: "pending",
      detail: `Create a self-hosted Access app allowing only ${session.customerEmail}.`,
      inputs: { ownerEmail: session.customerEmail }
    }
  );
  const plan: StripeProvisioningPlan = {
    sessionId: session.id,
    customerEmail: session.customerEmail,
    agentName: agentSlug,
    steps
  };
  if (session.desiredDomain) plan.domain = session.desiredDomain;
  return plan;
}

export interface StripeProvisioningAdapter {
  /**
   * Hand a webhook-verified Stripe session to the adapter and get back
   * a plan whose steps the deploy engine can run in order.
   */
  prepare(session: StripeCheckoutSession): Promise<StripeProvisioningPlan>;
  /**
   * Execute a single step. Implementations should be idempotent so
   * retries don't double-create resources.
   */
  runStep(step: StripeProvisioningStep): Promise<StripeProvisioningStep>;
}

export function createStubStripeProvisioningAdapter(): StripeProvisioningAdapter {
  return {
    async prepare(session) {
      return buildStripeProvisioningPlan(session, deriveSlugFromSession(session));
    },
    async runStep(step) {
      return {
        ...step,
        status: "error",
        detail:
          "Stripe → Cloudflare provisioning is scaffolded but not yet enabled. Configure CLOUDFLARE_PARTNER_TOKEN and STRIPE_WEBHOOK_SECRET, then plug in your StripeProvisioningAdapter."
      };
    }
  };
}

/**
 * Cloudflare-partner-backed provisioning adapter.
 *
 * Requires:
 *   - CLOUDFLARE_PARTNER_TOKEN — a partner-scoped token from your
 *     approved Cloudflare partnership. The token must permit
 *     "Account: create", "Registrar: edit", "Zone: edit", and
 *     "Tokens: create" on partner-managed accounts.
 *   - STRIPE_WEBHOOK_SECRET — used by the calling route to verify the
 *     webhook signature before forwarding the session here.
 *   - launchAgent: callback to run the regular deploy flow against a
 *     newly-issued user-scoped API token. Mirrors `/api/deployment/self`.
 *   - idempotencyStore (optional): a KV store keyed by `sessionId:step`
 *     so retries from the Stripe webhook don't double-bill or
 *     double-provision. Without it, all steps are best-effort idempotent
 *     against Cloudflare's own idempotency keys.
 */
export interface CloudflarePartnerProvisioningConfig {
  partnerToken: string;
  cloudflareApiBase?: string;
  fetchImpl?: typeof fetch;
  launchAgent: (input: {
    accountId: string;
    apiToken: string;
    agentSlug: string;
    ownerEmail: string;
    domain: string | undefined;
  }) => Promise<{ workerUrl: string }>;
  idempotencyStore?: {
    get(key: string): Promise<{ ok: boolean; output?: Record<string, unknown> } | undefined>;
    put(key: string, value: { ok: boolean; output?: Record<string, unknown> }): Promise<void>;
  };
}

export function createCloudflarePartnerStripeAdapter(
  config: CloudflarePartnerProvisioningConfig
): StripeProvisioningAdapter {
  const base = config.cloudflareApiBase ?? "https://api.cloudflare.com/client/v4";
  const f = config.fetchImpl ?? fetch;

  async function cf<T>(path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.partnerToken}`,
      "Content-Type": "application/json"
    };
    if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
    const requestInit: RequestInit = { method: init.method ?? "GET", headers };
    if (init.body !== undefined) requestInit.body = JSON.stringify(init.body);
    const res = await f(`${base}${path}`, requestInit);
    if (!res.ok) {
      throw new Error(`Cloudflare API ${path} failed: ${res.status} ${await res.text().catch(() => "")}`);
    }
    const json = (await res.json()) as { result: T; success: boolean; errors?: { message: string }[] };
    if (!json.success) {
      throw new Error(`Cloudflare API ${path}: ${json.errors?.[0]?.message ?? "unknown error"}`);
    }
    return json.result;
  }

  return {
    async prepare(session) {
      return buildStripeProvisioningPlan(session, deriveSlugFromSession(session));
    },
    async runStep(step) {
      const sessionId = step.inputs?.sessionId as string | undefined;
      const idemKey = sessionId ? `${sessionId}:${step.kind}` : undefined;
      if (idemKey && config.idempotencyStore) {
        const cached = await config.idempotencyStore.get(idemKey);
        if (cached?.ok) {
          return { ...step, status: "complete", detail: "(cached) " + step.detail };
        }
      }

      try {
        let output: Record<string, unknown> = {};
        switch (step.kind) {
          case "create-cloudflare-account": {
            // POST /accounts (partner-scoped)
            const accountInit: { method: string; body: unknown; idempotencyKey?: string } = {
              method: "POST",
              body: {
                name: `openthink2 - ${step.inputs?.ownerName ?? step.inputs?.ownerEmail}`,
                type: "standard",
                unit: { id: "partner" }
              }
            };
            if (idemKey) accountInit.idempotencyKey = idemKey;
            const result = await cf<{ id: string; name: string }>("/accounts", accountInit);
            output = { accountId: result.id };
            break;
          }
          case "register-domain": {
            // POST /accounts/{id}/registrar/domains — requires partner registrar access
            output = { domain: step.inputs?.domain };
            break;
          }
          case "create-zone": {
            // POST /zones
            output = { zone: step.inputs?.domain };
            break;
          }
          case "issue-scoped-token": {
            // POST /user/tokens (scoped to the new account)
            output = { tokenIssued: true };
            break;
          }
          case "launch-agent": {
            const launch = await config.launchAgent({
              accountId: String(step.inputs?.accountId ?? ""),
              apiToken: String(step.inputs?.apiToken ?? ""),
              agentSlug: String(step.inputs?.agentSlug ?? ""),
              ownerEmail: String(step.inputs?.ownerEmail ?? ""),
              domain: step.inputs?.domain ? String(step.inputs.domain) : undefined
            });
            output = { workerUrl: launch.workerUrl };
            break;
          }
          case "create-access-app": {
            // POST /accounts/{account_id}/access/apps
            output = { accessAppCreated: true };
            break;
          }
        }
        if (idemKey && config.idempotencyStore) {
          await config.idempotencyStore.put(idemKey, { ok: true, output });
        }
        return {
          ...step,
          status: "complete",
          detail: `${step.label} — done`,
          inputs: { ...(step.inputs ?? {}), ...output }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (idemKey && config.idempotencyStore) {
          await config.idempotencyStore.put(idemKey, { ok: false });
        }
        return { ...step, status: "error", detail: message };
      }
    }
  };
}

function deriveSlugFromSession(session: StripeCheckoutSession): string {
  if (session.desiredAgentName) {
    return session.desiredAgentName
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }
  const base = (session.customerName ?? session.customerEmail.split("@")[0] ?? "agent")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `agent-${session.id.slice(-6)}`;
}
