/**
 * Code viewer — preformatted code block with a copy button and a
 * "Run in sandbox" stub. Language is read from the artifact metadata
 * and surfaced as a label; full syntax-highlighting can be plugged in
 * later by swapping out the `<code>` body for a highlight component.
 */
import { useCallback, useState } from "react";
import type { CodeData } from "./types";

export interface CodeViewProps {
  data?: CodeData | undefined;
  onRunSandbox?: ((source: string, language: string | undefined) => void) | undefined;
}

export function CodeView(props: CodeViewProps) {
  const source = props.data?.content ?? "";
  const language = props.data?.language ?? "text";
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      const clip =
        typeof navigator !== "undefined" && navigator.clipboard
          ? navigator.clipboard
          : undefined;
      if (clip) {
        await clip.writeText(source);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [source]);

  const onRun = useCallback(() => {
    props.onRunSandbox?.(source, props.data?.language);
  }, [props, source]);

  return (
    <section className="pv-code" aria-label="Code viewer">
      <header className="pv-code__bar">
        <span className="pv-code__lang">{language}</span>
        <div className="pv-code__actions">
          <button type="button" className="pv-code__btn" onClick={onCopy} aria-label="Copy code">
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            className="pv-code__btn pv-code__btn--primary"
            onClick={onRun}
            disabled={!props.onRunSandbox}
            title={props.onRunSandbox ? "Run in sandbox" : "Sandbox runner not wired"}
          >
            Run in sandbox
          </button>
        </div>
      </header>
      <pre className="pv-code__body" data-language={language}>
        <code>{source || "// (empty)"}</code>
      </pre>
    </section>
  );
}

export default CodeView;
