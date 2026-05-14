/**
 * Persona shell — the 3-column UI described in the openthink2 brief.
 *
 *   ┌───────────────────┬─────────────────────────┬─────────────────────────────┐
 *   │ Sidebar (180px)   │ Thread feed (~40%)      │ Artifact canvas (~55%)      │
 *   │ New Task          │ Header + status         │ Windowing: single/grid/stack│
 *   │ Search            │ Working doc chip        │ Artifact viewers            │
 *   │ Library           │ Messages + actions      │ Thumbnail strip             │
 *   │ Learning          │ Composer                │                             │
 *   │ Skills            │                         │                             │
 *   │ Recent threads    │                         │                             │
 *   │ Settings          │                         │                             │
 *   └───────────────────┴─────────────────────────┴─────────────────────────────┘
 *
 * This file ships as a self-contained skeleton — every column is
 * wired with the basic structure, the rest is intentional surface
 * area for future expansion. Use it as the entry shell for the agent's
 * web UI; route the existing single-pane chat into <ThreadFeed/> and
 * the artifact-aware renderers (Streamdown, browser preview, etc.)
 * into <ArtifactCanvas/>.
 */

import { useMemo, useState, type ReactNode } from "react";

export type PersonaArtifactKind =
  | "document"
  | "browser"
  | "webpage"
  | "slides"
  | "table"
  | "image"
  | "code"
  | "chart";

export interface PersonaArtifact {
  id: string;
  kind: PersonaArtifactKind;
  title: string;
  version: number;
  updatedAt: string;
  thumbnail?: string;
}

export interface PersonaThreadSummary {
  id: string;
  title: string;
  agentName: string;
  agentColor: string;
  status: "live" | "complete" | "paused";
  lastUpdated: string;
  artifactCount: number;
}

export interface PersonaShellProps {
  workspaceName: string;
  ownerEmail: string;
  recentThreads: PersonaThreadSummary[];
  pendingLearningCount: number;
  pendingSkillsCount: number;
  artifacts: PersonaArtifact[];
  activeThreadId?: string;
  workingDoc: string;
  onSelectThread: (threadId: string) => void;
  onNewTask: () => void;
  onOpenSearch: () => void;
  onOpenLibrary: () => void;
  onOpenLearning: () => void;
  onOpenSkills: () => void;
  onOpenSettings: () => void;
  threadView: ReactNode;
  composer: ReactNode;
}

type ArtifactWindowingMode = "single" | "grid" | "stack";

interface SidebarItem {
  id: "new-task" | "search" | "library" | "learning" | "skills";
  label: string;
  primary?: boolean;
}

const sidebarItems: readonly SidebarItem[] = [
  { id: "new-task", label: "✦ New Task", primary: true },
  { id: "search", label: "🔍 Search" },
  { id: "library", label: "📚 Library" },
  { id: "learning", label: "🧠 Learning" },
  { id: "skills", label: "⚡ Skills" }
];

export function PersonaShell(props: PersonaShellProps) {
  const [windowingMode, setWindowingMode] = useState<ArtifactWindowingMode>("single");
  const [activeArtifactId, setActiveArtifactId] = useState<string | undefined>(
    props.artifacts[0]?.id
  );

  const activeArtifact = useMemo(
    () => props.artifacts.find((a) => a.id === activeArtifactId),
    [props.artifacts, activeArtifactId]
  );

  return (
    <div className="persona-shell" data-windowing={windowingMode}>
      <aside className="persona-shell__sidebar">
        <div className="persona-shell__brand">
          <strong>{props.workspaceName}</strong>
          <small>{props.ownerEmail}</small>
        </div>

        <nav className="persona-shell__nav">
          {sidebarItems.map((item) => {
            const onClick =
              item.id === "new-task"
                ? props.onNewTask
                : item.id === "search"
                  ? props.onOpenSearch
                  : item.id === "library"
                    ? props.onOpenLibrary
                    : item.id === "learning"
                      ? props.onOpenLearning
                      : props.onOpenSkills;
            const badge =
              item.id === "learning"
                ? props.pendingLearningCount
                : item.id === "skills"
                  ? props.pendingSkillsCount
                  : 0;
            return (
              <button
                type="button"
                key={item.id}
                className={`persona-shell__nav-item${item.primary ? " persona-shell__nav-item--primary" : ""}`}
                onClick={onClick}
              >
                <span>{item.label}</span>
                {badge > 0 && <span className="persona-shell__nav-badge">{badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className="persona-shell__divider" />

        <section className="persona-shell__recent">
          <header>Recent threads</header>
          <ul>
            {props.recentThreads.slice(0, 7).map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  className={`persona-shell__thread${thread.id === props.activeThreadId ? " is-active" : ""}`}
                  onClick={() => props.onSelectThread(thread.id)}
                >
                  <span className="persona-shell__thread-dot" style={{ background: thread.agentColor }} />
                  <span className="persona-shell__thread-title">{thread.title}</span>
                  <span className="persona-shell__thread-meta">{thread.lastUpdated}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <button
          type="button"
          className="persona-shell__nav-item persona-shell__settings"
          onClick={props.onOpenSettings}
        >
          ⚙ Settings · Help
        </button>
      </aside>

      <section className="persona-shell__thread">
        {props.workingDoc && (
          <div className="persona-shell__working-doc" title="Agent's working doc">
            <strong>Agent's notes</strong>
            <span>{props.workingDoc}</span>
          </div>
        )}

        <div className="persona-shell__thread-feed">{props.threadView}</div>

        <div className="persona-shell__composer">{props.composer}</div>
      </section>

      <section className="persona-shell__canvas">
        <header className="persona-shell__canvas-header">
          <div className="persona-shell__windowing">
            {(["single", "grid", "stack"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`persona-shell__win-btn${windowingMode === mode ? " is-active" : ""}`}
                onClick={() => setWindowingMode(mode)}
                aria-pressed={windowingMode === mode}
                aria-label={`Switch artifact canvas to ${mode} mode`}
              >
                {mode === "single" ? "▢" : mode === "grid" ? "▦" : "▤"}
              </button>
            ))}
          </div>
          <strong>
            {activeArtifact ? `${activeArtifact.title} v${activeArtifact.version}` : "No artifacts yet"}
          </strong>
        </header>

        <div className="persona-shell__canvas-body">
          {props.artifacts.length === 0 ? (
            <div className="persona-shell__canvas-empty">
              <p>Artifacts appear here as the agent produces them — documents, browser sessions, code, slides, images.</p>
            </div>
          ) : (
            <div className={`persona-shell__artifacts persona-shell__artifacts--${windowingMode}`}>
              {(windowingMode === "single" && activeArtifact ? [activeArtifact] : props.artifacts).map((artifact) => (
                <ArtifactTile key={artifact.id} artifact={artifact} active={artifact.id === activeArtifactId} />
              ))}
            </div>
          )}
        </div>

        {props.artifacts.length > 1 && (
          <footer className="persona-shell__thumbnails">
            {props.artifacts.map((artifact) => (
              <button
                key={artifact.id}
                type="button"
                className={`persona-shell__thumbnail${artifact.id === activeArtifactId ? " is-active" : ""}`}
                onClick={() => {
                  setActiveArtifactId(artifact.id);
                  setWindowingMode("single");
                }}
              >
                <span className="persona-shell__thumbnail-kind">{kindIcon(artifact.kind)}</span>
                <span className="persona-shell__thumbnail-title">{artifact.title}</span>
              </button>
            ))}
          </footer>
        )}
      </section>
    </div>
  );
}

function ArtifactTile({ artifact, active }: { artifact: PersonaArtifact; active: boolean }) {
  return (
    <article className={`persona-artifact${active ? " is-active" : ""}`} data-kind={artifact.kind}>
      <header>
        <span className="persona-artifact__kind">{kindIcon(artifact.kind)}</span>
        <h3>{artifact.title}</h3>
        <span className="persona-artifact__version">v{artifact.version}</span>
      </header>
      <div className="persona-artifact__placeholder">
        <p>
          {artifact.kind === "browser"
            ? "Live browser session will render here — streamed screenshots, controllable when the user takes over."
            : artifact.kind === "document"
              ? "Document viewer — markdown / rich text with version picker and inline edit."
              : artifact.kind === "code"
                ? "Code viewer with syntax highlighting and run-in-sandbox."
                : artifact.kind === "slides"
                  ? "Multi-slide deck with prev/next navigation."
                  : artifact.kind === "table"
                    ? "Sortable / filterable data table with CSV export."
                    : artifact.kind === "image"
                      ? "Image preview with download and variations."
                      : artifact.kind === "chart"
                        ? "Interactive chart rendered in sandboxed iframe."
                        : "Webpage / app preview with mobile / desktop viewport toggle."}
        </p>
      </div>
    </article>
  );
}

function kindIcon(kind: PersonaArtifactKind): string {
  switch (kind) {
    case "document":
      return "📄";
    case "browser":
      return "🌐";
    case "webpage":
      return "🖥";
    case "slides":
      return "🎞";
    case "table":
      return "📊";
    case "image":
      return "🖼";
    case "code":
      return "💻";
    case "chart":
      return "📈";
  }
}
