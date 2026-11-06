import type { MouseEvent } from "react";
import "./windowControls.css";

type ResizeDirection = "North" | "South" | "East" | "West" | "NorthEast" | "NorthWest" | "SouthEast" | "SouthWest";

type WindowControlsProps = {
  closeLabel?: string;
  isMaximized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
};

export function WindowControls({
  closeLabel = "Fermer",
  isMaximized,
  onClose,
  onMinimize,
  onToggleMaximize
}: WindowControlsProps) {
  const maximizeLabel = isMaximized ? "Restaurer" : "Agrandir";
  return (
    <div className="paideia-window-controls">
      <button aria-label="Réduire" title="Réduire" onClick={onMinimize} type="button">
        <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M3 8.5h10" /></svg>
      </button>
      <button aria-label={maximizeLabel} title={maximizeLabel} onClick={onToggleMaximize} type="button">
        {isMaximized
          ? <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M5.5 5.5V3.5h7v7h-2M3.5 5.5h7v7h-7z" /></svg>
          : <svg aria-hidden="true" viewBox="0 0 16 16"><rect x="3.5" y="3.5" width="9" height="9" /></svg>}
      </button>
      <button aria-label={closeLabel} title={closeLabel} onClick={onClose} type="button">
        <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m3.5 3.5 9 9m0-9-9 9" /></svg>
      </button>
    </div>
  );
}

const RESIZE_DIRECTIONS = ["North", "South", "East", "West", "NorthEast", "NorthWest", "SouthEast", "SouthWest"] as const;

export function WindowResizeHandles({
  onResizeStart
}: {
  onResizeStart: (direction: ResizeDirection) => void;
}) {
  const startResize = (event: MouseEvent<HTMLDivElement>, direction: ResizeDirection) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onResizeStart(direction);
  };
  return <>{RESIZE_DIRECTIONS.map((direction) => (
    <div
      aria-hidden="true"
      className={`paideia-window-resize paideia-window-resize-${direction}`}
      key={direction}
      onMouseDown={(event) => startResize(event, direction)}
    />
  ))}</>;
}
