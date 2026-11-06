import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import styles from "./AudioActivity.module.css";
import type { PlyrAudioPlayerProps } from "./types";
import { useI18n } from "../../../i18n/react";

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "00:00";
  }
  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function PlyrAudioPlayer({
  accentColor,
  activeTrackIndex,
  allowDownload,
  autoplayNext,
  onActiveTrackIndexChange,
  playRequestId,
  tracks,
  volumePanelPlacement = "above"
}: PlyrAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { t } = useI18n();
  const playerRef = useRef<Plyr | null>(null);
  const volumeRef = useRef<HTMLDivElement | null>(null);
  const shouldResumeAfterTrackChangeRef = useRef(false);
  const activeTrackIndexRef = useRef(activeTrackIndex);
  const autoplayNextRef = useRef(autoplayNext);
  const tracksLengthRef = useRef(tracks.length);
  const wasPlayingBeforeSeekRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);
  const [volume, setVolume] = useState(1);
  const activeTrack = tracks[activeTrackIndex] ?? tracks[0] ?? null;
  const audioSrc = activeTrack?.audioSrc ?? null;
  const canSeek = duration > 0;

  function goToNextTrack(shouldPlay: boolean) {
    const nextIndex = activeTrackIndexRef.current + 1;
    if (nextIndex >= tracksLengthRef.current) {
      return;
    }
    shouldResumeAfterTrackChangeRef.current = shouldPlay;
    onActiveTrackIndexChange(nextIndex);
  }

  useEffect(() => {
    activeTrackIndexRef.current = activeTrackIndex;
    autoplayNextRef.current = autoplayNext;
    tracksLengthRef.current = tracks.length;
  }, [activeTrackIndex, autoplayNext, tracks.length]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    playerRef.current?.destroy();
    const player = new Plyr(audio, {
      controls: [],
      muted: false,
      settings: ["speed"],
      seekTime: 10,
      speed: { selected: 1, options: [0.75, 1, 1.25, 1.5, 2] },
      storage: { enabled: false, key: "paideia-audio-player" },
      volume: 1
    });
    playerRef.current = player;

    const handleEnded = () => {
      setIsPlaying(false);
      if (!autoplayNextRef.current || tracksLengthRef.current < 2) {
        return;
      }
      goToNextTrack(true);
    };
    const handleLoadedMetadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const handleTimeUpdate = () => setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    return () => {
      audio.pause();
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      player.destroy();
      playerRef.current = null;
    };
  }, [onActiveTrackIndexChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) {
      return;
    }

    const shouldResume = shouldResumeAfterTrackChangeRef.current;
    shouldResumeAfterTrackChangeRef.current = false;
    wasPlayingBeforeSeekRef.current = false;
    setIsPlaying(false);
    audio.src = audioSrc;
    audio.load();
    setCurrentTime(0);
    setDuration(0);

    if (shouldResume) {
      const resumePlayback = () => {
        const promise = audio.play();
        if (promise && typeof promise.catch === "function") {
          promise.catch(() => {});
        }
      };
      audio.addEventListener("canplay", resumePlayback, { once: true });
    }
    return () => {
      audio.removeAttribute("src");
    };
  }, [audioSrc]);

  useEffect(() => {
    if (playRequestId <= 0) {
      return;
    }
    const audio = audioRef.current;
    if (!audio || !audioSrc) {
      return;
    }
    shouldResumeAfterTrackChangeRef.current = true;
    const promise = audio.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch(() => {});
    }
  }, [audioSrc, playRequestId]);

  useEffect(() => {
    if (!isVolumeOpen) {
      return;
    }

    function handleOutsidePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || volumeRef.current?.contains(target)) {
        return;
      }
      setIsVolumeOpen(false);
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [isVolumeOpen]);

  if (!audioSrc) {
    return (
      <div className={styles.emptyPlayer} role="status">
        {t("audio.addTrackToEnable", undefined, "Ajouter une piste audio pour activer le lecteur.")}
      </div>
    );
  }

  const style = { "--audio-accent": accentColor } as CSSProperties;
  const sliderMax = canSeek ? duration : 100;
  const remainingTime = Math.max(0, duration - currentTime);
  const remainingTimeLabel = `-${formatAudioTime(remainingTime)}`;

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (audio.paused) {
      const promise = audio.play();
      if (promise && typeof promise.catch === "function") {
        promise.catch(() => {});
      }
    } else {
      audio.pause();
    }
  }

  function seekTo(value: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(value)) {
      return;
    }
    const nextTime = Math.max(0, Math.min(value, audio.duration || duration || value));
    setCurrentTime(audio.currentTime);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function startSeek() {
    const audio = audioRef.current;
    wasPlayingBeforeSeekRef.current = Boolean(audio && !audio.paused);
  }

  function finishSeek() {
    const audio = audioRef.current;
    if (!audio || !wasPlayingBeforeSeekRef.current) {
      return;
    }
    const promise = audio.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch(() => {});
    }
  }

  function updateVolume(value: number) {
    const nextVolume = Math.max(0, Math.min(value, 1));
    const audio = audioRef.current;
    if (audio) {
      audio.volume = nextVolume;
      audio.muted = nextVolume === 0;
    }
    setVolume(nextVolume);
  }

  return (
    <div className={styles.playerFrame} style={style}>
      <div className={styles.transportBar}>
        <button
          aria-label={isPlaying ? t("audio.pause", undefined, "Mettre en pause") : t("audio.play", undefined, "Lire")}
          className={styles.transportPlay}
          onClick={togglePlayback}
          type="button"
        >
          {isPlaying ? (
            <svg aria-hidden="true" className={styles.transportPlayIcon} viewBox="0 0 24 24">
              <path d="M7 5h4v14H7V5zm6 0h4v14h-4V5z" fill="currentColor" />
            </svg>
          ) : (
            <svg aria-hidden="true" className={styles.transportPlayIcon} viewBox="0 0 24 24">
              <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
            </svg>
          )}
        </button>
        <input
          aria-label={t("audio.playbackPosition", undefined, "Position de lecture")}
          className={styles.transportSeek}
          disabled={!canSeek}
          max={sliderMax}
          min={0}
          onChange={(event) => seekTo(Number(event.target.value))}
          onInput={(event) => seekTo(Number(event.currentTarget.value))}
          onKeyUp={finishSeek}
          onPointerDown={startSeek}
          onPointerUp={finishSeek}
          step={0.01}
          type="range"
          value={canSeek ? Math.min(currentTime, sliderMax) : 0}
        />
        <span className={`${styles.transportTime} ${styles.transportTimeDuration}`}>{remainingTimeLabel}</span>
        <div className={styles.transportVolume} ref={volumeRef}>
          <button
            aria-expanded={isVolumeOpen}
            aria-label={t("audio.adjustVolume", undefined, "Régler le volume")}
            className={styles.transportVolumeButton}
            onClick={() => setIsVolumeOpen((current) => !current)}
            type="button"
          >
            <svg
              aria-hidden="true"
              className={styles.transportVolumeIcon}
              viewBox="0 0 24 24"
            >
              <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
              {volume <= 0 ? (
                <path
                  d="M18 9l3 3m0-3l-3 3"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
              ) : (
                <>
                  <path
                    d="M16 9.5a4 4 0 010 5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="2"
                  />
                  <path
                    d="M18.5 7a7 7 0 010 10"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="2"
                  />
                </>
              )}
            </svg>
          </button>
          {isVolumeOpen ? (
            <div className={`${styles.transportVolumePanel} ${volumePanelPlacement === "below" ? styles.transportVolumePanelBelow : ""}`}>
              <input
                aria-label={t("audio.volume", undefined, "Volume")}
                max={1}
                min={0}
                onChange={(event) => updateVolume(Number(event.target.value))}
                step={0.01}
                type="range"
                value={volume}
              />
            </div>
          ) : null}
        </div>
      </div>
      <audio controlsList={allowDownload ? undefined : "nodownload"} preload="metadata" ref={audioRef}>
        <source src={audioSrc} />
      </audio>
    </div>
  );
}
