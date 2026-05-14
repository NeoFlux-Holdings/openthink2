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
import { useMemo, useState } from "react";

/**
 * Learning page — surfaces the agent's accumulated skills, memories,
 * and pending suggestions emitted by the self-evolve loop
 * (starters/personal-agent/src/evolve/loop.ts).
 *
 * The page renders a tabbed feed of suggestions per agent. Today this
 * is stubbed against fixture data so the platform builds standalone;
 * when wired to a deployed agent it pulls live data from
 * /learning/pending on the agent worker.
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

export function LearningWorkspace() {
  const [agentFilter, setAgentFilter] = useState<(typeof fixtureAgents)[number] | "all">("all");
  const [decisions, setDecisions] = useState<Record<string, "accept" | "reject" | "edit">>({});

  const filtered = useMemo(
    () =>
      agentFilter === "all"
        ? fixtureSuggestions
        : fixtureSuggestions.filter((s) => s.agentName === agentFilter),
    [agentFilter]
  );

  const pendingCount = filtered.filter((s) => !decisions[s.id]).length;

  const acceptedCount = Object.values(decisions).filter((v) => v === "accept").length;
  const rejectedCount = Object.values(decisions).filter((v) => v === "reject").length;
  const editedCount = Object.values(decisions).filter((v) => v === "edit").length;

  return (
    <section className="workspace-page" aria-label="Learning workspace">
      <div className="surface chat-shell">
        <div className="surface-header">
          <div className="page-kicker">LearningDO</div>
          <h1>What the agent has been learning</h1>
          <p>
            Skills, memories, rubrics, and prompt edits surfaced by the self-evolve loop. Accept what
            matters and the agent applies it next run; edit to refine; reject to dismiss.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            padding: "0 20px 14px"
          }}
        >
          <SummaryCard icon={Sparkles} label="Skills accepted" value={acceptedCount} />
          <SummaryCard icon={ListChecks} label="Pending" value={pendingCount} />
          <SummaryCard icon={PencilLine} label="Edited" value={editedCount} />
          <SummaryCard icon={X} label="Rejected" value={rejectedCount} />
        </div>

        <div style={{ padding: "0 20px 8px", display: "flex", gap: 6 }} role="tablist" aria-label="Filter by agent">
          {(["all", ...fixtureAgents] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={agentFilter === id}
              onClick={() => setAgentFilter(id)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid var(--line)",
                background: agentFilter === id ? "rgba(58, 91, 215, 0.1)" : "var(--surface-strong)",
                color: agentFilter === id ? "var(--accent)" : "var(--ink-soft)",
                fontSize: 13,
                cursor: "pointer"
              }}
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
            <ul style={{ display: "grid", gap: 12, padding: 0, margin: 0, listStyle: "none" }}>
              {filtered.map((sug) => {
                const decision = decisions[sug.id];
                return (
                  <li
                    key={sug.id}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      padding: 14,
                      background: "var(--surface-strong)",
                      opacity: decision ? 0.6 : 1
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <KindBadge kind={sug.kind} />
                      <strong style={{ fontSize: 14 }}>{sug.summary}</strong>
                      <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>
                        {Math.round(sug.confidence * 100)}% confidence · {sug.createdAt}
                      </span>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.45 }}>
                      {sug.detail}
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 8
                      }}
                    >
                      <small style={{ color: "var(--muted)", fontSize: 12 }}>
                        {sug.agentName} · {sug.threadTitle}
                      </small>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          className="button"
                          onClick={() => setDecisions((p) => ({ ...p, [sug.id]: "accept" }))}
                          disabled={Boolean(decision)}
                        >
                          <CheckCircle2 size={14} aria-hidden="true" /> Accept
                        </button>
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => setDecisions((p) => ({ ...p, [sug.id]: "edit" }))}
                          disabled={Boolean(decision)}
                        >
                          <PencilLine size={14} aria-hidden="true" /> Edit
                        </button>
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => setDecisions((p) => ({ ...p, [sug.id]: "reject" }))}
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
