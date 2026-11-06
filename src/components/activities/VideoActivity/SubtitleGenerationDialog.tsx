import { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useI18n } from "../../../i18n/react";
import {
  cancelSubtitleGeneration,
  startSubtitleGeneration,
  type SubtitleGenerationProgressEvent
} from "../../../lib/projectApi";
import styles from "./VideoActivity.module.css";

type SubtitleGenerationDialogProps = {
  assetRef?: string | null;
  blockId: string;
  projectPath: string;
  configuration: {
    enginePath: string;
    smallModelPath: string;
    mediumModelPath: string;
    smallAvailable: boolean;
    mediumAvailable: boolean;
    defaultLanguage: string;
  };
  onClose: () => void;
  onGenerated: (content: string, fileName: string, language: string) => void;
  outputKind?: "subtitles" | "transcript";
};

const TRANSCRIPTION_LANGUAGES = [
  "auto", "fr", "en", "de", "es", "it", "pt", "nl", "pl", "tr", "ro", "cs",
  "da", "sv", "fi", "el", "hu", "bg", "hr", "et", "lt", "lv", "sk", "sl", "mt",
  "cy", "eu", "br", "co", "sc", "ga"
] as const;

const UNSUPPORTED_TRANSCRIPTION_LANGUAGES = new Set(["co", "sc", "ga"]);

export function SubtitleGenerationDialog({
  assetRef,
  blockId,
  projectPath,
  configuration,
  onClose,
  onGenerated,
  outputKind = "subtitles"
}: SubtitleGenerationDialogProps) {
  const { language: interfaceLanguage, t } = useI18n();
  const initialModel = configuration.smallAvailable ? "small" : "medium";
  const [language, setLanguage] = useState("auto");
  const [model, setModel] = useState<"small" | "medium">(initialModel);
  const [taskId, setTaskId] = useState("");
  const taskIdRef = useRef("");
  const [progress, setProgress] = useState<SubtitleGenerationProgressEvent | null>(null);
  const [error, setError] = useState("");
  const [eventListenerReady, setEventListenerReady] = useState(false);
  const running = Boolean(taskId) && !["completed", "cancelled", "failed"].includes(progress?.state ?? "");

  const languageNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([interfaceLanguage], { type: "language" });
    } catch {
      return null;
    }
  }, [interfaceLanguage]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<SubtitleGenerationProgressEvent>("subtitle-generation-progress", (event) => {
      if (disposed || !taskIdRef.current || event.payload.taskId !== taskIdRef.current) return;
      setProgress(event.payload);
      if (event.payload.state === "failed") {
        setError(event.payload.error || t("video.subtitleGenerationFailed", undefined, "La génération des sous-titres a échoué."));
      }
      const generatedContent = outputKind === "transcript" ? event.payload.textContent : event.payload.vttContent;
      if (event.payload.state === "completed" && generatedContent) {
        onGenerated(
          generatedContent,
          event.payload.suggestedFileName || (outputKind === "transcript" ? "transcription.txt" : "subtitles.vtt"),
          event.payload.detectedLanguage || (language === "auto" ? "und" : language)
        );
      }
    }).then((dispose) => {
      if (disposed) dispose();
      else {
        unlisten = dispose;
        setEventListenerReady(true);
      }
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [language, onGenerated, outputKind, t]);

  async function start() {
    setError("");
    setProgress(null);
    const nextTaskId = `subtitle-${blockId.replace(/[^a-zA-Z0-9-]/g, "-")}-${Date.now()}`;
    taskIdRef.current = nextTaskId;
    setTaskId(nextTaskId);
    try {
      const result = await startSubtitleGeneration(
        nextTaskId,
        projectPath,
        blockId,
        { language, model, outputKind },
        {
          whisperCliPath: configuration.enginePath,
          whisperSmallModelPath: configuration.smallModelPath || null,
          whisperMediumModelPath: configuration.mediumModelPath || null
        },
        assetRef
      );
      taskIdRef.current = result.taskId;
      setTaskId(result.taskId);
    } catch (reason) {
      taskIdRef.current = "";
      setTaskId("");
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function cancel() {
    if (!taskId) return;
    try {
      await cancelSubtitleGeneration(taskId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  const stageLabel = progress?.state === "extracting-audio"
    ? t("video.subtitleGenerationExtracting", undefined, "Extraction de la piste audio…")
    : progress?.state === "transcribing"
      ? t("video.subtitleGenerationTranscribing", undefined, "Transcription locale en cours…")
      : progress?.state === "cancelled"
        ? t("video.subtitleGenerationCancelled", undefined, "Génération annulée.")
        : "";

  return (
    <div className="paideia-modal-backdrop" onClick={() => { if (!running) onClose(); }} role="presentation">
      <section
        aria-labelledby="subtitle-generation-title"
        aria-modal="true"
        className={`paideia-modal ${styles.subtitleGenerationDialog}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className={styles.subtitleGenerationHeader}>
          <div>
            <p className="modal-kicker">{t("video.subtitleGenerationKicker", undefined, "Transcription locale")}</p>
            <h2 id="subtitle-generation-title">{outputKind === "transcript"
              ? t("transcript.generate", undefined, "Générer la transcription")
              : t("video.generateSubtitles", undefined, "Générer les sous-titres")}</h2>
          </div>
          <button
            aria-label={t("common.close", undefined, "Fermer")}
            className="ghost-icon-button"
            disabled={running}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <p className={styles.subtitleGenerationNotice}>
          {outputKind === "transcript"
            ? t("transcript.localNotice", undefined, "Le fichier audio est traité uniquement sur cet ordinateur. La transcription générée doit être relue puis validée.")
            : t("video.subtitleGenerationLocalNotice", undefined, "La vidéo est traitée uniquement sur cet ordinateur. Les sous-titres générés doivent être relus et corrigés si nécessaire.")}
        </p>

        <div className={styles.subtitleGenerationFields}>
          <label>
            <span>{t("video.subtitleGenerationLanguage", undefined, "Langue parlée")}</span>
            <select disabled={running} onChange={(event) => setLanguage(event.target.value)} value={language}>
              {TRANSCRIPTION_LANGUAGES.map((code) => (
                <option disabled={UNSUPPORTED_TRANSCRIPTION_LANGUAGES.has(code)} key={code} value={code}>
                  {code === "auto"
                    ? t("video.subtitleGenerationLanguageAuto", undefined, "Détection automatique")
                    : languageNames?.of(code) || code.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("video.subtitleGenerationModel", undefined, "Modèle de transcription")}</span>
            <select
              disabled={running}
              onChange={(event) => setModel(event.target.value as "small" | "medium")}
              value={model}
            >
              <option disabled={!configuration.smallAvailable} value="small">
                {t("video.subtitleGenerationSmall", undefined, "Small — rapide")}
              </option>
              <option disabled={!configuration.mediumAvailable} value="medium">
                {t("video.subtitleGenerationMedium", undefined, "Medium — plus précis")}
              </option>
            </select>
          </label>
        </div>
        <p className={styles.subtitleGenerationLanguageSupportNote}>
          {t(
            "video.subtitleGenerationUnsupportedLanguages",
            undefined,
            "Actuellement, Whisper ne propose pas la reconnaissance du corse, du sarde et de l’irlandais."
          )}
        </p>

        {progress ? (
          <div className={styles.subtitleGenerationProgress} role="status">
            <progress max="100" value={progress.progress} />
            <div>
              <span>{stageLabel}</span>
              <span>{Math.round(progress.elapsedSeconds)} s</span>
            </div>
          </div>
        ) : null}
        {error ? <p className={styles.subtitleEditorError} role="alert">{error}</p> : null}

        <footer className={styles.subtitleGenerationActions}>
          {running ? (
            <button className="ghost-pill compact" onClick={() => void cancel()} type="button">
              {t("video.subtitleGenerationCancel", undefined, "Annuler la génération")}
            </button>
          ) : (
            <>
              <button className="ghost-pill compact" onClick={onClose} type="button">{t("common.cancel", undefined, "Annuler")}</button>
              <button className={`primary-pill ${styles.subtitleGenerationPrimaryAction}`} disabled={!eventListenerReady} onClick={() => void start()} type="button">
                {t("video.subtitleGenerationStart", undefined, "Lancer la génération")}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
