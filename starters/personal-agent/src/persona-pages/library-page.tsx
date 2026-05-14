/**
 * Library page — grid view of every artifact in the workspace, with
 * fuzzy substring search and quick filters across type / source / age.
 *
 * Mounts inside the Persona shell when the user clicks 📚 Library.
 * Decoupled from `persona-shell.tsx` via a local `PersonaArtifact`
 * shape so the page can also be rendered standalone in tests / Storybook.
 */
import { useMemo, useState, type ChangeEvent } from "react";

export type LibraryArtifactKind =
  | "document"
  | "browser"
  | "webpage"
  | "slides"
  | "table"
  | "image"
  | "code"
  | "chart";

export type LibraryArtifactSource = "agent" | "user" | "import" | "tool";

export interface PersonaArtifact {
  id: string;
  kind: LibraryArtifactKind;
  title: string;
  version: number;
  updatedAt: string;
  source?: LibraryArtifactSource;
  thumbnail?: string;
  summary?: string;
}

export type LibraryAgeBucket = "all" | "today" | "week" | "month" | "older";

export interface LibraryFilters {
  query: string;
  kind: LibraryArtifactKind | "all";
  source: LibraryArtifactSource | "all";
  age: LibraryAgeBucket;
}

export interface LibraryPageProps {
  artifacts: PersonaArtifact[];
  onOpenArtifact?: (id: string) => void;
}

const KIND_OPTIONS: ReadonlyArray<LibraryArtifactKind | "all"> = [
  "all",
  "document",
  "browser",
  "webpage",
  "slides",
  "table",
  "image",
  "code",
  "chart"
];

const SOURCE_OPTIONS: ReadonlyArray<LibraryArtifactSource | "all"> = [
  "all",
  "agent",
  "user",
  "import",
  "tool"
];

const AGE_OPTIONS: ReadonlyArray<LibraryAgeBucket> = ["all", "today", "week", "month", "older"];

function kindIcon(kind: LibraryArtifactKind): string {
  switch (kind) {
    case "document":
      return "▤";
    case "browser":
      return "◷";
    case "webpage":
      return "▢";
    case "slides":
      return "◫";
    case "table":
      return "▦";
    case "image":
      return "◳";
    case "code":
      return "❮❯";
    case "chart":
      return "▲";
  }
}

export function bucketFor(updatedAt: string, now: number = Date.now()): LibraryAgeBucket {
  const then = Date.parse(updatedAt);
  if (Number.isNaN(then)) return "older";
  const ageMs = now - then;
  const day = 86_400_000;
  if (ageMs < day) return "today";
  if (ageMs < 7 * day) return "week";
  if (ageMs < 30 * day) return "month";
  return "older";
}

export function filterArtifacts(
  artifacts: PersonaArtifact[],
  filters: LibraryFilters,
  now: number = Date.now()
): PersonaArtifact[] {
  const q = filters.query.trim().toLowerCase();
  return artifacts.filter((artifact) => {
    if (filters.kind !== "all" && artifact.kind !== filters.kind) return false;
    if (filters.source !== "all" && (artifact.source ?? "agent") !== filters.source) return false;
    if (filters.age !== "all" && bucketFor(artifact.updatedAt, now) !== filters.age) return false;
    if (q.length === 0) return true;
    const hay = `${artifact.title} ${artifact.summary ?? ""} ${artifact.kind}`.toLowerCase();
    return hay.includes(q);
  });
}

export function LibraryPage(props: LibraryPageProps) {
  const [filters, setFilters] = useState<LibraryFilters>({
    query: "",
    kind: "all",
    source: "all",
    age: "all"
  });

  const filtered = useMemo(
    () => filterArtifacts(props.artifacts, filters),
    [props.artifacts, filters]
  );

  const update =
    <K extends keyof LibraryFilters>(key: K) =>
    (event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      setFilters((prev) => ({ ...prev, [key]: event.target.value as LibraryFilters[K] }));
    };

  return (
    <section className="persona-page persona-library" aria-label="Library">
      <header className="persona-page__header">
        <h1>Library</h1>
        <p className="persona-page__subtitle">
          Every artifact your agent has produced — searchable, filterable, replayable.
        </p>
      </header>

      <div className="persona-library__toolbar">
        <input
          type="search"
          className="persona-library__search"
          placeholder="Search title, summary, kind…"
          value={filters.query}
          onChange={update("query")}
          aria-label="Search artifacts"
        />
        <FilterSelect label="Type" value={filters.kind} options={KIND_OPTIONS} onChange={update("kind")} />
        <FilterSelect label="Source" value={filters.source} options={SOURCE_OPTIONS} onChange={update("source")} />
        <FilterSelect label="Age" value={filters.age} options={AGE_OPTIONS} onChange={update("age")} />
      </div>

      <div className="persona-library__meta">
        <span>{filtered.length} of {props.artifacts.length} shown</span>
      </div>

      {filtered.length === 0 ? (
        <div className="persona-library__empty">
          <p>No artifacts match these filters yet.</p>
        </div>
      ) : (
        <ul className="persona-library__grid">
          {filtered.map((artifact) => (
            <li key={artifact.id}>
              <button
                type="button"
                className="persona-library__card"
                onClick={() => props.onOpenArtifact?.(artifact.id)}
              >
                <header>
                  <span className="persona-library__kind">{kindIcon(artifact.kind)}</span>
                  <strong>{artifact.title}</strong>
                  <span className="persona-library__version">v{artifact.version}</span>
                </header>
                <p className="persona-library__summary">
                  {artifact.summary ?? `${artifact.kind} · updated ${artifact.updatedAt}`}
                </p>
                <footer>
                  <span>{artifact.source ?? "agent"}</span>
                  <span>{artifact.updatedAt}</span>
                </footer>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface FilterSelectProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<T>;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}

function FilterSelect<T extends string>(props: FilterSelectProps<T>) {
  return (
    <label className="persona-library__filter">
      <span>{props.label}</span>
      <select value={props.value} onChange={props.onChange}>
        {props.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}
