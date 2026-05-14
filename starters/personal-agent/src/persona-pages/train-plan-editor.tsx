/**
 * Train-mode plan editor — controlled component for inspecting and
 * editing the agent's draft plan before execution.
 *
 * The agent externalizes its reasoning as a numbered list of editable
 * steps; the user may approve the whole plan, edit / reorder inline,
 * or approve step-by-step. Parent owns state; this component emits
 * `onChange` for every mutation. Runner-driven status updates flow
 * back via `steps`.
 *
 * Pure helpers (`reorderSteps`, `addStep`, `removeStep`, `updateStep`)
 * are exported and unit-tested without React. Row / header
 * sub-components + DnD hook live in sibling files (280-line cap).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { PlanRow } from "./train-plan-row";
import { TrainPlanHeader } from "./train-plan-header";
import { useTrainPlanDnd } from "./train-plan-hooks";

export type PlanStepStatus =
  | "pending" | "approved" | "running" | "complete" | "skipped" | "error";

export interface PlanStep {
  id: string;
  /** What this step will do. */
  title: string;
  /** Optional detail / why. */
  detail?: string;
  /** Tools this step will use. Surfaced as read-only chips. */
  toolBindings?: string[];
  /** Per-step status driven by the runner. */
  status: PlanStepStatus;
  /** Set when status === "error". */
  error?: string;
}

export type TrainPlanMode = "approve-all" | "step-by-step";

export interface TrainPlanEditorProps {
  steps: PlanStep[];
  mode: TrainPlanMode;
  /** Fires for title / detail / order / add / delete / mode-toggle edits. */
  onChange: (next: { steps: PlanStep[]; mode: TrainPlanMode }) => void;
  onApproveAll: () => void;
  onApproveNext: () => void;
  onReject: () => void;
  /** Disabled while the runner is mid-step. */
  busy?: boolean;
}

/* ──────────────────────────── pure helpers ────────────────────────────── */

function freshId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `step-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

/** Move the step with `fromId` to the index of the step with `toId`. */
export function reorderSteps(steps: PlanStep[], fromId: string, toId: string): PlanStep[] {
  if (fromId === toId) return steps.slice();
  const from = steps.findIndex((s) => s.id === fromId);
  const to = steps.findIndex((s) => s.id === toId);
  if (from === -1 || to === -1) return steps.slice();
  const next = steps.slice();
  const [moved] = next.splice(from, 1);
  if (!moved) return steps.slice();
  next.splice(to, 0, moved);
  return next;
}

/** Insert a new pending step at `atIndex`, or append when omitted. */
export function addStep(steps: PlanStep[], atIndex?: number): PlanStep[] {
  const fresh: PlanStep = { id: freshId(), title: "", status: "pending" };
  const next = steps.slice();
  if (atIndex === undefined || atIndex < 0 || atIndex > next.length) {
    next.push(fresh);
  } else {
    next.splice(atIndex, 0, fresh);
  }
  return next;
}

/** Return a list with the step matching `id` removed. */
export function removeStep(steps: PlanStep[], id: string): PlanStep[] {
  return steps.filter((s) => s.id !== id);
}

/** Merge `patch` into the step with `id`. Pure: input is never mutated. */
export function updateStep(steps: PlanStep[], id: string, patch: Partial<PlanStep>): PlanStep[] {
  return steps.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

/* ─────────────────────────────── component ─────────────────────────────── */

type EditTarget = { stepId: string; field: "title" | "detail" } | null;

export function TrainPlanEditor(props: TrainPlanEditorProps) {
  const { steps, mode, onChange, onApproveAll, onApproveNext, onReject, busy = false } = props;

  const [selectedId, setSelectedId] = useState<string | null>(steps[0]?.id ?? null);
  const [editing, setEditing] = useState<EditTarget>(null);
  const focusAfterAddRef = useRef<string | null>(null);

  // Keep selection in sync when the list shape changes underneath us.
  useEffect(() => {
    if (selectedId && steps.some((s) => s.id === selectedId)) return;
    setSelectedId(steps[0]?.id ?? null);
  }, [steps, selectedId]);

  // After "Add step", focus the new title input.
  useEffect(() => {
    if (!focusAfterAddRef.current) return;
    const id = focusAfterAddRef.current;
    focusAfterAddRef.current = null;
    setSelectedId(id);
    setEditing({ stepId: id, field: "title" });
  }, [steps]);

  const stepIndex = useMemo(() => {
    const map = new Map<string, number>();
    steps.forEach((s, i) => map.set(s.id, i));
    return map;
  }, [steps]);

  const emit = useCallback(
    (nextSteps: PlanStep[], nextMode: TrainPlanMode = mode) =>
      onChange({ steps: nextSteps, mode: nextMode }),
    [mode, onChange]
  );

  const handleEditTitle = useCallback(
    (id: string, title: string) => emit(updateStep(steps, id, { title })),
    [emit, steps]
  );

  const handleEditDetail = useCallback(
    (id: string, detail: string) => {
      // exactOptionalPropertyTypes: clearing means stripping the key,
      // not assigning `undefined`. Done inline so updateStep stays pure.
      if (detail.length === 0) {
        emit(
          steps.map((s) => {
            if (s.id !== id) return s;
            const { detail: _omit, ...rest } = s;
            return rest;
          })
        );
        return;
      }
      emit(updateStep(steps, id, { detail }));
    },
    [emit, steps]
  );

  const handleAdd = useCallback(() => {
    const next = addStep(steps);
    const fresh = next[next.length - 1];
    if (fresh) focusAfterAddRef.current = fresh.id;
    emit(next);
  }, [emit, steps]);

  const handleDelete = useCallback(
    (id: string) => {
      const idx = stepIndex.get(id) ?? -1;
      const next = removeStep(steps, id);
      const fallback = next[Math.min(idx, next.length - 1)] ?? next[0];
      setSelectedId(fallback?.id ?? null);
      setEditing(null);
      emit(next);
    },
    [emit, stepIndex, steps]
  );

  const handleToggleMode = useCallback(
    (nextMode: TrainPlanMode) => emit(steps, nextMode),
    [emit, steps]
  );

  // Drag-and-drop reordering (native HTML5 — no library).
  const dnd = useTrainPlanDnd({
    busy,
    onReorder: (fromId, toId) => emit(reorderSteps(steps, fromId, toId))
  });

  // List-level keyboard navigation; edit-mode keys are handled by the input.
  const onListKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    if (editing) return;
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      onApproveAll();
      return;
    }
    if (!selectedId) return;
    const idx = stepIndex.get(selectedId) ?? -1;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const n = steps[Math.min(idx + 1, steps.length - 1)];
      if (n) setSelectedId(n.id);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const p = steps[Math.max(idx - 1, 0)];
      if (p) setSelectedId(p.id);
    } else if (event.key === "Enter") {
      event.preventDefault();
      setEditing({ stepId: selectedId, field: "title" });
    }
  };

  const hasPending = steps.some((s) => s.status === "pending" || s.status === "approved");
  const approveNextDisabled = busy || mode !== "step-by-step" || !hasPending;
  const approveAllDisabled = busy || !hasPending;

  return (
    <section className="persona-page persona-train" aria-label="Draft plan" data-busy={busy ? "true" : "false"}>
      <TrainPlanHeader
        mode={mode}
        busy={busy}
        approveNextDisabled={approveNextDisabled}
        approveAllDisabled={approveAllDisabled}
        onModeChange={handleToggleMode}
        onApproveAll={onApproveAll}
        onApproveNext={onApproveNext}
        onReject={onReject}
      />

      <ol className="persona-train__list" onKeyDown={onListKeyDown} tabIndex={0} aria-label="Plan steps">

        {steps.map((step, idx) => (
          <PlanRow
            key={step.id}
            step={step}
            index={idx}
            isSelected={selectedId === step.id}
            isDropTarget={dnd.overId === step.id && dnd.dragId !== null && dnd.dragId !== step.id}
            isDragging={dnd.dragId === step.id}
            busy={busy}
            editing={editing && editing.stepId === step.id ? editing.field : null}
            onSelect={() => setSelectedId(step.id)}
            onBeginEdit={(field) => setEditing({ stepId: step.id, field })}
            onCancelEdit={() => setEditing(null)}
            onCommitTitle={(value) => {
              handleEditTitle(step.id, value);
              setEditing(null);
            }}
            onCommitDetail={(value) => {
              handleEditDetail(step.id, value);
              setEditing(null);
            }}
            onDelete={() => handleDelete(step.id)}
            onDragStart={dnd.onDragStart(step.id)}
            onDragOver={dnd.onDragOver(step.id)}
            onDrop={dnd.onDrop(step.id)}
            onDragEnd={dnd.onDragEnd}
          />
        ))}
        {steps.length === 0 && (
          <li className="persona-train__empty">
            No steps yet. Click &ldquo;Add step&rdquo; to draft one.
          </li>
        )}
      </ol>

      <button type="button" className="persona-train__add" onClick={handleAdd} disabled={busy}>
        + Add step
      </button>

      <p className="persona-train__hint">
        ↑/↓ navigate · Enter edits · Esc cancels · ⌘/Ctrl+Enter approves all
      </p>
    </section>
  );
}
