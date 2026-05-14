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
 * The actual partner-account provisioning endpoint requires an approved
 * Cloudflare partnership + a Stripe Connect account; both are configured
 * through env vars. The contract is exported so the
 * `/api/deployment/stripe` route can plug in the real implementation
 * incrementally without changing the deploy flow type.
 */

import { openThinkTokenPermissions } from "./cloudflare-token-url";

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
  const sharedInputs: Record<string, unknown> = {
    sessionId: session.id,
    ownerEmail: session.customerEmail,
    agentSlug
  };
  if (session.customerName) sharedInputs.ownerName = session.customerName;
  if (session.desiredDomain) sharedInputs.domain = session.desiredDomain;

  const steps: StripeProvisioningStep[] = [
    {
      kind: "create-cloudflare-account",
      label: "Create Cloudflare account",
      status: "pending",
      detail: `Create a Cloudflare account owned by ${session.customerEmail} via the Partner API.`,
      inputs: { ...sharedInputs }
    }
  ];
  if (session.desiredDomain) {
    steps.push(
      {
        kind: "register-domain",
        label: `Register ${session.desiredDomain}`,
        status: "pending",
        detail: "Use the Cloudflare registrar API to register the requested domain.",
        inputs: { ...sharedInputs }
      },
      {
        kind: "create-zone",
        label: `Add ${session.desiredDomain} as a zone`,
        status: "pending",
        detail: "Attach the new domain as a Cloudflare zone in the freshly-created account.",
        inputs: { ...sharedInputs }
      }
    );
  }
  steps.push(
    {
      kind: "issue-scoped-token",
      label: "Issue scoped API token",
      status: "pending",
      detail:
        "Create a Cloudflare API token in the new account with the openthink2 permission preset and store its fingerprint.",
      inputs: { ...sharedInputs }
    },
    {
      kind: "launch-agent",
      label: `Launch ${agentSlug}`,
      status: "pending",
      detail: "Run the same deploy flow used in self-deploy — Workers / D1 / R2 / Vectorize / Queue.",
      inputs: { ...sharedInputs }
    },
    {
      kind: "create-access-app",
      label: "Lock down with Cloudflare Access",
      status: "pending",
      detail: `Create a self-hosted Access app allowing only ${session.customerEmail}.`,
      inputs: { ...sharedInputs }
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
            // POST /accounts/{id}/registrar/domains/{domain}/register
            const accountId = String(step.inputs?.accountId ?? "");
            const domain = String(step.inputs?.domain ?? "");
            if (!accountId) throw new Error("register-domain requires a prior accountId");
            if (!domain) throw new Error("register-domain requires a domain input");
            const registerInit: { method: string; body: unknown; idempotencyKey?: string } = {
              method: "POST",
              body: { years: 1, auto_renew: true, privacy: true }
            };
            if (idemKey) registerInit.idempotencyKey = idemKey;
            const result = await cf<{ id?: string; name?: string }>(
              `/accounts/${accountId}/registrar/domains/${encodeURIComponent(domain)}/register`,
              registerInit
            );
            output = {
              domain: result.name ?? domain,
              ...(result.id ? { domainId: result.id } : {})
            };
            break;
          }
          case "create-zone": {
            // POST /zones
            const accountId = String(step.inputs?.accountId ?? "");
            const domain = String(step.inputs?.domain ?? "");
            if (!accountId) throw new Error("create-zone requires a prior accountId");
            if (!domain) throw new Error("create-zone requires a domain input");
            const zoneInit: { method: string; body: unknown; idempotencyKey?: string } = {
              method: "POST",
              body: { name: domain, account: { id: accountId }, type: "full" }
            };
            if (idemKey) zoneInit.idempotencyKey = idemKey;
            const result = await cf<{ id: string; name: string; name_servers?: string[] }>(
              "/zones",
              zoneInit
            );
            output = {
              zoneId: result.id,
              zone: result.name,
              ...(result.name_servers ? { nameservers: result.name_servers } : {})
            };
            break;
          }
          case "issue-scoped-token": {
            // POST /user/tokens scoped to the new account, using the
            // openthink2 permission preset.
            const accountId = String(step.inputs?.accountId ?? "");
            if (!accountId) throw new Error("issue-scoped-token requires a prior accountId");
            const resources: Record<string, string> = {
              [`com.cloudflare.api.account.${accountId}`]: "*"
            };
            const policies = openThinkTokenPermissions.map((permission) => ({
              effect: "allow" as const,
              resources,
              permission_groups: [{ name: permission.label }]
            }));
            const tokenInit: { method: string; body: unknown; idempotencyKey?: string } = {
              method: "POST",
              body: {
                name: `openthink2 - ${step.inputs?.agentSlug ?? accountId}`,
                policies
              }
            };
            if (idemKey) tokenInit.idempotencyKey = idemKey;
            const result = await cf<{ id: string; value: string }>("/user/tokens", tokenInit);
            output = { apiToken: result.value, tokenId: result.id };
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
            const accountId = String(step.inputs?.accountId ?? "");
            const ownerEmail = String(step.inputs?.ownerEmail ?? "");
            const agentSlug = String(step.inputs?.agentSlug ?? "");
            const domain = String(step.inputs?.domain ?? "");
            if (!accountId) throw new Error("create-access-app requires a prior accountId");
            if (!ownerEmail) throw new Error("create-access-app requires an ownerEmail");
            if (!agentSlug) throw new Error("create-access-app requires an agentSlug");
            if (!domain) throw new Error("create-access-app requires a domain");
            const accessInit: { method: string; body: unknown; idempotencyKey?: string } = {
              method: "POST",
              body: {
                name: `openthink2 - ${agentSlug}`,
                domain: `${agentSlug}.${domain}`,
                session_duration: "24h",
                auto_redirect_to_identity: true,
                policies: [
                  {
                    name: "Owner",
                    decision: "allow",
                    include: [{ email: { email: ownerEmail } }]
                  }
                ]
              }
            };
            if (idemKey) accessInit.idempotencyKey = idemKey;
            const result = await cf<{ id?: string; domain?: string; policies?: { id?: string }[] }>(
              `/accounts/${accountId}/access/apps`,
              accessInit
            );
            output = {
              accessAppCreated: true,
              ...(result.id ? { accessAppId: result.id } : {}),
              ...(result.domain ? { accessDomain: result.domain } : {}),
              ...(result.policies?.[0]?.id ? { accessPolicyId: result.policies[0].id } : {})
            };
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

/**
 * Run a prepared provisioning plan in order, threading state between
 * steps. Each step's resolved `inputs` (which include any outputs the
 * adapter wrote back) become part of the shared bag fed to the next
 * step. Stops on the first step that ends in `status === "error"` and
 * returns the partially-executed plan so the caller can surface
 * progress to the user / persist it for retry.
 */
export async function runPlan(
  plan: StripeProvisioningPlan,
  ctx: { adapter: StripeProvisioningAdapter }
): Promise<{
  plan: StripeProvisioningPlan;
  ok: boolean;
  error?: { step: StripeProvisioningStepKind; detail: string };
}> {
  let shared: Record<string, unknown> = {
    sessionId: plan.sessionId,
    ownerEmail: plan.customerEmail,
    agentSlug: plan.agentName
  };
  if (plan.domain) shared.domain = plan.domain;

  const executed: StripeProvisioningStep[] = [];
  for (const step of plan.steps) {
    const next: StripeProvisioningStep = {
      ...step,
      status: "active",
      inputs: { ...shared, ...(step.inputs ?? {}) }
    };
    const result = await ctx.adapter.runStep(next);
    executed.push(result);
    if (result.status === "error") {
      const updatedPlan: StripeProvisioningPlan = {
        ...plan,
        steps: [...executed, ...plan.steps.slice(executed.length)]
      };
      return {
        plan: updatedPlan,
        ok: false,
        error: { step: result.kind, detail: result.detail }
      };
    }
    shared = { ...shared, ...(result.inputs ?? {}) };
  }
  return {
    plan: { ...plan, steps: executed },
    ok: true
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
