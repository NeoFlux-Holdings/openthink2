/**
 * Header for {@link TrainPlanEditor} — pill title, approve-mode toggle,
 * and the three action buttons. Pulled out so the main file stays
 * under the 280-line cap.
 */
import type { TrainPlanMode } from "./train-plan-editor";

export interface TrainPlanHeaderProps {
  mode: TrainPlanMode;
  busy: boolean;
  approveNextDisabled: boolean;
  approveAllDisabled: boolean;
  onModeChange: (mode: TrainPlanMode) => void;
  onApproveAll: () => void;
  onApproveNext: () => void;
  onReject: () => void;
}

export function TrainPlanHeader(props: TrainPlanHeaderProps) {
  const {
    mode,
    busy,
    approveNextDisabled,
    approveAllDisabled,
    onModeChange,
    onApproveAll,
    onApproveNext,
    onReject
  } = props;

  return (
    <header className="persona-train__header">
      <div className="persona-train__title">
        <span className="persona-train__pill">Draft plan</span>
        <h1>Review &amp; approve the agent&rsquo;s next steps</h1>
      </div>
      <div className="persona-train__mode" role="radiogroup" aria-label="Approval mode">
        <button
          type="button"
          role="radio"
          aria-checked={mode === "approve-all"}
          className={`persona-train__mode-option${mode === "approve-all" ? " is-active" : ""}`}
          onClick={() => onModeChange("approve-all")}
          disabled={busy}
        >
          Approve all
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "step-by-step"}
          className={`persona-train__mode-option${mode === "step-by-step" ? " is-active" : ""}`}
          onClick={() => onModeChange("step-by-step")}
          disabled={busy}
        >
          Step-by-step
        </button>
      </div>
      <div className="persona-train__actions">
        <button
          type="button"
          className="persona-train__btn persona-train__btn--reject"
          onClick={onReject}
          disabled={busy}
        >
          Reject
        </button>
        <button
          type="button"
          className="persona-train__btn persona-train__btn--next"
          onClick={onApproveNext}
          disabled={approveNextDisabled}
          title={
            mode === "step-by-step"
              ? "Approve next pending step"
              : "Switch to step-by-step to enable"
          }
        >
          Approve next
        </button>
        <button
          type="button"
          className="persona-train__btn persona-train__btn--all"
          onClick={onApproveAll}
          disabled={approveAllDisabled}
        >
          Approve all
        </button>
      </div>
    </header>
  );
}
