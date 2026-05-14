/**
 * Webpage viewer — sandboxed iframe with a mobile / desktop viewport
 * toggle. Accepts either a remote `url` or raw `html` (rendered through
 * the `srcdoc` attribute so it stays isolated from the parent page).
 */
import { useState } from "react";
import type { WebpageData } from "./types";

export interface WebpageViewProps {
  data?: WebpageData | undefined;
}

type Viewport = "mobile" | "desktop";

const VIEWPORTS: Readonly<Record<Viewport, { width: number; label: string }>> = {
  mobile: { width: 390, label: "Mobile" },
  desktop: { width: 1280, label: "Desktop" }
};

export function WebpageView(props: WebpageViewProps) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const url = props.data?.url;
  const html = props.data?.html;
  const settings = VIEWPORTS[viewport];

  return (
    <section className="pv-webpage" aria-label="Webpage preview">
      <header className="pv-webpage__bar">
        <div className="pv-webpage__viewport-toggle" role="tablist" aria-label="Viewport">
          {(Object.keys(VIEWPORTS) as Viewport[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={viewport === key}
              className={`pv-webpage__viewport-btn${viewport === key ? " is-active" : ""}`}
              onClick={() => setViewport(key)}
            >
              {VIEWPORTS[key].label}
            </button>
          ))}
        </div>
        {url ? (
          <span className="pv-webpage__url" title={url}>
            {url}
          </span>
        ) : (
          <span className="pv-webpage__url pv-webpage__url--inline">inline html</span>
        )}
      </header>

      <div className="pv-webpage__stage" data-viewport={viewport}>
        <div className="pv-webpage__frame-wrap" style={{ maxWidth: settings.width }}>
          {url ? (
            <iframe
              className="pv-webpage__frame"
              src={url}
              title="Webpage preview"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : html ? (
            <iframe
              className="pv-webpage__frame"
              srcDoc={html}
              title="Inline webpage preview"
              sandbox="allow-scripts"
            />
          ) : (
            <div className="pv-webpage__empty">No URL or HTML provided.</div>
          )}
        </div>
      </div>
    </section>
  );
}

export default WebpageView;
