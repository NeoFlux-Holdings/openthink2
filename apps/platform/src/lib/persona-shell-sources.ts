// Auto-generated. Do not edit by hand.
// Run `node tools/regen-persona-shell-sources.mjs` to regenerate.
//
// These string constants hold the source of the Persona UI files that
// the deployed-agent template emits into generated user-agent Workers.
// Keeping the source as compiled-in TypeScript string constants lets
// the template renderer ship the Persona shell without a workspace
// dependency on @open-think/starter-personal-agent at deploy time.

// === Source: starters/personal-agent/src/persona-shell.tsx ===
export const PERSONA_SHELL_TSX = `/**
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
  | "chart"
  | "diff";

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
                className={\`persona-shell__nav-item\${item.primary ? " persona-shell__nav-item--primary" : ""}\`}
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
                  className={\`persona-shell__thread\${thread.id === props.activeThreadId ? " is-active" : ""}\`}
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

      <section className="persona-shell__center">
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
                className={\`persona-shell__win-btn\${windowingMode === mode ? " is-active" : ""}\`}
                onClick={() => setWindowingMode(mode)}
                aria-pressed={windowingMode === mode}
                aria-label={\`Switch artifact canvas to \${mode} mode\`}
              >
                {mode === "single" ? "▢" : mode === "grid" ? "▦" : "▤"}
              </button>
            ))}
          </div>
          <strong>
            {activeArtifact ? \`\${activeArtifact.title} v\${activeArtifact.version}\` : "No artifacts yet"}
          </strong>
        </header>

        <div className="persona-shell__canvas-body">
          {props.artifacts.length === 0 ? (
            <div className="persona-shell__canvas-empty">
              <p>Artifacts appear here as the agent produces them — documents, browser sessions, code, slides, images.</p>
            </div>
          ) : (
            <div className={\`persona-shell__artifacts persona-shell__artifacts--\${windowingMode}\`}>
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
                className={\`persona-shell__thumbnail\${artifact.id === activeArtifactId ? " is-active" : ""}\`}
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
    <article className={\`persona-artifact\${active ? " is-active" : ""}\`} data-kind={artifact.kind}>
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
                        : artifact.kind === "diff"
                          ? "Diff viewer — inline or side-by-side comparison of two text revisions."
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
    case "diff":
      return "🔀";
  }
}
`;

// === Source: starters/personal-agent/src/persona-shell.css ===
export const PERSONA_SHELL_CSS = `/*
 * Persona shell styles — three-column grid, modern and quiet, designed
 * to work with the openthink2 platform palette already present in
 * apps/platform/src/app/globals.css. Self-contained: only references
 * CSS custom properties through fallbacks so the shell renders
 * standalone if dropped into a different page.
 */

.persona-shell {
  --persona-sidebar: 220px;
  --persona-thread: minmax(360px, 0.9fr);
  --persona-canvas: minmax(420px, 1.4fr);
  --persona-bg: var(--surface, #f5f5f4);
  --persona-surface: var(--surface-strong, #ffffff);
  --persona-line: var(--line, rgba(21, 23, 22, 0.08));
  --persona-line-strong: var(--line-strong, rgba(21, 23, 22, 0.18));
  --persona-ink: var(--ink, #15151a);
  --persona-ink-soft: var(--ink-soft, #2f2f37);
  --persona-muted: var(--muted, #5e5e66);
  --persona-accent: var(--accent, #3a5bd7);
  --persona-green: var(--green, #176f49);
  --persona-radius: 12px;

  display: grid;
  grid-template-columns: var(--persona-sidebar) var(--persona-thread) var(--persona-canvas);
  grid-template-rows: 100vh;
  width: 100vw;
  max-width: 100%;
  background: var(--persona-bg);
  color: var(--persona-ink);
  font-family: inherit;
}

.persona-shell__sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 12px;
  border-right: 1px solid var(--persona-line);
  background: var(--persona-surface);
  overflow-y: auto;
}

.persona-shell__brand {
  display: grid;
  gap: 2px;
  padding: 6px 8px 4px;
}

.persona-shell__brand strong {
  font-size: 0.95rem;
}

.persona-shell__brand small {
  color: var(--persona-muted);
  font-size: 0.72rem;
}

.persona-shell__nav {
  display: grid;
  gap: 4px;
}

.persona-shell__nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--persona-ink-soft);
  font-size: 0.88rem;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease;
}

.persona-shell__nav-item:hover {
  background: rgba(21, 23, 22, 0.04);
}

.persona-shell__nav-item--primary {
  background: var(--persona-accent);
  color: white;
  font-weight: 600;
}

.persona-shell__nav-item--primary:hover {
  background: var(--persona-accent);
  filter: brightness(1.05);
}

.persona-shell__nav-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(21, 23, 22, 0.08);
  color: var(--persona-ink-soft);
}

.persona-shell__nav-item--primary .persona-shell__nav-badge {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.persona-shell__divider {
  height: 1px;
  margin: 6px 4px;
  background: var(--persona-line);
}

.persona-shell__recent {
  display: grid;
  gap: 6px;
  padding: 0 4px;
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
}

.persona-shell__recent header {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--persona-muted);
  padding: 4px 6px;
}

.persona-shell__recent ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 2px;
}

.persona-shell__thread {
  display: grid;
  grid-template-columns: 16px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: var(--persona-ink-soft);
  text-align: left;
  cursor: pointer;
  width: 100%;
  font-size: 0.84rem;
}

.persona-shell__thread:hover {
  background: rgba(21, 23, 22, 0.04);
}

.persona-shell__thread.is-active {
  background: rgba(58, 91, 215, 0.08);
  color: var(--persona-ink);
}

.persona-shell__thread-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.persona-shell__thread-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.persona-shell__thread-meta {
  font-size: 0.7rem;
  color: var(--persona-muted);
}

.persona-shell__settings {
  margin-top: auto;
}

/* === Center column: thread feed ============================================ */

/* Renamed from \`.persona-shell > .persona-shell__thread\` because the sidebar's
 * thread-button class also matched and applied its 3-column grid + button
 * padding to the center column, squashing it to ~16 px wide. */
.persona-shell__center {
  display: grid;
  grid-template-rows: auto 1fr auto;
  grid-template-columns: 1fr;
  background: var(--persona-bg);
  border-right: 1px solid var(--persona-line);
  min-height: 0;
  min-width: 0;
  padding: 0;
  margin: 0;
  color: var(--persona-ink);
  font: inherit;
  text-align: left;
}

.persona-shell__working-doc {
  margin: 14px 18px 0;
  padding: 10px 14px;
  border: 1px dashed var(--persona-line-strong);
  border-radius: var(--persona-radius);
  background: rgba(255, 255, 255, 0.6);
  display: grid;
  gap: 3px;
}

.persona-shell__working-doc strong {
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--persona-muted);
}

.persona-shell__working-doc span {
  font-size: 0.88rem;
  color: var(--persona-ink-soft);
  line-height: 1.4;
}

.persona-shell__thread-feed {
  overflow-y: auto;
  padding: 16px 18px;
  min-height: 0;
}

.persona-shell__composer {
  border-top: 1px solid var(--persona-line);
  padding: 12px 18px;
  background: var(--persona-surface);
}

/* === Right column: artifact canvas ========================================= */

.persona-shell__canvas {
  display: grid;
  grid-template-rows: auto 1fr auto;
  background: var(--persona-surface);
  min-height: 0;
}

.persona-shell__canvas-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--persona-line);
}

.persona-shell__windowing {
  display: inline-flex;
  border: 1px solid var(--persona-line);
  border-radius: 8px;
  overflow: hidden;
}

.persona-shell__win-btn {
  padding: 6px 10px;
  background: transparent;
  border: none;
  color: var(--persona-ink-soft);
  cursor: pointer;
  font-size: 0.95rem;
}

.persona-shell__win-btn:hover {
  background: rgba(21, 23, 22, 0.05);
}

.persona-shell__win-btn.is-active {
  background: rgba(58, 91, 215, 0.1);
  color: var(--persona-accent);
}

.persona-shell__canvas-body {
  overflow: auto;
  padding: 16px;
  min-height: 0;
}

.persona-shell__canvas-empty {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--persona-muted);
  font-size: 0.92rem;
  padding: 24px;
  text-align: center;
}

.persona-shell__artifacts {
  display: grid;
  gap: 16px;
}

.persona-shell__artifacts--single {
  grid-template-columns: 1fr;
}

.persona-shell__artifacts--grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.persona-shell__artifacts--stack {
  grid-template-columns: 1fr;
  /* future: snap-scroll for carousel; out of scope for the skeleton */
}

.persona-artifact {
  display: grid;
  grid-template-rows: auto 1fr;
  border: 1px solid var(--persona-line);
  border-radius: var(--persona-radius);
  background: white;
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.persona-artifact.is-active {
  border-color: rgba(58, 91, 215, 0.36);
}

.persona-artifact > header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--persona-line);
  background: rgba(21, 23, 22, 0.02);
}

.persona-artifact__kind {
  font-size: 1.05rem;
}

.persona-artifact h3 {
  margin: 0;
  font-size: 0.95rem;
}

.persona-artifact__version {
  margin-left: auto;
  font-size: 0.72rem;
  color: var(--persona-muted);
  font-variant-numeric: tabular-nums;
}

.persona-artifact__placeholder {
  display: grid;
  place-items: center;
  padding: 32px 24px;
  color: var(--persona-muted);
  font-size: 0.86rem;
  text-align: center;
  line-height: 1.45;
}

.persona-shell__thumbnails {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid var(--persona-line);
  overflow-x: auto;
  background: rgba(21, 23, 22, 0.02);
}

.persona-shell__thumbnail {
  display: inline-grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--persona-line);
  border-radius: 8px;
  background: white;
  font-size: 0.78rem;
  color: var(--persona-ink-soft);
  cursor: pointer;
  white-space: nowrap;
}

.persona-shell__thumbnail.is-active {
  border-color: rgba(58, 91, 215, 0.4);
  color: var(--persona-ink);
}

.persona-shell__thumbnail-kind {
  font-size: 0.95rem;
}

/* === Responsive breakpoints ================================================
 *
 * --bp-desktop: 1100px — full three-column Persona shell
 * --bp-tablet:   900px — sidebar collapses, canvas + thread feed share width,
 *                       thumbnail strip compresses to horizontal scroll
 * --bp-mobile:   620px — single column, larger tap targets (>= 44px),
 *                       working-doc disclosure, recent-threads chip row
 */

@media (max-width: 1100px) {
  .persona-shell {
    grid-template-columns: var(--persona-sidebar) 1fr;
    grid-template-rows: 100vh;
  }
  .persona-shell__canvas {
    grid-column: 1 / -1;
    border-top: 1px solid var(--persona-line);
  }
}

@media (max-width: 900px) {
  /* Compress canvas thumbnail strip: smaller thumbnails, no wrap.
   * Strip already uses overflow-x: auto, so we just shrink the chips. */
  .persona-shell__thumbnails {
    flex-wrap: nowrap;
    gap: 6px;
    padding: 8px 12px;
  }
  .persona-shell__thumbnail {
    padding: 5px 8px;
    font-size: 0.74rem;
    gap: 4px;
    max-width: 160px;
  }
  .persona-shell__thumbnail .persona-shell__thumbnail-title {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .persona-shell__thumbnail-kind {
    font-size: 0.85rem;
  }

  /* Canvas header tightens; windowing buttons stay legible. */
  .persona-shell__canvas-header {
    gap: 10px;
    padding: 10px 12px;
  }

  /* Working-doc and thread feed share width with canvas. */
  .persona-shell__working-doc {
    margin: 12px 14px 0;
    padding: 8px 12px;
  }
  .persona-shell__thread-feed {
    padding: 14px;
  }
  .persona-shell__composer {
    padding: 10px 14px;
  }
}

@media (max-width: 720px) {
  .persona-shell {
    grid-template-columns: 1fr;
  }
  .persona-shell__sidebar {
    display: none;
  }
}

@media (max-width: 620px) {
  /* Single column, larger tap targets, secondary metadata hidden. */
  .persona-shell {
    grid-template-columns: 1fr;
  }

  /* Working-doc becomes a collapsible disclosure: it still appears in the
   * DOM but renders compactly and hides the body until expanded via :focus
   * or :hover. Authors may upgrade to a native <details>; until then this
   * keeps the affordance compact without breaking aria attributes. */
  .persona-shell__working-doc {
    margin: 10px 12px 0;
    padding: 8px 12px;
    min-height: 44px;
    cursor: pointer;
  }
  .persona-shell__working-doc strong {
    display: block;
  }
  .persona-shell__working-doc strong::after {
    content: " ▾";
    color: var(--persona-muted);
    font-weight: 400;
  }
  .persona-shell__working-doc span {
    display: none;
  }
  .persona-shell__working-doc:hover span,
  .persona-shell__working-doc:focus span,
  .persona-shell__working-doc:focus-within span,
  .persona-shell__working-doc[aria-expanded="true"] span {
    display: block;
  }

  /* Thread feed and composer get more room and larger touch targets. */
  .persona-shell__thread-feed {
    padding: 12px 12px 16px;
  }
  .persona-shell__composer {
    padding: 10px 12px;
  }

  /* Canvas header: tighten and keep the icon buttons readable >= 44px. */
  .persona-shell__canvas-header {
    padding: 8px 10px;
    gap: 8px;
  }
  .persona-shell__win-btn {
    min-width: 44px;
    min-height: 44px;
    padding: 8px 12px;
    font-size: 1rem;
  }
  .persona-shell__canvas-body {
    padding: 12px;
  }

  /* Artifact grid never fits two columns at this width; flatten always. */
  .persona-shell__artifacts--grid {
    grid-template-columns: 1fr;
  }

  /* Thumbnails: horizontal scroll, larger touch targets. */
  .persona-shell__thumbnails {
    padding: 8px 10px;
    gap: 6px;
  }
  .persona-shell__thumbnail {
    min-height: 44px;
    padding: 6px 10px;
  }

  /* Recent-threads list (visible when sidebar is unhidden at tablet width
   * via a future toggle) becomes a horizontal scrolling chip row at mobile.
   * Hide the timestamp meta to keep chips compact. */
  .persona-shell__recent {
    overflow: visible;
  }
  .persona-shell__recent ul {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .persona-shell__recent li {
    flex: 0 0 auto;
  }
  .persona-shell__thread {
    grid-template-columns: 12px auto;
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid var(--persona-line);
    border-radius: 999px;
    background: var(--persona-surface);
    white-space: nowrap;
  }
  .persona-shell__thread .persona-shell__thread-title {
    max-width: 160px;
  }
  .persona-shell__thread .persona-shell__thread-meta {
    display: none;
  }

  /* Sidebar nav (when visible via slide-out) gets touch-friendly rows. */
  .persona-shell__nav-item,
  .persona-shell__settings {
    min-height: 44px;
    padding: 10px 12px;
  }
}

/* === Coarse-pointer and reduced-motion safeguards ========================== */

@media (hover: none) {
  /* Show inline action chrome that would otherwise need hover. The working-
   * doc disclosure body is always visible on coarse pointers. */
  .persona-shell__working-doc span {
    display: block;
  }
}

@media (prefers-reduced-motion: reduce) {
  .persona-shell__nav-item,
  .persona-artifact,
  .persona-shell__thread,
  .persona-shell__thumbnail,
  .persona-shell__win-btn {
    transition: none;
  }
}
`;

// === Source: starters/personal-agent/src/persona-app.tsx ===
export const PERSONA_APP_TSX = `/**
 * PersonaApp — the top-level wrapper that puts the Persona shell, Home,
 * Thread Feed, and Composer together for the deployed agent web UI.
 *
 * Owns:
 *   - The active routed view (\`home\`, \`thread\`, or one of the sidebar
 *     destinations: \`library\` / \`learning\` / \`skills\` / \`settings\`).
 *   - The \`useAgent\` + \`useAgentChat\` hookup that powers the thread.
 *   - The currently active thread id (the deployed PersonalChatAgent is
 *     single-room today, so the id is effectively a stable token).
 *
 * It does NOT own any artifact-canvas state — the existing
 * \`PersonaShell\` keeps its own windowing/active-artifact state.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import type { UIMessage } from "ai";
import { PersonaShell, type PersonaArtifact, type PersonaThreadSummary } from "./persona-shell";
import { PersonaHome, type PersonaRecentThread } from "./persona-pages/persona-home";
import { PersonaThreadFeed } from "./persona-pages/persona-thread-feed";
import { PersonaComposer } from "./persona-pages/persona-composer";
import { LibraryPage } from "./persona-pages/library-page";
import { SkillsPage } from "./persona-pages/skills-page";
import { SettingsPage, defaultPersonaSettings, type PersonaSettings } from "./persona-pages/settings-page";
import { SearchPalette } from "./persona-pages/search-palette";
import { builtinSkillPacks, flattenPacks, type Skill } from "./skills";

export type PersonaView = "home" | "thread" | "library" | "learning" | "skills" | "settings" | "search";

export interface PersonaAppProps {
  workspaceName: string;
  ownerEmail?: string;
  defaultModel: string;
  showCostEstimate?: boolean;
}

const DEFAULT_THREAD_ID = "default";
const DEFAULT_AGENT_COLOR = "#3a5bd7";

export function PersonaApp(props: PersonaAppProps): ReactNode {
  const { workspaceName, ownerEmail = "", defaultModel, showCostEstimate = false } = props;

  const [view, setView] = useState<PersonaView>("home");
  const [threadTitle, setThreadTitle] = useState<string>("New task");
  const [recentThreads, setRecentThreads] = useState<PersonaRecentThread[]>([]);
  const lastSubmitRef = useRef<{ text: string; at: number } | null>(null);

  // Persisted-in-memory persona settings. The deployed agent will pick
  // up changes for the duration of the session; durable persistence to
  // the orchestrator's DO is a follow-up.
  const [personaSettings, setPersonaSettings] = useState<PersonaSettings>(defaultPersonaSettings);
  const updatePersonaSettings = useCallback((patch: Partial<PersonaSettings>) => {
    setPersonaSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  // Skills come from the bundled registry (Cloudflare pack preloaded).
  // Manual toggle / pin lives in component state for now; durable
  // persistence is a follow-up.
  const [skillOverrides, setSkillOverrides] = useState<Record<string, { enabled?: boolean; pinned?: boolean }>>({});
  const allSkills = useMemo<Skill[]>(() => {
    const flat = flattenPacks(builtinSkillPacks);
    return flat.map((skill) => {
      const override = skillOverrides[skill.id];
      if (!override) return skill;
      return {
        ...skill,
        enabled: override.enabled ?? skill.enabled,
        pinned: override.pinned ?? skill.pinned
      };
    });
  }, [skillOverrides]);
  const activeSkills = useMemo(() => allSkills.filter((s) => s.enabled), [allSkills]);
  const pendingSkills = useMemo(() => allSkills.filter((s) => !s.enabled), [allSkills]);
  const toggleSkill = useCallback((id: string, enabled: boolean) => {
    setSkillOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), enabled } }));
  }, []);
  const pinSkill = useCallback((id: string, pinned: boolean) => {
    setSkillOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), pinned } }));
  }, []);

  const agent = useAgent({
    agent: "PersonalChatAgent",
    name: DEFAULT_THREAD_ID
  });

  const {
    messages,
    sendMessage,
    stop,
    clearError,
    status,
    error,
    isStreaming,
    isServerStreaming
  } = useAgentChat({
    agent,
    // Persona's normie default: feed every tool result back to the
    // model so the assistant produces a final answer without manual
    // continuation. The legacy chat (?shell=legacy) keeps the
    // per-tool approval flow for power users.
    autoContinueAfterToolResult: true,
    resume: false
  });

  const connected = agent.readyState === WebSocket.OPEN;
  const busy = status === "submitted" || status === "streaming" || isStreaming || isServerStreaming;

  // Promote to thread view once a user message lands, but ONLY when
  // the user is currently on the home screen. Otherwise the effect
  // would clobber any sidebar navigation (Library / Skills / Settings /
  // …) the moment the messages array updated.
  useEffect(() => {
    if (view !== "home") return;
    if (messages.some((message) => message.role === "user" && (message.parts ?? []).length > 0)) {
      setView("thread");
    }
  }, [messages, view]);

  // Keep the recent-threads chip in the sidebar in sync with the
  // current single-room thread title.
  useEffect(() => {
    const hasMessages = messages.length > 0;
    if (!hasMessages) {
      setRecentThreads([]);
      return;
    }
    setRecentThreads([
      {
        id: DEFAULT_THREAD_ID,
        title: threadTitle,
        agentName: workspaceName,
        agentColor: DEFAULT_AGENT_COLOR,
        lastUpdated: "Now"
      }
    ]);
  }, [messages.length, threadTitle, workspaceName]);

  const workingDoc = useMemo(() => extractWorkingDoc(messages), [messages]);

  // Stuck-state watchdog: when the agent has been "busy" for a long
  // time without any new content, surface a recovery banner so the
  // user can stop or retry. Resets every time the message count or
  // content fingerprint changes.
  const [stuck, setStuck] = useState(false);
  const contentSignature = useMemo(() => {
    let total = 0;
    for (const message of messages) {
      const parts = (message as { parts?: unknown[] }).parts ?? [];
      for (const part of parts) {
        if (part && typeof part === "object" && "text" in part && typeof (part as { text: unknown }).text === "string") {
          total += ((part as { text: string }).text ?? "").length;
        }
      }
    }
    return \`\${messages.length}:\${total}\`;
  }, [messages]);
  useEffect(() => {
    setStuck(false);
    if (!busy) return;
    const timer = setTimeout(() => setStuck(true), 30_000);
    return () => clearTimeout(timer);
  }, [busy, contentSignature]);

  const submitNewTask = useCallback(
    (prompt: string) => {
      if (!prompt.trim() || busy) return;
      lastSubmitRef.current = { text: prompt, at: Date.now() };
      if (threadTitle === "New task") {
        const firstLine = prompt.split("\\n")[0] ?? prompt;
        const trimmed = firstLine.length > 64 ? \`\${firstLine.slice(0, 61)}…\` : firstLine;
        setThreadTitle(trimmed);
      }
      clearError();
      sendMessage({ text: prompt });
      setView("thread");
    },
    [busy, clearError, sendMessage, threadTitle]
  );

  const sidebarRecent: PersonaThreadSummary[] = recentThreads.map((thread) => ({
    id: thread.id,
    title: thread.title,
    agentName: thread.agentName,
    agentColor: thread.agentColor,
    status: busy ? "live" : "complete",
    lastUpdated: thread.lastUpdated,
    artifactCount: 0
  }));

  const artifacts: PersonaArtifact[] = [];

  const renderCenter = () => {
    switch (view) {
      case "home":
        return (
          <PersonaHome
            recentThreads={recentThreads}
            disabled={!connected}
            draftStorageKey="openthink:persona:home-draft"
            onSubmit={(prompt, _mode, _attachments) => submitNewTask(prompt)}
            onSelectThread={() => setView("thread")}
          />
        );
      case "library":
        // LibraryPage owns its own narrower PersonaArtifact union (no
        // "diff" kind). Once we wire real artifact extraction in
        // PersonaApp we'll project shell-shaped artifacts into the
        // library shape here.
        return <LibraryPage artifacts={[]} />;
      case "learning":
        return <LearningPanel />;
      case "skills":
        return (
          <SkillsPage
            activeSkills={activeSkills}
            pendingSkills={pendingSkills}
            onToggleSkill={toggleSkill}
            onPinSkill={pinSkill}
          />
        );
      case "settings":
        return (
          <SettingsPage
            settings={personaSettings}
            onUpdate={updatePersonaSettings}
          />
        );
      case "search":
        // Search opens as a modal overlay rather than a routed page.
        // Show the home screen behind the palette so dismissing returns
        // the user to a useful surface.
        return (
          <PersonaHome
            recentThreads={recentThreads}
            disabled={!connected}
            onSubmit={(prompt, _mode, _attachments) => submitNewTask(prompt)}
            onSelectThread={() => setView("thread")}
          />
        );
      case "thread":
      default: {
        const threadProps: Parameters<typeof PersonaThreadFeed>[0] = {
          messages: messages as UIMessage[],
          status,
          busy,
          threadTitle,
          agentName: workspaceName,
          agentColor: DEFAULT_AGENT_COLOR,
          modelLabel: defaultModel,
          onTitleChange: setThreadTitle,
          onSelectFollowUp: (text: string) => submitNewTask(text)
        };
        if (workingDoc) threadProps.workingDoc = workingDoc;
        return <PersonaThreadFeed {...threadProps} />;
      }
    }
  };

  const composerProps: Parameters<typeof PersonaComposer>[0] = {
    busy,
    disabled: !connected,
    showCostEstimate,
    draftStorageKey: "openthink:persona:thread-draft",
    onSubmit: (text: string) => submitNewTask(text)
  };
  if (showCostEstimate) composerProps.costEstimate = "~$0.04";
  if (busy) composerProps.onStop = () => void stop();
  const composer = <PersonaComposer {...composerProps} />;

  const shellProps: Parameters<typeof PersonaShell>[0] = {
    workspaceName,
    ownerEmail,
    recentThreads: sidebarRecent,
    artifacts,
    workingDoc: "",
    pendingLearningCount: 0,
    pendingSkillsCount: 0,
    onSelectThread: () => setView("thread"),
    onNewTask: () => setView("home"),
    onOpenSearch: () => setView("search"),
    onOpenLibrary: () => setView("library"),
    onOpenLearning: () => setView("learning"),
    onOpenSkills: () => setView("skills"),
    onOpenSettings: () => setView("settings"),
    threadView: renderCenter(),
    composer: view === "thread" ? composer : null
  };
  if (view === "thread") shellProps.activeThreadId = DEFAULT_THREAD_ID;

  return (
    <>
      <PersonaShell {...shellProps} />
      {view === "search" ? (
        <SearchPalette
          threads={[]}
          artifacts={[]}
          memories={[]}
          onClose={() => setView("home")}
          onSelectThread={(id) => {
            setView("thread");
            void id;
          }}
          onSelectArtifact={() => setView("library")}
          onSelectMemory={() => setView("learning")}
        />
      ) : null}
      {stuck && busy ? (
        <div className="persona-app__stuck" role="status">
          <span>
            The agent has been working on this for a while. Stop and try again, or wait it out.
          </span>
          <button type="button" onClick={() => void stop()}>
            Stop
          </button>
        </div>
      ) : null}
      {error ? (
        <div className="persona-app__error" role="alert">
          <span>{error.message || String(error)}</span>
          <button type="button" onClick={() => clearError()}>
            Dismiss
          </button>
        </div>
      ) : null}
    </>
  );
}

function PersonaSimplePage({ title, description }: { title: string; description: string }) {
  return (
    <section className="persona-page" aria-label={title}>
      <header className="persona-page__header">
        <h1>{title}</h1>
        <p className="persona-page__subtitle">{description}</p>
      </header>
    </section>
  );
}

interface LearningSuggestion {
  id: string;
  kind: "skill" | "rubric" | "prompt";
  status: "pending" | "applied" | "rejected";
  summary?: string;
  name?: string;
  rationale?: string;
  confidence: number;
}

function LearningPanel() {
  const [suggestions, setSuggestions] = useState<LearningSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/learning/pending")
      .then(async (res) => {
        if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
        const body = (await res.json()) as { suggestions?: LearningSuggestion[] };
        if (!cancelled) setSuggestions(body.suggestions ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function decide(id: string, decision: "applied" | "rejected") {
    try {
      await fetch("/learning/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision })
      });
      setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, status: decision } : s)));
    } catch {
      // best-effort; user can retry
    }
  }

  const pending = suggestions.filter((s) => s.status === "pending");

  return (
    <section className="persona-page persona-learning" aria-label="Learning">
      <header className="persona-page__header">
        <h1>Learning</h1>
        <p className="persona-page__subtitle">
          Pending lessons your agent has captured. Approve them to update its persona.
        </p>
      </header>
      {loading ? <p className="persona-page__empty">Loading…</p> : null}
      {error ? (
        <p className="persona-page__error" role="alert">
          Couldn’t load suggestions yet. The agent will surface them as it runs.
        </p>
      ) : null}
      {!loading && !error && pending.length === 0 ? (
        <p className="persona-page__empty">
          No pending lessons yet. After a few task runs, the agent will propose skills, rubrics, and
          prompt edits here.
        </p>
      ) : null}
      <ul className="persona-learning__list">
        {pending.map((s) => (
          <li key={s.id} className="persona-learning__row">
            <div className="persona-learning__row-text">
              <span className="persona-learning__kind">{s.kind}</span>
              <strong>{s.name ?? s.summary ?? "Suggested change"}</strong>
              {s.rationale ? <small>{s.rationale}</small> : null}
            </div>
            <div className="persona-learning__row-actions">
              <button type="button" onClick={() => decide(s.id, "applied")}>
                Accept
              </button>
              <button type="button" onClick={() => decide(s.id, "rejected")} className="ghost">
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function extractWorkingDoc(messages: UIMessage[]): string | undefined {
  // Look for the most recent assistant message that has a working-doc
  // chip — we encode this as a metadata field if present, otherwise
  // we fall back to a sniff for a leading "Working doc:" line.
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message) continue;
    const metadata = (message as { metadata?: Record<string, unknown> }).metadata;
    if (metadata && typeof metadata.workingDoc === "string" && metadata.workingDoc.trim()) {
      return metadata.workingDoc.trim();
    }
  }
  return undefined;
}
`;

// === Source: starters/personal-agent/src/persona-pages/persona-home.tsx ===
export const PERSONA_HOME_TSX = `/**
 * Persona Home — the "What do you need done?" entry surface.
 *
 * This is the empty-state for the center column of the Persona shell.
 * It shows a single big textarea, a row of quick-action chips, a small
 * Auto / Plan first / Train mode toggle, an attachment button, and
 * below the fold a Recent threads grid and a Start-from-a-template
 * carousel.
 *
 * The component is presentational: it surfaces a submit callback that
 * the surrounding Persona shell wires into \`useAgentChat.sendMessage\`,
 * so it can be unit-tested without React DOM.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode
} from "react";

export type PersonaComposeMode = "auto" | "plan" | "train";

export interface PersonaQuickAction {
  id: string;
  label: string;
  prompt: string;
  emoji: string;
}

export interface PersonaTemplate {
  id: string;
  label: string;
  description: string;
  prompt: string;
  emoji: string;
  agentColor?: string;
}

export interface PersonaRecentThread {
  id: string;
  title: string;
  agentName: string;
  agentColor: string;
  lastUpdated: string;
}

export interface PersonaHomeProps {
  headline?: string | undefined;
  recentThreads: PersonaRecentThread[];
  quickActions?: PersonaQuickAction[] | undefined;
  templates?: PersonaTemplate[] | undefined;
  defaultMode?: PersonaComposeMode | undefined;
  disabled?: boolean | undefined;
  /** localStorage key for textarea draft persistence. When set, the
   *  textarea is rehydrated on mount and writes mirror to the same
   *  key, so navigating to Library / Skills / Settings and returning
   *  keeps the draft. Cleared on successful submit. */
  draftStorageKey?: string | undefined;
  onSubmit: (prompt: string, mode: PersonaComposeMode, attachments: File[]) => void;
  onSelectThread?: ((id: string) => void) | undefined;
}

export const DEFAULT_QUICK_ACTIONS: PersonaQuickAction[] = [
  {
    id: "write",
    emoji: "📝",
    label: "Write something",
    prompt: "Help me draft "
  },
  {
    id: "research",
    emoji: "🔍",
    label: "Research a topic",
    prompt: "Research the following topic and produce a structured brief: "
  },
  {
    id: "image",
    emoji: "🖼️",
    label: "Generate images",
    prompt: "Generate an image of "
  },
  {
    id: "browse",
    emoji: "🌐",
    label: "Browse & summarize",
    prompt: "Browse to the URL below and summarize the key points: "
  },
  {
    id: "email",
    emoji: "✉️",
    label: "Draft an email",
    prompt: "Draft an email about "
  },
  {
    id: "more",
    emoji: "⋯",
    label: "More",
    prompt: ""
  }
];

export const DEFAULT_TEMPLATES: PersonaTemplate[] = [
  {
    id: "coder",
    emoji: "💻",
    label: "Coder",
    description: "Pair-programs with code search, edits, and tests.",
    prompt: "Help me ship a small feature. Start by asking what to build.",
    agentColor: "#3a5bd7"
  },
  {
    id: "researcher",
    emoji: "🔬",
    label: "Researcher",
    description: "Multi-source web research with a written brief.",
    prompt: "Be my research analyst. Ask what to investigate.",
    agentColor: "#176f49"
  },
  {
    id: "writer",
    emoji: "✍️",
    label: "Writer",
    description: "Drafts, edits, and tightens long-form prose.",
    prompt: "Be my writing partner. Ask what we're drafting and the tone.",
    agentColor: "#b84d12"
  },
  {
    id: "browser",
    emoji: "🧭",
    label: "Browser",
    description: "Browses real websites and acts inside them.",
    prompt: "Browse the web for me. Ask which site to visit and what to do.",
    agentColor: "#7c3aed"
  },
  {
    id: "messenger",
    emoji: "💬",
    label: "Messenger",
    description: "Drafts emails, DMs, and replies in your voice.",
    prompt: "Help me write a message. Ask the recipient, tone, and goal.",
    agentColor: "#0ea5e9"
  },
  {
    id: "planner",
    emoji: "📋",
    label: "Planner",
    description: "Breaks goals into steps and tracks them.",
    prompt: "Plan a project with me. Ask the goal, deadline, and constraints.",
    agentColor: "#e11d48"
  }
];

const MODES: ReadonlyArray<{ id: PersonaComposeMode; label: string; hint: string }> = [
  { id: "auto", label: "Auto", hint: "Default — agent decides plan vs act." },
  { id: "plan", label: "Plan first", hint: "Show a plan before acting." },
  { id: "train", label: "Train", hint: "Save this as a reusable plan." }
];

export function PersonaHome(props: PersonaHomeProps): ReactNode {
  const {
    headline = "What do you need done?",
    recentThreads,
    quickActions = DEFAULT_QUICK_ACTIONS,
    templates = DEFAULT_TEMPLATES,
    defaultMode = "auto",
    disabled = false,
    draftStorageKey,
    onSubmit,
    onSelectThread
  } = props;

  const [prompt, setPrompt] = useState<string>(() => {
    if (!draftStorageKey || typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(draftStorageKey) ?? "";
    } catch {
      return "";
    }
  });
  const [mode, setMode] = useState<PersonaComposeMode>(defaultMode);
  const [attachments, setAttachments] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Persist draft across navigations so jumping to Library / Settings
  // and back doesn't lose what the user was typing.
  useEffect(() => {
    if (!draftStorageKey || typeof window === "undefined") return;
    try {
      if (prompt) window.localStorage.setItem(draftStorageKey, prompt);
      else window.localStorage.removeItem(draftStorageKey);
    } catch {
      // ignore
    }
  }, [prompt, draftStorageKey]);

  // Auto-grow the textarea up to a sensible max height.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const target = Math.min(Math.max(el.scrollHeight, 64), 240);
    el.style.height = \`\${target}px\`;
  }, [prompt]);

  const submit = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed, mode, attachments);
    setPrompt("");
    setAttachments([]);
    if (draftStorageKey && typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(draftStorageKey);
      } catch {
        // ignore
      }
    }
  }, [prompt, mode, attachments, disabled, onSubmit, draftStorageKey]);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    if (event.metaKey || event.ctrlKey || !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  function pickQuickAction(action: PersonaQuickAction) {
    setPrompt((current) => {
      if (!action.prompt) return current;
      const base = current.trim();
      const join = base.length === 0 ? "" : \`\${base}\\n\\n\`;
      return \`\${join}\${action.prompt}\`;
    });
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function pickTemplate(template: PersonaTemplate) {
    setPrompt(template.prompt);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length > 0) setAttachments((prev) => [...prev, ...files]);
    event.target.value = "";
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <section className="persona-home" aria-label="New task">
      <header className="persona-home__hero">
        <h1>{headline}</h1>
      </header>

      <form
        className="persona-home__form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="persona-home__input-card">
          <textarea
            ref={textareaRef}
            className="persona-home__textarea"
            placeholder="Type a task, or paste a URL, idea, or screenshot…"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Task description"
            disabled={disabled}
            rows={2}
          />

          <div className="persona-home__input-row">
            <div className="persona-home__attach">
              <button
                type="button"
                className="persona-home__attach-btn"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach files"
                disabled={disabled}
              >
                +
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={onFileChange}
                style={{ display: "none" }}
              />
              {attachments.length > 0 && (
                <ul className="persona-home__attachments" aria-label="Attached files">
                  {attachments.map((file, index) => (
                    <li key={\`\${file.name}-\${index}\`} className="persona-home__attachment">
                      <span>{file.name}</span>
                      <button
                        type="button"
                        className="persona-home__attachment-remove"
                        aria-label={\`Remove \${file.name}\`}
                        onClick={() => removeAttachment(index)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="persona-home__mode" role="group" aria-label="Compose mode">
              {MODES.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={\`persona-home__mode-btn\${mode === option.id ? " is-active" : ""}\`}
                  onClick={() => setMode(option.id)}
                  aria-pressed={mode === option.id}
                  title={option.hint}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <button
              type="submit"
              className="persona-home__send"
              disabled={disabled || prompt.trim().length === 0}
              aria-label="Send task"
            >
              ↑
            </button>
          </div>
        </div>

        <div className="persona-home__chips" aria-label="Quick actions">
          {quickActions.map((action) => (
            <button
              type="button"
              key={action.id}
              className="persona-home__chip"
              onClick={() => pickQuickAction(action)}
              disabled={disabled && action.prompt.length > 0}
            >
              <span className="persona-home__chip-emoji" aria-hidden="true">
                {action.emoji}
              </span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </form>

      {recentThreads.length > 0 && (
        <section className="persona-home__section" aria-labelledby="persona-home-recent">
          <header className="persona-home__section-header">
            <h2 id="persona-home-recent">Recent threads</h2>
          </header>
          <ul className="persona-home__recent-grid">
            {recentThreads.slice(0, 4).map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  className="persona-home__recent-card"
                  onClick={() => onSelectThread?.(thread.id)}
                >
                  <span className="persona-home__recent-dot" style={{ background: thread.agentColor }} />
                  <strong className="persona-home__recent-title">{thread.title}</strong>
                  <small className="persona-home__recent-meta">
                    <span>{thread.agentName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{thread.lastUpdated}</span>
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="persona-home__section" aria-labelledby="persona-home-templates">
        <header className="persona-home__section-header">
          <h2 id="persona-home-templates">Start from a template</h2>
          <p className="persona-home__section-hint">
            Curated starter agents with sane defaults — every template is yours to edit.
          </p>
        </header>
        <ul className="persona-home__templates" aria-label="Template carousel">
          {templates.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                className="persona-home__template"
                onClick={() => pickTemplate(template)}
                disabled={disabled}
              >
                <span
                  className="persona-home__template-emoji"
                  aria-hidden="true"
                  style={template.agentColor ? { background: hexWithAlpha(template.agentColor, 0.12) } : undefined}
                >
                  {template.emoji}
                </span>
                <span className="persona-home__template-body">
                  <strong>{template.label}</strong>
                  <small>{template.description}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  // Best-effort tint of the template emoji backdrop; falls back gracefully
  // for non-#rrggbb inputs (we just return the input string as-is).
  if (!hex.startsWith("#") || (hex.length !== 7 && hex.length !== 4)) return hex;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  } else {
    r = parseInt(hex.slice(1, 2).repeat(2), 16);
    g = parseInt(hex.slice(2, 3).repeat(2), 16);
    b = parseInt(hex.slice(3, 4).repeat(2), 16);
  }
  if ([r, g, b].some((channel) => Number.isNaN(channel))) return hex;
  return \`rgba(\${r}, \${g}, \${b}, \${alpha})\`;
}
`;

// === Source: starters/personal-agent/src/persona-pages/persona-thread-feed.tsx ===
export const PERSONA_THREAD_FEED_TSX = `/**
 * Persona Thread Feed — message bubbles, agent reasoning collapsible,
 * working doc chip, tool chips, follow-up suggestion chips, and message
 * actions.
 *
 * Replaces the legacy single-pane \`<Chat/>\` body for the Persona shell.
 * Receives the \`useAgentChat\` outputs as props so it stays free of
 * transport details and is easy to unit test.
 */

import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  isTextUIPart,
  isToolUIPart,
  getToolName,
  type UIMessage
} from "ai";
import {
  getToolApproval,
  getToolCallId,
  getToolInput,
  getToolOutput,
  getToolPartState
} from "@cloudflare/ai-chat/react";

const ThreadMarkdown = lazy(async () => {
  const { Streamdown } = await import("streamdown");
  return {
    default: function ThreadMarkdown({ children }: { children: string }) {
      return <Streamdown controls={false}>{children}</Streamdown>;
    }
  };
});

export type PersonaThreadStatus = "live" | "complete" | "paused";

export interface PersonaThreadFeedProps {
  messages: UIMessage[];
  status: "idle" | "submitted" | "streaming" | "ready" | "error" | "submitted-tool" | string;
  threadTitle?: string | undefined;
  agentName?: string | undefined;
  agentColor?: string | undefined;
  modelLabel?: string | undefined;
  workingDoc?: string | undefined;
  followUpSuggestions?: ReadonlyArray<string> | undefined;
  busy?: boolean | undefined;
  onTitleChange?: ((next: string) => void) | undefined;
  onSelectFollowUp?: ((text: string) => void) | undefined;
  onOpenArtifact?: ((toolName: string, toolCallId: string | undefined) => void) | undefined;
  onMessageAction?: ((action: PersonaMessageAction, messageId: string) => void) | undefined;
}

export type PersonaMessageAction =
  | "thumbs-up"
  | "thumbs-down"
  | "retry"
  | "copy"
  | "share";

const DEFAULT_FOLLOW_UPS: ReadonlyArray<string> = [
  "Walk me through what you did",
  "Try a different approach",
  "Make it shorter",
  "Show me the source"
];

export function PersonaThreadFeed(props: PersonaThreadFeedProps): ReactNode {
  const {
    messages,
    status,
    threadTitle = "Untitled thread",
    agentName = "agent",
    agentColor = "#3a5bd7",
    modelLabel,
    workingDoc,
    followUpSuggestions = DEFAULT_FOLLOW_UPS,
    busy = false,
    onTitleChange,
    onSelectFollowUp,
    onOpenArtifact,
    onMessageAction
  } = props;

  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(threadTitle);
  const [workingDocDismissed, setWorkingDocDismissed] = useState(false);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);

  useEffect(() => {
    setTitleDraft(threadTitle);
  }, [threadTitle]);

  useEffect(() => {
    // Reset working-doc dismissal when the agent posts a fresh one.
    setWorkingDocDismissed(false);
  }, [workingDoc]);

  useEffect(() => {
    const el = feedRef.current;
    if (!el || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  function onScroll() {
    const el = feedRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  const threadStatus: PersonaThreadStatus = computeStatus(status);

  const visible = useMemo(() => collectVisibleMessages(messages), [messages]);
  const showFollowUps =
    !busy &&
    visible.length > 0 &&
    visible[visible.length - 1]?.role === "assistant" &&
    followUpSuggestions.length > 0;

  return (
    <article className="persona-thread" aria-label="Conversation">
      <header className="persona-thread__header">
        <div className="persona-thread__title-block">
          {editing ? (
            <input
              type="text"
              className="persona-thread__title-input"
              value={titleDraft}
              autoFocus
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={() => {
                setEditing(false);
                const next = titleDraft.trim() || threadTitle;
                if (next !== threadTitle) onTitleChange?.(next);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setEditing(false);
                  const next = titleDraft.trim() || threadTitle;
                  if (next !== threadTitle) onTitleChange?.(next);
                } else if (event.key === "Escape") {
                  setEditing(false);
                  setTitleDraft(threadTitle);
                }
              }}
              aria-label="Edit thread title"
            />
          ) : (
            <button
              type="button"
              className="persona-thread__title"
              onClick={() => setEditing(true)}
              title="Click to rename"
            >
              {threadTitle}
            </button>
          )}
          <span className="persona-thread__agent">
            <span className="persona-thread__agent-dot" style={{ background: agentColor }} aria-hidden="true" />
            <span>{agentName}</span>
          </span>
        </div>
        <div className="persona-thread__meta">
          <span
            className={\`persona-thread__status persona-thread__status--\${threadStatus}\`}
            aria-label={\`Status \${threadStatus}\`}
          >
            <span className="persona-thread__status-dot" aria-hidden="true" />
            {threadStatus === "live" ? "Live" : threadStatus === "paused" ? "Paused" : "Complete"}
          </span>
          {modelLabel ? <span className="persona-thread__model" title="Model">{modelLabel}</span> : null}
          <button
            type="button"
            className="persona-thread__more"
            aria-label="More thread actions"
            onClick={() => onMessageAction?.("share", "thread")}
          >
            ⋯
          </button>
        </div>
        {threadStatus === "live" ? (
          <div className="persona-thread__progress" aria-hidden="true">
            <span />
          </div>
        ) : null}
      </header>

      {workingDoc && !workingDocDismissed ? (
        <div className="persona-thread__working-doc" role="note" aria-label="Working doc">
          <span className="persona-thread__working-doc-label">Working doc</span>
          <span className="persona-thread__working-doc-body">{workingDoc}</span>
          <button
            type="button"
            className="persona-thread__working-doc-close"
            aria-label="Dismiss working doc"
            onClick={() => setWorkingDocDismissed(true)}
          >
            ×
          </button>
        </div>
      ) : null}

      <div
        className="persona-thread__feed"
        ref={feedRef}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
      >
        {visible.length === 0 ? (
          <div className="persona-thread__empty">
            <p>This is a fresh thread — your first message starts the conversation.</p>
          </div>
        ) : (
          visible.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              busy={busy && message === visible[visible.length - 1]}
              onOpenArtifact={onOpenArtifact}
              onAction={onMessageAction}
            />
          ))
        )}
      </div>

      {showFollowUps ? (
        <div className="persona-thread__followups" aria-label="Suggested follow-ups">
          {followUpSuggestions.slice(0, 4).map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              className="persona-thread__followup"
              onClick={() => onSelectFollowUp?.(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function computeStatus(value: PersonaThreadFeedProps["status"]): PersonaThreadStatus {
  if (value === "streaming" || value === "submitted" || value === "submitted-tool") return "live";
  if (value === "error") return "paused";
  return "complete";
}

interface MessageBubbleProps {
  message: UIMessage;
  busy: boolean;
  onOpenArtifact?: ((toolName: string, toolCallId: string | undefined) => void) | undefined;
  onAction?: ((action: PersonaMessageAction, messageId: string) => void) | undefined;
}

function MessageBubble({ message, busy, onOpenArtifact, onAction }: MessageBubbleProps) {
  const role: "user" | "assistant" | "system" =
    message.role === "user" ? "user" : message.role === "assistant" ? "assistant" : "system";

  const parts = message.parts ?? [];
  const text = parts
    .map((part) => (isTextUIPart(part) ? part.text : ""))
    .filter(Boolean)
    .join("\\n\\n");
  const toolParts = parts.filter(isToolUIPart);
  const reasoningParts = parts.filter((part) => part.type === "reasoning");
  const reasoningText = reasoningParts
    .map((part) => (part as { text?: string }).text ?? "")
    .filter(Boolean)
    .join("\\n\\n");

  const statusLine = busy
    ? deriveStatusLine(toolParts) ?? (role === "assistant" ? "Thinking…" : undefined)
    : undefined;
  const hasAnyVisible = text.trim().length > 0 || toolParts.length > 0 || reasoningText.trim().length > 0;
  const isEmptyAssistant = role === "assistant" && !busy && !hasAnyVisible;

  return (
    <article className={\`persona-bubble persona-bubble--\${role}\`} data-role={role}>
      {role === "assistant" && reasoningText ? <ReasonedBlock text={reasoningText} /> : null}

      {statusLine ? (
        <p className="persona-bubble__status" aria-live="polite">
          <span className="persona-bubble__status-dot" aria-hidden="true" />
          {statusLine}
        </p>
      ) : null}

      {isEmptyAssistant ? (
        <p className="persona-bubble__empty">
          No response — try resending the question or asking it a different way.
        </p>
      ) : null}

      {toolParts.length > 0 ? (
        <ul className="persona-bubble__tools" aria-label="Tool activity">
          {collapseToolParts(toolParts).map((entry, index) => {
            const { name, callId, count } = entry;
            return (
              <li key={\`\${name}-\${index}\`}>
                <button
                  type="button"
                  className="persona-bubble__tool-chip"
                  onClick={() => onOpenArtifact?.(name, callId)}
                  title={count > 1 ? \`\${name} (×\${count})\` : name}
                >
                  <span className="persona-bubble__tool-emoji" aria-hidden="true">
                    {toolEmoji(name)}
                  </span>
                  <span className="persona-bubble__tool-label">
                    {toolLabel(name)}
                    {count > 1 ? \` ×\${count}\` : ""}
                  </span>
                  <ToolStateBadge part={entry.part} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {text ? (
        <div className="persona-bubble__text">
          <Suspense fallback={<p>{text}</p>}>
            <ThreadMarkdown>{text}</ThreadMarkdown>
          </Suspense>
        </div>
      ) : null}

      {role === "assistant" && !busy && text ? (
        <div className="persona-bubble__actions" aria-label="Message actions">
          <button type="button" aria-label="Thumbs up" onClick={() => onAction?.("thumbs-up", message.id)}>
            👍
          </button>
          <button type="button" aria-label="Thumbs down" onClick={() => onAction?.("thumbs-down", message.id)}>
            👎
          </button>
          <button type="button" aria-label="Retry" onClick={() => onAction?.("retry", message.id)}>
            ↩️
          </button>
          <button type="button" aria-label="Copy" onClick={() => onAction?.("copy", message.id)}>
            📋
          </button>
          <button type="button" aria-label="Share" onClick={() => onAction?.("share", message.id)}>
            🔗
          </button>
        </div>
      ) : null}
    </article>
  );
}

function ReasonedBlock({ text }: { text: string }) {
  return (
    <details className="persona-bubble__reasoned">
      <summary>Reasoned ▸</summary>
      <pre>{text}</pre>
    </details>
  );
}

function ToolStateBadge({ part }: { part: UIMessage["parts"][number] }) {
  if (!isToolUIPart(part)) return null;
  const state = String(getToolPartState(part));
  if (state === "result" || state === "output-available") {
    return <span className="persona-bubble__tool-state is-done" aria-label="done">done</span>;
  }
  if (state === "waiting-approval") {
    return <span className="persona-bubble__tool-state is-waiting" aria-label="waiting approval">approval</span>;
  }
  if (state === "denied") {
    return <span className="persona-bubble__tool-state is-denied" aria-label="denied">denied</span>;
  }
  return <span className="persona-bubble__tool-state is-running" aria-label="running">…</span>;
}

function toolEmoji(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("web") || lower.includes("search") || lower.includes("browse")) return "🌐";
  if (lower.includes("doc") || lower.includes("write") || lower.includes("edit")) return "📄";
  if (lower.includes("browser") || lower.includes("session")) return "🖥️";
  if (lower.includes("image") || lower.includes("picture")) return "🖼️";
  if (lower.includes("code") || lower.includes("script")) return "💻";
  if (lower.includes("email") || lower.includes("message")) return "✉️";
  if (lower.includes("memory") || lower.includes("recall")) return "🧠";
  if (lower.includes("goal")) return "🎯";
  return "🔧";
}

/**
 * Collapse a run of identical adjacent tool calls into a single chip
 * with a count. The agent often makes 4–5 searches in a row; rendering
 * each as its own pill is noisy.
 */
interface CollapsedToolEntry {
  name: string;
  callId: string | undefined;
  count: number;
  part: UIMessage["parts"][number];
}

function collapseToolParts(parts: UIMessage["parts"]): CollapsedToolEntry[] {
  const out: CollapsedToolEntry[] = [];
  for (const part of parts) {
    if (!isToolUIPart(part)) continue;
    const name = getToolName(part) ?? "tool";
    const callId = getToolCallId(part);
    const last = out[out.length - 1];
    if (last && last.name === name) {
      last.count += 1;
      last.part = part;
      last.callId = callId ?? last.callId;
    } else {
      out.push({ name, callId, count: 1, part });
    }
  }
  return out;
}

function toolLabel(name: string): string {
  // Strip MCP / AI-SDK prefixes before pattern-matching so a name like
  // \`mcp__cloudflare-docs__search_cloudflare_documentation\` doesn't slip
  // through as the unhelpful \`s search\`.
  const stripped = name
    .replace(/^tool[-_][a-z0-9]+[-_]/i, "")  // tool_<hash>_ or tool-<hash>-
    .replace(/^mcp[-_]+[a-z0-9-]+[-_]+/i, "") // mcp__<server>__
    .replace(/^[a-z]_+/i, ""); // single-letter MCP-server prefixes like "s_"
  const lower = stripped.toLowerCase();
  if (lower.includes("websearch") || (lower.includes("web") && lower.includes("search"))) return "web search";
  if (lower.includes("cloudflare") && lower.includes("doc")) return "cloudflare docs";
  if (lower.includes("search")) return "search";
  if (lower.includes("document") || lower.includes("doc")) return "document updated";
  if (lower.includes("browser") || lower.includes("navigate")) return "browser session";
  if (lower.includes("screenshot")) return "screenshot";
  if (lower.includes("image")) return "image";
  if (lower.includes("code") || lower.includes("sandbox")) return "code";
  if (lower.includes("fetch") || lower.includes("http")) return "fetch";
  if (lower.includes("memory")) return "memory";
  if (lower.includes("goal")) return "goal";
  if (lower.includes("file")) return "file";
  // Humanize snake / camel / kebab case.
  return stripped
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\\s+/g, " ")
    .trim()
    .toLowerCase();
}

function deriveStatusLine(toolParts: UIMessage["parts"]): string | undefined {
  for (let i = toolParts.length - 1; i >= 0; i -= 1) {
    const part = toolParts[i];
    if (!part || !isToolUIPart(part)) continue;
    const state = String(getToolPartState(part));
    if (state === "output-available" || state === "result" || state === "denied") continue;
    const toolName = getToolName(part) ?? "";
    const input = getToolInput(part);
    const inputText = typeof input === "object" && input
      ? extractFirstStringField(input as Record<string, unknown>)
      : undefined;
    const lower = toolName.toLowerCase();
    const verb = lower.includes("browse")
      ? "Browsing"
      : lower.includes("search")
        ? "Searching"
        : lower.includes("read") || lower.includes("get")
          ? "Reading"
          : "Running";
    const cleaned = inputText ? formatStatusFragment(inputText) : undefined;
    if (cleaned) return \`\${verb} \${cleaned}…\`;
    return \`\${verb} \${toolLabel(toolName)}…\`;
  }
  return undefined;
}

/**
 * Tools sometimes carry multi-line code snippets in their input (e.g.
 * \`query: "async () => { spec.paths[...]; return {...}; }"\`). Render
 * those as a single short line so the status line stays a status line
 * instead of dumping the snippet into the message body.
 */
function formatStatusFragment(input: string): string {
  const collapsed = input.replace(/\\s+/g, " ").trim();
  if (collapsed.length <= 80) return collapsed;
  return \`\${collapsed.slice(0, 77)}…\`;
}

function extractFirstStringField(value: Record<string, unknown>): string | undefined {
  const keys = ["url", "query", "q", "name", "title", "path", "search", "text"];
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  for (const v of Object.values(value)) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function collectVisibleMessages(messages: UIMessage[]): UIMessage[] {
  return messages.filter((message) => {
    const parts = message.parts ?? [];
    if (parts.length === 0) return false;
    if (message.role === "system") return false;
    const hasText = parts.some((part) => isTextUIPart(part) && part.text.trim().length > 0);
    const hasTool = parts.some((part) => isToolUIPart(part));
    const hasReasoning = parts.some((part) => part.type === "reasoning");
    return hasText || hasTool || hasReasoning;
  });
}

// Exported helpers for unit tests.
export const __test = {
  toolEmoji,
  toolLabel,
  deriveStatusLine,
  collectVisibleMessages
};
`;

// === Source: starters/personal-agent/src/persona-pages/persona-composer.tsx ===
export const PERSONA_COMPOSER_TSX = `/**
 * Persona Composer — sticky chat composer for the Persona shell.
 *
 * Matches the Home screen composer surface (mode toggle, attachments,
 * send button), but is built to live in a constrained slot — no
 * headline or templates, and the textarea auto-expands to a smaller max
 * height so the thread feed above stays visible while the user types.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode
} from "react";
import type { PersonaComposeMode } from "./persona-home";

export interface PersonaComposerProps {
  defaultMode?: PersonaComposeMode | undefined;
  disabled?: boolean | undefined;
  busy?: boolean | undefined;
  placeholder?: string | undefined;
  costEstimate?: string | undefined;
  showCostEstimate?: boolean | undefined;
  /** localStorage key for draft persistence. When set, the textarea
   *  is rehydrated on mount and writes are mirrored on every change.
   *  Cleared on successful submit. */
  draftStorageKey?: string | undefined;
  onSubmit: (text: string, mode: PersonaComposeMode, attachments: File[]) => void;
  onStop?: (() => void) | undefined;
}

export function PersonaComposer(props: PersonaComposerProps): ReactNode {
  const {
    defaultMode = "auto",
    disabled = false,
    busy = false,
    placeholder = "Reply, or paste a URL, doc, or screenshot…",
    costEstimate,
    showCostEstimate = false,
    draftStorageKey,
    onSubmit,
    onStop
  } = props;

  const [text, setText] = useState<string>(() => {
    if (!draftStorageKey || typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(draftStorageKey) ?? "";
    } catch {
      return "";
    }
  });
  const [mode, setMode] = useState<PersonaComposeMode>(defaultMode);
  const [planActive, setPlanActive] = useState(defaultMode === "plan");
  const [attachments, setAttachments] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Mirror text into localStorage as the user types so they can leave
  // the thread, navigate to Library / Settings / etc., and come back to
  // their draft intact.
  useEffect(() => {
    if (!draftStorageKey || typeof window === "undefined") return;
    try {
      if (text) window.localStorage.setItem(draftStorageKey, text);
      else window.localStorage.removeItem(draftStorageKey);
    } catch {
      // ignore quota / private-browsing errors
    }
  }, [text, draftStorageKey]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const target = Math.min(Math.max(el.scrollHeight, 44), 180);
    el.style.height = \`\${target}px\`;
  }, [text]);

  const submit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled || busy) return;
    onSubmit(trimmed, planActive ? "plan" : mode, attachments);
    setText("");
    setAttachments([]);
    if (draftStorageKey && typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(draftStorageKey);
      } catch {
        // ignore
      }
    }
  }, [text, disabled, busy, mode, planActive, attachments, onSubmit, draftStorageKey]);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      submit();
      return;
    }
    if (!event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files ? Array.from(event.target.files) : [];
    if (next.length > 0) setAttachments((prev) => [...prev, ...next]);
    event.target.value = "";
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form
      className={\`persona-composer\${busy ? " is-busy" : ""}\`}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {busy ? (
        <div className="persona-composer__busy" aria-live="polite">
          <span className="persona-composer__busy-dot" aria-hidden="true" />
          <span>Agent is working — send is paused. Press Stop to interrupt.</span>
        </div>
      ) : null}

      {attachments.length > 0 && (
        <ul className="persona-composer__attachments" aria-label="Attached files">
          {attachments.map((file, index) => (
            <li key={\`\${file.name}-\${index}\`}>
              <span>{file.name}</span>
              <button
                type="button"
                aria-label={\`Remove \${file.name}\`}
                onClick={() => removeAttachment(index)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="persona-composer__row">
        <button
          type="button"
          className="persona-composer__attach"
          onClick={() => fileRef.current?.click()}
          aria-label="Attach files"
          disabled={disabled}
        >
          +
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          onChange={onFileChange}
          style={{ display: "none" }}
        />

        <textarea
          ref={textareaRef}
          className="persona-composer__textarea"
          value={text}
          placeholder={placeholder}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Compose a reply"
          rows={1}
          disabled={disabled}
        />

        <div className="persona-composer__controls">
          <button
            type="button"
            className={\`persona-composer__plan\${planActive ? " is-active" : ""}\`}
            aria-pressed={planActive}
            onClick={() => {
              setPlanActive((prev) => !prev);
              setMode((prev) => (prev === "plan" ? "auto" : "plan"));
            }}
            title="Plan first before acting"
          >
            🧩 Plan
          </button>

          {showCostEstimate && costEstimate ? (
            <span className="persona-composer__cost" aria-label="Estimated cost">
              {costEstimate}
            </span>
          ) : null}

          {busy && onStop ? (
            <button
              type="button"
              className="persona-composer__stop"
              onClick={onStop}
              aria-label="Stop generation"
              title="Stop the agent"
            >
              <span className="persona-composer__stop-glyph" aria-hidden="true">■</span>
              <span className="persona-composer__stop-label">Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              className="persona-composer__send"
              disabled={disabled || busy || text.trim().length === 0}
              aria-label="Send (⌘/Ctrl+Enter)"
              title="⌘/Ctrl+Enter to send"
            >
              ↑
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
`;

// === Source: starters/personal-agent/src/persona-pages/library-page.tsx ===
export const PERSONA_LIBRARY_PAGE_TSX = `/**
 * Library page — grid view of every artifact in the workspace, with
 * fuzzy substring search and quick filters across type / source / age.
 *
 * Mounts inside the Persona shell when the user clicks 📚 Library.
 * Decoupled from \`persona-shell.tsx\` via a local \`PersonaArtifact\`
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
    const hay = \`\${artifact.title} \${artifact.summary ?? ""} \${artifact.kind}\`.toLowerCase();
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
                  {artifact.summary ?? \`\${artifact.kind} · updated \${artifact.updatedAt}\`}
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
`;

// === Source: starters/personal-agent/src/persona-pages/skills-page.tsx ===
export const PERSONA_SKILLS_PAGE_TSX = `/**
 * Skills page — built-in / active / pending tabs over the skill registry.
 *
 * Each skill row exposes:
 *   - an enable/disable toggle that fires \`onToggleSkill(id, enabled)\`
 *   - a pin button that fires \`onPinSkill(id, pinned)\`
 *
 * Reads the static built-in packs from \`../skills\` but lets the parent
 * pass in *runtime* skill state for the Active and Pending tabs — these
 * live in Durable Object storage and are sourced via the SkillStore.
 */
import { useMemo, useState } from "react";
import { builtinSkillPacks, flattenPacks, type Skill, type SkillPack } from "../skills";

export type SkillsTabId = "builtin" | "active" | "pending";

export interface SkillsPageProps {
  activeSkills: Skill[];
  pendingSkills: Skill[];
  onToggleSkill: (skillId: string, enabled: boolean) => void;
  onPinSkill: (skillId: string, pinned: boolean) => void;
  initialTab?: SkillsTabId;
}

const TABS: ReadonlyArray<{ id: SkillsTabId; label: string }> = [
  { id: "builtin", label: "Built-in" },
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending" }
];

export function SkillsPage(props: SkillsPageProps) {
  const [tab, setTab] = useState<SkillsTabId>(props.initialTab ?? "builtin");

  const builtinFlat = useMemo(() => flattenPacks(builtinSkillPacks), []);

  const counts = useMemo(
    () => ({
      builtin: builtinFlat.length,
      active: props.activeSkills.length,
      pending: props.pendingSkills.length
    }),
    [builtinFlat, props.activeSkills, props.pendingSkills]
  );

  return (
    <section className="persona-page persona-skills" aria-label="Skills">
      <header className="persona-page__header">
        <h1>Skills</h1>
        <p className="persona-page__subtitle">
          Reusable units of agent know-how — system prompt snippets, tool bindings, playbooks.
        </p>
      </header>

      <div className="persona-skills__tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={\`persona-skills__tab\${tab === t.id ? " is-active" : ""}\`}
            onClick={() => setTab(t.id)}
          >
            <span>{t.label}</span>
            <span className="persona-skills__count">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <div className="persona-skills__body">
        {tab === "builtin" && (
          <BuiltinList
            packs={builtinSkillPacks}
            onToggleSkill={props.onToggleSkill}
            onPinSkill={props.onPinSkill}
          />
        )}
        {tab === "active" && (
          <FlatList
            skills={props.activeSkills}
            emptyText="No skills active yet. Enable a built-in pack to get started."
            onToggleSkill={props.onToggleSkill}
            onPinSkill={props.onPinSkill}
          />
        )}
        {tab === "pending" && (
          <FlatList
            skills={props.pendingSkills}
            emptyText="No pending suggestions. The training loop will surface candidate skills here."
            onToggleSkill={props.onToggleSkill}
            onPinSkill={props.onPinSkill}
          />
        )}
      </div>
    </section>
  );
}

interface ListSharedProps {
  onToggleSkill: (skillId: string, enabled: boolean) => void;
  onPinSkill: (skillId: string, pinned: boolean) => void;
}

function BuiltinList(props: { packs: SkillPack[] } & ListSharedProps) {
  return (
    <div className="persona-skills__packs">
      {props.packs.map((pack) => (
        <section key={pack.id} className="persona-skills__pack">
          <header>
            <h2>{pack.label}</h2>
            <p>{pack.description}</p>
          </header>
          <ul className="persona-skills__list">
            {pack.skills.map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                onToggleSkill={props.onToggleSkill}
                onPinSkill={props.onPinSkill}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FlatList(
  props: { skills: Skill[]; emptyText: string } & ListSharedProps
) {
  if (props.skills.length === 0) {
    return <div className="persona-skills__empty">{props.emptyText}</div>;
  }
  return (
    <ul className="persona-skills__list">
      {props.skills.map((skill) => (
        <SkillRow
          key={skill.id}
          skill={skill}
          onToggleSkill={props.onToggleSkill}
          onPinSkill={props.onPinSkill}
        />
      ))}
    </ul>
  );
}

interface SkillRowProps extends ListSharedProps {
  skill: Skill;
}

function SkillRow({ skill, onToggleSkill, onPinSkill }: SkillRowProps) {
  return (
    <li className="persona-skills__row">
      <div className="persona-skills__row-main">
        <div className="persona-skills__row-head">
          <strong>{skill.name}</strong>
          <span className="persona-skills__source">{skill.source}</span>
        </div>
        <p>{skill.description}</p>
        {skill.tags.length > 0 && (
          <div className="persona-skills__tags">
            {skill.tags.map((tag) => (
              <span key={tag} className="persona-skills__tag">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="persona-skills__row-actions">
        <button
          type="button"
          className={\`persona-skills__pin\${skill.pinned ? " is-active" : ""}\`}
          onClick={() => onPinSkill(skill.id, !skill.pinned)}
          aria-pressed={skill.pinned}
          aria-label={skill.pinned ? "Unpin skill" : "Pin skill"}
          title={skill.pinned ? "Unpin" : "Pin"}
        >
          {skill.pinned ? "★" : "☆"}
        </button>
        <label className="persona-skills__toggle">
          <input
            type="checkbox"
            checked={skill.enabled}
            onChange={(event) => onToggleSkill(skill.id, event.target.checked)}
          />
          <span>{skill.enabled ? "On" : "Off"}</span>
        </label>
      </div>
    </li>
  );
}
`;

// === Source: starters/personal-agent/src/persona-pages/settings-page.tsx ===
export const PERSONA_SETTINGS_PAGE_TSX = `/**
 * Settings page — controls for the Persona shell's "Advanced" surface.
 *
 * Every field is fully controlled. Changes flow up through \`onUpdate\`
 * as a partial patch so the parent reducer can decide whether to persist
 * locally, sync to the Durable Object, or both.
 *
 * Sections:
 *   - Model picker (workers-ai / openrouter / anthropic / openai)
 *   - Extended thinking toggle + budget slider (1k–32k tokens)
 *   - Approval mode (full-auto / smart-auto / manual) + spend cap
 *   - Code-mode policy (off / assisted / always)
 *   - Training mode (off / review / auto-evolve)
 */
import { useId, type ChangeEvent } from "react";

export const modelProviders = ["workers-ai", "openrouter", "anthropic", "openai"] as const;
export type ModelProvider = (typeof modelProviders)[number];

export const approvalModeOptions = ["full-auto", "smart-auto", "manual"] as const;
export type SettingsApprovalMode = (typeof approvalModeOptions)[number];

export const codeModePolicies = ["off", "assisted", "always"] as const;
export type CodeModePolicy = (typeof codeModePolicies)[number];

export const trainingModes = ["off", "review", "auto-evolve"] as const;
export type TrainingMode = (typeof trainingModes)[number];

/**
 * Execution lanes — which surfaces the orchestrator may dispatch tools
 * through. Multiple may be active simultaneously. "in-worker" is always
 * on (the orchestrator's own McpAgent sub-agents). The other two are
 * advanced toggles. See \`executor.ts\` and \`smithery.ts\`.
 */
export const executionLanes = ["in-worker", "executor.sh", "smithery"] as const;
export type ExecutionLane = (typeof executionLanes)[number];

export interface PersonaSettings {
  modelProvider: ModelProvider;
  extendedThinking: boolean;
  thinkingBudgetTokens: number;
  approvalMode: SettingsApprovalMode;
  spendCapUsd: number;
  codeModePolicy: CodeModePolicy;
  trainingMode: TrainingMode;
  executionLanes: ExecutionLane[];
  smitheryApiKey: string;
  executorWorkosToken: string;
  voiceEnabled: boolean;
  voiceSilenceThreshold: number;
  voiceSilenceDurationMs: number;
  voiceInterruptThreshold: number;
}

export const defaultPersonaSettings: PersonaSettings = {
  modelProvider: "anthropic",
  extendedThinking: true,
  thinkingBudgetTokens: 8_000,
  approvalMode: "smart-auto",
  spendCapUsd: 5,
  codeModePolicy: "assisted",
  trainingMode: "review",
  executionLanes: ["in-worker"],
  smitheryApiKey: "",
  executorWorkosToken: "",
  voiceEnabled: false,
  voiceSilenceThreshold: 0.04,
  voiceSilenceDurationMs: 500,
  voiceInterruptThreshold: 0.05
};

export const THINKING_BUDGET_MIN = 1_000;
export const THINKING_BUDGET_MAX = 32_000;
export const THINKING_BUDGET_STEP = 500;

export interface SettingsPageProps {
  settings: PersonaSettings;
  onUpdate: (patch: Partial<PersonaSettings>) => void;
}

/**
 * Build a single-key patch suitable for the \`onUpdate\` callback. Extracted
 * so unit tests can verify shape without rendering React; the input handlers
 * below call into this when constructing their patches.
 */
export function buildSettingsPatch<K extends keyof PersonaSettings>(
  key: K,
  value: PersonaSettings[K]
): Partial<PersonaSettings> {
  return { [key]: value } as Partial<PersonaSettings>;
}

export function SettingsPage({ settings, onUpdate }: SettingsPageProps) {
  const baseId = useId();
  const ids = {
    model: useId(),
    thinking: useId(),
    budget: useId(),
    approval: useId(),
    spend: useId(),
    code: useId(),
    train: useId()
  };

  const onSelectChange =
    <K extends keyof PersonaSettings>(key: K) =>
    (event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      onUpdate(buildSettingsPatch(key, event.target.value as PersonaSettings[K]));
    };

  const onCheckboxChange =
    <K extends keyof PersonaSettings>(key: K) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      onUpdate(buildSettingsPatch(key, event.target.checked as PersonaSettings[K]));
    };

  const onNumberChange =
    <K extends keyof PersonaSettings>(key: K) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      if (Number.isFinite(value)) {
        onUpdate(buildSettingsPatch(key, value as PersonaSettings[K]));
      }
    };

  return (
    <section className="persona-page persona-settings" aria-label="Settings">
      <header className="persona-page__header">
        <h1>Settings</h1>
        <p className="persona-page__subtitle">
          Advanced controls. Most users can leave the defaults alone — change one knob at a time.
        </p>
      </header>

      <div className="persona-settings__group">
        <h2>Model</h2>
        <label className="persona-settings__field" htmlFor={ids.model}>
          <span>Provider</span>
          <select
            id={ids.model}
            value={settings.modelProvider}
            onChange={onSelectChange("modelProvider")}
          >
            {modelProviders.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="persona-settings__group">
        <h2>Reasoning</h2>
        <label className="persona-settings__field persona-settings__field--inline" htmlFor={ids.thinking}>
          <input
            id={ids.thinking}
            type="checkbox"
            checked={settings.extendedThinking}
            onChange={onCheckboxChange("extendedThinking")}
          />
          <span>Extended thinking</span>
        </label>
        <label className="persona-settings__field" htmlFor={ids.budget}>
          <span>
            Thinking budget · <strong>{settings.thinkingBudgetTokens.toLocaleString()} tokens</strong>
          </span>
          <input
            id={ids.budget}
            type="range"
            min={THINKING_BUDGET_MIN}
            max={THINKING_BUDGET_MAX}
            step={THINKING_BUDGET_STEP}
            value={settings.thinkingBudgetTokens}
            disabled={!settings.extendedThinking}
            onChange={onNumberChange("thinkingBudgetTokens")}
          />
        </label>
      </div>

      <div className="persona-settings__group">
        <h2>Approvals</h2>
        <label className="persona-settings__field" htmlFor={ids.approval}>
          <span>Approval mode</span>
          <select
            id={ids.approval}
            value={settings.approvalMode}
            onChange={onSelectChange("approvalMode")}
          >
            {approvalModeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="persona-settings__field" htmlFor={ids.spend}>
          <span>Spend cap (USD)</span>
          <input
            id={ids.spend}
            type="number"
            min={0}
            step={0.5}
            value={settings.spendCapUsd}
            onChange={onNumberChange("spendCapUsd")}
          />
        </label>
      </div>

      <div className="persona-settings__group">
        <h2>Code mode</h2>
        <fieldset className="persona-settings__radios">
          <legend>How aggressively to use sandboxed code execution.</legend>
          {codeModePolicies.map((option) => (
            <label key={option} className="persona-settings__radio">
              <input
                type="radio"
                name={ids.code}
                value={option}
                checked={settings.codeModePolicy === option}
                onChange={onSelectChange("codeModePolicy")}
              />
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <div className="persona-settings__group">
        <h2>Training</h2>
        <fieldset className="persona-settings__radios">
          <legend>How the agent learns from completed runs.</legend>
          {trainingModes.map((option) => (
            <label key={option} className="persona-settings__radio">
              <input
                type="radio"
                name={ids.train}
                value={option}
                checked={settings.trainingMode === option}
                onChange={onSelectChange("trainingMode")}
              />
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <div className="persona-settings__section">
        <header>
          <h3>Execution lanes</h3>
          <p>Where the orchestrator dispatches tool calls. The in-worker lane is always on; the others are advanced toggles.</p>
        </header>
        <fieldset className="persona-settings__checkboxes">
          <legend>Active lanes</legend>
          {executionLanes.map((lane) => (
            <label key={lane}>
              <input
                type="checkbox"
                checked={settings.executionLanes.includes(lane)}
                disabled={lane === "in-worker"}
                onChange={(event) => {
                  const next = event.target.checked
                    ? Array.from(new Set([...settings.executionLanes, lane]))
                    : settings.executionLanes.filter((l) => l !== lane);
                  onUpdate(buildSettingsPatch("executionLanes", next));
                }}
              />
              <span>{lane}</span>
            </label>
          ))}
        </fieldset>
        {settings.executionLanes.includes("smithery") && (
          <div className="persona-settings__field">
            <label htmlFor={\`\${baseId}-smithery-key\`}>Smithery API key</label>
            <input
              id={\`\${baseId}-smithery-key\`}
              type="password"
              value={settings.smitheryApiKey}
              onChange={(event) =>
                onUpdate(buildSettingsPatch("smitheryApiKey", event.target.value))
              }
              placeholder="sm_…"
              autoComplete="off"
            />
            <small>Stored as the OPEN_THINK_SMITHERY_API_KEY Worker secret. Used to mount registry servers as MCP clients.</small>
          </div>
        )}
        {settings.executionLanes.includes("executor.sh") && (
          <div className="persona-settings__field">
            <label htmlFor={\`\${baseId}-executor-token\`}>executor.sh WorkOS token</label>
            <input
              id={\`\${baseId}-executor-token\`}
              type="password"
              value={settings.executorWorkosToken}
              onChange={(event) =>
                onUpdate(buildSettingsPatch("executorWorkosToken", event.target.value))
              }
              placeholder="ws_…"
              autoComplete="off"
            />
            <small>Obtained by signing in at executor.sh. Stored as OPEN_THINK_EXECUTOR_WORKOS_TOKEN.</small>
          </div>
        )}
      </div>

      <div className="persona-settings__section">
        <header>
          <h3>Voice</h3>
          <p>Talk to your agent. Mic stays disabled until you grant permission; the WebSocket only opens once permission is granted (Agents SDK v0.12.4 connection control).</p>
        </header>
        <label className="persona-settings__toggle">
          <input
            type="checkbox"
            checked={settings.voiceEnabled}
            onChange={(event) =>
              onUpdate(buildSettingsPatch("voiceEnabled", event.target.checked))
            }
          />
          <span>Enable voice console</span>
        </label>
        {settings.voiceEnabled && (
          <div className="persona-settings__voice-tuning">
            <label className="persona-settings__field">
              <span>Silence threshold</span>
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.01}
                value={settings.voiceSilenceThreshold}
                onChange={(event) =>
                  onUpdate(
                    buildSettingsPatch(
                      "voiceSilenceThreshold",
                      Number.parseFloat(event.target.value)
                    )
                  )
                }
              />
              <small>{settings.voiceSilenceThreshold.toFixed(2)} — lower = pickier mic.</small>
            </label>
            <label className="persona-settings__field">
              <span>End turn after silence (ms)</span>
              <input
                type="range"
                min={100}
                max={3000}
                step={50}
                value={settings.voiceSilenceDurationMs}
                onChange={(event) =>
                  onUpdate(
                    buildSettingsPatch(
                      "voiceSilenceDurationMs",
                      Number.parseInt(event.target.value, 10)
                    )
                  )
                }
              />
              <small>{settings.voiceSilenceDurationMs} ms</small>
            </label>
            <label className="persona-settings__field">
              <span>Interrupt threshold</span>
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.01}
                value={settings.voiceInterruptThreshold}
                onChange={(event) =>
                  onUpdate(
                    buildSettingsPatch(
                      "voiceInterruptThreshold",
                      Number.parseFloat(event.target.value)
                    )
                  )
                }
              />
              <small>{settings.voiceInterruptThreshold.toFixed(2)} — how loud you have to talk to barge in.</small>
            </label>
          </div>
        )}
      </div>
    </section>
  );
}
`;

// === Source: starters/personal-agent/src/persona-pages/search-palette.tsx ===
export const PERSONA_SEARCH_PALETTE_TSX = `/**
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
  items.filter((t) => matchesQuery(\`\${t.title} \${t.agentName}\`, q));
export const filterArtifacts = (items: SearchArtifactHit[], q: string) =>
  items.filter((a) => matchesQuery(\`\${a.title} \${a.kind}\`, q));
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
              className={\`persona-search__tab\${tab === t.id ? " is-active" : ""}\`}
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
                  <li key={t.id} className={\`persona-search__row\${index === props.cursor ? " is-active" : ""}\`}>
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
        <li key={item.id} className={\`persona-search__row\${index === props.cursor ? " is-active" : ""}\`}>
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
`;

// === Source: starters/personal-agent/src/persona-pages/index.ts ===
export const PERSONA_PAGES_INDEX_TS = `/**
 * Barrel exports for the Persona shell's supporting pages.
 *
 * These pages mount inside the agent's web UI in response to the
 * sidebar callbacks (\`onOpenLibrary\`, \`onOpenSkills\`, \`onOpenSettings\`,
 * \`onOpenSearch\`) on the main \`PersonaShell\` component.
 */
export {
  LibraryPage,
  bucketFor,
  filterArtifacts,
  type LibraryAgeBucket,
  type LibraryArtifactKind,
  type LibraryArtifactSource,
  type LibraryFilters,
  type LibraryPageProps,
  type PersonaArtifact
} from "./library-page";

export {
  SkillsPage,
  type SkillsPageProps,
  type SkillsTabId
} from "./skills-page";

export {
  SettingsPage,
  THINKING_BUDGET_MAX,
  THINKING_BUDGET_MIN,
  THINKING_BUDGET_STEP,
  approvalModeOptions,
  buildSettingsPatch,
  codeModePolicies,
  defaultPersonaSettings,
  modelProviders,
  trainingModes,
  type CodeModePolicy,
  type ModelProvider,
  type PersonaSettings,
  type SettingsApprovalMode,
  type SettingsPageProps,
  type TrainingMode
} from "./settings-page";

export {
  SearchPalette,
  ageBucket,
  filterArtifacts as filterSearchArtifacts,
  filterMemories,
  filterThreads,
  groupByAge,
  matchesQuery,
  type AgeBucket,
  type SearchArtifactHit,
  type SearchMemoryHit,
  type SearchPaletteProps,
  type SearchTab,
  type SearchThreadHit
} from "./search-palette";

export {
  TrainPlanEditor,
  addStep,
  removeStep,
  reorderSteps,
  updateStep,
  type PlanStep,
  type PlanStepStatus,
  type TrainPlanEditorProps,
  type TrainPlanMode
} from "./train-plan-editor";

export {
  VoiceConsole,
  useMicPermission,
  type UseVoiceAgentInput,
  type UseVoiceAgentOutput,
  type VoiceConsoleProps,
  type VoiceConsoleSettings
} from "./voice-console";

export {
  InvocationsPage,
  type InvocationViewModel,
  type InvocationsPageProps,
  type InvocationsSummaryModel
} from "./invocations-page";

export {
  KnowledgePage,
  type KnowledgeKind,
  type KnowledgePageProps,
  type KnowledgeView
} from "./knowledge-page";

export {
  PersonaHome,
  DEFAULT_QUICK_ACTIONS,
  DEFAULT_TEMPLATES,
  type PersonaComposeMode,
  type PersonaHomeProps,
  type PersonaQuickAction,
  type PersonaRecentThread,
  type PersonaTemplate
} from "./persona-home";

export {
  PersonaThreadFeed,
  type PersonaMessageAction,
  type PersonaThreadFeedProps,
  type PersonaThreadStatus
} from "./persona-thread-feed";

export {
  PersonaComposer,
  type PersonaComposerProps
} from "./persona-composer";
`;

// === Source: starters/personal-agent/src/persona-pages/persona-pages.css ===
export const PERSONA_PAGES_CSS = `/*
 * Persona pages — styles for Library, Skills, Settings, and the global
 * Search palette. Follows the same convention as persona-shell.css:
 * every visible color goes through a CSS variable with a fallback so
 * the pages render standalone when dropped into a different app.
 */

.persona-page {
  --persona-bg: var(--surface, #f5f5f4);
  --persona-surface: var(--surface-strong, #ffffff);
  --persona-line: var(--line, rgba(21, 23, 22, 0.08));
  --persona-line-strong: var(--line-strong, rgba(21, 23, 22, 0.18));
  --persona-ink: var(--ink, #15151a);
  --persona-ink-soft: var(--ink-soft, #2f2f37);
  --persona-muted: var(--muted, #5e5e66);
  --persona-accent: var(--accent, #3a5bd7);
  --persona-radius: 12px;

  display: grid;
  gap: 18px;
  padding: 28px 32px;
  background: var(--persona-bg);
  color: var(--persona-ink);
  min-height: 100%;
  font-family: inherit;
}

.persona-page__header h1 {
  margin: 0;
  font-size: 1.45rem;
  letter-spacing: -0.01em;
}

.persona-page__subtitle {
  margin: 4px 0 0;
  color: var(--persona-muted);
  font-size: 0.92rem;
  max-width: 60ch;
}

/* === Library =============================================================== */

.persona-library__toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) repeat(3, auto);
  gap: 10px;
  align-items: center;
}

.persona-library__search {
  padding: 8px 12px;
  border: 1px solid var(--persona-line);
  border-radius: 8px;
  background: var(--persona-surface);
  color: var(--persona-ink);
  font-size: 0.92rem;
}

.persona-library__filter {
  display: inline-grid;
  grid-template-columns: auto auto;
  gap: 6px;
  align-items: center;
  font-size: 0.82rem;
  color: var(--persona-muted);
}

.persona-library__filter select {
  padding: 5px 8px;
  border: 1px solid var(--persona-line);
  border-radius: 6px;
  background: var(--persona-surface);
  color: var(--persona-ink);
  font-size: 0.85rem;
}

.persona-library__meta {
  font-size: 0.78rem;
  color: var(--persona-muted);
}

.persona-library__empty {
  padding: 36px;
  border: 1px dashed var(--persona-line-strong);
  border-radius: var(--persona-radius);
  background: var(--persona-surface);
  color: var(--persona-muted);
  text-align: center;
}

.persona-library__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.persona-library__card {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid var(--persona-line);
  border-radius: var(--persona-radius);
  background: var(--persona-surface);
  text-align: left;
  cursor: pointer;
  color: inherit;
  width: 100%;
  transition: border-color 0.12s ease;
}

.persona-library__card:hover {
  border-color: var(--persona-line-strong);
}

.persona-library__card > header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.persona-library__card strong {
  flex: 1 1 auto;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 0.92rem;
}

.persona-library__kind {
  font-size: 1rem;
}

.persona-library__version {
  font-size: 0.7rem;
  color: var(--persona-muted);
  font-variant-numeric: tabular-nums;
}

.persona-library__summary {
  margin: 0;
  font-size: 0.82rem;
  color: var(--persona-ink-soft);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.persona-library__card > footer {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  color: var(--persona-muted);
}

/* === Skills ================================================================ */

.persona-skills__tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--persona-line);
}

.persona-skills__tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  background: transparent;
  border-bottom: 2px solid transparent;
  color: var(--persona-ink-soft);
  font-size: 0.88rem;
  cursor: pointer;
}

.persona-skills__tab.is-active {
  color: var(--persona-accent);
  border-bottom-color: var(--persona-accent);
}

.persona-skills__count {
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(21, 23, 22, 0.08);
  color: var(--persona-muted);
}

.persona-skills__body {
  display: grid;
  gap: 16px;
}

.persona-skills__pack header h2 {
  margin: 0;
  font-size: 1rem;
}

.persona-skills__pack header p {
  margin: 2px 0 0;
  color: var(--persona-muted);
  font-size: 0.84rem;
}

.persona-skills__list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.persona-skills__row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--persona-line);
  border-radius: 10px;
  background: var(--persona-surface);
  align-items: center;
}

.persona-skills__row-head {
  display: flex;
  gap: 8px;
  align-items: baseline;
}

.persona-skills__row-head strong {
  font-size: 0.9rem;
}

.persona-skills__source {
  font-size: 0.7rem;
  color: var(--persona-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.persona-skills__row p {
  margin: 2px 0 0;
  color: var(--persona-ink-soft);
  font-size: 0.84rem;
  line-height: 1.4;
}

.persona-skills__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.persona-skills__tag {
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(58, 91, 215, 0.08);
  color: var(--persona-accent);
}

.persona-skills__row-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.persona-skills__pin {
  border: none;
  background: transparent;
  color: var(--persona-muted);
  font-size: 1rem;
  cursor: pointer;
}

.persona-skills__pin.is-active {
  color: var(--persona-accent);
}

.persona-skills__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: var(--persona-ink-soft);
  cursor: pointer;
}

.persona-skills__empty {
  padding: 24px;
  border: 1px dashed var(--persona-line-strong);
  border-radius: var(--persona-radius);
  color: var(--persona-muted);
  text-align: center;
}

/* === Settings ============================================================== */

.persona-settings__group {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--persona-line);
  border-radius: var(--persona-radius);
  background: var(--persona-surface);
}

.persona-settings__group h2 {
  margin: 0;
  font-size: 0.92rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--persona-muted);
}

.persona-settings__field {
  display: grid;
  gap: 4px;
  font-size: 0.88rem;
  color: var(--persona-ink-soft);
}

.persona-settings__field--inline {
  grid-template-columns: auto 1fr;
  align-items: center;
}

.persona-settings__field select,
.persona-settings__field input[type="number"],
.persona-settings__field input[type="text"] {
  padding: 6px 8px;
  border: 1px solid var(--persona-line);
  border-radius: 6px;
  background: var(--persona-bg);
  color: var(--persona-ink);
  font-size: 0.88rem;
  max-width: 260px;
}

.persona-settings__field input[type="range"] {
  width: 100%;
  max-width: 360px;
}

.persona-settings__radios {
  border: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.persona-settings__radios legend {
  font-size: 0.82rem;
  color: var(--persona-muted);
  padding: 0;
}

.persona-settings__radio {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  color: var(--persona-ink-soft);
  cursor: pointer;
}

/* === Search palette ======================================================== */

.persona-search {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: start center;
  z-index: 90;
}

.persona-search__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(21, 23, 22, 0.4);
}

.persona-search__panel {
  position: relative;
  margin-top: 10vh;
  width: min(640px, 92vw);
  max-height: 70vh;
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: 0;
  background: var(--surface-strong, #ffffff);
  border: 1px solid var(--line, rgba(21, 23, 22, 0.08));
  border-radius: 14px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.persona-search__input {
  padding: 14px 18px;
  border: none;
  border-bottom: 1px solid var(--line, rgba(21, 23, 22, 0.08));
  font-size: 1rem;
  background: transparent;
  color: var(--ink, #15151a);
  outline: none;
}

.persona-search__tabs {
  display: flex;
  gap: 4px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--line, rgba(21, 23, 22, 0.08));
}

.persona-search__tab {
  padding: 4px 10px;
  border: none;
  background: transparent;
  color: var(--muted, #5e5e66);
  font-size: 0.85rem;
  border-radius: 6px;
  cursor: pointer;
}

.persona-search__tab.is-active {
  background: rgba(58, 91, 215, 0.08);
  color: var(--accent, #3a5bd7);
}

.persona-search__results {
  overflow-y: auto;
  padding: 6px 0;
}

.persona-search__list,
.persona-search__groups ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.persona-search__groups section {
  display: grid;
  gap: 2px;
  padding: 6px 0;
}

.persona-search__groups header {
  padding: 4px 18px;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted, #5e5e66);
}

.persona-search__row button {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  width: 100%;
  padding: 8px 18px;
  border: none;
  background: transparent;
  text-align: left;
  color: var(--ink-soft, #2f2f37);
  font-size: 0.88rem;
  cursor: pointer;
}

.persona-search__row.is-active button {
  background: rgba(58, 91, 215, 0.08);
  color: var(--ink, #15151a);
}

.persona-search__row button > span {
  font-size: 0.74rem;
  color: var(--muted, #5e5e66);
}

.persona-search__empty {
  padding: 24px;
  color: var(--muted, #5e5e66);
  text-align: center;
}

.persona-search__footer {
  display: flex;
  gap: 16px;
  justify-content: flex-end;
  padding: 8px 16px;
  font-size: 0.74rem;
  color: var(--muted, #5e5e66);
  border-top: 1px solid var(--line, rgba(21, 23, 22, 0.08));
  background: var(--surface, #f5f5f4);
}

/* === Responsive breakpoints ================================================
 *
 * Mirrors persona-shell.css so the pages stay consistent inside the shell.
 *   --bp-desktop: 1100px — wide layouts, two-up library grid, side toolbars
 *   --bp-tablet:   900px — toolbar wraps, tabs scroll horizontally, denser
 *                         skill rows
 *   --bp-mobile:   620px — single-column grids, touch-friendly fields (>=44px),
 *                         search palette becomes full-screen, secondary
 *                         metadata is hidden
 */

@media (max-width: 1100px) {
  .persona-page {
    padding: 24px 24px;
  }
}

@media (max-width: 900px) {
  .persona-page {
    padding: 20px 18px;
    gap: 14px;
  }

  /* Library toolbar — let the filters wrap underneath the search input. */
  .persona-library__toolbar {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .persona-library__filter {
    grid-template-columns: auto 1fr;
  }
  .persona-library__filter select {
    width: 100%;
    max-width: 220px;
  }

  /* Library card grid: keep auto-fill but with a tighter minimum so two
   * cards still fit at narrow tablet widths before collapsing further. */
  .persona-library__grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 10px;
  }

  /* Skills tabs — horizontal scroll instead of wrap. */
  .persona-skills__tabs {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }
  .persona-skills__tab {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  /* Skill rows tighten; actions stay inline at tablet. */
  .persona-skills__row {
    padding: 9px 10px;
  }

  /* Settings groups compress padding. */
  .persona-settings__group {
    padding: 14px;
  }

  /* Search palette already constrains via min(640px, 92vw). At tablet,
   * give it more vertical room. */
  .persona-search__panel {
    max-height: 80vh;
  }
}

@media (max-width: 620px) {
  .persona-page {
    padding: 16px 14px;
    gap: 12px;
  }
  .persona-page__header h1 {
    font-size: 1.25rem;
  }
  .persona-page__subtitle {
    font-size: 0.85rem;
  }

  /* Library: single column, larger touch surface. */
  .persona-library__toolbar {
    grid-template-columns: 1fr;
  }
  .persona-library__search {
    min-height: 44px;
    font-size: 0.95rem;
  }
  .persona-library__filter {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  .persona-library__filter select {
    min-height: 44px;
    max-width: 100%;
    font-size: 0.95rem;
  }
  .persona-library__grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .persona-library__card {
    padding: 14px 14px;
    min-height: 44px;
  }

  /* Skills page: tab row scrolls horizontally, per-skill actions stack
   * below the body, count badge stays inline with the tab label. */
  .persona-skills__tabs {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 2px;
  }
  .persona-skills__tab {
    flex: 0 0 auto;
    white-space: nowrap;
    min-height: 44px;
    padding: 8px 12px;
  }
  .persona-skills__row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .persona-skills__row-actions {
    justify-content: flex-end;
    gap: 12px;
  }
  .persona-skills__pin {
    min-width: 44px;
    min-height: 44px;
    font-size: 1.2rem;
  }
  .persona-skills__toggle {
    min-height: 44px;
    padding: 0 4px;
  }
  .persona-skills__source {
    font-size: 0.68rem;
  }

  /* Settings: 44px tap targets, radio rows wrap vertically. */
  .persona-settings__group {
    padding: 14px 12px;
  }
  .persona-settings__field--inline {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  .persona-settings__field select,
  .persona-settings__field input[type="number"],
  .persona-settings__field input[type="text"] {
    min-height: 44px;
    max-width: 100%;
    font-size: 0.95rem;
    padding: 8px 10px;
  }
  .persona-settings__field input[type="range"] {
    max-width: 100%;
    height: 32px;
  }
  .persona-settings__radios {
    grid-auto-flow: row;
    gap: 4px;
  }
  .persona-settings__radio {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 4px 0;
  }

  /* Search palette goes full-screen on mobile (the cmd+K modal). */
  .persona-search__panel {
    margin-top: 0;
    width: 100vw;
    max-width: 100vw;
    max-height: 100dvh;
    height: 100dvh;
    border-radius: 0;
    box-shadow: none;
  }
  .persona-search__input {
    padding: 14px 16px;
    font-size: 1.05rem;
    min-height: 52px;
  }
  /* Tab row scrollable when the palette is full-screen. */
  .persona-search__tabs {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding: 6px 10px;
  }
  .persona-search__tab {
    flex: 0 0 auto;
    white-space: nowrap;
    min-height: 36px;
  }
  /* Compact result rows; keep a comfortable tap target. */
  .persona-search__row button {
    padding: 12px 16px;
    grid-template-columns: 1fr;
    gap: 2px;
    min-height: 44px;
  }
  .persona-search__row button > span {
    font-size: 0.72rem;
  }
  .persona-search__groups header {
    padding: 6px 16px;
  }
  .persona-search__footer {
    padding: 10px 14px;
    font-size: 0.78rem;
  }
}

/* === Coarse-pointer and reduced-motion safeguards ========================== */

@media (hover: none) {
  /* Cards / skill rows that would have used a hover affordance get a
   * persistent border-color so the affordance is always visible. */
  .persona-library__card {
    border-color: var(--persona-line-strong);
  }
}

@media (prefers-reduced-motion: reduce) {
  .persona-library__card,
  .persona-skills__tab,
  .persona-search__tab,
  .persona-skills__pin {
    transition: none;
  }
}

/* === Persona Home ========================================================== */

.persona-home {
  --persona-bg: var(--surface, #f5f5f4);
  --persona-surface: var(--surface-strong, #ffffff);
  --persona-line: var(--line, rgba(21, 23, 22, 0.08));
  --persona-line-strong: var(--line-strong, rgba(21, 23, 22, 0.18));
  --persona-ink: var(--ink, #15151a);
  --persona-ink-soft: var(--ink-soft, #2f2f37);
  --persona-muted: var(--muted, #5e5e66);
  --persona-accent: var(--accent, #3a5bd7);
  --persona-radius: 14px;

  display: grid;
  gap: 28px;
  padding: 48px 32px 64px;
  max-width: 880px;
  margin: 0 auto;
  width: 100%;
  color: var(--persona-ink);
  font-family: inherit;
}

.persona-home__hero h1 {
  margin: 0;
  font-size: clamp(1.4rem, 2.2vw + 0.5rem, 1.9rem);
  letter-spacing: -0.01em;
  text-align: center;
}

.persona-home__form {
  display: grid;
  gap: 14px;
}

.persona-home__input-card {
  display: grid;
  gap: 10px;
  padding: 14px 14px 12px;
  border: 1px solid var(--persona-line-strong);
  border-radius: var(--persona-radius);
  background: var(--persona-surface);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02);
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}

.persona-home__input-card:focus-within {
  border-color: var(--persona-accent);
  box-shadow: 0 0 0 3px rgba(58, 91, 215, 0.12);
}

.persona-home__textarea {
  width: 100%;
  min-height: 64px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--persona-ink);
  font-size: 1.02rem;
  line-height: 1.45;
  resize: none;
  font-family: inherit;
}

.persona-home__input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.persona-home__attach {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.persona-home__attach-btn {
  min-width: 36px;
  min-height: 36px;
  border-radius: 999px;
  border: 1px solid var(--persona-line-strong);
  background: var(--persona-surface);
  color: var(--persona-ink-soft);
  font-size: 1.15rem;
  cursor: pointer;
  line-height: 1;
}

.persona-home__attach-btn:hover {
  border-color: var(--persona-accent);
  color: var(--persona-accent);
}

.persona-home__attachments {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.persona-home__attachment {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(58, 91, 215, 0.08);
  color: var(--persona-accent);
  font-size: 0.8rem;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.persona-home__attachment-remove {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 1rem;
  padding: 0 0 0 2px;
  line-height: 1;
}

.persona-home__mode {
  margin-left: auto;
  display: inline-flex;
  border: 1px solid var(--persona-line);
  border-radius: 999px;
  padding: 2px;
  background: rgba(21, 23, 22, 0.03);
}

.persona-home__mode-btn {
  border: none;
  background: transparent;
  color: var(--persona-muted);
  font-size: 0.82rem;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  min-height: 32px;
}

.persona-home__mode-btn.is-active {
  background: var(--persona-surface);
  color: var(--persona-ink);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.persona-home__send {
  min-width: 36px;
  min-height: 36px;
  border-radius: 999px;
  border: none;
  background: var(--persona-accent);
  color: white;
  font-size: 1.05rem;
  cursor: pointer;
  font-weight: 600;
  display: inline-grid;
  place-items: center;
}

.persona-home__send:disabled {
  background: rgba(21, 23, 22, 0.18);
  cursor: not-allowed;
}

.persona-home__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.persona-home__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--persona-line);
  background: var(--persona-surface);
  color: var(--persona-ink-soft);
  font-size: 0.86rem;
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease;
}

.persona-home__chip:hover {
  border-color: var(--persona-accent);
  color: var(--persona-accent);
}

.persona-home__chip-emoji {
  font-size: 1rem;
}

.persona-home__section {
  display: grid;
  gap: 10px;
}

.persona-home__section-header h2 {
  margin: 0;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--persona-muted);
}

.persona-home__section-hint {
  margin: 2px 0 0;
  color: var(--persona-muted);
  font-size: 0.82rem;
}

.persona-home__recent-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.persona-home__recent-card {
  display: grid;
  grid-template-rows: auto auto auto;
  gap: 6px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--persona-line);
  border-radius: var(--persona-radius);
  background: var(--persona-surface);
  text-align: left;
  cursor: pointer;
  color: inherit;
}

.persona-home__recent-card:hover {
  border-color: var(--persona-line-strong);
}

.persona-home__recent-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.persona-home__recent-title {
  font-size: 0.92rem;
  font-weight: 600;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.persona-home__recent-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.74rem;
  color: var(--persona-muted);
}

.persona-home__templates {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 10px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x mandatory;
  padding-bottom: 6px;
}

.persona-home__templates > li {
  flex: 0 0 220px;
  scroll-snap-align: start;
}

.persona-home__template {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--persona-line);
  border-radius: var(--persona-radius);
  background: var(--persona-surface);
  text-align: left;
  cursor: pointer;
  color: inherit;
}

.persona-home__template:hover {
  border-color: var(--persona-line-strong);
}

.persona-home__template-emoji {
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(58, 91, 215, 0.08);
  font-size: 1.2rem;
}

.persona-home__template-body {
  display: grid;
  gap: 2px;
}

.persona-home__template-body strong {
  font-size: 0.9rem;
}

.persona-home__template-body small {
  color: var(--persona-muted);
  font-size: 0.78rem;
  line-height: 1.35;
}

/* === Persona Thread Feed =================================================== */

.persona-thread {
  --persona-bg: var(--surface, #f5f5f4);
  --persona-surface: var(--surface-strong, #ffffff);
  --persona-line: var(--line, rgba(21, 23, 22, 0.08));
  --persona-line-strong: var(--line-strong, rgba(21, 23, 22, 0.18));
  --persona-ink: var(--ink, #15151a);
  --persona-ink-soft: var(--ink-soft, #2f2f37);
  --persona-muted: var(--muted, #5e5e66);
  --persona-accent: var(--accent, #3a5bd7);
  --persona-radius: 14px;

  display: grid;
  grid-template-rows: auto auto 1fr auto;
  min-height: 0;
  height: 100%;
  width: 100%;
}

.persona-thread__header {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 14px 18px 12px;
  border-bottom: 1px solid var(--persona-line);
  background: var(--persona-surface);
}

.persona-thread__title-block {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  min-width: 0;
}

.persona-thread__title {
  font-size: 1rem;
  font-weight: 600;
  border: none;
  background: transparent;
  color: var(--persona-ink);
  padding: 4px 6px;
  border-radius: 6px;
  cursor: text;
  text-align: left;
  max-width: 60ch;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.persona-thread__title:hover {
  background: rgba(21, 23, 22, 0.04);
}

.persona-thread__title-input {
  font-size: 1rem;
  font-weight: 600;
  border: 1px solid var(--persona-accent);
  background: var(--persona-surface);
  color: var(--persona-ink);
  padding: 4px 8px;
  border-radius: 6px;
  outline: none;
  max-width: 40ch;
}

.persona-thread__agent {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: var(--persona-muted);
}

.persona-thread__agent-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.persona-thread__meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.persona-thread__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 600;
  background: rgba(21, 23, 22, 0.06);
  color: var(--persona-ink-soft);
}

.persona-thread__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}

.persona-thread__status--live {
  background: rgba(58, 91, 215, 0.12);
  color: var(--persona-accent);
}

.persona-thread__status--complete {
  background: rgba(23, 111, 73, 0.12);
  color: var(--green, #176f49);
}

.persona-thread__status--paused {
  background: rgba(184, 77, 18, 0.12);
  color: var(--accent-strong, #b84d12);
}

.persona-thread__model {
  font-size: 0.74rem;
  color: var(--persona-muted);
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--persona-line);
  background: var(--persona-bg);
  font-variant-numeric: tabular-nums;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.persona-thread__more {
  border: none;
  background: transparent;
  color: var(--persona-muted);
  font-size: 1.1rem;
  cursor: pointer;
  min-width: 32px;
  min-height: 32px;
  border-radius: 6px;
}

.persona-thread__more:hover {
  background: rgba(21, 23, 22, 0.05);
}

.persona-thread__progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  overflow: hidden;
  background: rgba(58, 91, 215, 0.1);
}

.persona-thread__progress span {
  display: block;
  width: 40%;
  height: 100%;
  background: var(--persona-accent);
  border-radius: 2px;
  animation: persona-thread-progress 1.4s ease-in-out infinite;
}

@keyframes persona-thread-progress {
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(50%);
  }
  100% {
    transform: translateX(250%);
  }
}

.persona-thread__working-doc {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  margin: 12px 18px 0;
  padding: 10px 14px;
  border: 1px dashed var(--persona-line-strong);
  border-radius: var(--persona-radius);
  background: rgba(58, 91, 215, 0.04);
}

.persona-thread__working-doc-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--persona-accent);
}

.persona-thread__working-doc-body {
  color: var(--persona-ink-soft);
  font-size: 0.86rem;
  line-height: 1.4;
}

.persona-thread__working-doc-close {
  border: none;
  background: transparent;
  color: var(--persona-muted);
  font-size: 1.1rem;
  cursor: pointer;
  min-width: 28px;
  min-height: 28px;
  border-radius: 6px;
}

.persona-thread__feed {
  overflow-y: auto;
  padding: 18px;
  display: grid;
  gap: 14px;
  min-height: 0;
  scrollbar-gutter: stable;
}

.persona-thread__empty {
  color: var(--persona-muted);
  font-size: 0.92rem;
  text-align: center;
  padding: 36px 12px;
}

.persona-bubble {
  display: grid;
  gap: 8px;
  max-width: min(680px, 100%);
  padding: 12px 14px;
  border-radius: 14px;
  font-size: 0.95rem;
  line-height: 1.5;
}

.persona-bubble--user {
  justify-self: flex-end;
  margin-left: auto;
  background: rgba(58, 91, 215, 0.08);
  color: var(--persona-ink);
  border-bottom-right-radius: 4px;
}

.persona-bubble--assistant {
  background: var(--persona-surface);
  border: 1px solid var(--persona-line);
  border-bottom-left-radius: 4px;
}

.persona-bubble__reasoned {
  font-size: 0.82rem;
  color: var(--persona-muted);
}

.persona-bubble__reasoned summary {
  cursor: pointer;
  display: inline-block;
  padding: 2px 0;
  user-select: none;
  list-style: none;
}

.persona-bubble__reasoned summary::-webkit-details-marker {
  display: none;
}

.persona-bubble__reasoned pre {
  margin: 6px 0 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(21, 23, 22, 0.04);
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  line-height: 1.45;
}

.persona-bubble__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  margin: 0;
  font-size: 0.82rem;
  color: var(--persona-muted, #5e5e66);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.persona-bubble__status-dot {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--persona-accent, #3a5bd7);
  animation: persona-bubble-pulse 1.1s ease-in-out infinite;
}

@keyframes persona-bubble-pulse {
  0%, 100% {
    transform: scale(0.85);
    opacity: 0.55;
  }
  50% {
    transform: scale(1.15);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .persona-bubble__status-dot {
    animation: none;
  }
}

.persona-bubble__empty {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(180, 59, 53, 0.06);
  color: var(--persona-ink-soft, #2f2f37);
  font-size: 0.84rem;
  line-height: 1.45;
}

.persona-bubble__tools {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.persona-bubble__tool-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--persona-line);
  background: var(--persona-bg);
  color: var(--persona-ink-soft);
  font-size: 0.78rem;
  cursor: pointer;
  max-width: 100%;
}

.persona-bubble__tool-chip:hover {
  border-color: var(--persona-accent);
  color: var(--persona-accent);
}

.persona-bubble__tool-emoji {
  font-size: 0.9rem;
}

.persona-bubble__tool-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: 220px;
}

.persona-bubble__tool-state {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 600;
  background: rgba(21, 23, 22, 0.06);
  color: var(--persona-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.persona-bubble__tool-state.is-done {
  background: rgba(23, 111, 73, 0.12);
  color: var(--green, #176f49);
}

.persona-bubble__tool-state.is-waiting {
  background: rgba(184, 77, 18, 0.12);
  color: var(--accent-strong, #b84d12);
}

.persona-bubble__tool-state.is-denied {
  background: rgba(225, 29, 72, 0.12);
  color: #e11d48;
}

.persona-bubble__tool-state.is-running {
  background: rgba(58, 91, 215, 0.12);
  color: var(--persona-accent);
}

.persona-bubble__text {
  font-size: 0.95rem;
  line-height: 1.55;
  word-break: break-word;
}

.persona-bubble__text > * + * {
  margin-top: 8px;
}

.persona-bubble__text p {
  margin: 0;
}

.persona-bubble__text pre {
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(21, 23, 22, 0.04);
  overflow-x: auto;
  font-size: 0.82rem;
  line-height: 1.45;
}

.persona-bubble__text code {
  background: rgba(21, 23, 22, 0.06);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.86em;
}

.persona-bubble__actions {
  display: inline-flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.persona-bubble:hover .persona-bubble__actions,
.persona-bubble:focus-within .persona-bubble__actions {
  opacity: 1;
}

.persona-bubble__actions button {
  min-width: 28px;
  min-height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--persona-muted);
}

.persona-bubble__actions button:hover {
  background: rgba(21, 23, 22, 0.06);
}

.persona-thread__followups {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 18px 8px;
}

.persona-thread__followup {
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid var(--persona-line);
  background: var(--persona-surface);
  color: var(--persona-ink-soft);
  font-size: 0.82rem;
  cursor: pointer;
}

.persona-thread__followup:hover {
  border-color: var(--persona-accent);
  color: var(--persona-accent);
}

/* === Persona Composer ====================================================== */

.persona-composer {
  --persona-surface: var(--surface-strong, #ffffff);
  --persona-line: var(--line, rgba(21, 23, 22, 0.08));
  --persona-line-strong: var(--line-strong, rgba(21, 23, 22, 0.18));
  --persona-ink: var(--ink, #15151a);
  --persona-ink-soft: var(--ink-soft, #2f2f37);
  --persona-muted: var(--muted, #5e5e66);
  --persona-accent: var(--accent, #3a5bd7);

  display: grid;
  gap: 6px;
  padding: 8px 10px 10px;
  border: 1px solid var(--persona-line-strong);
  border-radius: 14px;
  background: var(--persona-surface);
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}

.persona-composer:focus-within {
  border-color: var(--persona-accent);
  box-shadow: 0 0 0 3px rgba(58, 91, 215, 0.12);
}

.persona-composer__attachments {
  list-style: none;
  margin: 0;
  padding: 0 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.persona-composer__attachments li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(58, 91, 215, 0.08);
  color: var(--persona-accent);
  font-size: 0.78rem;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.persona-composer__attachments button {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  line-height: 1;
  font-size: 0.95rem;
}

.persona-composer__row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: end;
  gap: 8px;
}

.persona-composer__attach {
  min-width: 36px;
  min-height: 36px;
  border-radius: 999px;
  border: 1px solid var(--persona-line);
  background: transparent;
  color: var(--persona-ink-soft);
  font-size: 1.05rem;
  cursor: pointer;
  line-height: 1;
}

.persona-composer__attach:hover {
  border-color: var(--persona-accent);
  color: var(--persona-accent);
}

.persona-composer__textarea {
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--persona-ink);
  font-size: 0.95rem;
  line-height: 1.45;
  min-height: 44px;
  font-family: inherit;
  padding: 8px 4px;
}

.persona-composer__textarea:disabled {
  color: var(--persona-muted);
}

.persona-composer__controls {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.persona-composer__plan {
  min-height: 32px;
  padding: 4px 10px;
  border: 1px solid var(--persona-line);
  border-radius: 999px;
  background: transparent;
  color: var(--persona-muted);
  font-size: 0.78rem;
  cursor: pointer;
}

.persona-composer__plan.is-active {
  background: rgba(58, 91, 215, 0.1);
  color: var(--persona-accent);
  border-color: rgba(58, 91, 215, 0.4);
}

.persona-composer__cost {
  font-size: 0.74rem;
  color: var(--persona-muted);
  font-variant-numeric: tabular-nums;
}

.persona-composer__send {
  min-width: 36px;
  min-height: 36px;
  border-radius: 999px;
  border: none;
  background: var(--persona-accent);
  color: white;
  font-size: 1.05rem;
  cursor: pointer;
  font-weight: 600;
  display: inline-grid;
  place-items: center;
}

.persona-composer__send:disabled {
  background: rgba(21, 23, 22, 0.18);
  cursor: not-allowed;
}

.persona-composer__send.is-stop {
  background: rgba(225, 29, 72, 0.9);
}

.persona-composer__busy {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(58, 91, 215, 0.08);
  color: var(--persona-accent, #3a5bd7);
  font-size: 0.78rem;
  font-weight: 500;
}

.persona-composer__busy-dot {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--persona-accent, #3a5bd7);
  animation: persona-bubble-pulse 1.1s ease-in-out infinite;
}

.persona-composer.is-busy .persona-composer__input {
  opacity: 0.8;
}

.persona-composer__stop {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  height: 38px;
  border: none;
  border-radius: 999px;
  background: rgba(225, 29, 72, 0.92);
  color: white;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(225, 29, 72, 0.18);
}

.persona-composer__stop:hover {
  background: rgb(208, 24, 65);
}

.persona-composer__stop-glyph {
  font-size: 0.7rem;
  line-height: 1;
}

@media (prefers-reduced-motion: reduce) {
  .persona-composer__busy-dot {
    animation: none;
  }
}

/* === Persona App error toast =============================================== */

.persona-app__error {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(225, 29, 72, 0.95);
  color: white;
  font-size: 0.86rem;
  z-index: 80;
  box-shadow: 0 16px 40px rgba(225, 29, 72, 0.28);
}

.persona-app__error button {
  border: none;
  background: rgba(255, 255, 255, 0.18);
  color: white;
  font-size: 0.78rem;
  padding: 4px 10px;
  border-radius: 999px;
  cursor: pointer;
}

.persona-app__stuck {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 12px;
  max-width: min(560px, calc(100vw - 32px));
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(241, 113, 5, 0.98);
  color: white;
  font-size: 0.86rem;
  z-index: 70;
  box-shadow: 0 16px 40px rgba(241, 113, 5, 0.28);
}

.persona-app__stuck button {
  border: none;
  background: rgba(255, 255, 255, 0.22);
  color: white;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  flex: 0 0 auto;
}

.persona-app__stuck button:hover {
  background: rgba(255, 255, 255, 0.32);
}

/* === Learning panel (deployed-agent side) ================================= */

.persona-learning {
  max-width: 760px;
}

.persona-learning__list {
  display: grid;
  gap: 10px;
  list-style: none;
  margin: 18px 0 0;
  padding: 0;
}

.persona-learning__row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--persona-line, rgba(21, 23, 22, 0.08));
  border-radius: 12px;
  background: var(--persona-surface, white);
}

.persona-learning__row-text {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.persona-learning__row-text strong {
  font-size: 0.95rem;
  color: var(--persona-ink, #15151a);
}

.persona-learning__row-text small {
  color: var(--persona-ink-soft, #2f2f37);
  font-size: 0.84rem;
  line-height: 1.4;
}

.persona-learning__kind {
  display: inline-flex;
  align-self: start;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(58, 91, 215, 0.1);
  color: var(--persona-accent, #3a5bd7);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.persona-learning__row-actions {
  display: flex;
  gap: 6px;
}

.persona-learning__row-actions button {
  padding: 6px 12px;
  border: none;
  border-radius: 8px;
  background: var(--persona-accent, #3a5bd7);
  color: white;
  font: inherit;
  font-size: 0.84rem;
  cursor: pointer;
}

.persona-learning__row-actions button.ghost {
  background: transparent;
  color: var(--persona-ink-soft, #2f2f37);
  border: 1px solid var(--persona-line, rgba(21, 23, 22, 0.08));
}

.persona-page__error {
  margin: 12px 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(180, 59, 53, 0.06);
  color: var(--persona-ink-soft, #2f2f37);
  font-size: 0.86rem;
}

.persona-page__empty {
  margin: 12px 0;
  color: var(--persona-muted, #5e5e66);
  font-size: 0.92rem;
}

@media (max-width: 720px) {
  .persona-learning__row {
    grid-template-columns: 1fr;
  }
  .persona-learning__row-actions {
    justify-content: flex-end;
  }
}

/* === Responsive ============================================================ */

@media (max-width: 720px) {
  .persona-home {
    padding: 28px 16px 48px;
    gap: 22px;
  }

  .persona-home__input-row {
    gap: 8px;
  }

  .persona-home__mode {
    order: 3;
    margin-left: 0;
    width: 100%;
    justify-content: space-between;
  }

  .persona-home__mode-btn {
    flex: 1 1 0;
    text-align: center;
    min-height: 36px;
  }

  .persona-home__attach,
  .persona-home__send {
    min-height: 44px;
    min-width: 44px;
  }

  .persona-home__attach-btn {
    min-height: 44px;
    min-width: 44px;
  }

  .persona-home__chip {
    min-height: 44px;
  }

  .persona-home__recent-grid {
    grid-template-columns: 1fr;
  }

  .persona-home__templates > li {
    flex-basis: 80%;
  }

  .persona-thread__header {
    grid-template-columns: 1fr;
    padding: 12px 14px;
  }

  .persona-thread__meta {
    justify-self: end;
  }

  .persona-thread__feed {
    padding: 14px;
  }

  .persona-bubble {
    max-width: 100%;
  }

  .persona-bubble__actions {
    opacity: 1;
  }

  .persona-thread__working-doc {
    margin: 10px 12px 0;
  }

  .persona-thread__followups {
    padding: 0 12px 8px;
  }

  .persona-composer__attach,
  .persona-composer__send {
    min-height: 44px;
    min-width: 44px;
  }

  .persona-composer__plan {
    min-height: 44px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .persona-thread__progress span {
    animation: none;
    width: 100%;
  }
  .persona-home__chip,
  .persona-home__recent-card,
  .persona-home__template,
  .persona-thread__title,
  .persona-bubble__tool-chip,
  .persona-thread__followup,
  .persona-composer,
  .persona-home__input-card {
    transition: none;
  }
}
`;
