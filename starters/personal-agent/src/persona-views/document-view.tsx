/**
 * Document viewer — renders markdown (or any plain-text content) inside
 * a styled `<pre>` block with a version dropdown and an inline edit
 * toggle. Stays dependency-light: no markdown parser is pulled in here
 * so the viewer works during SSR and in tests without a DOM.
 */
import { useMemo, useState, type ChangeEvent } from "react";
import type { DocumentData, DocumentVersion } from "./types";

export interface DocumentViewProps {
  data?: DocumentData | undefined;
  title?: string | undefined;
  version?: number | undefined;
  onChange?: ((next: string) => void) | undefined;
}

function buildVersionList(data: DocumentData | undefined, currentVersion: number | undefined): DocumentVersion[] {
  const versions = data?.versions ?? [];
  if (versions.length > 0) return versions;
  return [
    {
      version: currentVersion ?? 1,
      label: "Current",
      content: data?.content ?? ""
    }
  ];
}

export function DocumentView(props: DocumentViewProps) {
  const versions = useMemo(
    () => buildVersionList(props.data, props.version),
    [props.data, props.version]
  );
  const [selectedVersion, setSelectedVersion] = useState<number>(versions[0]?.version ?? 1);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(versions[0]?.content ?? "");

  const activeContent = useMemo(() => {
    const match = versions.find((v) => v.version === selectedVersion);
    return match?.content ?? versions[0]?.content ?? "";
  }, [versions, selectedVersion]);

  const onSelectVersion = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = Number.parseInt(event.target.value, 10);
    setSelectedVersion(next);
    setEditing(false);
    setDraft(versions.find((v) => v.version === next)?.content ?? "");
  };

  const onEditToggle = () => {
    if (editing) {
      props.onChange?.(draft);
    } else {
      setDraft(activeContent);
    }
    setEditing((prev) => !prev);
  };

  return (
    <section className="pv-document" aria-label="Document viewer">
      <header className="pv-document__bar">
        <label className="pv-document__version-label">
          <span>Version</span>
          <select value={selectedVersion} onChange={onSelectVersion} aria-label="Select document version">
            {versions.map((v) => (
              <option key={v.version} value={v.version}>
                v{v.version}
                {v.label ? ` · ${v.label}` : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="pv-document__edit-toggle"
          onClick={onEditToggle}
          aria-pressed={editing}
        >
          {editing ? "Save" : "Edit"}
        </button>
      </header>

      {editing ? (
        <textarea
          className="pv-document__editor"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          spellCheck
          aria-label="Edit document"
        />
      ) : (
        <pre className="pv-document__body" aria-label="Document content">
          {activeContent || "(empty)"}
        </pre>
      )}
    </section>
  );
}

export default DocumentView;
