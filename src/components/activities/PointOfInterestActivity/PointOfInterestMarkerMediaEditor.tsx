import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AuthoringButton, AuthoringFileButton } from "../../authoring";
import { getAssetPickerAccept } from "../../../app/mediaAssets";
import type { PointOfInterestMarker, PointOfInterestMarkerMedia } from "../../../types/project";
import { useI18n } from "../../../i18n/react";
import styles from "./PointOfInterestActivity.module.css";
import { analyzeProjectVideo, type VideoOptimizationAnalysis } from "../../../lib/projectApi";
import { SubtitleGenerationDialog } from "../VideoActivity/SubtitleGenerationDialog";
import { VideoOptimizationDialog } from "../VideoActivity/VideoOptimizationDialog";
import { VttSubtitleEditor } from "../VideoActivity/VttSubtitleEditor";
import videoStyles from "../VideoActivity/VideoActivity.module.css";
import { TranscriptAuthoringControls } from "../../transcript";

type Props = {
  blockId: string;
  marker: PointOfInterestMarker;
  resolveAssetUrl: (assetRef?: string | null) => string | null;
  onChange: (media: PointOfInterestMarkerMedia | null) => void;
  onUpload: (
    file: File,
    kind: "image" | "video" | "audio" | "subtitle"
  ) => Promise<string>;
  optimizationAvailable: boolean;
  projectPath: string;
  subtitleGenerationConfiguration: {
    ready: boolean;
    enginePath: string;
    smallModelPath: string;
    mediumModelPath: string;
    smallAvailable: boolean;
    mediumAvailable: boolean;
    defaultLanguage: string;
  };
};

function cloneMarkerMedia(media: PointOfInterestMarkerMedia | null): PointOfInterestMarkerMedia | null {
  if (!media) return null;
  return {
    ...media,
    imageAccessibility: media.imageAccessibility ? { ...media.imageAccessibility } : media.imageAccessibility
  };
}

export function PointOfInterestMarkerMediaEditor({
  blockId,
  marker,
  onChange,
  onUpload,
  optimizationAvailable,
  projectPath,
  resolveAssetUrl,
  subtitleGenerationConfiguration
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatedSubtitleDraft, setGeneratedSubtitleDraft] = useState<{
    content: string;
    fileName: string;
    language: string;
  } | null>(null);
  const [subtitleEditorOpen, setSubtitleEditorOpen] = useState(false);
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [optimizationAnalysis, setOptimizationAnalysis] = useState<VideoOptimizationAnalysis | null>(null);
  const [toolError, setToolError] = useState("");
  const initialMediaRef = useRef<PointOfInterestMarkerMedia | null>(null);
  const media = marker.media ?? null;

  function openMediaDialog() {
    initialMediaRef.current = cloneMarkerMedia(media);
    setOpen(true);
  }

  function cancelMediaDialog() {
    onChange(cloneMarkerMedia(initialMediaRef.current));
    initialMediaRef.current = null;
    setOpen(false);
  }

  function finishMediaDialog() {
    initialMediaRef.current = null;
    setOpen(false);
  }

  useEffect(() => {
    const sourceRef = media?.type === "video" ? (media.optimizedAssetRef || media.assetRef) : "";
    if (!open || !optimizationAvailable || !sourceRef) {
      setOptimizationAnalysis(null);
      return;
    }
    let cancelled = false;
    setToolError("");
    void analyzeProjectVideo(projectPath, blockId, sourceRef)
      .then((analysis) => { if (!cancelled) setOptimizationAnalysis(analysis); })
      .catch((reason) => { if (!cancelled) setToolError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { cancelled = true; };
  }, [blockId, media?.assetRef, media?.optimizedAssetRef, media?.type, open, optimizationAvailable, projectPath]);

  async function upload(file: File, kind: "image" | "video" | "audio") {
    setBusy(true);
    setOpen(false);
    try {
      const assetRef = await onUpload(file, kind);
      onChange({
        type: kind,
        assetRef,
        fileName: file.name,
        originalAssetRef: kind === "video" ? assetRef : null,
        imageAccessibility: kind === "image" ? { altText: "", decorative: false } : null
      });
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  async function uploadSubtitle(file: File) {
    if (!media || media.type !== "video") return;
    setBusy(true);
    try {
      const subtitleAssetRef = await onUpload(file, "subtitle");
      onChange({ ...media, subtitleAssetRef });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.markerMediaEditor}>
      <div className={styles.markerMediaSummary}>
        <div>
          <strong>{t("poi.markerMedia", undefined, "Média du panneau")}</strong>
          <span>{media ? `${media.type === "image" ? t("activity.image", undefined, "Image") : media.type === "video" ? t("activity.media", undefined, "Vidéo") : t("activity.audio", undefined, "Audio")} · ${media.fileName}` : t("poi.noMarkerMedia", undefined, "Aucun média")}</span>
          {media?.type === "video" && media.subtitleAssetRef ? (
            <small>{t("poi.subtitlesAttached", undefined, "Sous-titres ajoutés")}</small>
          ) : null}
        </div>
        <div className={styles.markerMediaActions}>
          <AuthoringButton onClick={openMediaDialog} variant="ghost">
            {media ? t("common.edit", undefined, "Modifier") : t("poi.addMarkerMedia", undefined, "Ajouter")}
          </AuthoringButton>
          {media ? (
            <AuthoringButton onClick={() => onChange(null)} variant="danger">
              {t("common.delete", undefined, "Supprimer")}
            </AuthoringButton>
          ) : null}
        </div>
      </div>
      {open ? createPortal(
        <div className={styles.markerMediaDialogBackdrop}>
          <div
            aria-labelledby="poi-marker-media-dialog-title"
            aria-modal="true"
            className={`paideia-accessible-local-dialog ${styles.markerMediaDialog} ${media ? styles.markerMediaDialogWithMedia : styles.markerMediaDialogEmpty}`}
            role="dialog"
          >
            <header>
              <div>
                <strong id="poi-marker-media-dialog-title">{t("poi.markerMedia", undefined, "Média du panneau")}</strong>
                <span>{marker.title.replace(/<[^>]*>/g, " ").trim()}</span>
              </div>
              <button aria-label={t("common.cancel", undefined, "Annuler")} data-paideia-modal-cancel="true" onClick={cancelMediaDialog} type="button">
                <span aria-hidden="true" className={styles.markerMediaCancelIcon} />
              </button>
            </header>
            {media ? (
              <div className={styles.markerMediaPreview}>
                {media.type === "image" ? <img alt={media.imageAccessibility?.altText ?? ""} src={resolveAssetUrl(media.assetRef) ?? ""} /> : null}
                {media.type === "video" ? <video controls poster={resolveAssetUrl(media.posterAssetRef) ?? undefined} src={resolveAssetUrl(media.optimizedAssetRef || media.assetRef) ?? ""} /> : null}
                {media.type === "audio" ? <audio controls src={resolveAssetUrl(media.assetRef) ?? ""} /> : null}
              </div>
            ) : null}
            <div className={styles.markerMediaChoices}>
              <AuthoringFileButton accept={getAssetPickerAccept("image")} disabled={busy} onFileSelect={(file) => void upload(file, "image")}>{t("activity.image", undefined, "Image")}</AuthoringFileButton>
              <AuthoringFileButton accept={getAssetPickerAccept("video")} disabled={busy} onFileSelect={(file) => void upload(file, "video")}>{t("activity.media", undefined, "Vidéo")}</AuthoringFileButton>
              <AuthoringFileButton accept={getAssetPickerAccept("audio")} disabled={busy} onFileSelect={(file) => void upload(file, "audio")}>{t("activity.audio", undefined, "Audio")}</AuthoringFileButton>
            </div>
            {media?.type === "image" ? (
              <div className={styles.markerMediaAccessibility}>
                <label>
                  <span>{t("imageAlt.title", undefined, "Texte alternatif")}</span>
                  <input disabled={Boolean(media.imageAccessibility?.decorative)} onChange={(event) => onChange({ ...media, imageAccessibility: { altText: event.target.value, decorative: false } })} value={media.imageAccessibility?.altText ?? ""} />
                </label>
                <label className="checkbox-line compact">
                  <input checked={Boolean(media.imageAccessibility?.decorative)} onChange={(event) => onChange({ ...media, imageAccessibility: { altText: "", decorative: event.target.checked } })} type="checkbox" />
                  <span>{t("imageAlt.decorative", undefined, "Cette image est décorative")}</span>
                </label>
              </div>
            ) : null}
            {media?.type === "video" ? (
              <div className={styles.markerVideoTools}>
                <AuthoringFileButton accept={getAssetPickerAccept("subtitle")} disabled={busy} onFileSelect={(file) => void uploadSubtitle(file)}>
                  {media.subtitleAssetRef ? t("poi.replaceSubtitles", undefined, "Remplacer les sous-titres") : t("poi.addSubtitles", undefined, "Ajouter des sous-titres")}
                </AuthoringFileButton>
                {subtitleGenerationConfiguration.ready ? (
                  <AuthoringButton onClick={() => setGeneratorOpen(true)} variant="ghost">
                    {t("video.generateSubtitles", undefined, "Générer les sous-titres")}
                  </AuthoringButton>
                ) : null}
                {optimizationAvailable ? (
                  <AuthoringButton
                    className={`${videoStyles.optimizerButton} ${videoStyles[
                      media.optimizedAssetRef ? "optimized" : optimizationAnalysis?.status ?? "neutral"
                    ]}`}
                    disabled={!optimizationAnalysis}
                    onClick={() => setOptimizerOpen(true)}
                    variant="ghost"
                  >
                    {media.optimizedAssetRef || optimizationAnalysis?.status === "adapted"
                      ? t("video.optimizedActive", undefined, "Vidéo optimisée")
                      : t("video.optimizeVideo", undefined, "Optimiser la vidéo")}
                  </AuthoringButton>
                ) : null}
                {media.optimizedAssetRef && media.originalAssetRef ? (
                  <AuthoringButton
                    onClick={() => onChange({
                      ...media,
                      optimizedAssetRef: null,
                      optimizationProfile: null
                    })}
                    variant="ghost"
                  >
                    {t("video.restoreOriginal", undefined, "Restaurer l’original")}
                  </AuthoringButton>
                ) : null}
                {toolError ? <small role="alert">{toolError}</small> : null}
                <small>{t("poi.videoAdvancedToolsHint", undefined, "Le plein écran est toujours disponible dans le lecteur.")}</small>
              </div>
            ) : null}
            {media?.type === "audio" ? (
              <TranscriptAuthoringControls
                assetRef={media.assetRef}
                blockId={`${blockId}-${marker.id}`}
                configuration={subtitleGenerationConfiguration}
                onChange={(patch) => onChange({ ...media, ...patch })}
                projectPath={projectPath}
                value={media}
              />
            ) : null}
            {media ? (
              <div className="modal-actions">
                <button className="primary-pill" onClick={finishMediaDialog} type="button">
                  {t("poi.finishMediaSettings", undefined, "Terminer")}
                </button>
              </div>
            ) : null}
          </div>
        </div>,
        document.body
      ) : null}
      {generatorOpen && media?.type === "video" ? (
        <SubtitleGenerationDialog
          assetRef={media.optimizedAssetRef || media.assetRef}
          blockId={blockId}
          configuration={subtitleGenerationConfiguration}
          onClose={() => setGeneratorOpen(false)}
          onGenerated={(content, fileName, language) => {
            setGeneratedSubtitleDraft({ content, fileName, language });
            setGeneratorOpen(false);
            setSubtitleEditorOpen(true);
          }}
          projectPath={projectPath}
        />
      ) : null}
      {subtitleEditorOpen && generatedSubtitleDraft && media?.type === "video" ? (
        <VttSubtitleEditor
          fileName={generatedSubtitleDraft.fileName}
          initialVttContent={generatedSubtitleDraft.content}
          onClose={() => {
            setSubtitleEditorOpen(false);
            setGeneratedSubtitleDraft(null);
          }}
          onSave={async (file) => {
            await uploadSubtitle(file);
            setSubtitleEditorOpen(false);
            setGeneratedSubtitleDraft(null);
          }}
          spellcheckLanguage={generatedSubtitleDraft.language === "auto"
            ? subtitleGenerationConfiguration.defaultLanguage
            : generatedSubtitleDraft.language}
          videoSrc={resolveAssetUrl(media.optimizedAssetRef || media.assetRef) ?? ""}
        />
      ) : null}
      {optimizerOpen && media?.type === "video" && optimizationAnalysis ? (
        <VideoOptimizationDialog
          analysis={optimizationAnalysis}
          assetRef={media.optimizedAssetRef || media.assetRef}
          blockId={`${blockId}-${marker.id}`}
          onClose={() => setOptimizerOpen(false)}
          onOptimizedAsset={(result) => {
            onChange({
              ...media,
              assetRef: result.assetRef,
              originalAssetRef: null,
              optimizedAssetRef: result.assetRef,
              optimizationProfile: result.profile
            });
            setOptimizerOpen(false);
          }}
          projectPath={projectPath}
        />
      ) : null}
    </section>
  );
}
