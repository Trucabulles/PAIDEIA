import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function RichTextOpacityPicker({ label, value, onBeforeCommand, onChange }: {
  label: string; value: number; onBeforeCommand?: () => void; onChange: (value: number) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (rect) setPosition({ left: Math.max(12, Math.min(rect.right - 150, window.innerWidth - 162)),
        top: rect.bottom + 88 < window.innerHeight ? rect.bottom + 6 : Math.max(12, rect.top - 88) });
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !trigger.current?.contains(event.target) && !panel.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); }
    };
    const peer = () => setOpen(false);
    place();
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("paideia:color-picker-exclusive-open", peer);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("paideia:color-picker-exclusive-open", peer);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  return <>
    <button type="button" ref={trigger} className="toolbar-field-fill-opacity-toggle" aria-label={label}
      title={label} aria-expanded={open} aria-controls={open ? id : undefined}
      onMouseDown={event => { event.preventDefault(); onBeforeCommand?.(); }}
      onClick={() => {
        if (!open) window.dispatchEvent(new CustomEvent("paideia:color-picker-exclusive-open", { detail: { fieldId: id } }));
        setOpen(!open);
      }}><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 7 5 5 5-5" /></svg></button>
    {open && createPortal(<div id={id} ref={panel} className="toolbar-field-fill-opacity-panel" data-rich-text-toolbar="true"
      role="group" aria-label={label} style={position}>
      <label>{label}<span className="toolbar-field-fill-opacity">
        <input type="number" min={0} max={100} value={value} aria-label={label}
          onPointerDown={() => onBeforeCommand?.()}
          onChange={event => { if (event.target.value !== "") onChange(Math.max(0, Math.min(100, Number(event.target.value)))); }} />
        <span aria-hidden="true">%</span>
      </span></label>
    </div>, document.body)}
  </>;
}
