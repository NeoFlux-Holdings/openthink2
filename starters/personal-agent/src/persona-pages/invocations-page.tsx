/**
 * Invocations page — the agent's run history.
 *
 * Pulls from `/invocations` on the deployed agent (or fixture data
 * when no agent URL is configured). Surfaces the existing trace data
 * the evolve loop already records — no new collection layer, just a
 * different read path.
 *
 * UX (matches Persona spec §7 "Invocations" tab):
 *   - Top: four summary cards (Total runs, Success rate, Avg latency,
 *     Total cost).
 *   - Below: a filter row (outcome / agent / model / date range).
 *   - Body: a sortable, paginated table with one row per invocation.
 *     Mobile collapses the table into stacked cards.
 *   - Click a row to open the detail drawer: full goal, tools used,
 *     timing breakdown, user feedback, "promote to skill" CTA.
 *
 * Mobile: a single column, summary cards in a 2x2 grid, table
 * becomes cards. The breakpoint matches persona-shell.css (720px).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent
} from "react";

type Outcome = "success" | "partial" | "failure" | "abandoned";

export interface InvocationViewModel {
  id: string;
  agentName: string;
  threadTitle: string;
  goal: string;
  model: string;
  startedAt: string;
  durationMs: number | null;
  toolsUsed: string[];
  outcome: Outcome;
  costUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  userFeedback?: "thumbs-up" | "thumbs-down" | "edit";
}

export interface InvocationsSummaryModel {
  totalRuns: number;
  successRate: number | null;
  averageDurationMs: number | null;
  totalCostUsd: number;
}

export interface InvocationsPageProps {
  /** Live agent base url. When `null` the page uses fixtures and shows
   *  a "Demo data" badge — same pattern as the Learning page. */
  agentBaseUrl?: string | null;
  fixtures?: { invocations: InvocationViewModel[]; summary: InvocationsSummaryModel };
}

const fixtureInvocations: InvocationViewModel[] = [
  {
    id: "inv-1",
    agentName: "amber-otter",
    threadTitle: "Refactor monorepo CI",
    goal: "Split CI into per-workspace matrix jobs",
    model: "kimi-k2.6",
    startedAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
    durationMs: 38_400,
    toolsUsed: ["github.list_workflows", "github.commit_files", "github.open_pr"],
    outcome: "success",
    costUsd: 0.042,
    inputTokens: 8_200,
    outputTokens: 1_540,
    userFeedback: "thumbs-up"
  },
  {
    id: "inv-2",
    agentName: "amber-otter",
    threadTitle: "Q3 retro draft",
    goal: "Summarize last 12 standups into a bullet recap",
    model: "kimi-k2.6",
    startedAt: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
    durationMs: 14_220,
    toolsUsed: ["calendar.list", "notion.read"],
    outcome: "success",
    costUsd: 0.018,
    inputTokens: 4_100,
    outputTokens: 620
  },
  {
    id: "inv-3",
    agentName: "loyal-fox",
    threadTitle: "Frontend a11y audit",
    goal: "Run axe across the marketing site",
    model: "kimi-k2.6",
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    durationMs: 92_100,
    toolsUsed: ["browser.navigate", "browser.screenshot", "axe.scan"],
    outcome: "partial",
    costUsd: 0.11,
    inputTokens: 22_500,
    outputTokens: 3_120
  },
  {
    id: "inv-4",
    agentName: "loyal-fox",
    threadTitle: "Migration runbook",
    goal: "Generate a runbook from the open PR diff",
    model: "kimi-k2.6",
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    durationMs: 5_300,
    toolsUsed: ["github.diff"],
    outcome: "failure",
    costUsd: 0.006,
    inputTokens: 1_200,
    outputTokens: 80,
    userFeedback: "thumbs-down"
  }
];

const fixtureSummary: InvocationsSummaryModel = {
  totalRuns: fixtureInvocations.length,
  successRate:
    fixtureInvocations.filter((r) => r.outcome === "success").length / fixtureInvocations.length,
  averageDurationMs: 37_505,
  totalCostUsd: 0.176
};

const outcomeChip: Record<Outcome, { label: string; bg: string; fg: string }> = {
  success: { label: "Success", bg: "rgba(23, 111, 73, 0.12)", fg: "var(--green, #176f49)" },
  partial: { label: "Partial", bg: "rgba(241, 113, 5, 0.12)", fg: "#9d4b00" },
  failure: { label: "Failure", bg: "rgba(180, 59, 53, 0.12)", fg: "var(--red, #b43b35)" },
  abandoned: { label: "Abandoned", bg: "rgba(21, 23, 22, 0.08)", fg: "var(--ink-soft, #2f2f37)" }
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function formatCost(usd: number | null): string {
  if (usd === null) return "—";
  if (usd === 0) return "$0";
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return iso;
  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

type SortKey = "startedAt" | "durationMs" | "costUsd" | "outcome";

export function InvocationsPage(props: InvocationsPageProps) {
  const [data, setData] = useState<InvocationViewModel[]>(props.fixtures?.invocations ?? []);
  const [summary, setSummary] = useState<InvocationsSummaryModel>(
    props.fixtures?.summary ?? fixtureSummary
  );
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<Outcome | "all">("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("startedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [activeInvocationId, setActiveInvocationId] = useState<string | null>(null);

  useEffect(() => {
    if (!props.agentBaseUrl) {
      setData(props.fixtures?.invocations ?? fixtureInvocations);
      setSummary(props.fixtures?.summary ?? fixtureSummary);
      setIsLive(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${props.agentBaseUrl}/invocations`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as {
          invocations: InvocationViewModel[];
          summary: InvocationsSummaryModel;
        };
        if (cancelled) return;
        setData(body.invocations ?? []);
        setSummary(body.summary);
        setIsLive(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setData(props.fixtures?.invocations ?? fixtureInvocations);
        setSummary(props.fixtures?.summary ?? fixtureSummary);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.agentBaseUrl, props.fixtures]);

  const agents = useMemo(() => {
    const set = new Set<string>();
    for (const r of data) set.add(r.agentName);
    return Array.from(set);
  }, [data]);

  const filtered = useMemo(() => {
    const rows = data.filter((r) => {
      if (outcomeFilter !== "all" && r.outcome !== outcomeFilter) return false;
      if (agentFilter !== "all" && r.agentName !== agentFilter) return false;
      return true;
    });
    rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (sortKey === "startedAt") {
        return (new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()) * dir;
      }
      return ((av as number) - (bv as number)) * dir;
    });
    return rows;
  }, [data, outcomeFilter, agentFilter, sortKey, sortDir]);

  const onSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir(key === "startedAt" ? "desc" : "desc");
      }
    },
    [sortKey]
  );

  const active = useMemo(
    () => filtered.find((r) => r.id === activeInvocationId) ?? null,
    [filtered, activeInvocationId]
  );

  return (
    <section className="persona-invocations" aria-label="Agent invocations">
      <header className="persona-invocations__header">
        <h2>Invocations</h2>
        <p>What the agent has been up to. Pulled from the same run-trace store the evolve loop reads.</p>
        {!isLive && !error && <span className="persona-invocations__badge">Demo data</span>}
        {error && (
          <p className="persona-invocations__error" role="alert">
            Live fetch failed: {error}. Showing fixtures.
          </p>
        )}
      </header>

      <div className="persona-invocations__cards">
        <SummaryCard label="Total runs" value={summary.totalRuns.toLocaleString()} />
        <SummaryCard
          label="Success rate"
          value={summary.successRate === null ? "—" : `${Math.round(summary.successRate * 100)}%`}
        />
        <SummaryCard label="Avg latency" value={formatDuration(summary.averageDurationMs)} />
        <SummaryCard label="Total spend" value={formatCost(summary.totalCostUsd)} />
      </div>

      <div className="persona-invocations__filters" role="search">
        <label className="persona-invocations__filter">
          <span>Outcome</span>
          <select
            value={outcomeFilter}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setOutcomeFilter(event.target.value as Outcome | "all")
            }
          >
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="partial">Partial</option>
            <option value="failure">Failure</option>
            <option value="abandoned">Abandoned</option>
          </select>
        </label>
        <label className="persona-invocations__filter">
          <span>Agent</span>
          <select
            value={agentFilter}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setAgentFilter(event.target.value)}
          >
            <option value="all">All</option>
            {agents.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        {loading && <span className="persona-invocations__loading">Loading…</span>}
      </div>

      <table className="persona-invocations__table">
        <thead>
          <tr>
            <th aria-sort={sortKey === "startedAt" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
              <button type="button" onClick={() => onSort("startedAt")}>
                When {sortKey === "startedAt" && (sortDir === "asc" ? "↑" : "↓")}
              </button>
            </th>
            <th>Agent</th>
            <th>Goal</th>
            <th className="persona-invocations__numeric">
              <button type="button" onClick={() => onSort("durationMs")}>
                Latency {sortKey === "durationMs" && (sortDir === "asc" ? "↑" : "↓")}
              </button>
            </th>
            <th className="persona-invocations__numeric">
              <button type="button" onClick={() => onSort("costUsd")}>
                Cost {sortKey === "costUsd" && (sortDir === "asc" ? "↑" : "↓")}
              </button>
            </th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={6} className="persona-invocations__empty">
                No invocations match your filters.
              </td>
            </tr>
          ) : (
            filtered.map((r) => (
              <tr
                key={r.id}
                tabIndex={0}
                onClick={() => setActiveInvocationId(r.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveInvocationId(r.id);
                  }
                }}
                data-outcome={r.outcome}
              >
                <td className="persona-invocations__when">
                  <span>{formatRelativeTime(r.startedAt)}</span>
                  <small>{new Date(r.startedAt).toLocaleString()}</small>
                </td>
                <td>{r.agentName}</td>
                <td className="persona-invocations__goal">
                  <strong>{r.threadTitle}</strong>
                  <small>{r.goal}</small>
                </td>
                <td className="persona-invocations__numeric">{formatDuration(r.durationMs)}</td>
                <td className="persona-invocations__numeric">{formatCost(r.costUsd)}</td>
                <td>
                  <span
                    className="persona-invocations__outcome"
                    style={{
                      background: outcomeChip[r.outcome].bg,
                      color: outcomeChip[r.outcome].fg
                    }}
                  >
                    {outcomeChip[r.outcome].label}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <ol className="persona-invocations__cards-list" aria-label="Invocations (mobile)">
        {filtered.map((r) => (
          <li key={`m-${r.id}`} onClick={() => setActiveInvocationId(r.id)} data-outcome={r.outcome}>
            <div className="persona-invocations__card-head">
              <strong>{r.threadTitle}</strong>
              <span
                className="persona-invocations__outcome"
                style={{
                  background: outcomeChip[r.outcome].bg,
                  color: outcomeChip[r.outcome].fg
                }}
              >
                {outcomeChip[r.outcome].label}
              </span>
            </div>
            <small>{r.goal}</small>
            <div className="persona-invocations__card-meta">
              <span>{r.agentName}</span>
              <span>·</span>
              <span>{formatRelativeTime(r.startedAt)}</span>
              <span>·</span>
              <span>{formatDuration(r.durationMs)}</span>
              <span>·</span>
              <span>{formatCost(r.costUsd)}</span>
            </div>
          </li>
        ))}
      </ol>

      {active && (
        <aside
          className="persona-invocations__drawer"
          role="dialog"
          aria-label={`Invocation ${active.id}`}
        >
          <header>
            <div>
              <strong>{active.threadTitle}</strong>
              <small>{active.goal}</small>
            </div>
            <button
              type="button"
              className="persona-invocations__drawer-close"
              onClick={() => setActiveInvocationId(null)}
              aria-label="Close detail"
            >
              ✕
            </button>
          </header>
          <dl>
            <div>
              <dt>Agent</dt>
              <dd>{active.agentName}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{active.model}</dd>
            </div>
            <div>
              <dt>Started</dt>
              <dd>{new Date(active.startedAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Latency</dt>
              <dd>{formatDuration(active.durationMs)}</dd>
            </div>
            <div>
              <dt>Cost</dt>
              <dd>{formatCost(active.costUsd)}</dd>
            </div>
            <div>
              <dt>Tokens</dt>
              <dd>
                {active.inputTokens?.toLocaleString() ?? "—"} in /{" "}
                {active.outputTokens?.toLocaleString() ?? "—"} out
              </dd>
            </div>
            <div>
              <dt>User feedback</dt>
              <dd>{active.userFeedback ?? "—"}</dd>
            </div>
            <div>
              <dt>Tools</dt>
              <dd>
                {active.toolsUsed.length === 0
                  ? "(none)"
                  : active.toolsUsed.map((t) => (
                      <span key={t} className="persona-invocations__tool-chip">
                        {t}
                      </span>
                    ))}
              </dd>
            </div>
          </dl>
        </aside>
      )}
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="persona-invocations__card">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
