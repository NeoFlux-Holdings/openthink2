/**
 * Diff viewer — line-level comparison of two text revisions with
 * inline and side-by-side modes plus a "copy unified patch" button.
 * Mirrors the style of CodeView / DocumentView. The diff algorithm is
 * a pure LCS-based line diff so the helper can be unit-tested without
 * React.
 */
import { useCallback, useMemo, useState } from "react";
import type { DiffData } from "./types";

export interface DiffLine {
  kind: "equal" | "added" | "removed";
  text: string;
  /** 1-based line number on the "before" side, if present. */
  leftLine?: number;
  /** 1-based line number on the "after" side, if present. */
  rightLine?: number;
}

type DiffMode = "inline" | "side-by-side";

export interface DiffViewProps {
  data?: DiffData | undefined;
  /** Initial mode; defaults to "inline". */
  initialMode?: DiffMode | undefined;
}

/**
 * Compute a line-level diff between two strings via the classic
 * Longest-Common-Subsequence DP. Runs in O(N·M) time / space on the
 * line counts; comfortable for typical artifact-sized payloads
 * (a few thousand lines). Larger inputs should be virtualized or
 * chunked before being fed to this helper.
 */
export function computeLineDiff(before: string, after: string): DiffLine[] {
  const left = before.length === 0 ? [] : before.split("\n");
  const right = after.length === 0 ? [] : after.split("\n");
  const n = left.length;
  const m = right.length;

  // dp[i][j] = LCS length of left[0..i) vs right[0..j)
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (left[i] === right[j]) {
        dp[i + 1]![j + 1] = (dp[i]![j] ?? 0) + 1;
      } else {
        dp[i + 1]![j + 1] = Math.max(dp[i]![j + 1] ?? 0, dp[i + 1]![j] ?? 0);
      }
    }
  }

  // Walk backwards through the table to emit the diff in source order.
  const out: DiffLine[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (left[i - 1] === right[j - 1]) {
      out.push({ kind: "equal", text: left[i - 1]!, leftLine: i, rightLine: j });
      i--;
      j--;
    } else if ((dp[i]![j - 1] ?? 0) >= (dp[i - 1]![j] ?? 0)) {
      // Prefer j-- during backward walk so "removed" sorts before
      // "added" at each change point after the final reverse().
      out.push({ kind: "added", text: right[j - 1]!, rightLine: j });
      j--;
    } else {
      out.push({ kind: "removed", text: left[i - 1]!, leftLine: i });
      i--;
    }
  }
  while (i > 0) {
    out.push({ kind: "removed", text: left[i - 1]!, leftLine: i });
    i--;
  }
  while (j > 0) {
    out.push({ kind: "added", text: right[j - 1]!, rightLine: j });
    j--;
  }
  out.reverse();
  return out;
}

/**
 * Build a `--- / +++` unified-diff snippet for the clipboard. Not a
 * complete RFC-2440 patch (no hunk ranges) — just enough for a human
 * to read or paste into a chat.
 */
export function buildUnifiedPatch(lines: DiffLine[], filename?: string): string {
  const header = filename ? `--- a/${filename}\n+++ b/${filename}` : "--- before\n+++ after";
  const body = lines
    .map((line) => {
      if (line.kind === "added") return `+${line.text}`;
      if (line.kind === "removed") return `-${line.text}`;
      return ` ${line.text}`;
    })
    .join("\n");
  return body ? `${header}\n${body}` : header;
}

export function DiffView(props: DiffViewProps) {
  const before = props.data?.before ?? "";
  const after = props.data?.after ?? "";
  const filename = props.data?.filename;
  const [mode, setMode] = useState<DiffMode>(props.initialMode ?? "inline");
  const [copied, setCopied] = useState(false);

  const lines = useMemo(() => computeLineDiff(before, after), [before, after]);
  const added = lines.filter((l) => l.kind === "added").length;
  const removed = lines.filter((l) => l.kind === "removed").length;
  const isEmpty = before === after;

  const onCopy = useCallback(async () => {
    try {
      const patch = buildUnifiedPatch(lines, filename);
      const clip =
        typeof navigator !== "undefined" && navigator.clipboard ? navigator.clipboard : undefined;
      if (clip) await clip.writeText(patch);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [lines, filename]);

  return (
    <section className="pv-diff" aria-label="Diff viewer">
      <header className="pv-diff__bar">
        <span className="pv-diff__summary" aria-live="polite">
          <span className="pv-diff__add">+{added}</span>
          <span className="pv-diff__rem">-{removed}</span>
          <span className="pv-diff__sep">lines</span>
          {filename && <span className="pv-diff__file">· {filename}</span>}
        </span>
        <div className="pv-diff__modes" role="tablist" aria-label="Diff layout">
          <button
            type="button"
            role="tab"
            className={`pv-diff__btn${mode === "inline" ? " is-active" : ""}`}
            aria-pressed={mode === "inline"}
            aria-selected={mode === "inline"}
            onClick={() => setMode("inline")}
          >
            Inline
          </button>
          <button
            type="button"
            role="tab"
            className={`pv-diff__btn${mode === "side-by-side" ? " is-active" : ""}`}
            aria-pressed={mode === "side-by-side"}
            aria-selected={mode === "side-by-side"}
            onClick={() => setMode("side-by-side")}
          >
            Side-by-side
          </button>
        </div>
        <button
          type="button"
          className="pv-diff__btn pv-diff__btn--primary"
          onClick={onCopy}
          aria-label="Copy unified patch"
        >
          {copied ? "Copied" : "Copy patch"}
        </button>
      </header>

      {isEmpty ? (
        <div className="pv-diff__empty">No changes between revisions.</div>
      ) : mode === "inline" ? (
        <InlineRows lines={lines} />
      ) : (
        <SideRows lines={lines} />
      )}
    </section>
  );
}

function InlineRows({ lines }: { lines: DiffLine[] }) {
  return (
    <ol className="pv-diff__inline" aria-label="Inline diff">
      {lines.map((line, idx) => {
        const prefix = line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " ";
        const role = line.kind === "added" ? "added" : line.kind === "removed" ? "removed" : "context";
        const label = `${role} line${line.leftLine ? ` left ${line.leftLine}` : ""}${
          line.rightLine ? ` right ${line.rightLine}` : ""
        }: ${line.text}`;
        return (
          <li
            key={idx}
            className={`pv-diff__row pv-diff__row--${line.kind}`}
            tabIndex={0}
            aria-label={label}
          >
            <span className="pv-diff__num">{line.leftLine ?? ""}</span>
            <span className="pv-diff__num">{line.rightLine ?? ""}</span>
            <span className="pv-diff__sign" aria-hidden="true">
              {prefix}
            </span>
            <span className="pv-diff__text">{line.text}</span>
          </li>
        );
      })}
    </ol>
  );
}

function SideRow({ line, side }: { line: DiffLine; side: "left" | "right" }) {
  const skip = side === "left" ? line.kind === "added" : line.kind === "removed";
  if (skip) {
    return (
      <li className="pv-diff__row pv-diff__row--blank" aria-hidden="true">
        <span className="pv-diff__num" />
        <span className="pv-diff__text" />
      </li>
    );
  }
  const num = side === "left" ? line.leftLine : line.rightLine;
  const role = line.kind === "equal" ? "context" : line.kind;
  return (
    <li
      className={`pv-diff__row pv-diff__row--${line.kind}`}
      tabIndex={0}
      aria-label={`${role} ${side} ${num}: ${line.text}`}
    >
      <span className="pv-diff__num">{num ?? ""}</span>
      <span className="pv-diff__text">{line.text}</span>
    </li>
  );
}

function SideRows({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="pv-diff__side" aria-label="Side-by-side diff">
      <ol className="pv-diff__col pv-diff__col--left" aria-label="Before">
        {lines.map((line, idx) => (
          <SideRow key={idx} line={line} side="left" />
        ))}
      </ol>
      <ol className="pv-diff__col pv-diff__col--right" aria-label="After">
        {lines.map((line, idx) => (
          <SideRow key={idx} line={line} side="right" />
        ))}
      </ol>
    </div>
  );
}

export default DiffView;
