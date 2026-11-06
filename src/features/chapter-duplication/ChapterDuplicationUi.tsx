import { useLayoutEffect, useState, type MouseEvent } from "react";
import { DuplicateIcon } from "../../components/app/AppIcons";
import type { ChapterEntry } from "../../app/projectSelectors";
import type { TranslationParams } from "../../i18n";
import type { ChapterAssetConflict, ChapterClipboard, ChapterOperationKind, ChapterPasteTarget } from "./useChapterDuplication";
import "./chapterDuplication.css";

type Translator = (key: string, params?: TranslationParams, fallback?: string) => string;

export function ChapterDuplicateButton({
  busy,
  entry,
  onCopy,
  onDuplicate,
  t
}: {
  busy: boolean;
  entry: ChapterEntry;
  onCopy: (entry: ChapterEntry) => void;
  onDuplicate: (entry: ChapterEntry) => void;
  t: Translator;
}) {
  return (
    <button
      aria-label={t("lesson.duplicateChapter", undefined, "Dupliquer le chapitre")}
      className="chapter-duplicate-button"
      disabled={busy}
      onClick={(event) => {
        event.stopPropagation();
        onDuplicate(entry);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onCopy(entry);
      }}
      title={t("lesson.duplicateChapterHint", undefined, "Cliquer pour dupliquer. Clic droit pour copier et coller.")}
      type="button"
    >
      <DuplicateIcon />
    </button>
  );
}

export function ChapterPasteTargetButton({
  busy,
  clipboard,
  onPaste,
  target,
  t
}: {
  busy: boolean;
  clipboard: ChapterClipboard;
  onPaste: (target: ChapterPasteTarget) => void;
  target: ChapterPasteTarget;
  t: Translator;
}) {
  return (
    <button
      aria-label={`${t("chapterClipboard.pasteHere", undefined, "Coller ici")} : ${clipboard.chapter.title}`}
      className="chapter-paste-target"
      disabled={busy}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onPaste(target);
      }}
      type="button"
    >
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 5.5H7.5A1.5 1.5 0 0 0 6 7v12a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V7a1.5 1.5 0 0 0-1.5-1.5H15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M9 4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5v2H9v-2Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="m9.5 14 2.5 2.5 2.5-2.5M12 10.5v6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
      <span>{t("chapterClipboard.pasteHere", undefined, "Coller ici")}</span>
    </button>
  );
}

export function ChapterPastePending({
  busy,
  clipboard,
  onCancel,
  t
}: {
  busy: boolean;
  clipboard: ChapterClipboard;
  onCancel: () => void;
  t: Translator;
}) {
  const [top, setTop] = useState(12);

  useLayoutEffect(() => {
    const workspace = document.querySelector<HTMLElement>(".workspace-shell");
    const chromeBars = workspace?.querySelector<HTMLElement>(".chrome-bars");
    if (!workspace || !chromeBars) {
      return;
    }
    const observedWorkspace = workspace;
    const observedChromeBars = chromeBars;

    let animationFrame = 0;
    let followUntil = 0;

    function measureChromeBottom() {
      const nextTop = Math.max(12, Math.round(observedChromeBars.getBoundingClientRect().bottom) + 10);
      setTop((current) => (current === nextTop ? current : nextTop));
    }

    function followChrome(timestamp: number) {
      measureChromeBottom();
      if (timestamp < followUntil) {
        animationFrame = window.requestAnimationFrame(followChrome);
      } else {
        animationFrame = 0;
      }
    }

    function startFollowingChrome() {
      followUntil = performance.now() + 250;
      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(followChrome);
      }
    }

    function finishFollowingChrome() {
      measureChromeBottom();
    }

    const resizeObserver = new ResizeObserver(startFollowingChrome);
    const classObserver = new MutationObserver(startFollowingChrome);
    resizeObserver.observe(observedChromeBars);
    classObserver.observe(observedWorkspace, { attributes: true, attributeFilter: ["class"] });
    observedChromeBars.addEventListener("transitionrun", startFollowingChrome);
    observedChromeBars.addEventListener("transitionend", finishFollowingChrome);
    window.addEventListener("resize", startFollowingChrome);
    measureChromeBottom();

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
      resizeObserver.disconnect();
      classObserver.disconnect();
      observedChromeBars.removeEventListener("transitionrun", startFollowingChrome);
      observedChromeBars.removeEventListener("transitionend", finishFollowingChrome);
      window.removeEventListener("resize", startFollowingChrome);
    };
  }, []);

  return (
    <div className="chapter-paste-pending" role="status" style={{ top }}>
      <span>{t("chapterClipboard.ready", { title: clipboard.chapter.title }, `« ${clipboard.chapter.title} » prêt à coller`)}</span>
      <button disabled={busy} onClick={onCancel} type="button">{t("common.cancel")}</button>
    </div>
  );
}

export function ChapterOperationPending({ kind, t }: { kind: ChapterOperationKind; t: Translator }) {
  const label = kind === "duplicate"
    ? t("lesson.duplicateChapter", undefined, "Dupliquer le chapitre")
    : t("chapterClipboard.paste", undefined, "Coller le chapitre");
  return (
    <div className="paideia-modal-backdrop chapter-operation-backdrop" role="presentation">
      <section aria-live="assertive" aria-modal="true" className="paideia-modal chapter-operation-dialog" role="status">
        <div aria-hidden="true" className="import-spinner" />
        <h2>{label}…</h2>
      </section>
    </div>
  );
}

function stopDialogPropagation(event: MouseEvent<HTMLElement>) {
  event.stopPropagation();
}

export function ChapterCopyConfirmationDialog({
  entry,
  onCancel,
  onConfirm,
  t
}: {
  entry: ChapterEntry;
  onCancel: () => void;
  onConfirm: () => void;
  t: Translator;
}) {
  return (
    <div className="paideia-modal-backdrop" onClick={onCancel} role="presentation">
      <section aria-labelledby="copy-chapter-title" aria-modal="true" className="paideia-modal" onClick={stopDialogPropagation} role="dialog">
        <p className="eyebrow">{t("chapterClipboard.eyebrow", undefined, "Chapitre")}</p>
        <h2 id="copy-chapter-title">{t("chapterClipboard.copyTitle", undefined, "Copier ce chapitre ?")}</h2>
        <p>{t("chapterClipboard.copyQuestion", { title: entry.chapter.title }, `Le chapitre « ${entry.chapter.title} » sera prêt à être collé dans une leçon modifiable.`)}</p>
        <div className="modal-actions">
          <button className="ghost-pill" onClick={onCancel} type="button">{t("common.cancel")}</button>
          <button className="primary-pill" onClick={onConfirm} type="button">{t("common.copy", undefined, "Copier")}</button>
        </div>
      </section>
    </div>
  );
}

export function ChapterAssetConflictDialog({
  busy,
  conflict,
  onCancel,
  onConfirm,
  onToggle,
  onToggleAll,
  t
}: {
  busy: boolean;
  conflict: ChapterAssetConflict;
  onCancel: () => void;
  onConfirm: () => void;
  onToggle: (sourceAssetRef: string) => void;
  onToggleAll: () => void;
  t: Translator;
}) {
  const allSelected = conflict.reusedSourceRefs.size === conflict.duplicates.length;
  return (
    <div className="paideia-modal-backdrop" onClick={onCancel} role="presentation">
      <section aria-labelledby="chapter-assets-title" aria-modal="true" className="paideia-modal chapter-assets-dialog" onClick={stopDialogPropagation} role="dialog">
        <p className="eyebrow">{t("chapterClipboard.mediaEyebrow", undefined, "Médias identiques")}</p>
        <h2 id="chapter-assets-title">{t("chapterClipboard.mediaTitle", undefined, "Choisir les médias à réutiliser")}</h2>
        <p>{t("chapterClipboard.mediaQuestion", undefined, "Les médias cochés réutiliseront le fichier déjà présent. Les autres seront copiés.")}</p>
        <label className="chapter-assets-select-all">
          <input checked={allSelected} disabled={busy} onChange={onToggleAll} type="checkbox" />
          <span>{t("common.selectAll", undefined, "Tout sélectionner")}</span>
          <span className="chapter-assets-selection-count">
            {conflict.reusedSourceRefs.size}/{conflict.duplicates.length}
          </span>
        </label>
        <div className="chapter-assets-list">
          {conflict.duplicates.map((duplicate) => (
            <label className="chapter-assets-item" key={duplicate.sourceAssetRef}>
              <input
                checked={conflict.reusedSourceRefs.has(duplicate.sourceAssetRef)}
                disabled={busy}
                onChange={() => onToggle(duplicate.sourceAssetRef)}
                type="checkbox"
              />
              <span>
                <strong>{duplicate.sourceFileName}</strong>
                <small>{t("chapterClipboard.reuseExisting", { file: duplicate.existingFileName }, `Réutiliser « ${duplicate.existingFileName} »`)}</small>
              </span>
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button className="ghost-pill" disabled={busy} onClick={onCancel} type="button">{t("common.cancel")}</button>
          <button className="primary-pill" disabled={busy} onClick={onConfirm} type="button">{t("chapterClipboard.paste", undefined, "Coller le chapitre")}</button>
        </div>
      </section>
    </div>
  );
}
