/**
 * Search palette — global cmd+K surface with Threads / Artifacts / Memories
 * tabs. Empty-query view groups threads by age. Case-insensitive substring
 * match (no external fuzzy lib). Keyboard: ↑ ↓ navigate, Enter open, Tab
 * cycle, Esc close.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

export type SearchTab = "threads" | "artifacts" | "memories";
export type AgeBucket = "week" | "month" | "older";

export interface SearchThreadHit { id: string; title: string; updatedAt: string; agentName: string }
export interface SearchArtifactHit { id: string; title: string; kind: string; updatedAt: string }
export interface SearchMemoryHit { id: string; body: string; updatedAt: string }

export interface SearchPaletteProps {
  threads: SearchThreadHit[];
  artifacts: SearchArtifactHit[];
  memories: SearchMemoryHit[];
  onClose: () => void;
  onSelectThread: (id: string) => void;
  onSelectArtifact: (id: string) => void;
  onSelectMemory: (id: string) => void;
  initialTab?: SearchTab;
}

const TABS: ReadonlyArray<{ id: SearchTab; label: string }> = [
  { id: "threads", label: "Threads" },
  { id: "artifacts", label: "Artifacts" },
  { id: "memories", label: "Memories" }
];

export function ageBucket(updatedAt: string, now: number = Date.now()): AgeBucket {
  const then = Date.parse(updatedAt);
  if (Number.isNaN(then)) return "older";
  const day = 86_400_000;
  const ageMs = now - then;
  if (ageMs < 7 * day) return "week";
  if (ageMs < 30 * day) return "month";
  return "older";
}

export function matchesQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q.length === 0 || haystack.toLowerCase().includes(q);
}

export const filterThreads = (items: SearchThreadHit[], q: string) =>
  items.filter((t) => matchesQuery(`${t.title} ${t.agentName}`, q));
export const filterArtifacts = (items: SearchArtifactHit[], q: string) =>
  items.filter((a) => matchesQuery(`${a.title} ${a.kind}`, q));
export const filterMemories = (items: SearchMemoryHit[], q: string) =>
  items.filter((m) => matchesQuery(m.body, q));

export function groupByAge<T extends { updatedAt: string }>(items: T[], now: number = Date.now()) {
  const groups = { week: [] as T[], month: [] as T[], older: [] as T[] };
  for (const item of items) groups[ageBucket(item.updatedAt, now)].push(item);
  return groups;
}

export function SearchPalette(props: SearchPaletteProps) {
  const [tab, setTab] = useState<SearchTab>(props.initialTab ?? "threads");
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    if (tab === "threads") return filterThreads(props.threads, query);
    if (tab === "artifacts") return filterArtifacts(props.artifacts, query);
    return filterMemories(props.memories, query);
  }, [tab, query, props.threads, props.artifacts, props.memories]);

  useEffect(() => {
    setCursor(0);
  }, [tab, query]);

  const activate = useCallback(
    (index: number) => {
      const item = results[index];
      if (!item) return;
      if (tab === "threads") props.onSelectThread(item.id);
      else if (tab === "artifacts") props.onSelectArtifact(item.id);
      else props.onSelectMemory(item.id);
    },
    [results, tab, props]
  );

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      props.onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, Math.max(results.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      activate(cursor);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const i = TABS.findIndex((t) => t.id === tab);
      const next = TABS[(i + (event.shiftKey ? -1 : 1) + TABS.length) % TABS.length];
      if (next) setTab(next.id);
    }
  };

  return (
    <div className="persona-search" role="dialog" aria-modal="true" aria-label="Global search" onKeyDown={onKeyDown}>
      <div className="persona-search__backdrop" onClick={props.onClose} />
      <div className="persona-search__panel">
        <input
          ref={inputRef}
          className="persona-search__input"
          type="search"
          placeholder="Search threads, artifacts, memories…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="persona-search__tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`persona-search__tab${tab === t.id ? " is-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="persona-search__results">
          {results.length === 0 ? (
            <div className="persona-search__empty">No matches.</div>
          ) : tab === "threads" && query.trim() === "" ? (
            <GroupedThreads groups={groupByAge(results as SearchThreadHit[])} cursor={cursor} onPick={activate} />
          ) : (
            <FlatResults items={results} tab={tab} cursor={cursor} onPick={activate} />
          )}
        </div>
        <footer className="persona-search__footer">
          <span>↑ ↓ navigate</span>
          <span>↵ open</span>
          <span>Tab cycle</span>
          <span>Esc close</span>
        </footer>
      </div>
    </div>
  );
}

function GroupedThreads(props: {
  groups: { week: SearchThreadHit[]; month: SearchThreadHit[]; older: SearchThreadHit[] };
  cursor: number;
  onPick: (index: number) => void;
}) {
  const labels = { week: "Past week", month: "Past month", older: "Older" } as const;
  let i = -1;
  return (
    <div className="persona-search__groups">
      {(["week", "month", "older"] as const).map((bucket) => {
        const items = props.groups[bucket];
        if (items.length === 0) return null;
        return (
          <section key={bucket}>
            <header>{labels[bucket]}</header>
            <ul>
              {items.map((t) => {
                const index = ++i;
                return (
                  <li key={t.id} className={`persona-search__row${index === props.cursor ? " is-active" : ""}`}>
                    <button type="button" onClick={() => props.onPick(index)}>
                      <strong>{t.title}</strong>
                      <span>{t.agentName} · {t.updatedAt}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function FlatResults(props: {
  items: SearchThreadHit[] | SearchArtifactHit[] | SearchMemoryHit[];
  tab: SearchTab;
  cursor: number;
  onPick: (index: number) => void;
}) {
  return (
    <ul className="persona-search__list">
      {props.items.map((item, index) => (
        <li key={item.id} className={`persona-search__row${index === props.cursor ? " is-active" : ""}`}>
          <button type="button" onClick={() => props.onPick(index)}>
            <strong>{renderTitle(item, props.tab)}</strong>
            <span>{item.updatedAt}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function renderTitle(item: SearchThreadHit | SearchArtifactHit | SearchMemoryHit, tab: SearchTab): string {
  if (tab === "threads") return (item as SearchThreadHit).title;
  if (tab === "artifacts") return (item as SearchArtifactHit).title;
  return (item as SearchMemoryHit).body.slice(0, 80);
}
