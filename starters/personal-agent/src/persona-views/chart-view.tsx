/**
 * Chart viewer — renders a simple SVG line chart from an array of
 * `{x, y}` points. No external chart library; keeps the viewer
 * dependency-light. Auto-scales to fit the viewbox.
 */
import { useMemo } from "react";
import type { ChartData, ChartPoint } from "./types";

export interface ChartViewProps {
  data?: ChartData | undefined;
  width?: number | undefined;
  height?: number | undefined;
}

const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 240;
const PADDING = 24;

/**
 * Build an SVG `points` attribute (space-separated `x,y` pairs) from a
 * point array, auto-scaled to fit inside a `width x height` box minus
 * symmetric padding.
 */
export function buildPolylinePoints(
  points: ChartPoint[],
  width: number = DEFAULT_WIDTH,
  height: number = DEFAULT_HEIGHT,
  padding: number = PADDING
): string {
  if (points.length === 0) return "";
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  return points
    .map((p) => {
      const x = padding + ((p.x - minX) / xRange) * innerW;
      const y = padding + innerH - ((p.y - minY) / yRange) * innerH;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function ChartView(props: ChartViewProps) {
  const points = props.data?.points ?? [];
  const width = props.width ?? DEFAULT_WIDTH;
  const height = props.height ?? DEFAULT_HEIGHT;
  const polyline = useMemo(
    () => buildPolylinePoints(points, width, height),
    [points, width, height]
  );

  return (
    <section className="pv-chart" aria-label="Chart">
      <header className="pv-chart__bar">
        <span>{props.data?.label ?? "Series"}</span>
        <small>{points.length} pts</small>
      </header>
      {points.length === 0 ? (
        <div className="pv-chart__empty">No data points yet.</div>
      ) : (
        <svg
          className="pv-chart__svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={props.data?.label ?? "Line chart"}
        >
          <rect x={0} y={0} width={width} height={height} className="pv-chart__bg" />
          <polyline points={polyline} className="pv-chart__line" fill="none" />
        </svg>
      )}
    </section>
  );
}

export default ChartView;
