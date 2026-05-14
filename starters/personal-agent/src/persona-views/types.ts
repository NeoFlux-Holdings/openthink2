/**
 * Type extensions for the Persona artifact viewers.
 *
 * The base {@link PersonaArtifact} type in `persona-shell.tsx` is a
 * metadata-only descriptor — it tells the shell *what* an artifact is
 * (kind, title, version) but not *what's in it*. The viewer components
 * in this folder need actual payload data, so we layer a generic
 * `data` field on top via a separate type module so we don't have to
 * touch `persona-shell.tsx`.
 */
import type { PersonaArtifact, PersonaArtifactKind } from "../persona-shell";

export type { PersonaArtifact, PersonaArtifactKind };

/**
 * A {@link PersonaArtifact} with a generic, kind-specific payload.
 * Use `unknown` at the boundary and narrow with the {@link ArtifactData}
 * union when routing.
 */
export interface PersonaArtifactWithData<TData = unknown> extends PersonaArtifact {
  data?: TData | undefined;
}

export interface DocumentVersion {
  version: number;
  label?: string;
  content: string;
}

export interface DocumentData {
  content: string;
  /**
   * Optional version history. The current version always appears at
   * the top of the dropdown.
   */
  versions?: DocumentVersion[];
}

export interface CodeData {
  content: string;
  language?: string;
}

export interface BrowserData {
  url: string;
  /** A URL that resolves to a fresh screenshot each request. */
  screenshotUrl?: string;
  /** Polling interval; defaults to ~4fps (250ms). */
  refreshIntervalMs?: number;
}

export interface WebpageData {
  url?: string;
  html?: string;
}

export interface SlideContent {
  title: string;
  body: string;
}

export interface SlidesData {
  slides: SlideContent[];
}

export type TableRow = Record<string, string | number>;

export interface TableData {
  columns?: string[];
  rows: TableRow[];
}

export interface ImageData {
  src: string;
  alt?: string;
  downloadName?: string;
}

export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartData {
  points: ChartPoint[];
  label?: string;
}

export interface DiffData {
  before: string;
  after: string;
  /** Optional filename for the header. */
  filename?: string;
  /** Optional language hint for syntax-aware splits (we don't tokenize today — for future). */
  language?: string;
}

/** Discriminated payload union, keyed by `PersonaArtifactKind`. */
export type ArtifactData =
  | { kind: "document"; data: DocumentData }
  | { kind: "code"; data: CodeData }
  | { kind: "browser"; data: BrowserData }
  | { kind: "webpage"; data: WebpageData }
  | { kind: "slides"; data: SlidesData }
  | { kind: "table"; data: TableData }
  | { kind: "image"; data: ImageData }
  | { kind: "chart"; data: ChartData }
  | { kind: "diff"; data: DiffData };
