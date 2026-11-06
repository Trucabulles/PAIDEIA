import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import selectChevron from "./rich-select-chevron.svg";

type Option = { value: string; label: string; previewFamily?: string };
type Group = { label: string; options: Option[] };

// UI-only experiment: font application still uses the existing toolbar command.
export function RichTextFontPicker({ value, label, groups, onBeforeCommand, onChange }: {
  value: string; label: string; groups: Group[];
  onBeforeCommand?: () => void; onChange: (value: string) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 260, height: 360 });
  const options = groups.flatMap(group => group.options);
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 260), window.innerWidth - 32);
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const height = Math.max(0, Math.min(360, Math.max(below, above)));
      setPosition({ width, height, left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)),
        top: below >= height ? rect.bottom + 4 : rect.top - height - 4 });
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !trigger.current?.contains(event.target) && !popup.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); setOpen(false);
      }
    };
    place();
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);

  const choose = (option: Option) => { setOpen(false); onChange(option.value); };
  return <>
    <button ref={trigger} type="button" className="toolbar-select toolbar-font-family-select rich-font-trigger"
      aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
      aria-activedescendant={open ? `${id}-${active}` : undefined}
      onMouseDown={event => { event.preventDefault(); onBeforeCommand?.(); }}
      onClick={() => { setActive(Math.max(0, options.findIndex(option => option.value === value))); setOpen(!open); }}
      onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
          event.preventDefault();
          if (!open) { onBeforeCommand?.(); setOpen(true); setActive(Math.max(0, options.findIndex(option => option.value === value))); }
          else setActive(index => event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : Math.max(0, Math.min(options.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))));
        } else if (open && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); if (options[active]) choose(options[active]); }
        else if (event.key === "Tab") setOpen(false);
      }}>
      {selected?.label || label}
      <img alt="" aria-hidden="true" className="rich-select-chevron" src={selectChevron} />
    </button>
    {open && createPortal(<div ref={popup} id={id} role="listbox" aria-label={label}
      data-rich-text-toolbar="true" className="rich-font-popup" style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.height }}
      onMouseDown={event => event.preventDefault()}>
      {groups.filter(group => group.options.length).map((group, groupIndex) => <div role="group" aria-label={group.label} key={groupIndex}>
        {group.label && <div className="rich-font-group">{group.label}</div>}
        {group.options.map(option => {
          const index = options.indexOf(option);
          return <button type="button" role="option" tabIndex={-1} id={`${id}-${index}`} key={option.value}
            aria-selected={option.value === value} className={`rich-font-option ${index === active ? "is-active" : ""}`}
            style={option.previewFamily ? { fontFamily: `"${option.previewFamily.replace(/["\\]/g, "")}", sans-serif` } : undefined}
            onPointerMove={() => setActive(index)} onClick={() => choose(option)}>{option.label}</button>;
        })}
      </div>)}
    </div>, document.body)}
  </>;
}
