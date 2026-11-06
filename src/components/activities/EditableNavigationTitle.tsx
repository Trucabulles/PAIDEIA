import { useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useI18n } from "../../i18n/react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  renderEditor?: (finish: () => void) => ReactNode;
  onBeginEditing?: () => void;
};

/** Keep navigation immediate; only the second click enters text editing. */
export function EditableNavigationTitle({ renderEditor, onBeginEditing, children, onClick, onKeyDown, ...props }: Props) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (editing) root.current?.querySelector<HTMLElement>("[contenteditable=true]")?.focus({ preventScroll: true });
  }, [editing]);

  if (editing && renderEditor) {
    return <div ref={root} className={props.className} id={props.id} role={props.role}
      aria-selected={props["aria-selected"]} aria-controls={props["aria-controls"]}
      aria-expanded={props["aria-expanded"]}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}>
      {renderEditor(() => setEditing(false))}
    </div>;
  }
  return <button {...props} onKeyDown={onKeyDown}
    title={renderEditor ? t("richText.editTitleHint") : props.title}
    onClick={(event) => {
      if (!renderEditor || event.detail < 2) onClick?.(event);
    }}
    onDoubleClick={renderEditor ? (event) => {
      event.preventDefault();
      event.stopPropagation();
      onBeginEditing?.();
      setEditing(true);
    } : undefined}>{children}</button>;
}
