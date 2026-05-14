/**
 * Plan-row sub-component for {@link TrainPlanEditor}.
 *
 * Kept in its own file so the main editor stays under the project's
 * 280-line cap. The row owns the inline-edit lifecycle for one step:
 * which field (title/detail) is editing, where focus goes, and the
 * native HTML5 drag handlers piped down from the parent.
 *
 * The `StatusGlyph` component is co-located here because nothing else
 * renders status pips.
 */
import { useEffect, useRef, type DragEvent } from "react";
import type { PlanStep, PlanStepStatus } from "./train-plan-editor";

export function StatusGlyph({ status }: { status: PlanStepStatus }) {
  switch (status) {
    case "running":
      return (
        <span className="persona-train__status persona-train__status--running" aria-label="running">
          <span className="persona-train__dot" />
        </span>
      );
    case "complete":
      return (
        <span className="persona-train__status persona-train__status--complete" aria-label="complete">
          ✓
        </span>
      );
    case "skipped":
      return (
        <span className="persona-train__status persona-train__status--skipped" aria-label="skipped">
          –
        </span>
      );
    case "error":
      return (
        <span className="persona-train__status persona-train__status--error" aria-label="error">
          !
        </span>
      );
    case "approved":
      return (
        <span className="persona-train__status persona-train__status--approved" aria-label="approved">
          ○
        </span>
      );
    case "pending":
    default:
      return (
        <span className="persona-train__status persona-train__status--pending" aria-label="pending">
          ○
        </span>
      );
  }
}

export interface PlanRowProps {
  step: PlanStep;
  index: number;
  isSelected: boolean;
  isDropTarget: boolean;
  isDragging: boolean;
  busy: boolean;
  editing: "title" | "detail" | null;
  onSelect: () => void;
  onBeginEdit: (field: "title" | "detail") => void;
  onCancelEdit: () => void;
  onCommitTitle: (value: string) => void;
  onCommitDetail: (value: string) => void;
  onDelete: () => void;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDragOver: (event: DragEvent<HTMLLIElement>) => void;
  onDrop: (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: (event: DragEvent<HTMLLIElement>) => void;
}

export function PlanRow(props: PlanRowProps) {
  const {
    step,
    index,
    isSelected,
    isDropTarget,
    isDragging,
    busy,
    editing,
    onSelect,
    onBeginEdit,
    onCancelEdit,
    onCommitTitle,
    onCommitDetail,
    onDelete,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd
  } = props;

  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const detailInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing === "title") titleInputRef.current?.focus();
    if (editing === "detail") detailInputRef.current?.focus();
  }, [editing]);

  const classes = [
    "persona-train__row",
    isSelected ? "is-selected" : "",
    isDropTarget ? "is-drop-target" : "",
    isDragging ? "is-dragging" : "",
    `is-status-${step.status}`
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li
      className={classes}
      draggable={!busy && editing === null}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      data-step-id={step.id}
    >
      <span className="persona-train__handle" aria-hidden="true" title="Drag to reorder">
        ⋮⋮
      </span>
      <span className="persona-train__index" aria-hidden="true">
        {index + 1}.
      </span>
      <StatusGlyph status={step.status} />
      <div className="persona-train__body">
        {editing === "title" ? (
          <input
            ref={titleInputRef}
            className="persona-train__title-input"
            defaultValue={step.title}
            placeholder="Describe this step…"
            onBlur={(event) => onCommitTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCommitTitle(event.currentTarget.value);
              } else if (event.key === "Escape") {
                event.preventDefault();
                onCancelEdit();
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="persona-train__title-btn"
            onClick={(event) => {
              event.stopPropagation();
              onBeginEdit("title");
            }}
            disabled={busy}
          >
            {step.title || <em className="persona-train__placeholder">Untitled step</em>}
          </button>
        )}
        {editing === "detail" ? (
          <textarea
            ref={detailInputRef}
            className="persona-train__detail-input"
            defaultValue={step.detail ?? ""}
            placeholder="Why / additional detail…"
            rows={2}
            onBlur={(event) => onCommitDetail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onCancelEdit();
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="persona-train__detail-btn"
            onClick={(event) => {
              event.stopPropagation();
              onBeginEdit("detail");
            }}
            disabled={busy}
          >
            {step.detail ?? <span className="persona-train__placeholder">+ Add detail</span>}
          </button>
        )}
        {step.toolBindings && step.toolBindings.length > 0 && (
          <ul className="persona-train__chips" aria-label="Tools">
            {step.toolBindings.map((tool) => (
              <li key={tool} className="persona-train__chip">
                {tool}
              </li>
            ))}
          </ul>
        )}
        {step.status === "error" && step.error && (
          <p className="persona-train__error">{step.error}</p>
        )}
      </div>
      <button
        type="button"
        className="persona-train__delete"
        aria-label={`Delete step ${index + 1}`}
        title="Delete step"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        disabled={busy}
      >
        ×
      </button>
    </li>
  );
}
