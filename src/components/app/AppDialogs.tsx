import type {
  ActivityClipboardState,
  AnnotationCropWarningDialogState,
  CharacterPackageConflictDialogState,
  CopyActivityDialogState,
  CreateLessonDialogState,
  CreateLibraryCollectionDialogState,
  DeleteBlockDialogState,
  DeleteChapterDialogState,
  DeleteLibraryProjectDialogState,
  DeleteUserCharacterDialogState,
  DeleteUserFontDialogState,
  EnlargedImageState,
  ImportDialogState,
  PasteActivityDialogState,
  PdfExportDialogState,
  QuizLmsConflictDialogState,
  RenameLibraryProjectDialogState,
  ScormBatchProgressState,
  ScormBatchSummaryState
} from "../../app/appStateTypes";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { RichInlineImageDimensions, RichInlineImageWrap } from "../rich-text-toolbar/richInlineImage";
import { RichInlineImageResizeDialog } from "../rich-text-toolbar/RichInlineImageResizeDialog";
import { RichTextLinkDialog } from "../rich-text-toolbar/RichTextLinkDialog";
import { useI18n } from "../../i18n/react";
import { LicenseDialog } from "./LicenseDialog";
import { PdfExportDialog } from "./PdfExportDialog";

type RichTextLinkDialogState = {
  text: string;
  url: string;
};

function renderChangelogInline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).filter(Boolean).map((part, index) =>
    part.startsWith("`") && part.endsWith("`")
      ? <code key={`${index}-${part}`}>{part.slice(1, -1)}</code>
      : part
  );
}

function renderChangelogContent(content: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;
    nodes.push(
      <ul key={`list-${nodes.length}`}>
        {listItems.map((item, index) => <li key={`${index}-${item}`}>{renderChangelogInline(item)}</li>)}
      </ul>
    );
    listItems = [];
  };

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }
    if (line === "# Changelog PAIDEIA") continue;
    if (line.startsWith("## ")) {
      flushList();
      nodes.push(<h3 key={`heading-${nodes.length}`}>{renderChangelogInline(line.slice(3))}</h3>);
      continue;
    }
    if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
      continue;
    }
    flushList();
    nodes.push(<p key={`paragraph-${nodes.length}`}>{renderChangelogInline(line.replace(/^#+\s*/, ""))}</p>);
  }
  flushList();
  return nodes;
}

type ImageViewerProps = {
  image: EnlargedImageState;
  onClose: () => void;
};

function ImageViewer({ image, onClose }: ImageViewerProps) {
  const { t } = useI18n();
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [fitScale, setFitScale] = useState(1);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const clampPan = (nextPan: { x: number; y: number }, nextScale = scale) => {
    const viewport = viewportRef.current;
    if (!viewport || !naturalSize.width || !naturalSize.height) return { x: 0, y: 0 };
    const maxX = Math.max(0, (naturalSize.width * nextScale - viewport.clientWidth) / 2);
    const maxY = Math.max(0, (naturalSize.height * nextScale - viewport.clientHeight) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, nextPan.x)),
      y: Math.max(-maxY, Math.min(maxY, nextPan.y))
    };
  };

  const fitToViewport = () => {
    const viewport = viewportRef.current;
    const source = imageRef.current;
    if (!viewport || !source?.naturalWidth || !source.naturalHeight) return;
    const nextFit = Math.min(1, viewport.clientWidth / source.naturalWidth, viewport.clientHeight / source.naturalHeight);
    setNaturalSize({ width: source.naturalWidth, height: source.naturalHeight });
    setFitScale(nextFit);
    setScale(nextFit);
    setPan({ x: 0, y: 0 });
  };

  const applyScale = (nextScale: number, clientX?: number, clientY?: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const boundedScale = Math.max(fitScale, Math.min(2, nextScale));
    if (Math.abs(boundedScale - scale) < 0.0001) return;
    const rect = viewport.getBoundingClientRect();
    const anchorX = clientX === undefined ? 0 : clientX - (rect.left + rect.width / 2);
    const anchorY = clientY === undefined ? 0 : clientY - (rect.top + rect.height / 2);
    const ratio = boundedScale / scale;
    const nextPan = {
      x: anchorX - (anchorX - pan.x) * ratio,
      y: anchorY - (anchorY - pan.y) * ratio
    };
    setScale(boundedScale);
    setPan(clampPan(nextPan, boundedScale));
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const observer = new ResizeObserver(() => fitToViewport());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [image.src]);

  return (
    <div aria-label={image.alt || t("activity.image", undefined, "Image")} className="image-lightbox" onClick={(event) => event.target === event.currentTarget && onClose()} role="dialog" aria-modal="true">
      <button aria-label={t("common.close")} className="image-lightbox-close" onClick={onClose} title={t("common.close")} type="button" />
      <div
        className={`image-lightbox-viewport${scale > fitScale + 0.001 ? " is-zoomed" : ""}`}
        onDoubleClick={fitToViewport}
        onPointerDown={(event) => {
          if (scale <= fitScale + 0.001) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          setPan(clampPan({ x: drag.panX + event.clientX - drag.x, y: drag.panY + event.clientY - drag.y }));
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
        }}
        onWheel={(event) => {
          event.preventDefault();
          applyScale(scale * Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
        }}
        ref={viewportRef}
      >
        <img
          alt={image.alt}
          className={image.rounded ? "rounded" : ""}
          draggable={false}
          onLoad={fitToViewport}
          ref={imageRef}
          src={image.src}
          style={{
            height: naturalSize.height || undefined,
            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})`,
            width: naturalSize.width || undefined
          }}
        />
      </div>
      <div className="image-lightbox-controls" onClick={(event) => event.stopPropagation()}>
        <button aria-label={t("imageViewer.zoomOut", undefined, "Réduire")} onClick={() => applyScale(scale / 1.25)} type="button">−</button>
        <button className="image-lightbox-zoom-value" onClick={() => applyScale(1)} type="button">
          {Math.round(scale * 100)} %
        </button>
        <button aria-label={t("imageViewer.zoomIn", undefined, "Agrandir")} onClick={() => applyScale(scale * 1.25)} type="button">+</button>
        <button onClick={fitToViewport} type="button">{t("imageViewer.fit", undefined, "Ajuster")}</button>
      </div>
    </div>
  );
}

type AppDialogsProps = {
  activityClipboard: ActivityClipboardState | null;
  annotationCommitRunning: boolean;
  annotationCropWarningDialog: AnnotationCropWarningDialogState | null;
  blockAnnotationCropWarningId: string | null;
  busyAction: string | null;
  characterPackageConflictDialog: CharacterPackageConflictDialogState | null;
  copyActivityDialog: CopyActivityDialogState | null;
  createLessonDialog: CreateLessonDialogState | null;
  createLibraryCollectionDialog: CreateLibraryCollectionDialogState | null;
  deleteBlockDialog: DeleteBlockDialogState | null;
  deleteChapterDialog: DeleteChapterDialogState | null;
  deleteLibraryProjectDialog: DeleteLibraryProjectDialogState | null;
  deleteUserCharacterDialog: DeleteUserCharacterDialogState | null;
  deleteUserFontDialog: DeleteUserFontDialogState | null;
  enlargedImage: EnlargedImageState | null;
  fontOperationError: string | null;
  importDialog: ImportDialogState | null;
  licenseDialogOpen: boolean;
  licenseDialogDocument: "license" | "third-party";
  pasteActivityDialog: PasteActivityDialogState | null;
  pdfExportDialog: PdfExportDialogState | null;
  quizLmsConflictDialog: QuizLmsConflictDialogState | null;
  renameLibraryProjectDialog: RenameLibraryProjectDialogState | null;
  richInlineImageDialog: (RichInlineImageDimensions & { altText: string; decorative: boolean; wrap: RichInlineImageWrap; rounded?: boolean; zoom?: boolean }) | null;
  richInlineImageError: string | null;
  richTextLinkDialog: RichTextLinkDialogState | null;
  richTextLinkError: string | null;
  scormBatchProgress: ScormBatchProgressState | null;
  scormBatchSummary: ScormBatchSummaryState | null;
  blockLabel: (blockType: string) => string;
  onAnnotationCropCancel: () => void;
  onAnnotationCropConfirm: () => void;
  onBlockAnnotationCropCancel: () => void;
  onBlockAnnotationCropConfirm: () => void;
  onCharacterPackageConflictCancel: () => void;
  onCharacterPackageConflictCopy: () => void;
  onCharacterPackageConflictUpdate: () => void;
  onCopyActivityCancel: () => void;
  onCopyActivityConfirm: () => void;
  onCreateLessonCancel: () => void;
  onCreateLessonConfirm: () => void;
  onCreateLessonValueChange: (value: string) => void;
  onCreateLibraryCollectionCancel: () => void;
  onCreateLibraryCollectionConfirm: () => void;
  onCreateLibraryCollectionValueChange: (value: string) => void;
  onDeleteBlockCancel: () => void;
  onDeleteBlockConfirm: () => void;
  onDeleteChapterCancel: () => void;
  onDeleteChapterConfirm: () => void;
  onDeleteLibraryProjectCancel: () => void;
  onDeleteLibraryProjectConfirm: () => void;
  onDeleteUserCharacterCancel: () => void;
  onDeleteUserCharacterConfirm: () => void;
  onDeleteUserFontCancel: () => void;
  onDeleteUserFontConfirm: () => void;
  onEnlargedImageClose: () => void;
  onFontOperationErrorClose: () => void;
  onImportDialogClose: () => void;
  onImportDialogDownloadReport: () => void;
  onImportDialogViewReport: () => void;
  onLicenseDialogClose: () => void;
  onPasteActivityCancel: () => void;
  onPasteActivityConfirm: () => void;
  onPdfExportDialogClose: () => void;
  onQuizLmsConflictCancel: () => void;
  onQuizLmsConflictConfirm: () => void;
  onRenameLibraryProjectCancel: () => void;
  onRenameLibraryProjectConfirm: () => void;
  onRenameLibraryProjectValueChange: (value: string) => void;
  onRichInlineImageApply: (width: number, height: number, altText: string, decorative: boolean, wrap: RichInlineImageWrap, rounded: boolean, zoom: boolean) => void;
  onRichInlineImageClose: () => void;
  onRichInlineImageDelete: () => void;
  onRichInlineImageErrorClose: () => void;
  onRichTextLinkApply: (url: string, text: string) => void;
  onRichTextLinkClose: () => void;
  onScormBatchSummaryClose: () => void;
};

export function AppDialogs({
  activityClipboard,
  annotationCommitRunning,
  annotationCropWarningDialog,
  blockAnnotationCropWarningId,
  busyAction,
  characterPackageConflictDialog,
  copyActivityDialog,
  createLessonDialog,
  createLibraryCollectionDialog,
  deleteBlockDialog,
  deleteChapterDialog,
  deleteLibraryProjectDialog,
  deleteUserCharacterDialog,
  deleteUserFontDialog,
  enlargedImage,
  fontOperationError,
  importDialog,
  licenseDialogOpen,
  licenseDialogDocument,
  pasteActivityDialog,
  pdfExportDialog,
  quizLmsConflictDialog,
  renameLibraryProjectDialog,
  richInlineImageDialog,
  richInlineImageError,
  richTextLinkDialog,
  richTextLinkError,
  scormBatchProgress,
  scormBatchSummary,
  blockLabel,
  onAnnotationCropCancel,
  onAnnotationCropConfirm,
  onBlockAnnotationCropCancel,
  onBlockAnnotationCropConfirm,
  onCharacterPackageConflictCancel,
  onCharacterPackageConflictCopy,
  onCharacterPackageConflictUpdate,
  onCopyActivityCancel,
  onCopyActivityConfirm,
  onCreateLessonCancel,
  onCreateLessonConfirm,
  onCreateLessonValueChange,
  onCreateLibraryCollectionCancel,
  onCreateLibraryCollectionConfirm,
  onCreateLibraryCollectionValueChange,
  onDeleteBlockCancel,
  onDeleteBlockConfirm,
  onDeleteChapterCancel,
  onDeleteChapterConfirm,
  onDeleteLibraryProjectCancel,
  onDeleteLibraryProjectConfirm,
  onDeleteUserCharacterCancel,
  onDeleteUserCharacterConfirm,
  onDeleteUserFontCancel,
  onDeleteUserFontConfirm,
  onEnlargedImageClose,
  onFontOperationErrorClose,
  onImportDialogClose,
  onImportDialogDownloadReport,
  onImportDialogViewReport,
  onLicenseDialogClose,
  onPasteActivityCancel,
  onPasteActivityConfirm,
  onPdfExportDialogClose,
  onQuizLmsConflictCancel,
  onQuizLmsConflictConfirm,
  onRenameLibraryProjectCancel,
  onRenameLibraryProjectConfirm,
  onRenameLibraryProjectValueChange,
  onRichInlineImageApply,
  onRichInlineImageClose,
  onRichInlineImageDelete,
  onRichInlineImageErrorClose,
  onRichTextLinkApply,
  onRichTextLinkClose,
  onScormBatchSummaryClose
}: AppDialogsProps) {
  const { t } = useI18n();

  useEffect(() => {
    const focusableSelector = [
      "button:not([disabled])",
      "[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])"
    ].join(", ");
    const modalSelector = ".paideia-modal-backdrop:not(.license-dialog-backdrop), .import-blocking-backdrop, .image-lightbox, .paideia-accessible-local-dialog";
    let activeModal: HTMLElement | null = null;
    let previousFocus: HTMLElement | null = null;

    const resolveModal = (): HTMLElement | null => {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(modalSelector));
      const backdrop = candidates[candidates.length - 1];
      if (!backdrop) return null;
      if (backdrop.classList.contains("image-lightbox")) return backdrop;
      return backdrop.querySelector<HTMLElement>("[role='dialog'], [role='status'], .paideia-modal, .import-status-modal") ?? backdrop;
    };

    const getFocusable = (modal: HTMLElement) => Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector))
      .filter((element) => element.getClientRects().length > 0);

    const focusModal = (modal: HTMLElement) => {
      if (!activeModal) {
        previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      }
      activeModal = modal;
      const focusable = getFocusable(modal);
      if (focusable.length) {
        focusable[0].focus();
      } else {
        modal.tabIndex = -1;
        modal.focus();
      }
    };

    const releaseModal = () => {
      if (activeModal && !document.body.contains(activeModal)) {
        activeModal = null;
        if (previousFocus?.isConnected) previousFocus.focus();
        previousFocus = null;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const modal = resolveModal();
      if (!modal) {
        releaseModal();
        return;
      }
      if (modal !== activeModal) focusModal(modal);

      const target = event.target instanceof Node ? event.target : null;
      if (!target || !modal.contains(target)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        getFocusable(modal)[0]?.focus() ?? modal.focus();
        return;
      }

      if (event.key === "Tab") {
        const focusable = getFocusable(modal);
        if (!focusable.length) {
          event.preventDefault();
          modal.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      if (event.key === "Escape") {
        const cancel = modal.querySelector<HTMLButtonElement>(".ghost-pill:not([disabled]), [data-paideia-modal-cancel='true']:not([disabled])");
        if (cancel) {
          event.preventDefault();
          event.stopPropagation();
          cancel.click();
        }
      }
    };

    const observer = new MutationObserver(() => {
      const modal = resolveModal();
      if (modal && modal !== activeModal) focusModal(modal);
      else if (!modal) releaseModal();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("keydown", handleKeyDown, true);
    const initialModal = resolveModal();
    if (initialModal) focusModal(initialModal);

    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", handleKeyDown, true);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <>
      {licenseDialogOpen ? <LicenseDialog document={licenseDialogDocument} onClose={onLicenseDialogClose} /> : null}

      {createLessonDialog ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <form
            aria-labelledby="create-lesson-title"
            aria-modal="true"
            aria-busy={busyAction === "create-project"}
            className="paideia-modal create-lesson-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              onCreateLessonConfirm();
            }}
            role="dialog"
          >
            <p className="modal-kicker">{t("dialog.createLesson.kicker")}</p>
            <h2 id="create-lesson-title">{t("dialog.createLesson.title")}</h2>
            <label className="modal-field">
              <span>{t("dialog.createLesson.name")}</span>
              <input
                autoFocus
                disabled={busyAction === "create-project"}
                onChange={(event) => onCreateLessonValueChange(event.target.value)}
                value={createLessonDialog.value}
              />
            </label>
            <div className="modal-actions">
              <button className="ghost-pill" disabled={busyAction === "create-project"} onClick={onCreateLessonCancel} type="button">{t("common.cancel")}</button>
              <button className="primary-pill" disabled={!createLessonDialog.value.trim() || busyAction === "create-project"} type="submit">{t("common.create")}</button>
            </div>
          </form>
        </div>
      ) : null}

      {createLibraryCollectionDialog ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <form
            aria-labelledby="create-library-collection-title"
            aria-modal="true"
            className="paideia-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              onCreateLibraryCollectionConfirm();
            }}
            role="dialog"
          >
            <p className="modal-kicker">{t("dialog.projectLibrary.kicker")}</p>
            <h2 id="create-library-collection-title">{t("dialog.createCollection.title")}</h2>
            <label className="modal-field">
              <span>{t("dialog.createCollection.name")}</span>
              <input
                autoFocus
                onChange={(event) => onCreateLibraryCollectionValueChange(event.target.value)}
                value={createLibraryCollectionDialog.value}
              />
            </label>
            <div className="modal-actions">
              <button className="ghost-pill" onClick={onCreateLibraryCollectionCancel} type="button">{t("common.cancel")}</button>
              <button className="primary-pill" disabled={!createLibraryCollectionDialog.value.trim()} type="submit">{t("common.create")}</button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteUserCharacterDialog ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section aria-labelledby="delete-user-character-title" aria-modal="true" className="paideia-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <p className="modal-kicker">{t("dialog.characterDelete.kicker", undefined, "Suppression de personnage")}</p>
            <h2 id="delete-user-character-title">{t("dialog.characterDelete.title", { name: deleteUserCharacterDialog.name }, "Supprimer « {name} » ?")}</h2>
            <p>{t("dialog.characterDelete.message", undefined, "Ce personnage sera supprimé de la banque utilisateur locale. Les projets qui l'ont déjà importé gardent leurs copies projet.")}</p>
            <div className="modal-actions">
              <button className="ghost-pill" onClick={onDeleteUserCharacterCancel} type="button">{t("common.cancel")}</button>
              <button className="danger-pill" onClick={onDeleteUserCharacterConfirm} type="button">{t("common.delete")}</button>
            </div>
          </section>
        </div>
      ) : null}

      {deleteUserFontDialog ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section aria-labelledby="delete-user-font-title" aria-modal="true" className="paideia-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <p className="modal-kicker">{t("dialog.fontDelete.kicker", undefined, "Suppression de police")}</p>
            <h2 id="delete-user-font-title">{deleteUserFontDialog.projectPath ? t("dialog.fontDeleteProject.title", { name: deleteUserFontDialog.name }, "Supprimer « {name} » du projet ?") : t("dialog.fontDelete.title", { name: deleteUserFontDialog.name }, "Supprimer « {name} » de la banque ?")}</h2>
            <p>{deleteUserFontDialog.projectPath ? t("dialog.fontDeleteProject.message", undefined, "Supprimer cette police du projet ? Les textes qui l’utilisent reprendront la police par défaut de la leçon, ou Inter. Si vous supprimez la police par défaut, la leçon utilisera Inter.") : t("dialog.fontDelete.message", undefined, "Cette police sera retirée de la banque locale. Les leçons qui l'ont déjà importée gardent leur copie projet.")}</p>
            <div className="modal-actions">
              <button className="ghost-pill" onClick={onDeleteUserFontCancel} type="button">{t("common.cancel")}</button>
              <button className="danger-pill" onClick={onDeleteUserFontConfirm} type="button">{t("common.delete")}</button>
            </div>
          </section>
        </div>
      ) : null}

      {["project-font", "project-font-import", "user-font", "project-font-remove", "user-font-delete"].includes(busyAction ?? "") ? (
        <div className="paideia-modal-backdrop font-operation-backdrop" role="presentation">
          <section aria-live="polite" className="paideia-modal font-operation-modal" role="status">
            <h2>{["user-font", "project-font-import"].includes(busyAction ?? "") ? t("dialog.fontOperation.importing", undefined, "Police en cours d'importation…") : t("dialog.fontOperation.applying", undefined, "Police en cours d'application au projet…")}</h2>
          </section>
        </div>
      ) : null}

      {fontOperationError ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section aria-labelledby="font-operation-error-title" aria-modal="true" className="paideia-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <p className="modal-kicker">{t("dialog.fontOperation.kicker", undefined, "Police")}</p>
            <h2 id="font-operation-error-title">{t("dialog.fontOperation.errorTitle", undefined, "Import ou application impossible")}</h2>
            <p>{fontOperationError}</p>
            <div className="modal-actions">
              <button className="primary-pill" onClick={onFontOperationErrorClose} type="button">{t("common.ok", undefined, "OK")}</button>
            </div>
          </section>
        </div>
      ) : null}

      {enlargedImage ? <ImageViewer image={enlargedImage} key={enlargedImage.src} onClose={onEnlargedImageClose} /> : null}

      {annotationCommitRunning ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section aria-live="polite" className="paideia-modal" role="status">
            <div aria-hidden="true" className="import-spinner" />
            <h2>{t("dialog.annotation.generating", undefined, "Génération de l'image annotée en cours...")}</h2>
          </section>
        </div>
      ) : null}

      {richTextLinkDialog ? (
        <RichTextLinkDialog
          error={richTextLinkError}
          initialText={richTextLinkDialog.text}
          initialUrl={richTextLinkDialog.url}
          onApply={onRichTextLinkApply}
          onClose={onRichTextLinkClose}
        />
      ) : null}

      {richInlineImageDialog ? (
        <RichInlineImageResizeDialog dimensions={richInlineImageDialog} onApply={onRichInlineImageApply} onClose={onRichInlineImageClose} onDelete={onRichInlineImageDelete} />
      ) : null}

      {richInlineImageError ? (
        <div className="paideia-modal-backdrop rich-text-dialog-backdrop" data-rich-text-dialog="true" role="presentation">
          <section aria-labelledby="rich-inline-image-error-title" aria-modal="true" className="paideia-modal" data-rich-text-dialog="true" onClick={(event) => event.stopPropagation()} role="dialog">
            <p className="modal-kicker">{t("dialog.richInlineImage.kicker", undefined, "Image intégrée au texte")}</p>
            <h2 id="rich-inline-image-error-title">{t("common.operationImpossible", undefined, "Opération impossible")}</h2>
            <p>{richInlineImageError}</p>
            <div className="modal-actions">
              <button className="primary-pill" onClick={onRichInlineImageErrorClose} type="button">{t("common.ok", undefined, "OK")}</button>
            </div>
          </section>
        </div>
      ) : null}

      {annotationCropWarningDialog ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section aria-labelledby="annotation-crop-warning-title" aria-modal="true" className="paideia-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <p className="modal-kicker">{t("dialog.annotationCrop.kicker")}</p>
            <h2 id="annotation-crop-warning-title">{t("dialog.annotationCrop.title")}</h2>
            <p>{t("dialog.annotationCrop.message")}</p>
            <div className="modal-actions">
              <button className="ghost-pill" onClick={onAnnotationCropCancel} type="button">{t("common.cancel")}</button>
              <button className="primary-pill" onClick={onAnnotationCropConfirm} type="button">{t("common.yes")}</button>
            </div>
          </section>
        </div>
      ) : null}

      {blockAnnotationCropWarningId ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section aria-labelledby="block-annotation-crop-warning-title" aria-modal="true" className="paideia-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <p className="modal-kicker">{t("dialog.annotationCrop.kicker")}</p>
            <h2 id="block-annotation-crop-warning-title">{t("dialog.annotationCrop.title")}</h2>
            <p>{t("dialog.annotationCrop.message")}</p>
            <div className="modal-actions">
              <button className="ghost-pill" onClick={onBlockAnnotationCropCancel} type="button">{t("common.cancel")}</button>
              <button className="primary-pill" onClick={onBlockAnnotationCropConfirm} type="button">{t("common.yes")}</button>
            </div>
          </section>
        </div>
      ) : null}

      {deleteChapterDialog ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section aria-labelledby="delete-chapter-title" aria-modal="true" className="paideia-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <p className="modal-kicker">{t("dialog.deleteChapter.kicker")}</p>
            <h2 id="delete-chapter-title">{t("dialog.delete.confirm")}</h2>
            <p>{t("dialog.deleteChapter.message")}</p>
            <strong>{deleteChapterDialog.entry.chapter.title}</strong>
            <div className="modal-actions">
              <button className="ghost-pill" onClick={onDeleteChapterCancel} type="button">{t("common.cancel")}</button>
              <button className="danger-pill" onClick={onDeleteChapterConfirm} type="button">{t("common.delete")}</button>
            </div>
          </section>
        </div>
      ) : null}

      {deleteLibraryProjectDialog ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section aria-labelledby="delete-library-project-title" aria-modal="true" className="paideia-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <p className="modal-kicker">{t("dialog.deleteLesson.kicker")}</p>
            <h2 id="delete-library-project-title">{t("dialog.delete.confirm")}</h2>
            <p>{t("dialog.deleteLesson.message")}</p>
            <strong>{deleteLibraryProjectDialog.entry.title}</strong>
            <div className="modal-actions">
              <button className="ghost-pill" onClick={onDeleteLibraryProjectCancel} type="button">{t("common.cancel")}</button>
              <button className="danger-pill" onClick={onDeleteLibraryProjectConfirm} type="button">{t("common.delete")}</button>
            </div>
          </section>
        </div>
      ) : null}

      {scormBatchProgress ? (
        <div className="import-blocking-backdrop" role="presentation">
          <section aria-labelledby="scorm-batch-progress-title" aria-live="polite" aria-modal="true" className="import-status-modal scorm-batch-running-modal" role="dialog">
            <div aria-hidden="true" className="import-spinner" />
            <h2 id="scorm-batch-progress-title">{t("dialog.scormBatchProgress.title")}</h2>
            <p>
              {t("dialog.scormBatchProgress.progress", { current: scormBatchProgress.current, total: scormBatchProgress.total })}<br />
              {t("dialog.scormBatchSummary.collection")} <strong>{scormBatchProgress.collection}</strong>
            </p>
            <p className="scorm-batch-current-lesson">{scormBatchProgress.lessonTitle}</p>
          </section>
        </div>
      ) : null}

      {scormBatchSummary ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section aria-labelledby="scorm-batch-summary-title" aria-modal="true" className="paideia-modal scorm-batch-summary-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <p className="modal-kicker">{t("dialog.scormBatchSummary.kicker", undefined, "Export collection SCORM 1.2")}</p>
            <h2 id="scorm-batch-summary-title">{scormBatchSummary.title}</h2>
            <div className="scorm-batch-summary">
              <p>{t("dialog.scormBatchSummary.collection", undefined, "Collection :")} <strong>{scormBatchSummary.collection}</strong></p>
              <dl>
                <div><dt>{t("dialog.scormBatchSummary.exportedLessons", undefined, "Leçons exportées")}</dt><dd>{scormBatchSummary.exportedCount} / {scormBatchSummary.totalCount}</dd></div>
                <div><dt>{t("dialog.scormBatchSummary.errors", undefined, "Erreurs")}</dt><dd>{scormBatchSummary.errors.length}</dd></div>
              </dl>
              {scormBatchSummary.destinationRoot ? (
                <p className="scorm-batch-path">{t("dialog.scormBatchSummary.folder", undefined, "Dossier :")} <span>{scormBatchSummary.destinationRoot}</span></p>
              ) : null}
              {scormBatchSummary.errors.length ? (
                <div className="scorm-batch-errors">
                  <strong>{t("dialog.scormBatchSummary.details", undefined, "Détails")}</strong>
                  <ul>{scormBatchSummary.errors.map((error) => <li key={error}>{error}</li>)}</ul>
                </div>
              ) : null}
            </div>
            <div className="modal-actions">
              <button autoFocus className="primary-pill" onClick={onScormBatchSummaryClose} type="button">{t("common.close")}</button>
            </div>
          </section>
        </div>
      ) : null}

      {pdfExportDialog ? <PdfExportDialog dialog={pdfExportDialog} onClose={onPdfExportDialogClose} /> : null}

      {renameLibraryProjectDialog ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <form
            aria-labelledby="rename-library-project-title"
            aria-modal="true"
            className="paideia-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              onRenameLibraryProjectConfirm();
            }}
            role="dialog"
          >
            <p className="modal-kicker">{t("dialog.projectLibrary.kicker")}</p>
            <h2 id="rename-library-project-title">{t("dialog.renameLesson.title")}</h2>
            <label className="modal-field">
              <span>{t("dialog.renameLesson.name")}</span>
              <input autoFocus onChange={(event) => onRenameLibraryProjectValueChange(event.target.value)} value={renameLibraryProjectDialog.value} />
            </label>
            <div className="modal-actions">
              <button className="ghost-pill" onClick={onRenameLibraryProjectCancel} type="button">{t("common.cancel")}</button>
              <button className="primary-pill" disabled={!renameLibraryProjectDialog.value.trim()} type="submit">{t("common.rename")}</button>
            </div>
          </form>
        </div>
      ) : null}

      {quizLmsConflictDialog ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section aria-labelledby="quiz-lms-conflict-title" aria-modal="true" className="paideia-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <p className="modal-kicker">{t("dialog.quizLmsConflict.kicker", undefined, "Questionnaire LMS")}</p>
            <h2 id="quiz-lms-conflict-title">{t("dialog.quizLmsConflict.title", undefined, "Un autre quiz envoie déjà la note au LMS")}</h2>
            <p>{t("dialog.quizLmsConflict.warning", undefined, "Attention, un autre quiz envoie déjà la note au LMS.")}</p>
            <p>{t("dialog.quizLmsConflict.confirm", undefined, "Êtes-vous sûr de vouloir sélectionner celui-ci ?")}</p>
            <div className="modal-actions">
              <button className="ghost-pill" onClick={onQuizLmsConflictCancel} type="button">{t("common.cancel")}</button>
              <button className="primary-pill" onClick={onQuizLmsConflictConfirm} type="button">{t("common.yes")}</button>
            </div>
          </section>
        </div>
      ) : null}

      {copyActivityDialog ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section aria-labelledby="copy-activity-title" aria-modal="true" className="paideia-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <p className="modal-kicker">{t("dialog.activityClipboard.kicker", undefined, "Tampon PAIDEIA")}</p>
            <h2 id="copy-activity-title">{t("dialog.activityClipboard.copyTitle", undefined, "Copier cette activité ?")}</h2>
            <p>{t("dialog.activityClipboard.copyMessage", undefined, "Cette activité sera copiée dans le tampon PAIDEIA. Vous pourrez ensuite l'insérer dans une autre leçon ouverte.")}</p>
            <strong>{blockLabel(copyActivityDialog.block.type)}</strong>
            <div className="modal-actions">
              <button className="ghost-pill" onClick={onCopyActivityCancel} type="button">{t("common.cancel")}</button>
              <button className="primary-pill" onClick={onCopyActivityConfirm} type="button">{t("common.copy")}</button>
            </div>
          </section>
        </div>
      ) : null}

      {pasteActivityDialog ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section aria-labelledby="paste-activity-title" aria-modal="true" className="paideia-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <p className="modal-kicker">{t("dialog.activityClipboard.kicker", undefined, "Tampon PAIDEIA")}</p>
            {pasteActivityDialog.mode === "paste" && activityClipboard ? (
              <>
                <h2 id="paste-activity-title">{t("dialog.activityClipboard.pasteTitle", undefined, "Coller cette activité ici ?")}</h2>
                <p>{t("dialog.activityClipboard.pasteMessage", undefined, "L'activité sera insérée à cet emplacement.")}</p>
                <strong>{activityClipboard.label}</strong>
                <div className="modal-actions">
                  <button className="ghost-pill" onClick={onPasteActivityCancel} type="button">{t("common.cancel")}</button>
                  <button className="primary-pill" onClick={onPasteActivityConfirm} type="button">{t("common.paste", undefined, "Coller")}</button>
                </div>
              </>
            ) : (
              <>
                <h2 id="paste-activity-title">{t("dialog.activityClipboard.emptyTitle")}</h2>
                <p>{t("dialog.activityClipboard.emptyMessage")}</p>
                <div className="modal-actions">
                  <button autoFocus className="primary-pill" onClick={onPasteActivityCancel} type="button">{t("common.close")}</button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      {deleteBlockDialog ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section aria-labelledby="delete-block-title" aria-modal="true" className="paideia-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <p className="modal-kicker">{t("dialog.deleteActivity.kicker")}</p>
            <h2 id="delete-block-title">{t("dialog.delete.confirm")}</h2>
            <p>{t("dialog.deleteActivity.message")}</p>
            <strong>{blockLabel(deleteBlockDialog.block.type)}</strong>
            <div className="modal-actions">
              <button className="ghost-pill" onClick={onDeleteBlockCancel} type="button">{t("common.cancel")}</button>
              <button className="danger-pill" onClick={onDeleteBlockConfirm} type="button">{t("common.delete")}</button>
            </div>
          </section>
        </div>
      ) : null}

      {characterPackageConflictDialog ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section aria-labelledby="character-package-conflict-title" aria-modal="true" className="paideia-modal character-package-conflict-modal" role="dialog">
            <p className="modal-kicker">{t("resources.characters")}</p>
            <h2 id="character-package-conflict-title">{t("resources.characterConflicts")}</h2>
            <p>
              {t("resources.characterConflictCount", { count: characterPackageConflictDialog.conflicts.length })}
            </p>
            <ul className="character-package-conflict-list">
              {characterPackageConflictDialog.conflicts.map((conflict) => (
                <li key={conflict.portableId}>« {conflict.name} »</li>
              ))}
            </ul>
            <p>{t("resources.characterConflictChoice")}</p>
            <div className="modal-actions character-package-conflict-actions">
              <button className="ghost-pill" onClick={onCharacterPackageConflictCancel} type="button">{t("common.cancel")}</button>
              <button className="ghost-pill" onClick={onCharacterPackageConflictCopy} type="button">{t("resources.importAsCopies")}</button>
              <button autoFocus className="primary-pill" onClick={onCharacterPackageConflictUpdate} type="button">{t("resources.updateCharacters")}</button>
            </div>
          </section>
        </div>
      ) : null}

      {importDialog ? (
        <div className="import-blocking-backdrop" role="presentation">
          <section
            aria-labelledby="import-dialog-title"
            aria-live={importDialog.status === "running" ? "polite" : "off"}
            aria-modal="true"
            className="import-status-modal"
            role="dialog"
          >
            {importDialog.status === "running" ? <div aria-hidden="true" className="import-spinner" /> : null}
            <h2 id="import-dialog-title">
              {importDialog.reportVisible
                ? importDialog.reportTitle ?? t("importLog.title", undefined, "Journal d’importation")
                : importDialog.status === "running"
                ? importDialog.title ?? t("import.running")
                : importDialog.status === "done"
                  ? importDialog.doneTitle ?? t("import.complete")
                  : importDialog.doneTitle ?? t("import.interrupted")}
            </h2>
            {importDialog.status === "running" && importDialog.message ? (
              <p className="import-status-message">{importDialog.message}</p>
            ) : null}
            {importDialog.status === "running" && importDialog.runningNote ? (
              <small className="import-status-running-note">{importDialog.runningNote}</small>
            ) : null}
            {importDialog.reportVisible ? (
              <>
                {importDialog.reportRows?.length ? (
                  <div aria-label={importDialog.reportTitle ?? t("importLog.title", undefined, "Journal d’importation")} className="import-report-list" role="list" tabIndex={0}>
                    {importDialog.reportRows.map((row, index) => (
                      <article className={`import-report-row import-report-row-${row.level}`} key={`${row.location}-${index}`} role="listitem">
                        <span aria-hidden="true" className="import-report-dot" />
                        <div>
                          <strong>{row.title}</strong>
                          <span className="import-report-location">{row.location}</span>
                          <span>{row.result}</span>
                          {row.details.map((detail) => <span className="import-report-detail" key={detail}>{detail}</span>)}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : importDialog.reportKind === "changelog" ? (
                  <article
                    aria-label={importDialog.reportTitle}
                    className="import-log-preview changelog-report-preview"
                    tabIndex={0}
                  >
                    {renderChangelogContent(importDialog.reportContent ?? "")}
                  </article>
                ) : (
                  <pre
                    aria-label={importDialog.reportTitle ?? t("importLog.title", undefined, "Journal d’importation")}
                    className={`import-log-preview${importDialog.reportKind === "metrology" ? " metrology-report-preview" : ""}`}
                    tabIndex={0}
                  >{(() => {
                    const content = importDialog.reportContent ?? "";
                    const marker = importDialog.reportSecondarySectionMarker;
                    const sectionStart = marker ? content.indexOf(marker) : -1;
                    if (sectionStart < 0) return content;
                    const sectionMarker = marker ?? "";
                    return (
                      <>
                        {content.slice(0, sectionStart)}
                        {sectionMarker}
                        <span className="metrology-report-references">{content.slice(sectionStart + sectionMarker.length)}</span>
                      </>
                    );
                  })()}</pre>
                )}
                {importDialog.reportPath ? <p className="import-log-path">{importDialog.reportPath}</p> : null}
              </>
            ) : importDialog.status !== "running" ? (
              <p className="import-status-message">
                {importDialog.status === "done"
                  ? importDialog.message ?? t("import.readyMessage")
                  : importDialog.message ?? t("import.failedMessage")}
              </p>
            ) : null}
            {importDialog.status === "running" && importDialog.allowBackground ? (
              <div className="modal-actions">
                <button className="ghost-pill" onClick={onImportDialogClose} type="button">
                  {importDialog.backgroundLabel ?? t("import.continueInBackground")}
                </button>
              </div>
            ) : importDialog.status !== "running" ? (
              <div className="modal-actions">
                {importDialog.reportVisible && (importDialog.reportRows?.length || importDialog.reportKind === "metrology") ? (
                  <button className="ghost-pill" onClick={onImportDialogDownloadReport} type="button">
                    {t("importLog.downloadRtf", undefined, "Télécharger en RTF")}
                  </button>
                ) : null}
                {!importDialog.reportVisible && importDialog.reportContent ? (
                  <button className="ghost-pill" onClick={onImportDialogViewReport} type="button">
                    {t("importLog.view", undefined, "Voir le journal d’importation")}
                  </button>
                ) : null}
                <button className="primary-pill" onClick={onImportDialogClose} type="button">
                  {importDialog.closeLabel ?? t(importDialog.reportVisible || importDialog.status !== "done" ? "common.close" : "common.continue")}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
