import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { RichTextBookmarkOption } from "./richTextBookmarks";
import { useI18n } from "../../i18n/react";

type Props =
  | { mode: "create"; initialLabel: string; onApply: (label: string) => void; onClose: () => void }
  | { mode: "reference"; bookmarks: RichTextBookmarkOption[]; onApply: (bookmarkId: string) => void; onClose: () => void };

export function RichTextBookmarkDialog(props: Props) {
  const { t } = useI18n();
  const [label, setLabel] = useState(props.mode === "create" ? props.initialLabel : "");
  const [bookmarkId, setBookmarkId] = useState(props.mode === "reference" ? props.bookmarks[0]?.id ?? "" : "");
  const [referenceListOpen, setReferenceListOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const referenceSelectRef = useRef<HTMLDivElement | null>(null);
  const referenceTriggerRef = useRef<HTMLButtonElement | null>(null);
  const referenceListboxId = useId();
  useEffect(() => { inputRef.current?.focus(); referenceTriggerRef.current?.focus(); }, []);
  useEffect(() => {
    if (!referenceListOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !referenceSelectRef.current?.contains(event.target)) setReferenceListOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [referenceListOpen]);

  const focusReferenceOption = (position: "selected" | "first" | "last" | "next" | "previous") => {
    requestAnimationFrame(() => {
      const options = Array.from(referenceSelectRef.current?.querySelectorAll<HTMLButtonElement>("[role='option']") ?? []);
      if (!options.length) return;
      const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);
      const selectedIndex = options.findIndex((option) => option.dataset.bookmarkId === bookmarkId);
      const nextIndex = position === "first" ? 0
        : position === "last" ? options.length - 1
          : position === "next" ? Math.min(options.length - 1, Math.max(0, currentIndex + 1))
            : position === "previous" ? Math.max(0, currentIndex < 0 ? selectedIndex : currentIndex - 1)
              : Math.max(0, selectedIndex);
      options[nextIndex]?.focus();
    });
  };

  const handleReferenceListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setReferenceListOpen(false);
      referenceTriggerRef.current?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusReferenceOption(event.key === "ArrowDown" ? "next" : event.key === "ArrowUp" ? "previous" : event.key === "Home" ? "first" : "last");
    }
  };
  return (
    <div className="paideia-modal-backdrop rich-text-dialog-backdrop" data-rich-text-dialog="true" role="presentation">
      <form
        aria-labelledby="rich-bookmark-dialog-title"
        aria-modal="true"
        className="paideia-modal rich-text-bookmark-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          if (props.mode === "create") props.onApply(label);
          else if (bookmarkId) props.onApply(bookmarkId);
        }}
        role="dialog"
      >
        <p className="modal-kicker">{t("richText.kicker", undefined, "Rich Text")}</p>
        <h2 id="rich-bookmark-dialog-title">{props.mode === "create" ? t("richText.createBookmark", undefined, "Créer une balise") : t("richText.insertReferenceShort", undefined, "Insérer un renvoi")}</h2>
        {props.mode === "create" ? (
          <label className="modal-field">{t("richText.bookmarkName", undefined, "Nom de la balise")}
            <input ref={inputRef} value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
        ) : (
          <div className="modal-field">{t("richText.targetBookmark", undefined, "Balise cible")}
            <div className="rich-reference-select" ref={referenceSelectRef}>
            <button
              aria-label={t("richText.targetBookmark", undefined, "Balise cible")}
              aria-controls={referenceListboxId}
              aria-expanded={referenceListOpen}
              aria-haspopup="listbox"
              className="rich-reference-select-trigger"
              onClick={() => setReferenceListOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                event.preventDefault();
                setReferenceListOpen(true);
                focusReferenceOption("selected");
              }}
              ref={referenceTriggerRef}
              type="button"
            >
              <span>{props.bookmarks.find((bookmark) => bookmark.id === bookmarkId)?.label ?? ""}</span>
              <span aria-hidden="true" className="rich-reference-select-chevron">⌄</span>
            </button>
            {referenceListOpen ? (
              <div className="rich-reference-select-options" id={referenceListboxId} onKeyDown={handleReferenceListKeyDown} role="listbox">
                {[...new Set(props.bookmarks.map((bookmark) => bookmark.sourceType === "reference-bank" ? bookmark.bankId : "lesson"))].map((group) => {
                  const entries = props.bookmarks.filter((bookmark) => (bookmark.sourceType === "reference-bank" ? bookmark.bankId : "lesson") === group);
                  const groupLabel = group === "lesson" ? t("richText.lessonBookmarks", undefined, "Balises de la leçon") : entries[0].chapterTitle;
                  return <div aria-label={groupLabel} className="rich-reference-select-group" key={group} role="group">
                    <div className="rich-reference-select-group-label">{groupLabel}</div>
                    {entries.map((bookmark) => (
                      <button
                        aria-selected={bookmark.id === bookmarkId}
                        className="rich-reference-select-option"
                        data-bookmark-id={bookmark.id}
                        key={bookmark.id}
                        onClick={() => {
                          setBookmarkId(bookmark.id);
                          setReferenceListOpen(false);
                          referenceTriggerRef.current?.focus();
                        }}
                        role="option"
                        type="button"
                      >{bookmark.label}</button>
                    ))}
                  </div>;
                })}
              </div>
            ) : null}
            </div>
            {props.bookmarks.find((bookmark) => bookmark.id === bookmarkId) ? (
              <>
                <small>{props.bookmarks.find((bookmark) => bookmark.id === bookmarkId)?.chapterTitle}</small>
                <small>{props.bookmarks.find((bookmark) => bookmark.id === bookmarkId)?.excerpt}</small>
              </>
            ) : null}
          </div>
        )}
        <div className="modal-actions">
          <button className="ghost-pill" onClick={props.onClose} type="button">{t("common.cancel")}</button>
          <button className="primary-pill" disabled={props.mode === "create" ? !label.trim() : !bookmarkId} type="submit">
            {props.mode === "create" ? t("common.create") : t("richText.insert", undefined, "Insérer")}
          </button>
        </div>
      </form>
    </div>
  );
}
