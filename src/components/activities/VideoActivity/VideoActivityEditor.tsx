import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { AuthoringCheckbox, AuthoringFileButton } from "../../authoring";
import { ColorPickerField } from "../../color-picker/ColorPickerPopover";
import { PlyrVideoPlayer } from "./PlyrVideoPlayer";
import styles from "./VideoActivity.module.css";
import type { VideoActivityEditorProps } from "./types";
import { useI18n } from "../../../i18n/react";
import { VttSubtitleEditor } from "./VttSubtitleEditor";
import { VideoOptimizationDialog } from "./VideoOptimizationDialog";
import { SubtitleGenerationDialog } from "./SubtitleGenerationDialog";
import {
  analyzeProjectVideo,
  restoreOriginalVideo,
  type VideoOptimizationAnalysis
} from "../../../lib/projectApi";

export function VideoActivityEditor({
  blockId,
  projectPath,
  optimizationAvailable,
  subtitleGenerationConfiguration,
  optimizedVideoActive,
  originalVideoAvailable,
  videoSrc,
  videoFileName,
  subtitleSrc,
  originalSubtitleSrc,
  subtitleFileName,
  subtitleAccept,
  captionColor,
  captionBackgroundEnabled,
  captionOutline,
  allowFullscreen,
  onCaptionColorChange,
  onCaptionBackgroundEnabledChange,
  onCaptionOutlineChange,
  onAllowFullscreenChange,
  onVideoPathUpload,
  onVideoRemove,
  onWorkspaceChange,
  onSubtitleUpload,
  onSubtitleEdit,
  onSubtitleRemove
}: VideoActivityEditorProps) {
  const { t } = useI18n();

  async function chooseVideoFile() {
    const selected = await openDialog({
      multiple: false,
      directory: false,
      filters: [{ name: t("activity.media"), extensions: ["mp4", "webm", "ogg"] }]
    });
    if (typeof selected === "string") {
      await onVideoPathUpload(selected);
    }
  }
  const [isSubtitleEditorOpen, setIsSubtitleEditorOpen] = useState(false);
  const [isSubtitleGeneratorOpen, setIsSubtitleGeneratorOpen] = useState(false);
  const [generatedSubtitleDraft, setGeneratedSubtitleDraft] = useState<{
    content: string;
    fileName: string;
    language: string;
  } | null>(null);
  const [optimizationAnalysis, setOptimizationAnalysis] = useState<VideoOptimizationAnalysis | null>(null);
  const [optimizationAnalysisError, setOptimizationAnalysisError] = useState("");
  const [optimizationAnalysisBusy, setOptimizationAnalysisBusy] = useState(false);
  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);
  const [restoringOriginal, setRestoringOriginal] = useState(false);

  useEffect(() => {
    if (!optimizationAvailable || !videoSrc || !blockId || !projectPath) {
      setOptimizationAnalysis(null);
      setOptimizationAnalysisError("");
      return;
    }
    let cancelled = false;
    setOptimizationAnalysisBusy(true);
    setOptimizationAnalysisError("");
    void analyzeProjectVideo(projectPath, blockId)
      .then((analysis) => {
        if (!cancelled) setOptimizationAnalysis(analysis);
      })
      .catch((error) => {
        if (!cancelled) {
          setOptimizationAnalysis(null);
          setOptimizationAnalysisError(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (!cancelled) setOptimizationAnalysisBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [blockId, optimizationAvailable, projectPath, videoSrc]);

  async function restoreOriginal() {
    setRestoringOriginal(true);
    setOptimizationAnalysisError("");
    try {
      onWorkspaceChange(await restoreOriginalVideo(projectPath, blockId));
    } catch (error) {
      setOptimizationAnalysisError(error instanceof Error ? error.message : String(error));
    } finally {
      setRestoringOriginal(false);
    }
  }
  return (
    <>
      <section className={`inspector-span-2 ${styles.videoEditorLayout}`}>
        <aside className={styles.previewColumn}>
          <div className={styles.previewSticky}>
            <span className="editor-label">{t("video.playerPreview", undefined, "Aperçu du lecteur")}</span>
            <PlyrVideoPlayer
              allowFullscreen={allowFullscreen}
              captionColor={captionColor}
              captionBackgroundEnabled={captionBackgroundEnabled}
              captionOutline={captionOutline}
              mediaSrc={videoSrc}
              maxDisplayHeight={480}
              subtitleSrc={subtitleSrc}
            />
          </div>
        </aside>

        <div className={styles.controlsColumn}>
          <section className={styles.editorSection}>
            <span className="editor-label">{t("activity.media")}</span>
            <div className={styles.fileChoice}>
              {videoSrc ? (
                <button className={`${styles.videoRemoveAction} media-picker-button`} onClick={() => void onVideoRemove()} type="button">
                  <span>{t("video.removeVideo", undefined, "Supprimer la vidéo")}</span>
                </button>
              ) : (
                <button className="media-picker-button" onClick={() => void chooseVideoFile()} type="button">
                  <span>{t("video.chooseVideo", undefined, "Choisir une vidéo")}</span>
                </button>
              )}
              <strong title={videoFileName || undefined}>{videoFileName || t("editor.noFileSelected")}</strong>
              {videoSrc ? (
                <button
                  aria-label={t("common.delete", undefined, "Supprimer")}
                  className={styles.assetRemoveButton}
                  onClick={() => void onVideoRemove()}
                  onPointerDown={(event) => event.stopPropagation()}
                  title={t("common.delete", undefined, "Supprimer")}
                  type="button"
                >
                  <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20"><path d="M5 5L15 15M15 5L5 15" /></svg>
                </button>
              ) : null}
            </div>
          </section>

          <section className={styles.editorSection}>
            <span className="editor-label">{t("video.sectionSubtitles", undefined, "Sous-titres")}</span>
            <div className={styles.fileChoice}>
              {subtitleSrc ? (
                <button className="ghost-pill" onClick={() => setIsSubtitleEditorOpen(true)} type="button">
                  {t("video.editSubtitles", undefined, "Éditer les sous-titres")}
                </button>
              ) : (
                <AuthoringFileButton accept={subtitleAccept} onFileSelect={onSubtitleUpload}>
                  <span>{t("video.chooseSubtitle", undefined, "Choisir un fichier de sous-titres")}</span>
                </AuthoringFileButton>
              )}
              <strong title={subtitleFileName || undefined}>{subtitleFileName || t("video.noSubtitleSelected", undefined, "Aucun sous-titre sélectionné")}</strong>
              {subtitleSrc ? (
                <button
                  aria-label={t("common.delete", undefined, "Supprimer")}
                  className={styles.assetRemoveButton}
                  onClick={() => void onSubtitleRemove()}
                  onPointerDown={(event) => event.stopPropagation()}
                  title={t("common.delete", undefined, "Supprimer")}
                  type="button"
                >
                  <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20"><path d="M5 5L15 15M15 5L5 15" /></svg>
                </button>
              ) : null}
            </div>
            {!subtitleSrc && videoSrc && subtitleGenerationConfiguration.ready ? (
              <button
                className={`${styles.subtitleGenerateAction} ghost-pill`}
                onClick={() => setIsSubtitleGeneratorOpen(true)}
                type="button"
              >
                {t("video.generateSubtitles", undefined, "Générer les sous-titres")}
              </button>
            ) : null}
          </section>

          {optimizationAvailable && videoSrc ? (
            <section className={styles.editorSection}>
              <span className="editor-label">{t("video.sectionOptimization", undefined, "Optimisation")}</span>
              <div className={styles.optimizerEntry}>
                <button
                  aria-label={t("video.openOptimizationOptions", undefined, "Ouvrir les options d’optimisation de cette vidéo")}
                  className={`${styles.optimizerButton} ${styles[optimizedVideoActive ? "optimized" : optimizationAnalysis?.status ?? "neutral"]}`}
                  disabled={optimizationAnalysisBusy || !optimizationAnalysis}
                  onClick={() => setIsOptimizerOpen(true)}
                  title={optimizationAnalysisError || undefined}
                  type="button"
                >
                  {optimizationAnalysisBusy
                    ? t("video.optimizerAnalyzing", undefined, "Analyse de la vidéo…")
                    : optimizedVideoActive || optimizationAnalysis?.status === "adapted"
                      ? t("video.optimizedActive", undefined, "Vidéo optimisée")
                      : t("video.optimizeVideo", undefined, "Optimiser la vidéo")}
                </button>
                {optimizedVideoActive && originalVideoAvailable ? (
                  <button className="ghost-pill" disabled={restoringOriginal} onClick={() => void restoreOriginal()} type="button">
                    {restoringOriginal
                      ? t("video.restoringOriginal", undefined, "Restauration…")
                      : t("video.restoreOriginal", undefined, "Restaurer l’original")}
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className={styles.editorSection}>
            <span className="editor-label">{t("video.sectionAppearance", undefined, "Apparence des sous-titres")}</span>
            <div className={styles.colorRow}>
              <label>
                <span>{t("common.color", undefined, "Couleur")}</span>
                <ColorPickerField
                  ariaLabel={t("video.subtitleColorAria", undefined, "Couleur des sous-titres")}
                  onChange={onCaptionColorChange}
                  value={captionColor}
                />
              </label>
              <label>
                <span>{t("video.subtitleOutline", undefined, "Contour de la police")}</span>
                <select
                  onChange={(event) => onCaptionOutlineChange(event.target.value as "none" | "thin" | "thick")}
                  value={captionOutline}
                >
                  <option value="none">{t("video.subtitleOutlineNone", undefined, "Aucun")}</option>
                  <option value="thin">{t("video.subtitleOutlineThin", undefined, "Fin")}</option>
                  <option value="thick">{t("video.subtitleOutlineThick", undefined, "Épais")}</option>
                </select>
              </label>
              <div className={styles.captionBackgroundField}>
                <AuthoringCheckbox
                  checked={captionBackgroundEnabled}
                  compact
                  labelClassName={styles.captionBackgroundToggle}
                  onChange={(event) => onCaptionBackgroundEnabledChange(event.target.checked)}
                >
                  {t("video.subtitleBackground", undefined, "Fond de sous-titre")}
                </AuthoringCheckbox>
              </div>
            </div>
          </section>

          <section className={styles.editorSection}>
            <span className="editor-label">{t("video.sectionPlayback", undefined, "Lecture")}</span>
            <AuthoringCheckbox
              checked={allowFullscreen}
              labelClassName={styles.fullscreenToggle}
              onChange={(event) => onAllowFullscreenChange(event.target.checked)}
            >
              {t("video.allowFullscreen", undefined, "Autoriser le plein écran")}
            </AuthoringCheckbox>
          </section>
        </div>
      </section>
      {isSubtitleEditorOpen && subtitleSrc ? (
        <VttSubtitleEditor
          fileName={subtitleFileName}
          onClose={() => setIsSubtitleEditorOpen(false)}
          onSave={onSubtitleEdit}
          originalSubtitleSrc={originalSubtitleSrc ?? subtitleSrc}
          spellcheckLanguage={subtitleGenerationConfiguration.defaultLanguage}
          subtitleSrc={subtitleSrc}
          videoSrc={videoSrc}
        />
      ) : null}
      {isSubtitleEditorOpen && generatedSubtitleDraft ? (
        <VttSubtitleEditor
          fileName={generatedSubtitleDraft.fileName}
          initialVttContent={generatedSubtitleDraft.content}
          onClose={() => {
            setIsSubtitleEditorOpen(false);
            setGeneratedSubtitleDraft(null);
          }}
          onSave={async (file) => {
            await onSubtitleUpload(file);
            setGeneratedSubtitleDraft(null);
          }}
          spellcheckLanguage={generatedSubtitleDraft.language === "auto"
            ? subtitleGenerationConfiguration.defaultLanguage
            : generatedSubtitleDraft.language}
          videoSrc={videoSrc}
        />
      ) : null}
      {isSubtitleGeneratorOpen ? (
        <SubtitleGenerationDialog
          blockId={blockId}
          configuration={subtitleGenerationConfiguration}
          onClose={() => setIsSubtitleGeneratorOpen(false)}
          onGenerated={(content, fileName, language) => {
            setGeneratedSubtitleDraft({ content, fileName, language });
            setIsSubtitleGeneratorOpen(false);
            setIsSubtitleEditorOpen(true);
          }}
          projectPath={projectPath}
        />
      ) : null}
      {optimizationAnalysisError ? <p className={styles.optimizerInlineError} role="alert">{optimizationAnalysisError}</p> : null}
      {isOptimizerOpen && optimizationAnalysis ? (
        <VideoOptimizationDialog
          analysis={optimizationAnalysis}
          blockId={blockId}
          onClose={() => setIsOptimizerOpen(false)}
          onWorkspaceChange={onWorkspaceChange}
          projectPath={projectPath}
        />
      ) : null}
    </>
  );
}
