import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../../i18n/react";
import styles from "./VideoActivity.module.css";
import {
  parseVtt,
  parseVttTimestamp,
  serializeVtt,
  type VttDocument
} from "./vtt";

type VttSubtitleEditorProps = {
  fileName: string;
  initialVttContent?: string | null;
  onClose: () => void;
  onSave: (file: File) => Promise<void> | void;
  originalSubtitleSrc?: string | null;
  spellcheckLanguage: string;
  subtitleSrc?: string | null;
  videoSrc: string | null;
};

type ValidationState = {
  errors: Record<string, string>;
  overlaps: number[];
};

function validateDocument(document: VttDocument): ValidationState {
  const errors: Record<string, string> = {};
  const overlaps: number[] = [];
  document.cues.forEach((cue, index) => {
    const start = parseVttTimestamp(cue.start);
    const end = parseVttTimestamp(cue.end);
    if (start === null || end === null) {
      errors[cue.id] = "INVALID_TIME";
      return;
    }
    if (end <= start) {
      errors[cue.id] = "INVALID_RANGE";
    }
    if (index > 0) {
      const previousEnd = parseVttTimestamp(document.cues[index - 1].end);
      if (previousEnd !== null && start < previousEnd) {
        overlaps.push(index);
      }
    }
  });
  return { errors, overlaps };
}

export function VttSubtitleEditor({
  fileName,
  initialVttContent,
  onClose,
  onSave,
  originalSubtitleSrc,
  spellcheckLanguage,
  subtitleSrc,
  videoSrc
}: VttSubtitleEditorProps) {
  const { t } = useI18n();
  const [original, setOriginal] = useState<VttDocument | null>(null);
  const [draft, setDraft] = useState<VttDocument | null>(null);
  const [loadError, setLoadError] = useState("");
  const [previewSubtitleSrc, setPreviewSubtitleSrc] = useState("");
  const [saving, setSaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (initialVttContent) {
      try {
        const generated = parseVtt(initialVttContent);
        setOriginal(generated);
        setDraft(generated);
        setLoadError("");
      } catch {
        setLoadError(t("video.subtitleEditorInvalidFile", undefined, "Le fichier WebVTT ne peut pas être édité."));
      }
      return () => {
        cancelled = true;
      };
    }
    if (!subtitleSrc) {
      setLoadError(t("video.subtitleEditorInvalidFile", undefined, "Le fichier WebVTT ne peut pas être édité."));
      return () => {
        cancelled = true;
      };
    }
    void Promise.all([subtitleSrc, originalSubtitleSrc ?? subtitleSrc].map((source) => fetch(source)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.text();
      })
      .then((content) => parseVtt(content))))
      .then(([currentVersion, importedVersion]) => {
        if (!cancelled) {
          setOriginal(importedVersion);
          setDraft(currentVersion);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(t("video.subtitleEditorInvalidFile", undefined, "Le fichier WebVTT ne peut pas être édité."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialVttContent, originalSubtitleSrc, subtitleSrc, t]);

  useEffect(() => {
    if (!draft) {
      setPreviewSubtitleSrc("");
      return;
    }
    const objectUrl = URL.createObjectURL(new Blob([serializeVtt(draft)], { type: "text/vtt;charset=utf-8" }));
    setPreviewSubtitleSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [draft]);

  const validation = useMemo(() => draft ? validateDocument(draft) : { errors: {}, overlaps: [] }, [draft]);
  const hasErrors = Object.keys(validation.errors).length > 0;

  function updateCue(id: string, patch: Partial<NonNullable<typeof draft>["cues"][number]>) {
    setDraft((current) => current ? {
      ...current,
      cues: current.cues.map((cue) => cue.id === id ? { ...cue, ...patch } : cue)
    } : current);
  }

  function previewCue(start: string) {
    const video = videoRef.current;
    const milliseconds = parseVttTimestamp(start);
    if (!video || milliseconds === null) return;
    video.currentTime = milliseconds / 1000;
    void video.play();
  }

  async function save() {
    if (!draft || hasErrors) return;
    setSaving(true);
    try {
      const safeName = fileName.toLowerCase().endsWith(".vtt") ? fileName : `${fileName || "subtitles"}.vtt`;
      await onSave(new File([serializeVtt(draft)], safeName, { type: "text/vtt;charset=utf-8" }));
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="paideia-modal-backdrop" onClick={onClose} role="presentation">
      <section
        aria-labelledby="video-vtt-editor-title"
        aria-modal="true"
        className={`paideia-modal ${styles.subtitleEditorDialog}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className={styles.subtitleEditorHeader}>
          <div>
            <p className="modal-kicker">{t("video.subtitleEditorKicker", undefined, "Sous-titres WebVTT")}</p>
            <h2 id="video-vtt-editor-title">{t("video.editSubtitles", undefined, "Éditer les sous-titres")}</h2>
          </div>
          <button aria-label={t("common.close", undefined, "Fermer")} className="ghost-icon-button" onClick={onClose} type="button">×</button>
        </header>

        {videoSrc ? (
          <video
            className={styles.subtitleEditorVideo}
            controls
            onLoadedMetadata={(event) => {
              const track = event.currentTarget.textTracks[0];
              if (track) track.mode = "showing";
            }}
            preload="metadata"
            ref={videoRef}
            src={videoSrc}
          >
            {previewSubtitleSrc ? (
              <track
                default
                key={previewSubtitleSrc}
                kind="captions"
                label={t("video.frenchCaptions", undefined, "Sous-titres français")}
                onLoad={(event) => {
                  event.currentTarget.track.mode = "showing";
                }}
                src={previewSubtitleSrc}
                srcLang="fr"
              />
            ) : null}
          </video>
        ) : null}
        <main className={styles.subtitleEditorBody}>
          {loadError ? <p className={styles.subtitleEditorError} role="alert">{loadError}</p> : null}
          {!draft && !loadError ? <p role="status">{t("pdf.loading", undefined, "Chargement")}</p> : null}

          {draft ? (
            <>
            {validation.overlaps.length > 0 ? (
              <p className={styles.subtitleEditorWarning} role="status">
                {t("video.subtitleEditorOverlapWarning", undefined, "Certains segments se chevauchent. Vérifiez leur chronologie avant l’enregistrement.")}
              </p>
            ) : null}
            <div className={styles.subtitleCueList}>
              {draft.cues.map((cue, index) => {
                const error = validation.errors[cue.id];
                return (
                  <article className={styles.subtitleCueCard} key={cue.id}>
                    <header className={styles.subtitleCueHeader}>
                      <strong>{t("video.subtitleSegment", { index: index + 1 }, "Segment {index}")}</strong>
                      <div className={styles.subtitleCueActions}>
                        <button className="ghost-pill" onClick={() => previewCue(cue.start)} type="button">{t("video.previewSubtitleSegment", undefined, "Lire")}</button>
                      </div>
                    </header>
                    <div className={styles.subtitleTimingRow}>
                      <label>
                        <span>{t("video.subtitleStart", undefined, "Début")}</span>
                        <input aria-invalid={Boolean(error)} onChange={(event) => updateCue(cue.id, { start: event.target.value })} value={cue.start} />
                      </label>
                      <label>
                        <span>{t("video.subtitleEnd", undefined, "Fin")}</span>
                        <input aria-invalid={Boolean(error)} onChange={(event) => updateCue(cue.id, { end: event.target.value })} value={cue.end} />
                      </label>
                    </div>
                    {error ? (
                      <p className={styles.subtitleEditorError} role="alert">
                        {error === "INVALID_RANGE"
                          ? t("video.subtitleEditorInvalidRange", undefined, "La fin doit être postérieure au début.")
                          : t("video.subtitleEditorInvalidTime", undefined, "Utilisez le format 00:00:00.000.")}
                      </p>
                    ) : null}
                    <label className={styles.subtitleTextField}>
                      <span>{t("video.subtitleText", undefined, "Texte")}</span>
                      <textarea
                        autoCorrect="off"
                        lang={spellcheckLanguage}
                        onChange={(event) => updateCue(cue.id, { text: event.target.value })}
                        rows={3}
                        spellCheck
                        value={cue.text}
                      />
                    </label>
                  </article>
                );
              })}
            </div>
            </>
          ) : null}
        </main>

        <footer className={`modal-actions ${styles.subtitleEditorFooter}`}>
          <button className="ghost-pill" disabled={!original || saving} onClick={() => setDraft(original)} type="button">
            {t("video.restoreLoadedSubtitles", undefined, "Restaurer la version chargée")}
          </button>
          <button className="ghost-pill" disabled={saving} onClick={onClose} type="button">{t("common.cancel", undefined, "Annuler")}</button>
          <button className="primary-pill" disabled={!draft || hasErrors || saving} onClick={() => void save()} type="button">
            {saving ? t("common.saving", undefined, "Enregistrement…") : t("common.save", undefined, "Enregistrer")}
          </button>
        </footer>
      </section>
    </div>
  );
}
