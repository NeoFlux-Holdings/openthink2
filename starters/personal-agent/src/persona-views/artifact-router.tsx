/**
 * ArtifactRouter — given a {@link PersonaArtifactWithData}, pick the
 * right viewer component and render it. This is the single integration
 * point the Persona shell needs in order to drop the placeholder
 * `ArtifactTile` once it's ready to wire real data through.
 */
import type {
  BrowserData,
  ChartData,
  CodeData,
  DocumentData,
  ImageData,
  PersonaArtifactKind,
  PersonaArtifactWithData,
  SlidesData,
  TableData,
  WebpageData
} from "./types";
import { BrowserView } from "./browser-view";
import { ChartView } from "./chart-view";
import { CodeView } from "./code-view";
import { DocumentView } from "./document-view";
import { ImageView } from "./image-view";
import { SlidesView } from "./slides-view";
import { TableView } from "./table-view";
import { WebpageView } from "./webpage-view";

export interface ArtifactRouterProps {
  artifact: PersonaArtifactWithData;
}

/**
 * Map a {@link PersonaArtifactKind} to a human-readable label. Useful
 * for analytics, headers, and tests that assert routing correctness
 * without having to mount the actual React tree.
 */
export function viewKey(kind: PersonaArtifactKind): string {
  switch (kind) {
    case "document":
      return "document-view";
    case "code":
      return "code-view";
    case "browser":
      return "browser-view";
    case "webpage":
      return "webpage-view";
    case "slides":
      return "slides-view";
    case "table":
      return "table-view";
    case "image":
      return "image-view";
    case "chart":
      return "chart-view";
  }
}

export function ArtifactRouter(props: ArtifactRouterProps) {
  const { artifact } = props;
  const data = artifact.data;
  switch (artifact.kind) {
    case "document":
      return (
        <DocumentView
          data={data as DocumentData | undefined}
          title={artifact.title}
          version={artifact.version}
        />
      );
    case "code":
      return <CodeView data={data as CodeData | undefined} />;
    case "browser":
      return <BrowserView data={data as BrowserData | undefined} />;
    case "webpage":
      return <WebpageView data={data as WebpageData | undefined} />;
    case "slides":
      return <SlidesView data={data as SlidesData | undefined} />;
    case "table":
      return <TableView data={data as TableData | undefined} />;
    case "image":
      return <ImageView data={data as ImageData | undefined} />;
    case "chart":
      return <ChartView data={data as ChartData | undefined} />;
  }
}

export default ArtifactRouter;
