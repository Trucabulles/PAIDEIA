import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useI18n } from "../../../i18n/react";
import { PlyrAudioPlayer } from "./PlyrAudioPlayer";
import styles from "./AudioActivity.module.css";
import type { AudioActivityProps } from "./types";
import { TranscriptAccessButton } from "../../transcript";

export function AudioActivity({
  accentColor,
  allowDownload,
  autoplayNext,
  backgroundColor,
  borderColor,
  borderStyle,
  borderWidth,
  coverNode,
  descriptionNode,
  rounded,
  shadow,
  titleNode,
  tracks
}: AudioActivityProps) {
  const { t } = useI18n();
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [playRequestId, setPlayRequestId] = useState(0);
  const [trackDurations, setTrackDurations] = useState<Record<string, string>>({});
  const hasPlaylist = tracks.length > 0;

  useEffect(() => {
    const nextDurations: Record<string, string> = {};
    const audioElements: HTMLAudioElement[] = [];

    tracks.forEach((track) => {
      if (!track.audioSrc) {
        return;
      }

      const audio = new Audio();
      audio.preload = "metadata";
      audio.src = track.audioSrc;
      audioElements.push(audio);
      audio.addEventListener(
        "loadedmetadata",
        () => {
          if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
            return;
          }
          const totalSeconds = Math.round(audio.duration);
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          nextDurations[track.id] = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
          setTrackDurations((current) => ({ ...current, [track.id]: nextDurations[track.id] }));
        },
        { once: true }
      );
    });

    return () => {
      audioElements.forEach((audio) => {
        audio.removeAttribute("src");
        audio.load();
      });
    };
  }, [tracks]);

  useEffect(() => {
    setActiveTrackIndex((current) => Math.max(0, Math.min(tracks.length - 1, current)));
  }, [tracks.length]);

  const style = {
    "--audio-accent": accentColor,
    "--audio-background": backgroundColor,
    "--audio-border-color": borderColor,
    "--audio-border-style": borderStyle,
    "--audio-border-width": borderWidth,
    "--audio-radius": rounded ? "28px" : "0px"
  } as CSSProperties;

  return (
    <article className={`${styles.card} ${shadow ? styles.shadow : ""}`} style={style}>
      <div className={styles.cover}>{coverNode}</div>
      <div className={styles.body}>
        <div className={styles.title}>{titleNode}</div>
        <div className={styles.description}>{descriptionNode}</div>
        {hasPlaylist ? (
          <div className={styles.playlist} aria-label={t("audio.trackList", undefined, "Liste des pistes audio")}>
            {tracks.map((track, index) => (
              <div className={styles.trackRow} key={track.id}>
                <button
                  aria-current={index === activeTrackIndex ? "true" : undefined}
                  className={`${styles.trackSelect} ${index === activeTrackIndex ? styles.trackActive : ""}`}
                  onClick={() => {
                    setActiveTrackIndex(index);
                    setPlayRequestId((current) => current + 1);
                  }}
                  type="button"
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{track.title || t("audio.trackNumber", { count: index + 1 }, "Piste {count}")}</strong>
                  {trackDurations[track.id] ? <em>{trackDurations[track.id]}</em> : null}
                </button>
                {track.transcriptStatus === "validated" && track.transcriptHtml ? (
                  <TranscriptAccessButton
                    allowDownload={Boolean(track.transcriptAllowDownload)}
                    html={track.transcriptHtml}
                    language={track.transcriptLanguage}
                    title={track.title || t("audio.trackNumber", { count: index + 1 }, "Piste {count}")}
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        <PlyrAudioPlayer
          accentColor={accentColor}
          activeTrackIndex={activeTrackIndex}
          allowDownload={allowDownload}
          autoplayNext={autoplayNext}
          onActiveTrackIndexChange={setActiveTrackIndex}
          playRequestId={playRequestId}
          tracks={tracks}
        />
      </div>
    </article>
  );
}
