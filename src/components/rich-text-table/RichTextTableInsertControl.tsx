import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/react";
import "./RichTextTable.css";
import { PAIDEIA_TABLE_INSERT_SIZE } from "./tableDom";

type RichTextTableInsertControlProps = {
  onBeforeOpen?: () => void;
  onInsert: (rows: number, columns: number) => void;
};

const MAX_TABLE_SIZE = PAIDEIA_TABLE_INSERT_SIZE;

export function RichTextTableInsertControl({ onBeforeOpen, onInsert }: RichTextTableInsertControlProps) {
  const { t } = useI18n();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState({ rows: 1, columns: 1 });

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <span className="rich-toolbar-group rich-table-insert-slot" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label={t("richText.table.insert", undefined, "Insérer un tableau")}
        className={`toolbar-button icon-only rich-table-insert-button ${open ? "active" : ""}`}
        onMouseDown={(event) => {
          event.preventDefault();
          onBeforeOpen?.();
        }}
        onClick={() => setOpen((current) => !current)}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          onBeforeOpen?.();
          document.dispatchEvent(new CustomEvent("paideia:open-rich-table-menu", {
            detail: { x: event.clientX, y: event.clientY }
          }));
        }}
        title={t("richText.table.insert", undefined, "Insérer un tableau")}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="16" rx="1.5" />
          <path d="M3 9h18M3 14h18M9 4v16M15 4v16" />
        </svg>
      </button>
      {open ? (
        <div className="rich-table-grid-popover" data-rich-text-dialog="true" role="dialog">
          <strong>{t("richText.table.chooseSize", undefined, "Taille du tableau")}</strong>
          <span>{hovered.rows} × {hovered.columns}</span>
          <div className="rich-table-grid-picker" role="grid">
            {Array.from({ length: MAX_TABLE_SIZE }, (_, rowIndex) =>
              Array.from({ length: MAX_TABLE_SIZE }, (_, columnIndex) => {
                const rows = rowIndex + 1;
                const columns = columnIndex + 1;
                const selected = rows <= hovered.rows && columns <= hovered.columns;
                return (
                  <button
                    aria-label={t("richText.table.createSize", { rows, columns }, `Créer un tableau de ${rows} lignes et ${columns} colonnes`)}
                    className={selected ? "selected" : ""}
                    key={`${rows}-${columns}`}
                    onFocus={() => setHovered({ rows, columns })}
                    onMouseEnter={() => setHovered({ rows, columns })}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onInsert(rows, columns);
                      setOpen(false);
                    }}
                    role="gridcell"
                    type="button"
                  />
                );
              })
            )}
          </div>
          <small>{t("richText.table.maximumSize", undefined, "Maximum : 8 × 8")}</small>
        </div>
      ) : null}
    </span>
  );
}
