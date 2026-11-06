import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { AuthoringCheckbox } from "../authoring";
import { useI18n } from "../../i18n/react";
import { readTranscriptDocument } from "../../lib/projectApi";
import { SubtitleGenerationDialog } from "../activities/VideoActivity/SubtitleGenerationDialog";
import {
  plainTextToTranscriptHtml,
  transcriptHtmlToPlainText,
  type TranscriptValue
} from "./transcriptTools";
import styles from "./Transcript.module.css";

type Props = {
  assetRef: string;
  blockId: string;
  configuration: {
    ready: boolean;
    enginePath: string;
    smallModelPath: string;
    mediumModelPath: string;
    smallAvailable: boolean;
    mediumAvailable: boolean;
    defaultLanguage: string;
  };
  onChange: (patch: TranscriptValue) => void;
  projectPath: string;
  value: TranscriptValue;
};

export function TranscriptAuthoringControls({ assetRef, blockId, configuration, onChange, projectPath, value }: Props) {
  const { t } = useI18n();
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(() => transcriptHtmlToPlainText(value.transcriptHtml));
  const [draftLanguage, setDraftLanguage] = useState(value.transcriptLanguage || configuration.defaultLanguage);
  const [draftSource, setDraftSource] = useState(value.transcriptSource || "manual");
  const [importError, setImportError] = useState("");
  const [importRunning, setImportRunning] = useState(false);
  const hasTranscript = Boolean(value.transcriptHtml?.trim());
  const validated = hasTranscript && value.transcriptStatus === "validated";

  function openEditor(
    nextDraft = transcriptHtmlToPlainText(value.transcriptHtml),
    nextLanguage = value.transcriptLanguage || configuration.defaultLanguage,
    nextSource = value.transcriptSource || "manual"
  ) {
    setDraft(nextDraft);
    setDraftLanguage(nextLanguage);
    setDraftSource(nextSource);
    setEditorOpen(true);
  }

  async function importTranscript() {
    setImportError("");
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: "TXT / Markdown / RTF / DOCX / ODT", extensions: ["txt", "md", "rtf", "docx", "odt"] }]
      });
      if (!selected || Array.isArray(selected)) return;
      setImportRunning(true);
      const plainText = await readTranscriptDocument(selected);
      openEditor(plainText, value.transcriptLanguage || configuration.defaultLanguage, "imported");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    } finally {
      setImportRunning(false);
    }
  }

  return (
    <section className={styles.authoring}>
      <div className={styles.authoringHeader}>
        <div>
          <strong>{t("transcript.title", undefined, "Transcription")}</strong>
          <span className={validated ? styles.validated : styles.draft}>{validated ? t("transcript.validated", undefined, "Validée") : hasTranscript ? t("transcript.toReview", undefined, "À vérifier") : t("transcript.none", undefined, "Aucune transcription")}</span>
        </div>
        <div className={styles.authoringActions}>
          {configuration.ready ? <button className="ghost-pill compact" onClick={() => setGeneratorOpen(true)} type="button">{t("transcript.generate", undefined, "Générer")}</button> : null}
          <button className="ghost-pill compact" disabled={importRunning} onClick={() => void importTranscript()} type="button">{t("common.import", undefined, "Importer")}</button>
          {hasTranscript ? <button className="ghost-pill compact" onClick={() => openEditor()} type="button">{t("common.edit", undefined, "Modifier")}</button> : null}
          {hasTranscript && !validated ? <button className="primary-pill compact" onClick={() => onChange({ transcriptStatus: "validated" })} type="button">{t("transcript.validate", undefined, "Valider")}</button> : null}
          {hasTranscript ? <button className="danger-pill compact" onClick={() => onChange({ transcriptHtml: null, transcriptLanguage: null, transcriptSource: null, transcriptStatus: null, transcriptAllowDownload: false })} type="button">{t("common.delete", undefined, "Supprimer")}</button> : null}
        </div>
      </div>
      <div className={styles.importFormats}>TXT · Markdown (.md) · RTF · DOCX · ODT</div>
      {importError ? <div className={styles.fileError} role="alert">{importError}</div> : null}
      {hasTranscript ? (
        <AuthoringCheckbox checked={Boolean(value.transcriptAllowDownload)} compact disabled={!validated} onChange={(event) => onChange({ transcriptAllowDownload: event.target.checked })}>
          {t("transcript.allowDownload", undefined, "Autoriser le téléchargement de la transcription")}
        </AuthoringCheckbox>
      ) : null}
      {generatorOpen ? (
        <SubtitleGenerationDialog
          assetRef={assetRef}
          blockId={blockId}
          configuration={configuration}
          onClose={() => setGeneratorOpen(false)}
          onGenerated={(content, _fileName, language) => {
            setGeneratorOpen(false);
            openEditor(content, language === "auto" ? configuration.defaultLanguage : language, "whisper");
          }}
          outputKind="transcript"
          projectPath={projectPath}
        />
      ) : null}
      {editorOpen ? (
        <div className="paideia-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setEditorOpen(false)}>
          <section aria-labelledby={`transcript-editor-${blockId}`} aria-modal="true" className={`paideia-modal ${styles.editorDialog}`} role="dialog">
            <header className={styles.readerHeader}><h2 id={`transcript-editor-${blockId}`}>{t("transcript.edit", undefined, "Modifier la transcription")}</h2><button aria-label={t("common.close", undefined, "Fermer")} className="ghost-icon-button" onClick={() => setEditorOpen(false)} type="button">×</button></header>
            <label><span>{t("transcript.language", undefined, "Langue de la transcription")}</span><input onChange={(event) => setDraftLanguage(event.target.value)} value={draftLanguage} /></label>
            <textarea autoFocus onChange={(event) => setDraft(event.target.value)} spellCheck value={draft} />
            <footer><button className="ghost-pill" onClick={() => setEditorOpen(false)} type="button">{t("common.cancel", undefined, "Annuler")}</button><button className="primary-pill" onClick={() => { onChange({ transcriptHtml: plainTextToTranscriptHtml(draft), transcriptLanguage: draftLanguage, transcriptSource: draftSource, transcriptStatus: "draft", transcriptAllowDownload: false }); setEditorOpen(false); }} type="button">{t("common.save", undefined, "Enregistrer")}</button></footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
