"use client";

import {
  Brain,
  CheckCircle2,
  GraduationCap,
  ListChecks,
  PencilLine,
  Sparkles,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Streamdown } from "streamdown";

/**
 * Learning page — surfaces the agent's accumulated skills, memories,
 * and pending suggestions emitted by the self-evolve loop
 * (starters/personal-agent/src/evolve/loop.ts).
 *
 * When the agent URL is known (via `NEXT_PUBLIC_AGENT_BASE_URL` or a
 * `?agent=<url>` query param) the page fetches live suggestions from
 * `/learning/pending` and POSTs accept / edit / reject decisions to
 * `/learning/decisions`. When no agent URL is configured the page
 * falls back to fixture data so the platform still has a useful demo
 * surface; the UI flags this with a small "demo data" badge.
 */

type SuggestionKind = "skill" | "memory" | "rubric" | "prompt";

interface PendingSuggestion {
  id: string;
  kind: SuggestionKind;
  agentName: string;
  threadTitle: string;
  confidence: number;
  summary: string;
  detail: string;
  createdAt: string;
}

/** Shape returned by the agent's `/learning/pending` endpoint. Mirrors
 * `EvolveSuggestion` from `starters/personal-agent/src/evolve/types.ts`
 * but kept structural so we don't pull a workspace import into the
 * Next.js client bundle. */
interface AgentSuggestion {
  id: string;
  kind: "skill" | "rubric" | "prompt";
  status: "pending" | "applied" | "rejected";
  confidence: number;
  name?: string;
  summary?: string;
  systemPromptFragment?: string;
  toolBindings?: string[];
  criteria?: { name: string; weight: number; description: string }[];
  scope?: "orchestrator" | "child" | "workspace";
  before?: string;
  after?: string;
  rationale?: string;
  evidenceTraceIds?: string[];
  agentName?: string;
  threadTitle?: string;
  createdAt?: string;
}

const fixtureAgents = ["amber-otter", "loyal-fox", "no-agent"] as const;

const fixtureSuggestions: PendingSuggestion[] = [
  {
    id: "sug-1",
    kind: "skill",
    agentName: "amber-otter",
    threadTitle: "Refactor monorepo CI",
    confidence: 0.84,
    summary: "Promote 'matrix CI per workspace' as a reusable skill",
    detail:
      "The agent solved this twice with the same pattern: split matrix per workspace, share caches, run on each PR. Worth saving so future tasks don't relitigate it.",
    createdAt: "today"
  },
  {
    id: "sug-2",
    kind: "memory",
    agentName: "amber-otter",
    threadTitle: "Q3 retro draft",
    confidence: 0.92,
    summary: "User prefers concise bullet recaps over narrative summaries",
    detail: "Three thumbs-up on bullet-form summaries; one thumbs-down on a narrative version of the same content.",
    createdAt: "yesterday"
  },
  {
    id: "sug-3",
    kind: "rubric",
    agentName: "loyal-fox",
    threadTitle: "Frontend a11y audit",
    confidence: 0.71,
    summary: "Add accessibility rubric: keyboard-only walkthrough + axe pass",
    detail: "Two failed runs missed obvious a11y regressions. A rubric forcing a keyboard pass and axe report before claiming done would have caught them.",
    createdAt: "2d"
  },
  {
    id: "sug-4",
    kind: "prompt",
    agentName: "loyal-fox",
    threadTitle: "Migration runbook",
    confidence: 0.65,
    summary: "Drop 'plan before acting' boilerplate — already implied by smart-auto",
    detail: "Reviewing 12 traces, the boilerplate is never the reason actions failed; trimming saves ~120 input tokens per turn.",
    createdAt: "3d"
  }
];

function KindBadge({ kind }: { kind: SuggestionKind }) {
  const map = {
    skill: { label: "Skill", color: "rgba(58, 91, 215, 0.12)", ink: "var(--accent)" },
    memory: { label: "Memory", color: "rgba(23, 111, 73, 0.12)", ink: "var(--green)" },
    rubric: { label: "Rubric", color: "rgba(241, 113, 5, 0.12)", ink: "#9d4b00" },
    prompt: { label: "Prompt edit", color: "rgba(135, 64, 200, 0.12)", ink: "#5b3490" }
  } as const;
  const meta = map[kind];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 999,
        background: meta.color,
        color: meta.ink,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.03em",
        textTransform: "uppercase"
      }}
    >
      {meta.label}
    </span>
  );
}

function DemoBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        background: "rgba(241, 113, 5, 0.12)",
        color: "#9d4b00",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
        marginLeft: 8
      }}
      title="No agent URL is configured; rendering fixture data."
    >
      Demo data
    </span>
  );
}

/** Resolve the agent base URL from `?agent=<url>` (preferred for
 * testing) or `NEXT_PUBLIC_AGENT_BASE_URL`. Returns `null` when
 * neither is configured. */
function resolveAgentBaseUrl(): string | null {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("agent");
    if (fromQuery) {
      try {
        return new URL(fromQuery).toString().replace(/\/$/, "");
      } catch {
        // Fall through to env.
      }
    }
  }
  const fromEnv = process.env.NEXT_PUBLIC_AGENT_BASE_URL;
  if (fromEnv) {
    try {
      return new URL(fromEnv).toString().replace(/\/$/, "");
    } catch {
      return null;
    }
  }
  return null;
}

/** Project the agent's structural `AgentSuggestion` into the page
 * view-model. The agent never emits `kind: "memory"` (the evolve loop
 * only produces skill/rubric/prompt), so the view-model's `memory`
 * variant is fixture-only. */
function toPendingSuggestion(s: AgentSuggestion): PendingSuggestion {
  const detail = (() => {
    if (s.kind === "skill") return s.systemPromptFragment ?? s.summary ?? "";
    if (s.kind === "rubric") {
      return (s.criteria ?? []).map((c) => `${c.name}: ${c.description}`).join(" · ") || s.summary || "";
    }
    if (s.kind === "prompt") return s.rationale ?? s.summary ?? "";
    return s.summary ?? "";
  })();
  const summary = (() => {
    if (s.summary) return s.summary;
    if (s.kind === "skill") return s.name ?? "Promote a new skill";
    if (s.kind === "rubric") return s.name ?? "Add a new rubric";
    if (s.kind === "prompt") return `${s.scope ?? "orchestrator"} prompt edit`;
    return "Suggestion";
  })();
  return {
    id: s.id,
    kind: s.kind,
    agentName: s.agentName ?? "agent",
    threadTitle: s.threadTitle ?? (s.evidenceTraceIds?.[0] ?? "trace"),
    confidence: typeof s.confidence === "number" ? s.confidence : 0.5,
    summary,
    detail,
    createdAt: s.createdAt ?? "recent"
  };
}

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; suggestions: PendingSuggestion[] }
  | { kind: "fallback"; suggestions: PendingSuggestion[]; reason: string }
  | { kind: "error"; message: string };

export function LearningWorkspace() {
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [decisions, setDecisions] = useState<Record<string, "accept" | "reject" | "edit">>({});
  const [agentBaseUrl, setAgentBaseUrl] = useState<string | null>(null);
  const [state, setState] = useState<FetchState>({ kind: "idle" });

  useEffect(() => {
    const url = resolveAgentBaseUrl();
    setAgentBaseUrl(url);
    if (!url) {
      setState({
        kind: "fallback",
        suggestions: fixtureSuggestions,
        reason: "No agent URL configured (set NEXT_PUBLIC_AGENT_BASE_URL or pass ?agent=)."
      });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    fetch(`${url}/learning/pending`, { headers: { accept: "application/json" } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Agent returned ${res.status}`);
        return (await res.json()) as { suggestions: AgentSuggestion[] };
      })
      .then((body) => {
        if (cancelled) return;
        const suggestions = (body.suggestions ?? []).map(toPendingSuggestion);
        setState({ kind: "ready", suggestions });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setState({
          kind: "fallback",
          suggestions: fixtureSuggestions,
          reason: `Failed to load from agent (${message}); showing fixture data.`
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestions =
    state.kind === "ready" || state.kind === "fallback" ? state.suggestions : [];
  const isFallback = state.kind === "fallback";

  const availableAgents = useMemo(() => {
    const set = new Set<string>();
    for (const s of suggestions) set.add(s.agentName);
    return Array.from(set);
  }, [suggestions]);

  const filtered = useMemo(
    () =>
      agentFilter === "all"
        ? suggestions
        : suggestions.filter((s) => s.agentName === agentFilter),
    [agentFilter, suggestions]
  );

  const pendingCount = filtered.filter((s) => !decisions[s.id]).length;
  const acceptedCount = Object.values(decisions).filter((v) => v === "accept").length;
  const rejectedCount = Object.values(decisions).filter((v) => v === "reject").length;
  const editedCount = Object.values(decisions).filter((v) => v === "edit").length;

  const submitDecision = useCallback(
    async (id: string, decision: "accept" | "reject" | "edit") => {
      // Optimistic UI: mark immediately so the buttons disable.
      setDecisions((prev) => ({ ...prev, [id]: decision }));
      if (!agentBaseUrl || isFallback) return;
      try {
        const res = await fetch(`${agentBaseUrl}/learning/decisions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, decision })
        });
        if (!res.ok) throw new Error(`Agent returned ${res.status}`);
      } catch {
        // Roll back on failure so the user can retry.
        setDecisions((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [agentBaseUrl, isFallback]
  );

  return (
    <section className="workspace-page" aria-label="Learning workspace">
      <div className="surface chat-shell">
        <div className="surface-header">
          <div className="page-kicker">
            LearningDO
            {isFallback ? <DemoBadge /> : null}
          </div>
          <h1>What the agent has been learning</h1>
          <p>
            Skills, memories, rubrics, and prompt edits surfaced by the self-evolve loop. Accept what
            matters and the agent applies it next run; edit to refine; reject to dismiss.
          </p>
          {state.kind === "loading" ? (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading suggestions from agent…</p>
          ) : null}
          {state.kind === "error" ? (
            <p style={{ color: "var(--red, #b3261e)", fontSize: 13 }}>{state.message}</p>
          ) : null}
          {state.kind === "fallback" ? (
            <p style={{ color: "var(--muted)", fontSize: 12 }}>{state.reason}</p>
          ) : null}
        </div>

        <div className="learning-summary-grid">
          <SummaryCard icon={Sparkles} label="Skills accepted" value={acceptedCount} />
          <SummaryCard icon={ListChecks} label="Pending" value={pendingCount} />
          <SummaryCard icon={PencilLine} label="Edited" value={editedCount} />
          <SummaryCard icon={X} label="Rejected" value={rejectedCount} />
        </div>

        <div className="learning-tab-row" role="tablist" aria-label="Filter by agent">
          {(["all", ...(isFallback ? (fixtureAgents as readonly string[]) : availableAgents)] as string[]).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={agentFilter === id}
              onClick={() => setAgentFilter(id)}
              className="learning-tab"
            >
              {id === "all" ? "All agents" : id}
            </button>
          ))}
        </div>

        <div className="message-list" aria-live="polite" style={{ padding: "8px 20px 24px" }}>
          {filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              No suggestions for this agent yet. Run a few threads and check back.
            </div>
          ) : (
            <ul className="learning-list">
              {filtered.map((sug) => {
                const decision = decisions[sug.id];
                return (
                  <li
                    key={sug.id}
                    className="learning-card"
                    style={{ opacity: decision ? 0.6 : 1 }}
                  >
                    <div className="learning-card-header">
                      <KindBadge kind={sug.kind} />
                      <strong style={{ fontSize: 14 }}>{sug.summary}</strong>
                      <span className="learning-confidence">
                        {Math.round(sug.confidence * 100)}% confidence · {sug.createdAt}
                      </span>
                    </div>
                    <div
                      className="learning-detail"
                      style={{ marginTop: 8, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.45 }}
                    >
                      <Streamdown controls={false}>{sug.detail}</Streamdown>
                    </div>
                    <div className="learning-card-meta-row">
                      <small style={{ color: "var(--muted)", fontSize: 12 }}>
                        {sug.agentName} · {sug.threadTitle}
                      </small>
                      <div className="learning-card-actions">
                        <button
                          type="button"
                          className="button"
                          onClick={() => {
                            void submitDecision(sug.id, "accept");
                          }}
                          disabled={Boolean(decision)}
                        >
                          <CheckCircle2 size={14} aria-hidden="true" /> Accept
                        </button>
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => {
                            void submitDecision(sug.id, "edit");
                          }}
                          disabled={Boolean(decision)}
                        >
                          <PencilLine size={14} aria-hidden="true" /> Edit
                        </button>
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => {
                            void submitDecision(sug.id, "reject");
                          }}
                          disabled={Boolean(decision)}
                        >
                          <X size={14} aria-hidden="true" /> Reject
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Brain;
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        padding: 14,
        border: "1px solid var(--line)",
        borderRadius: 12,
        background: "var(--surface-strong)",
        display: "grid",
        gap: 6
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 12 }}>
        <Icon size={14} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <strong style={{ fontSize: 22, fontVariantNumeric: "tabular-nums" }}>{value}</strong>
    </div>
  );
}

export const __unusedIcon = GraduationCap;
