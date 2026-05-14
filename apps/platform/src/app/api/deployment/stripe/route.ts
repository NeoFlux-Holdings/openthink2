import {
  createStubStripeProvisioningAdapter,
  runPlan,
  type StripeCheckoutSession,
  type StripeProvisioningAdapter
} from "../../../../lib/stripe-provisioning";
import { getPlatformRuntimeEnv, readEnvString } from "../../../../lib/platform-env";

/**
 * Optional injection seam for tests. Production code reads
 * `STRIPE_WEBHOOK_SECRET` and uses the stub provisioning adapter
 * (configured separately) — tests override this to assert behaviour
 * without needing a real Stripe key or a partner-token network.
 */
export interface StripeWebhookHandlerOptions {
  env?: Record<string, unknown>;
  adapter?: StripeProvisioningAdapter;
  now?: () => number;
  toleranceSeconds?: number;
  logger?: {
    warn?: (message: string) => void;
    error?: (message: string, error?: unknown) => void;
  };
}

export async function POST(request: Request): Promise<Response> {
  return handleStripeWebhook(request);
}

export async function handleStripeWebhook(
  request: Request,
  options: StripeWebhookHandlerOptions = {}
): Promise<Response> {
  const env = options.env ?? getPlatformRuntimeEnv();
  const secret = readEnvString(env, "STRIPE_WEBHOOK_SECRET");
  const signature = request.headers.get("stripe-signature");
  const logger = options.logger ?? { warn: console.warn, error: console.error };
  const body = await request.text();

  if (secret) {
    if (!signature) {
      return Response.json({ error: "Missing Stripe-Signature header." }, { status: 401 });
    }
    const verifyInput: VerifyInput = {
      body,
      signature,
      secret,
      toleranceSeconds: options.toleranceSeconds ?? 300
    };
    if (options.now) verifyInput.now = options.now;
    const verified = await verifyStripeSignature(verifyInput);
    if (!verified) {
      return Response.json({ error: "Invalid Stripe signature." }, { status: 401 });
    }
  } else {
    logger.warn?.(
      "[stripe-webhook] STRIPE_WEBHOOK_SECRET is empty — accepting webhook unverified. Set the env var before production."
    );
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(body) as StripeEvent;
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return Response.json({ ok: true, ignored: true, type: event.type });
  }

  const data = event.data?.object;
  if (!data || typeof data !== "object") {
    return Response.json({ error: "Missing checkout session data." }, { status: 400 });
  }

  const session = toStripeCheckoutSession(data);
  if (!session) {
    return Response.json({ error: "Checkout session missing required fields." }, { status: 400 });
  }

  const adapter = options.adapter ?? createStubStripeProvisioningAdapter();

  try {
    const plan = await adapter.prepare(session);
    const result = await runPlan(plan, { adapter });
    if (!result.ok) {
      return Response.json(
        {
          ok: false,
          planId: plan.sessionId,
          error: result.error
        },
        { status: 500 }
      );
    }
    return Response.json({ ok: true, planId: plan.sessionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error?.("[stripe-webhook] provisioning failed", error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

interface StripeEvent {
  id?: string;
  type?: string;
  data?: {
    object?: unknown;
  };
}

interface RawStripeSession {
  id?: unknown;
  customer_email?: unknown;
  customer_details?: { email?: unknown; name?: unknown } | null;
  amount_total?: unknown;
  currency?: unknown;
  metadata?: Record<string, unknown> | null;
}

function toStripeCheckoutSession(raw: unknown): StripeCheckoutSession | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as RawStripeSession;
  const id = typeof obj.id === "string" ? obj.id : undefined;
  const email =
    typeof obj.customer_email === "string"
      ? obj.customer_email
      : typeof obj.customer_details?.email === "string"
        ? obj.customer_details.email
        : undefined;
  if (!id || !email) return null;
  const metadataRaw = obj.metadata && typeof obj.metadata === "object" ? obj.metadata : {};
  const metadata: Record<string, string> = {};
  for (const [k, v] of Object.entries(metadataRaw)) {
    if (typeof v === "string") metadata[k] = v;
  }
  const desiredDomain = typeof metadata.desired_domain === "string" ? metadata.desired_domain : undefined;
  const desiredAgentName =
    typeof metadata.desired_agent_name === "string" ? metadata.desired_agent_name : undefined;

  const session: StripeCheckoutSession = {
    id,
    customerEmail: email,
    amountTotal: typeof obj.amount_total === "number" ? obj.amount_total : 0,
    currency: typeof obj.currency === "string" ? obj.currency : "usd",
    metadata
  };
  const name =
    typeof obj.customer_details?.name === "string" ? obj.customer_details.name : undefined;
  if (name) session.customerName = name;
  if (desiredDomain) session.desiredDomain = desiredDomain;
  if (desiredAgentName) session.desiredAgentName = desiredAgentName;
  return session;
}

interface VerifyInput {
  body: string;
  signature: string;
  secret: string;
  toleranceSeconds: number;
  now?: () => number;
}

/**
 * Verify a Stripe webhook signature without importing the `stripe`
 * npm package. The header has the shape
 * `t=<unix_seconds>,v1=<hex_hmac>(,v1=<hex_hmac>)*` and the signed
 * payload is `<t>.<raw_body>` HMAC-SHA256 with `secret` as the key.
 *
 * Returns `true` only if the timestamp is within `toleranceSeconds`
 * of the current time and at least one `v1` signature matches.
 */
async function verifyStripeSignature(input: VerifyInput): Promise<boolean> {
  const parts = input.signature
    .split(",")
    .map((part) => part.trim().split("="))
    .filter((pair): pair is [string, string] => pair.length === 2 && pair[0] !== undefined && pair[1] !== undefined);
  const timestamp = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!timestamp || sigs.length === 0) return false;

  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) return false;
  const nowMs = input.now ? input.now() : Date.now();
  const drift = Math.abs(nowMs / 1000 - tsNum);
  if (drift > input.toleranceSeconds) return false;

  const signed = `${timestamp}.${input.body}`;
  const expected = await hmacSha256Hex(input.secret, signed);
  return sigs.some((candidate) => timingSafeEqualHex(candidate, expected));
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toHex(new Uint8Array(signature));
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i] ?? 0;
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
