/**
 * Barrel export for the Persona artifact viewers. Import from this
 * module so callers don't have to know about the per-kind file layout.
 *
 * Example:
 *
 * ```tsx
 * import { ArtifactRouter, type PersonaArtifactWithData } from "./persona-views";
 * ```
 */
export { ArtifactRouter, viewKey } from "./artifact-router";
export type { ArtifactRouterProps } from "./artifact-router";

export { BrowserView } from "./browser-view";
export type { BrowserViewProps } from "./browser-view";

export { ChartView, buildPolylinePoints } from "./chart-view";
export type { ChartViewProps } from "./chart-view";

export { CodeView } from "./code-view";
export type { CodeViewProps } from "./code-view";

export { DocumentView } from "./document-view";
export type { DocumentViewProps } from "./document-view";

export { ImageView } from "./image-view";
export type { ImageViewProps } from "./image-view";

export { SlidesView } from "./slides-view";
export type { SlidesViewProps } from "./slides-view";

export { TableView, buildCsv, inferColumns } from "./table-view";
export type { TableViewProps } from "./table-view";

export { WebpageView } from "./webpage-view";
export type { WebpageViewProps } from "./webpage-view";

export type {
  ArtifactData,
  BrowserData,
  ChartData,
  ChartPoint,
  CodeData,
  DocumentData,
  DocumentVersion,
  ImageData,
  PersonaArtifact,
  PersonaArtifactKind,
  PersonaArtifactWithData,
  SlideContent,
  SlidesData,
  TableData,
  TableRow,
  WebpageData
} from "./types";
