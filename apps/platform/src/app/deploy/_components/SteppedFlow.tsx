"use client";

import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  Rocket,
  Shuffle,
  Sparkles
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from "react";
import {
  buildOpenThinkTokenUrl
} from "@/lib/cloudflare-token-url";
import type { DeploymentRequest } from "@/lib/deployment-engine";
import { randomFunAgentName } from "@/lib/fun-agent-name";

export type StepIndex = 0 | 1 | 2 | 3;

interface SteppedFlowProps {
  isDeploying: boolean;
  step: StepIndex;
  onStepChange: (step: StepIndex) => void;
  onLaunch: (payload: Partial<DeploymentRequest>) => void;
}

interface TokenInspection {
  userEmail?: string;
  defaultAccessEmail?: string;
  defaultAccountId?: string;
  accounts: Array<{ id: string; name?: string }>;
  zones: Array<{ id: string; name: string; status?: string }>;
}

interface PermissionIssue {
  error: string;
  cloudflare?: {
    status?: number;
    operation?: string;
    requiredPermission?: string;
  };
}

const modelChoices = [
  {
    id: "@cf/moonshotai/kimi-k2.6",
    provider: "workers-ai" as const,
    label: "Kimi K2.6",
    blurb: "Default. Cloudflare-hosted."
  },
  {
    id: "anthropic/claude-opus-4.7",
    provider: "anthropic" as const,
    label: "Claude Opus 4.7",
    blurb: "BYOK key needed."
  },
  {
    id: "anthropic/claude-sonnet-4.7",
    provider: "anthropic" as const,
    label: "Claude Sonnet 4.7",
    blurb: "BYOK key needed."
  },
  {
    id: "openai/gpt-5.5",
    provider: "openai" as const,
    label: "ChatGPT 5.5",
    blurb: "BYOK key needed."
  }
] as const;

const approvalChoices = [
  { id: "auto" as const, label: "Auto", hint: "Run tools without asking." },
  {
    id: "review" as const,
    label: "Review",
    hint: "Confirm risky actions."
  },
  { id: "manual" as const, label: "Manual", hint: "Approve every tool call." }
];

function sanitizeDomainLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function SteppedFlow({
  isDeploying,
  step,
  onStepChange,
  onLaunch
}: SteppedFlowProps) {
  // Step 1 — agent
  const [agentName, setAgentName] = useState(() => randomFunAgentName());
  const [cfApiToken, setCfApiToken] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [inspection, setInspection] = useState<TokenInspection | null>(null);
  const [permissionIssue, setPermissionIssue] = useState<PermissionIssue | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Step 2 — lock down
  const [accessAllowedEmail, setAccessAllowedEmail] = useState("");
  const [accessAdditionalEmails, setAccessAdditionalEmails] = useState("");
  const [showTeammates, setShowTeammates] = useState(false);
  const [customDomainEnabled, setCustomDomainEnabled] = useState(false);
  const [customZoneId, setCustomZoneId] = useState("");
  const [customHostPrefix, setCustomHostPrefix] = useState("");
  const [customHostPrefixDirty, setCustomHostPrefixDirty] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [spendLimitUsd, setSpendLimitUsd] = useState(100);
  const [defaultModel, setDefaultModel] = useState<string>(
    "@cf/moonshotai/kimi-k2.6"
  );
  const [approvalMode, setApprovalMode] = useState<"auto" | "review" | "manual">(
    "review"
  );

  // Refs for autofocus
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const launchButtonRef = useRef<HTMLButtonElement>(null);

  const tokenUrl = useMemo(
    () =>
      buildOpenThinkTokenUrl({
        tokenName: `Open Think - ${agentName}`
      }),
    [agentName]
  );

  const suggestedHostPrefix = sanitizeDomainLabel(agentName);
  const effectiveHostPrefix = customHostPrefixDirty
    ? customHostPrefix
    : suggestedHostPrefix;
  const selectedZone = inspection?.zones.find((zone) => zone.id === customZoneId);
  const customHostname =
    effectiveHostPrefix && selectedZone?.name
      ? `${effectiveHostPrefix}.${selectedZone.name}`
      : "";

  // Auto-focus token field when step 1 opens
  useEffect(() => {
    if (step === 0) {
      tokenInputRef.current?.focus({ preventScroll: true });
    }
    if (step === 2) {
      launchButtonRef.current?.focus({ preventScroll: true });
    }
  }, [step]);

  const shuffleName = useCallback(() => {
    const next = randomFunAgentName();
    setAgentName(next);
    if (!customHostPrefixDirty) {
      setCustomHostPrefix(sanitizeDomainLabel(next));
    }
  }, [customHostPrefixDirty]);

  const verifyToken = useCallback(async () => {
    if (!cfApiToken.trim()) return;
    setVerifyError(null);
    setPermissionIssue(null);
    setInspection(null);
    setIsVerifying(true);
    try {
      const response = await fetch("/api/deployment/verify-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cfApiToken: cfApiToken.trim() })
      });
      const body = (await response.json().catch(() => null)) as
        | {
            inspection?: TokenInspection;
            permissionIssue?: PermissionIssue;
            error?: string;
          }
        | null;
      if (!response.ok || !body?.inspection) {
        throw new Error(body?.error ?? "Token verification failed.");
      }
      setInspection(body.inspection);
      setAccessAllowedEmail(
        body.inspection.defaultAccessEmail ?? body.inspection.userEmail ?? ""
      );
      setCustomZoneId(body.inspection.zones[0]?.id ?? "");
      setPermissionIssue(body.permissionIssue ?? null);
      if (!customHostPrefixDirty) {
        setCustomHostPrefix(sanitizeDomainLabel(agentName));
      }
      // Auto-advance once verified
      onStepChange(1);
    } catch (error) {
      setVerifyError(
        error instanceof Error ? error.message : "Token verification failed."
      );
    } finally {
      setIsVerifying(false);
    }
  }, [agentName, cfApiToken, customHostPrefixDirty, onStepChange]);

  const cloudflareAccountId = inspection?.defaultAccountId ?? "";

  const summaryEmails = useMemo(() => {
    const extras = accessAdditionalEmails
      .split(/[,\n]/)
      .map((email) => email.trim())
      .filter(Boolean);
    return [accessAllowedEmail, ...extras].filter(Boolean);
  }, [accessAllowedEmail, accessAdditionalEmails]);

  const handleLaunch = useCallback(() => {
    const additionalEmails = accessAdditionalEmails
      .split(/[,\n]/)
      .map((email) => email.trim())
      .filter(Boolean);

    const selectedModel = modelChoices.find((m) => m.id === defaultModel);

    const payload: Partial<DeploymentRequest> = {
      agentName,
      cloudflareAccountId,
      accessAllowedEmail,
      accessAdditionalEmails: additionalEmails,
      cfApiToken,
      spendLimitUsd,
      acceptedTerms: true,
      defaultModel,
      modelProvider: selectedModel?.provider ?? "workers-ai",
      thinkingLevel: "medium",
      providerKeys: {},
      personalAgent: {
        enabled: true,
        presetId: "openthink-gbrain-gstack",
        advancedMode: false,
        toolApprovalPolicy:
          approvalMode === "auto"
            ? "auto"
            : approvalMode === "manual"
              ? "ask-every-time"
              : "allow-all",
        features: {}
      }
    };
    if (customDomainEnabled && customHostname && customZoneId) {
      payload.customDomain = {
        enabled: true,
        hostname: customHostname,
        zoneId: customZoneId
      };
    }
    onLaunch(payload);
  }, [
    accessAdditionalEmails,
    accessAllowedEmail,
    agentName,
    approvalMode,
    cloudflareAccountId,
    cfApiToken,
    customDomainEnabled,
    customHostname,
    customZoneId,
    defaultModel,
    onLaunch,
    spendLimitUsd
  ]);

  const handleTokenKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && cfApiToken && !isVerifying) {
      event.preventDefault();
      void verifyToken();
    }
  };

  return (
    <div className="ot-stepper">
      <StepIndicator step={step} onStepChange={onStepChange} />

      {step === 0 ? (
        <section className="ot-step" aria-labelledby="ot-step-1-title">
          <header className="ot-step__head">
            <h2 id="ot-step-1-title">Your agent</h2>
            <p>Give it a name and connect your Cloudflare account.</p>
          </header>

          <div className="ot-field">
            <label htmlFor="ot-agent-name">Agent name</label>
            <div className="ot-input-group">
              <input
                id="ot-agent-name"
                value={agentName}
                onChange={(event) => {
                  setAgentName(event.target.value);
                  if (!customHostPrefixDirty) {
                    setCustomHostPrefix(sanitizeDomainLabel(event.target.value));
                  }
                }}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="ot-button ot-button--icon"
                onClick={shuffleName}
                aria-label="Shuffle a new name"
                title="Shuffle"
              >
                <Shuffle size={18} aria-hidden="true" />
              </button>
            </div>
            <small className="ot-hint">
              Two-word handles read nicely as subdomains. Change anytime.
            </small>
          </div>

          <div className="ot-token-card">
            <p className="ot-token-card__why">
              We need a scoped Cloudflare API token to create the worker, D1,
              R2, and Access app inside <strong>your</strong> account. It is
              never stored on our side.
            </p>
            <a
              className="ot-button ot-button--primary ot-button--block"
              href={tokenUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Cloudflare dashboard
              <ExternalLink size={16} aria-hidden="true" />
            </a>
            <small className="ot-hint ot-hint--center">
              Cloudflare opens with the correct permissions preselected.
            </small>
          </div>

          <div className="ot-field">
            <label htmlFor="ot-cf-token">Paste the token</label>
            <input
              ref={tokenInputRef}
              id="ot-cf-token"
              type="password"
              value={cfApiToken}
              onChange={(event) => setCfApiToken(event.target.value)}
              onKeyDown={handleTokenKeyDown}
              autoComplete="off"
              placeholder="cf_pat_…"
              spellCheck={false}
            />
          </div>

          {verifyError ? (
            <p className="ot-alert ot-alert--error">{verifyError}</p>
          ) : null}
          {permissionIssue ? (
            <p className="ot-alert ot-alert--warn">
              {permissionIssue.error}
              {permissionIssue.cloudflare?.requiredPermission
                ? ` Add ${permissionIssue.cloudflare.requiredPermission} to the token before launching.`
                : null}
            </p>
          ) : null}

          <button
            type="button"
            className="ot-button ot-button--primary ot-button--block ot-button--giant"
            disabled={!cfApiToken.trim() || isVerifying}
            onClick={verifyToken}
          >
            {isVerifying ? (
              <>
                <Loader2 size={18} aria-hidden="true" className="ot-spin" />
                Verifying token
              </>
            ) : (
              <>
                Verify token
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="ot-step" aria-labelledby="ot-step-2-title">
          <header className="ot-step__head">
            <h2 id="ot-step-2-title">Lock it down</h2>
            <p>Who gets in, where it lives, and optional tuning.</p>
          </header>

          {inspection ? (
            <div className="ot-verified">
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>
                Verified
                {inspection.accounts[0]?.name
                  ? ` — ${inspection.accounts[0].name}`
                  : ""}
              </span>
            </div>
          ) : null}

          <div className="ot-field">
            <label htmlFor="ot-access-email">Access email</label>
            <input
              id="ot-access-email"
              type="email"
              value={accessAllowedEmail}
              onChange={(event) => setAccessAllowedEmail(event.target.value)}
              autoComplete="email"
            />
            <small className="ot-hint">
              Only this address can sign in to your agent.
            </small>
          </div>

          <details
            className="ot-disclose"
            open={showTeammates}
            onToggle={(event) =>
              setShowTeammates((event.target as HTMLDetailsElement).open)
            }
          >
            <summary>Add teammates</summary>
            <div className="ot-field">
              <label htmlFor="ot-extra-emails">Additional emails</label>
              <textarea
                id="ot-extra-emails"
                value={accessAdditionalEmails}
                onChange={(event) =>
                  setAccessAdditionalEmails(event.target.value)
                }
                placeholder="teammate@example.com, ops@example.com"
                rows={3}
              />
              <small className="ot-hint">
                Comma- or newline-separated. Each one also gets Access sign-in.
              </small>
            </div>
          </details>

          <div className="ot-toggle-row">
            <div className="ot-toggle-row__main">
              <strong>Custom domain</strong>
              <small>
                Skip for now and use the default <code>workers.dev</code>
                subdomain.
              </small>
            </div>
            <label className="ot-switch">
              <input
                type="checkbox"
                checked={customDomainEnabled}
                onChange={(event) => {
                  setCustomDomainEnabled(event.target.checked);
                  if (event.target.checked && !customHostPrefixDirty) {
                    setCustomHostPrefix(sanitizeDomainLabel(agentName));
                  }
                }}
              />
              <span aria-hidden="true" />
            </label>
          </div>

          {customDomainEnabled ? (
            <div className="ot-domain-grid">
              <div className="ot-field">
                <label htmlFor="ot-zone">DNS zone</label>
                <select
                  id="ot-zone"
                  value={customZoneId}
                  onChange={(event) => setCustomZoneId(event.target.value)}
                >
                  <option value="">Choose zone</option>
                  {inspection?.zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ot-field">
                <label htmlFor="ot-subdomain">Subdomain</label>
                <input
                  id="ot-subdomain"
                  value={effectiveHostPrefix}
                  onChange={(event) => {
                    setCustomHostPrefixDirty(true);
                    setCustomHostPrefix(sanitizeDomainLabel(event.target.value));
                  }}
                  placeholder={suggestedHostPrefix || "agent"}
                />
                <small className="ot-hint">
                  {customHostname || "Pick a zone above to see the full host."}
                </small>
              </div>
            </div>
          ) : null}

          <details
            className="ot-disclose ot-disclose--quiet"
            open={showAdvanced}
            onToggle={(event) =>
              setShowAdvanced((event.target as HTMLDetailsElement).open)
            }
          >
            <summary>Advanced</summary>
            <div className="ot-field">
              <label htmlFor="ot-spend-limit">Monthly spend cap (USD)</label>
              <input
                id="ot-spend-limit"
                type="number"
                min={5}
                max={100}
                value={spendLimitUsd}
                onChange={(event) =>
                  setSpendLimitUsd(Number(event.target.value) || 0)
                }
              />
            </div>
            <div className="ot-field">
              <label htmlFor="ot-default-model">Default model</label>
              <select
                id="ot-default-model"
                value={defaultModel}
                onChange={(event) => setDefaultModel(event.target.value)}
              >
                {modelChoices.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.label} — {choice.blurb}
                  </option>
                ))}
              </select>
            </div>
            <div className="ot-field">
              <span className="ot-field__label">Tool approval</span>
              <div className="ot-segmented" role="radiogroup" aria-label="Tool approval mode">
                {approvalChoices.map((choice) => (
                  <button
                    type="button"
                    key={choice.id}
                    role="radio"
                    aria-checked={approvalMode === choice.id}
                    className="ot-segmented__btn"
                    data-active={approvalMode === choice.id}
                    onClick={() => setApprovalMode(choice.id)}
                  >
                    <strong>{choice.label}</strong>
                    <small>{choice.hint}</small>
                  </button>
                ))}
              </div>
            </div>
          </details>

          <button
            type="button"
            className="ot-button ot-button--primary ot-button--block ot-button--giant"
            onClick={() => onStepChange(2)}
            disabled={!accessAllowedEmail.trim()}
          >
            Continue
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="ot-step" aria-labelledby="ot-step-3-title">
          <header className="ot-step__head">
            <h2 id="ot-step-3-title">Launch</h2>
            <p>Quick check, then ship it.</p>
          </header>

          <dl className="ot-summary">
            <div>
              <dt>Agent name</dt>
              <dd>{agentName}</dd>
            </div>
            {inspection?.accounts[0] ? (
              <div>
                <dt>Cloudflare account</dt>
                <dd>
                  {inspection.accounts[0].name ??
                    inspection.defaultAccountId ??
                    "—"}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Access {summaryEmails.length === 1 ? "email" : "emails"}</dt>
              <dd>
                {summaryEmails.length
                  ? summaryEmails.join(", ")
                  : "—"}
              </dd>
            </div>
            {customDomainEnabled && customHostname ? (
              <div>
                <dt>Custom domain</dt>
                <dd>{customHostname}</dd>
              </div>
            ) : null}
          </dl>

          <button
            ref={launchButtonRef}
            type="button"
            className="ot-button ot-button--primary ot-button--block ot-button--giant ot-button--launch"
            onClick={handleLaunch}
            disabled={isDeploying}
          >
            {isDeploying ? (
              <>
                <Loader2 size={18} aria-hidden="true" className="ot-spin" />
                Launching…
              </>
            ) : (
              <>
                <Rocket size={18} aria-hidden="true" />
                Launch agent
              </>
            )}
          </button>

          <p className="ot-fineprint">
            <Lock size={12} aria-hidden="true" />
            By launching, the agent worker is created in your Cloudflare
            account. We never see your token.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function StepIndicator({
  step,
  onStepChange
}: {
  step: StepIndex;
  onStepChange: (step: StepIndex) => void;
}) {
  const labels: Array<{ label: string; index: StepIndex }> = [
    { label: "Your agent", index: 0 },
    { label: "Lock it down", index: 1 },
    { label: "Launch", index: 2 },
    { label: "Live", index: 3 }
  ];

  return (
    <ol
      className="ot-stepdots"
      aria-label="Setup progress"
      role="list"
      data-step={step}
    >
      {labels.map((entry) => {
        const reached = step >= entry.index;
        const current = step === entry.index;
        const canJump = entry.index < step;
        return (
          <li key={entry.index}>
            <button
              type="button"
              className="ot-stepdot"
              data-state={
                current ? "current" : reached ? "done" : "pending"
              }
              aria-current={current ? "step" : undefined}
              disabled={!canJump && !current}
              onClick={() => canJump && onStepChange(entry.index)}
            >
              <span className="ot-stepdot__dot" aria-hidden="true">
                {reached && !current ? (
                  <Sparkles size={11} />
                ) : current ? (
                  <span className="ot-stepdot__pulse" />
                ) : null}
              </span>
              <span className="ot-stepdot__label">{entry.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
