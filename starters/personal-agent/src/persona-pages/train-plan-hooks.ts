/**
 * Hooks for {@link TrainPlanEditor} — extracted so the main component
 * file stays under the project's 280-line cap.
 *
 * `useTrainPlanDnd` owns the native HTML5 drag-and-drop state plus the
 * three handlers each row needs. It deliberately does not call
 * `onChange` itself — that's the parent's job — but instead emits a
 * `(fromId, toId)` move via `onReorder` when the user drops one step
 * onto another.
 */
import { useState, type DragEvent } from "react";

export interface UseTrainPlanDndOptions {
  busy: boolean;
  onReorder: (fromId: string, toId: string) => void;
}

export interface TrainPlanDnd {
  dragId: string | null;
  overId: string | null;
  onDragStart: (id: string) => (event: DragEvent<HTMLLIElement>) => void;
  onDragOver: (id: string) => (event: DragEvent<HTMLLIElement>) => void;
  onDrop: (id: string) => (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
}

/**
 * Native HTML5 drag-and-drop state + handlers for a plan-step list.
 * No external libraries — `draggable` + `dataTransfer` are enough for
 * simple vertical reordering of a single list.
 */
export function useTrainPlanDnd(opts: UseTrainPlanDndOptions): TrainPlanDnd {
  const { busy, onReorder } = opts;
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const onDragStart = (id: string) => (event: DragEvent<HTMLLIElement>) => {
    if (busy) {
      event.preventDefault();
      return;
    }
    setDragId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  };

  const onDragOver = (id: string) => (event: DragEvent<HTMLLIElement>) => {
    if (!dragId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (overId !== id) setOverId(id);
  };

  const onDrop = (id: string) => (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    const source = dragId ?? event.dataTransfer.getData("text/plain");
    if (source && source !== id) onReorder(source, id);
    setDragId(null);
    setOverId(null);
  };

  const onDragEnd = () => {
    setDragId(null);
    setOverId(null);
  };

  return { dragId, overId, onDragStart, onDragOver, onDrop, onDragEnd };
}
