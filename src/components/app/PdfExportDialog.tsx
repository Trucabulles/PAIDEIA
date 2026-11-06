import type { PdfExportDialogState } from "../../app/appStateTypes";
import { useI18n } from "../../i18n/react";
import { useState } from "react";
import { invokeCommand } from "../../lib/tauri";

type PdfExportDialogProps = {
  dialog: PdfExportDialogState;
  onClose: () => void;
};

export function PdfExportDialog({ dialog, onClose }: PdfExportDialogProps) {
  const { t } = useI18n();
  const [openError, setOpenError] = useState<string | null>(null);
  const openPdf = async () => {
    try {
      setOpenError(null);
      await invokeCommand("open_exported_pdf", { targetPath: dialog.targetPath });
    } catch (error) {
      setOpenError(String(error));
    }
  };
  const phaseLabels: Record<NonNullable<PdfExportDialogState["phase"]>, string> = {
    loading: t("pdf.loading"),
    fonts: t("pdf.fonts"),
    assets: t("pdf.assets"),
    document: t("pdf.document"),
    finalizing: t("pdf.finalizing"),
    saving: t("pdf.saving")
  };
  return (
    <div className={dialog.status === "running" ? "import-blocking-backdrop" : "paideia-modal-backdrop"} role="presentation">
      <section
        aria-labelledby="pdf-export-status-title"
        aria-live="polite"
        aria-modal="true"
        className="import-status-modal pdf-export-status-modal"
        role="dialog"
      >
        {dialog.status === "running" ? <div aria-hidden="true" className="import-spinner" /> : null}
        <p className="modal-kicker">{t("pdf.kicker", undefined, "Export PDF")}</p>
        <h2 id="pdf-export-status-title">
          {dialog.status === "running"
            ? t("pdf.running", undefined, "Génération PDF en cours…")
            : dialog.status === "done"
              ? t("pdf.done", undefined, "PDF généré")
              : t("pdf.interrupted", undefined, "Génération PDF interrompue")}
        </h2>
        <p><strong>{dialog.lessonTitle}</strong></p>
        {dialog.status === "running" ? (
          <p>{dialog.phase ? phaseLabels[dialog.phase] : phaseLabels.loading}</p>
        ) : (
          <>
            <p>{dialog.message}</p>
            {dialog.status === "done" && dialog.targetPath ? (
              <p className="scorm-batch-path">{t("pdf.file", undefined, "Fichier :")} <button type="button" onClick={() => void openPdf()} style={{ display: "block", border: 0, background: "none", color: "inherit", font: "inherit", fontWeight: 700, textDecoration: "underline", cursor: "pointer", overflowWrap: "anywhere", padding: 0, width: "100%" }}>{dialog.targetPath}</button></p>
            ) : null}
            {openError ? <p role="alert">{openError}</p> : null}
            <button autoFocus className="primary-pill" onClick={onClose} type="button">{t("common.close")}</button>
          </>
        )}
      </section>
    </div>
  );
}
