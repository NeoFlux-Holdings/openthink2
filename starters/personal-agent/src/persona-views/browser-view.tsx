/**
 * Live browser-session placeholder — read-only URL bar, back/forward/
 * screenshot buttons, and a screenshot stream stub that polls the
 * configured URL at ~4fps.
 *
 * The screenshot URL is expected to point at an image endpoint that
 * returns the latest frame of the headless browser session; we append
 * a `?t=` cache-buster to force re-fetch on each interval tick.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { BrowserData } from "./types";

export interface BrowserViewProps {
  data?: BrowserData | undefined;
  onBack?: (() => void) | undefined;
  onForward?: (() => void) | undefined;
  onScreenshot?: (() => void) | undefined;
}

export function BrowserView(props: BrowserViewProps) {
  const url = props.data?.url ?? "about:blank";
  const screenshotUrl = props.data?.screenshotUrl;
  const intervalMs = props.data?.refreshIntervalMs ?? 250;
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!screenshotUrl) return;
    timerRef.current = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [screenshotUrl, intervalMs]);

  const framedUrl = useMemo(() => {
    if (!screenshotUrl) return undefined;
    const sep = screenshotUrl.includes("?") ? "&" : "?";
    return `${screenshotUrl}${sep}t=${tick}`;
  }, [screenshotUrl, tick]);

  return (
    <section className="pv-browser" aria-label="Browser session">
      <header className="pv-browser__chrome">
        <div className="pv-browser__nav">
          <button type="button" className="pv-browser__btn" onClick={props.onBack} aria-label="Back">
            {"<"}
          </button>
          <button type="button" className="pv-browser__btn" onClick={props.onForward} aria-label="Forward">
            {">"}
          </button>
          <button type="button" className="pv-browser__btn" onClick={props.onScreenshot} aria-label="Screenshot">
            Snap
          </button>
        </div>
        <input
          type="text"
          className="pv-browser__url"
          value={url}
          readOnly
          aria-label="Current URL"
        />
      </header>

      <div className="pv-browser__viewport">
        {framedUrl ? (
          <img
            className="pv-browser__frame"
            src={framedUrl}
            alt={`Latest screenshot from ${url}`}
            draggable={false}
          />
        ) : (
          <div className="pv-browser__placeholder">
            <p>No live screenshot stream wired yet.</p>
            <small>Pass a `screenshotUrl` in the artifact data to begin polling.</small>
          </div>
        )}
      </div>
    </section>
  );
}

export default BrowserView;
