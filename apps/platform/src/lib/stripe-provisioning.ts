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
  return {
    sessionId: session.id,
    customerEmail: session.customerEmail,
    agentName: agentSlug,
    domain: session.desiredDomain,
    steps
  };
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
