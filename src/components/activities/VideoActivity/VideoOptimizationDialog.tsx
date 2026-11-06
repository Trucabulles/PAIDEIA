import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  cancelVideoOptimization,
  confirmVideoOptimization,
  confirmDetachedVideoOptimization,
  discardVideoOptimization,
  startVideoOptimization,
  type VideoOptimizationAnalysis,
  type VideoOptimizationOptions,
  type VideoOptimizationProgressEvent
} from "../../../lib/projectApi";
import type { PaideiaWorkspaceState } from "../../../types/project";
import { useI18n } from "../../../i18n/react";
import styles from "./VideoActivity.module.css";

type VideoOptimizationDialogProps = {
  analysis: VideoOptimizationAnalysis;
  assetRef?: string | null;
  blockId: string;
  onClose: () => void;
  onOptimizedAsset?: (result: { assetRef: string; originalAssetRef: string; profile: string }) => void;
  onWorkspaceChange?: (workspace: PaideiaWorkspaceState) => void;
  projectPath: string;
};

const PROFILE_OPTIONS: Array<{ value: VideoOptimizationOptions["profile"]; fallback: string }> = [
  { value: "web-720", fallback: "Web pédagogique 720p léger" },
  { value: "web-1080", fallback: "Web pédagogique 1080p standard" },
  { value: "quality-1080", fallback: "1080p qualité" },
  { value: "strong", fallback: "Compression forte" },
  { value: "custom", fallback: "Personnalisé (encadré)" }
];

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} Ko`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} Mo`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} Go`;
}

function formatDuration(value?: number | null) {
  if (!value || !Number.isFinite(value)) return "—";
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatFps(value?: number | null) {
  if (!value || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value);
  return Math.abs(value - rounded) < 0.01 ? String(rounded) : value.toFixed(2).replace(".", ",");
}

function formatContainer(value?: string | null) {
  if (!value) return "—";
  return value.toLowerCase().includes("mp4") ? "MP4" : value.split(",")[0].toUpperCase();
}

function formatCodec(value?: string | null) {
  if (!value) return "—";
  return value.toLowerCase() === "h264" ? "H.264" : value.toUpperCase();
}

export function VideoOptimizationDialog({
  analysis,
  assetRef,
  blockId,
  onClose,
  onOptimizedAsset,
  onWorkspaceChange,
  projectPath
}: VideoOptimizationDialogProps) {
  const { t } = useI18n();
  const [profile, setProfile] = useState<VideoOptimizationOptions["profile"]>("web-1080");
  const [maxHeight, setMaxHeight] = useState(1080);
  const [rateControl, setRateControl] = useState<"crf" | "bitrate">("crf");
  const [crf, setCrf] = useState(23);
  const [videoBitrateMbps, setVideoBitrateMbps] = useState(5);
  const [audioBitrateKbps, setAudioBitrateKbps] = useState<96 | 128 | 160 | 192>(128);
  const [maxFps, setMaxFps] = useState<0 | 25 | 30>(0);
  const [taskId, setTaskId] = useState("");
  const [progress, setProgress] = useState<VideoOptimizationProgressEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void listen<VideoOptimizationProgressEvent>("video-optimization-progress", ({ payload }) => {
      if (!disposed && payload.taskId === taskId) {
        setProgress(payload);
        if (payload.error) setError(payload.error);
      }
    }).then((cleanup) => {
      unlisten = cleanup;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [taskId]);

  const running = progress?.state === "running" || progress?.state === "cancelling";
  const completed = progress?.state === "awaiting-confirmation" && progress.resultAnalysis;
  const displayedAnalysis = completed || analysis;
  const completedNeedsWarning = Boolean(completed && completed.status !== "adapted");
  const statusFallback = analysis.status === "recommended"
    ? "Optimisation recommandée"
    : analysis.status === "adapted"
      ? "Vidéo apparemment adaptée"
      : "Diagnostic incomplet";
  const profileSummary = profile === "web-720"
    ? ["H.264", "720p max.", "30 fps max.", "2,5 Mbit/s", "2 passes", "AAC 128 kbit/s"]
    : profile === "web-1080"
      ? ["H.264", "1080p max.", "30 fps max.", "5 Mbit/s", "2 passes", "AAC 128 kbit/s"]
      : profile === "quality-1080"
        ? ["H.264", "1080p max.", `FPS : ${t("video.optimizerKeepFps", undefined, "Conserver")}`, "8 Mbit/s", "2 passes", "AAC 192 kbit/s"]
        : profile === "strong"
          ? ["H.264", "720p max.", "25 fps max.", "1,5 Mbit/s", "2 passes", "AAC 96 kbit/s"]
          : [
              "H.264",
              `${maxHeight}p max.`,
              maxFps ? `${maxFps} fps max.` : `FPS : ${t("video.optimizerKeepFps", undefined, "Conserver")}`,
              rateControl === "crf"
                ? t("video.optimizerCrfOnePass", { value: crf })
                : t("video.optimizerBitrateTwoPasses", { value: videoBitrateMbps }),
              `AAC ${audioBitrateKbps} kbit/s`
            ];

  async function start() {
    setBusy(true);
    setError("");
    try {
      const options: VideoOptimizationOptions = {
        profile,
        ...(profile === "custom" ? {
          maxHeight,
          rateControl,
          ...(rateControl === "crf" ? { crf } : { videoBitrateMbps }),
          audioBitrateKbps,
          maxFps
        } : {})
      };
      const result = await startVideoOptimization(projectPath, blockId, options, assetRef);
      setTaskId(result.taskId);
      setProgress({
        taskId: result.taskId,
        state: "running",
        progress: 0,
        elapsedSeconds: 0,
        sourceAnalysis: analysis
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!taskId) return;
    setBusy(true);
    try {
      await cancelVideoOptimization(taskId);
      setProgress((current) => current ? { ...current, state: "cancelling" } : current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    if (taskId) await discardVideoOptimization(taskId);
    onClose();
  }

  async function confirm() {
    if (!taskId) return;
    setBusy(true);
    setError("");
    try {
      if (assetRef && onOptimizedAsset) {
        onOptimizedAsset(await confirmDetachedVideoOptimization(taskId));
      } else if (onWorkspaceChange) {
        onWorkspaceChange(await confirmVideoOptimization(taskId));
      } else {
        throw new Error("Cible d’optimisation indisponible");
      }
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.optimizerBackdrop} role="presentation">
      <section aria-labelledby="video-optimizer-title" aria-modal="true" className={styles.optimizerDialog} role="dialog">
        <header className={styles.optimizerHeader}>
          <div>
            <span className="editor-label">{t("video.optimizerEyebrow", undefined, "Encodage local")}</span>
            <h2 id="video-optimizer-title">{t("video.optimizeEncoding", undefined, "Optimiser l'encodage de la vidéo")}</h2>
          </div>
          {!running ? <button aria-label={t("common.close", undefined, "Fermer")} className={styles.optimizerClose} onClick={() => void discard()} type="button">×</button> : null}
        </header>

        <div className={`${styles.optimizerDiagnostic} ${styles[displayedAnalysis.status]}`}>
          <strong>{completed
            ? `${completedNeedsWarning ? "!" : "✓"} ${completedNeedsWarning
              ? t("video.optimizerCompletedWarning", undefined, "Optimisation terminée, résultat encore perfectible")
              : t("video.optimizerCompleted", undefined, "Optimisation terminée")}`
            : `${analysis.status === "recommended" ? "" : analysis.status === "adapted" ? "✓ " : "i "}${t(`video.optimizerStatus.${analysis.status}`, undefined, statusFallback)}`}</strong>
          <p>{completed
            ? completedNeedsWarning
              ? t("video.optimizerCompletedWarningHint", undefined, "La version optimisée est valide, mais certaines caractéristiques restent peu adaptées à une diffusion dans un LMS.")
              : t("video.optimizerCompletedHint", undefined, "La version optimisée est prête à être utilisée dans l’activité.")
            : analysis.status === "recommended"
              ? t("video.optimizerRecommendedHint", undefined, "Cette vidéo semble trop lourde ou surdimensionnée pour un SCORM. L'optimisation réduit le poids du paquet et facilite son chargement dans le LMS.")
              : analysis.status === "adapted"
                ? t("video.optimizerAdaptedHint", undefined, "Cette vidéo semble déjà adaptée à un usage web pédagogique.")
                : t("video.optimizerNeutralHint", undefined, "Les informations disponibles ne permettent pas un diagnostic complet. Vous pouvez néanmoins appliquer un profil encadré.")}</p>
        </div>

        <dl className={styles.optimizerMetrics}>
          <div><dt>{t("video.optimizerFile", undefined, "Fichier")}</dt><dd title={analysis.fileName}>{analysis.fileName}</dd></div>
          <div><dt>{t("video.optimizerSize", undefined, "Poids")}</dt><dd>{formatBytes(analysis.sizeBytes)}</dd></div>
          <div><dt>{t("video.optimizerDuration", undefined, "Durée")}</dt><dd>{formatDuration(analysis.durationSeconds)}</dd></div>
          <div><dt>{t("video.optimizerResolution", undefined, "Résolution")}</dt><dd>{analysis.width && analysis.height ? `${analysis.width} × ${analysis.height}` : "—"}</dd></div>
          <div><dt>{t("video.optimizerBitrate", undefined, "Débit moyen")}</dt><dd>{analysis.bitrateMbps ? `${analysis.bitrateMbps.toFixed(1)} Mbit/s` : "—"}</dd></div>
          <div><dt>{t("video.optimizerCodec", undefined, "Codec")}</dt><dd>{analysis.videoCodec ?? "—"}</dd></div>
        </dl>

        {!taskId ? (
          <div className={styles.optimizerForm}>
            <label>
              <span>{t("video.optimizerProfile", undefined, "Profil d'optimisation")}</span>
              <select onChange={(event) => setProfile(event.target.value as VideoOptimizationOptions["profile"])} value={profile}>
                {PROFILE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(`video.optimizerProfile.${option.value}`, undefined, option.fallback)}</option>)}
              </select>
            </label>
            <ul className={styles.optimizerProfileSummary}>
              {profileSummary.map((setting) => <li key={setting}>{setting}</li>)}
            </ul>
            {profile === "custom" ? (
              <div className={styles.optimizerCustomGrid}>
                <label className={styles.optimizerDimensionsField}><span>{t("video.optimizerMaxHeight", undefined, "Dimensions")}</span><select onChange={(event) => setMaxHeight(Number(event.target.value))} value={maxHeight}><option value={720}>720p</option><option value={1080}>1080p</option><option value={1440}>1440p</option><option value={2160}>2160p</option></select></label>
                <label className={styles.optimizerCompressionModeField}><span>{t("video.optimizerCompressionMode", undefined, "Mode de compression")}</span><select onChange={(event) => setRateControl(event.target.value as "crf" | "bitrate")} value={rateControl}><option value="crf">{t("video.optimizerCompressionMode.crf", undefined, "Qualité constante (CRF)")}</option><option value="bitrate">{t("video.optimizerCompressionMode.bitrate", undefined, "Débit vidéo cible")}</option></select></label>
                {rateControl === "crf" ? (
                  <label className={styles.optimizerVideoSettingField}><span>CRF (18–32)</span><input max={32} min={18} onChange={(event) => setCrf(Number(event.target.value))} step={1} type="number" value={crf} /></label>
                ) : (
                  <label className={styles.optimizerVideoSettingField}><span>{t("video.optimizerVideoBitrate", undefined, "Débit vidéo (Mbit/s)")}</span><input inputMode="decimal" max={40} min={0.5} onChange={(event) => setVideoBitrateMbps(Number(event.target.value))} step={0.1} type="number" value={videoBitrateMbps} /></label>
                )}
                <label className={styles.optimizerAudioField}><span>{t("video.optimizerAudioBitrate", undefined, "Débit audio")} (AAC)</span><select onChange={(event) => setAudioBitrateKbps(Number(event.target.value) as 96 | 128 | 160 | 192)} value={audioBitrateKbps}>{[96, 128, 160, 192].map((value) => <option key={value} value={value}>{value} kbit/s</option>)}</select></label>
                {rateControl === "crf" ? <p className={styles.optimizerCrfHint}>{t("video.optimizerCrfHint", undefined, "18 : qualité élevée · 23 : équilibre · 32 : compression élevée")}</p> : null}
                <label className={styles.optimizerFpsField}><span>{t("video.optimizerFps", undefined, "Fréquence d'images")}</span><select onChange={(event) => setMaxFps(Number(event.target.value) as 0 | 25 | 30)} value={maxFps}><option value={0}>{t("video.optimizerKeepFps", undefined, "Conserver")}</option><option value={25}>25 fps max.</option><option value={30}>30 fps max.</option></select><small>{t("video.optimizerSourceFps", { fps: formatFps(analysis.fps) }, "Source : {fps} fps")}</small></label>
              </div>
            ) : null}
          </div>
        ) : null}

        {progress ? (
          <div className={styles.optimizerProgress}>
            <div><strong>{progress.state === "awaiting-confirmation" ? t("video.optimizerCompleted", undefined, "Optimisation terminée") : t("video.optimizerInProgress", undefined, "Encodage en cours")}</strong><span>{Math.round(progress.progress)} %</span></div>
            <progress max={100} value={progress.progress} />
          </div>
        ) : null}

        {completed ? (
          <div className={styles.optimizerResult}>
            <div className={styles.optimizerComparison}>
              <span>{t("video.optimizerBefore", undefined, "Avant")} <strong>{formatBytes(analysis.sizeBytes)}</strong></span>
              <span aria-hidden="true">→</span>
              <span>{t("video.optimizerAfter", undefined, "Après")} <strong>{formatBytes(completed.sizeBytes)}</strong></span>
            </div>
            <p className={styles.optimizerOutputCharacteristics}>
              {[
                formatContainer(completed.container),
                formatCodec(completed.videoCodec),
                completed.width && completed.height ? `${completed.width} × ${completed.height}` : null,
                completed.fps ? `${formatFps(completed.fps)} fps` : null,
                completed.audioCodec
                  ? `${completed.audioCodec.toUpperCase()}${completed.audioBitrateKbps ? ` ${Math.round(completed.audioBitrateKbps)} kbit/s` : ""}`
                  : null
              ].filter(Boolean).join(" · ")}
            </p>
            <p className={styles.optimizerEncodingSummary}>{profile === "custom"
              ? rateControl === "crf"
                ? t("video.optimizerCrfOnePass", { value: crf })
                : t("video.optimizerBitrateTwoPasses", { value: videoBitrateMbps })
              : profile === "web-720" ? t("video.optimizerBitrateTwoPasses", { value: "2,5" })
                : profile === "web-1080" ? t("video.optimizerBitrateTwoPasses", { value: 5 })
                  : profile === "quality-1080" ? t("video.optimizerBitrateTwoPasses", { value: 8 })
                    : t("video.optimizerBitrateTwoPasses", { value: "1,5" })}</p>
            <p className={styles.optimizerEncodingSummary}>{t("video.optimizerSourceRemovalWarning", undefined, "Si vous utilisez la version optimisée, la vidéo originale importée sera supprimée du projet après enregistrement. Conservez votre propre copie si vous souhaitez la réimporter plus tard.")}</p>
          </div>
        ) : null}
        {error ? <p className={styles.optimizerError} role="alert">{error}</p> : null}

        <footer className={styles.optimizerActions}>
          {!taskId ? <button className="ghost-pill cancel-changes-pill" onClick={onClose} type="button">{t("common.cancel", undefined, "Annuler")}</button> : null}
          {!taskId ? <button className="primary-pill" disabled={busy} onClick={() => void start()} type="button">{t("video.startOptimization", undefined, "Lancer l'optimisation")}</button> : null}
          {running ? <button className="ghost-pill cancel-changes-pill" disabled={busy || progress?.state === "cancelling"} onClick={() => void cancel()} type="button">{t("video.cancelOptimization", undefined, "Annuler l'encodage")}</button> : null}
          {progress?.state === "cancelled" || progress?.state === "failed" ? <button className="ghost-pill" onClick={() => void discard()} type="button">{t("common.close", undefined, "Fermer")}</button> : null}
          {completed ? <button className="primary-pill" disabled={busy} onClick={() => void confirm()} type="button">{t("video.useOptimized", undefined, "Utiliser la version optimisée")}</button> : null}
        </footer>
      </section>
    </div>
  );
}
