import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import { logDevEvent } from "../../../lib/projectApi";
import styles from "./VideoActivity.module.css";
import type { PlyrVideoPlayerProps } from "./types";
import { useI18n } from "../../../i18n/react";

const plyrSpriteUrl = new URL("../../../../node_modules/plyr/dist/plyr.svg", import.meta.url).href;

const DEFAULT_CAPTION_COLOR = "#ffffff";
const CAPTION_SAFE_MARGIN_PX = 16;

function contrastingCaptionOutline(color: string): string {
  const normalized = color.trim().replace(/^#/, "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((value) => `${value}${value}`).join("")
    : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    return "#000000";
  }
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.52 ? "#000000" : "#ffffff";
}

function updateVideoGeometry(video: HTMLVideoElement, maxDisplayHeight?: number) {
  const player = video.closest<HTMLElement>(".plyr");
  const wrapper = player?.querySelector<HTMLElement>(".plyr__video-wrapper");
  if (!player || !wrapper || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return;
  }

  const videoRatio = video.videoWidth / video.videoHeight;
  const fullscreenDocument = video.ownerDocument as Document & { webkitFullscreenElement?: Element | null };
  const isFullscreen =
    fullscreenDocument.fullscreenElement === player ||
    fullscreenDocument.webkitFullscreenElement === player ||
    player.classList.contains("plyr--fullscreen-active");
  if (!isFullscreen && wrapper.clientWidth > 0) {
    if (maxDisplayHeight && maxDisplayHeight > 0) {
      const contentWidth = Math.round(maxDisplayHeight * videoRatio);
      player.style.maxWidth = `${contentWidth}px`;
      player.style.marginInline = "auto";
      player.closest<HTMLElement>(".linear-block-content")?.style.setProperty(
        "--video-content-width",
        `${contentWidth}px`
      );
    } else {
      player.style.removeProperty("max-width");
      player.style.removeProperty("margin-inline");
    }
    wrapper.style.aspectRatio = "auto";
    wrapper.style.height = `${Math.min(
      maxDisplayHeight && maxDisplayHeight > 0 ? maxDisplayHeight : Number.POSITIVE_INFINITY,
      Math.round(wrapper.clientWidth / videoRatio)
    )}px`;
  }

  const playerRect = player.getBoundingClientRect();
  const wrapperRect = wrapper.getBoundingClientRect();
  if (playerRect.width <= 0 || playerRect.height <= 0 || wrapperRect.width <= 0 || wrapperRect.height <= 0) {
    return;
  }

  const renderedHeight = Math.min(wrapperRect.height, wrapperRect.width / videoRatio);
  const contentBottom = wrapperRect.top - playerRect.top + (wrapperRect.height + renderedHeight) / 2;
  const bottomInset = Math.max(0, playerRect.height - contentBottom);
  player.style.setProperty(
    "--video-caption-safe-bottom",
    `${Math.round(bottomInset + CAPTION_SAFE_MARGIN_PX)}px`
  );
}

export function PlyrVideoPlayer({
  mediaSrc,
  posterSrc,
  subtitleSrc,
  captionColor = DEFAULT_CAPTION_COLOR,
  captionBackgroundEnabled = true,
  captionOutline = "none",
  allowFullscreen = true,
  maxDisplayHeight
}: PlyrVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { t } = useI18n();
  const playerRef = useRef<Plyr | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mediaSrc) {
      return;
    }

    const ownerWindow = video.ownerDocument?.defaultView as (Window & { Plyr?: typeof Plyr }) | null;
    const PlyrRuntime = ownerWindow?.Plyr ?? Plyr;
    const runtimeIconUrl =
      (ownerWindow as (Window & { __PAIDEIA_PLYR_ICON_URL?: string }) | null)?.__PAIDEIA_PLYR_ICON_URL ??
      plyrSpriteUrl;

    playerRef.current?.destroy();
    const controls = [
      "play-large",
      "play",
      "progress",
      "current-time",
      "duration",
      "mute",
      "volume",
      "captions",
      "settings"
    ];
    if (allowFullscreen) {
      controls.push("fullscreen");
    }

    void logDevEvent("info", "video.plyr.init.start", {
      mediaSrc,
      subtitleSrc,
      allowFullscreen,
      ownerWindowHasPlyr: typeof ownerWindow?.Plyr === "function",
      runtimeIconUrl
    });

    let player: Plyr;
    try {
      player = new PlyrRuntime(video, {
        captions: { active: Boolean(subtitleSrc), language: "fr", update: true },
        controls,
        fullscreen: { enabled: allowFullscreen, fallback: allowFullscreen, iosNative: false },
        iconUrl: runtimeIconUrl,
        loadSprite: true,
        muted: false,
        settings: ["captions", "speed"],
        speed: { selected: 1, options: [0.75, 1, 1.25, 1.5, 2] },
        storage: { enabled: false, key: "paideia-video-player" },
        volume: 1
      });
    } catch (error) {
      void logDevEvent("error", "video.plyr.init.failed", {
        mediaSrc,
        subtitleSrc,
        allowFullscreen,
        ownerWindowHasPlyr: typeof ownerWindow?.Plyr === "function",
        runtimeIconUrl,
        reason: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null
      });
      return;
    }
    playerRef.current = player;
    const scheduleGeometryUpdate = () => {
      ownerWindow?.requestAnimationFrame(() => {
        ownerWindow.requestAnimationFrame(() => updateVideoGeometry(video, maxDisplayHeight));
      });
    };
    const eventPlayer = player as Plyr & { on?: (event: string, callback: () => void) => void };
    eventPlayer.on?.("ready", () => {
      void logDevEvent("info", "video.plyr.ready", {
        mediaSrc,
        subtitleSrc,
        allowFullscreen
      });
      scheduleGeometryUpdate();
    });
    eventPlayer.on?.("enterfullscreen", scheduleGeometryUpdate);
    eventPlayer.on?.("exitfullscreen", scheduleGeometryUpdate);

    const enableCaptions = () => {
      if (!subtitleSrc) {
        return;
      }
      Array.from(video.textTracks).forEach((track, index) => {
        track.mode = index === 0 ? "showing" : "disabled";
      });
    };
    const handleMediaReady = () => {
      enableCaptions();
      scheduleGeometryUpdate();
    };
    video.addEventListener("loadedmetadata", handleMediaReady);
    video.addEventListener("loadeddata", handleMediaReady);
    ownerWindow?.addEventListener("resize", scheduleGeometryUpdate);
    const ResizeObserverRuntime = (ownerWindow as typeof window | null)?.ResizeObserver;
    const geometryObserver = ResizeObserverRuntime
      ? new ResizeObserverRuntime(scheduleGeometryUpdate)
      : null;
    const playerElement = video.closest<HTMLElement>(".plyr");
    const wrapperElement = playerElement?.querySelector<HTMLElement>(".plyr__video-wrapper");
    if (playerElement) geometryObserver?.observe(playerElement);
    if (wrapperElement) geometryObserver?.observe(wrapperElement);
    const timers = [0, 250, 1000].map((delay) => window.setTimeout(enableCaptions, delay));
    scheduleGeometryUpdate();

    return () => {
      video.pause();
      video.removeEventListener("loadedmetadata", handleMediaReady);
      video.removeEventListener("loadeddata", handleMediaReady);
      ownerWindow?.removeEventListener("resize", scheduleGeometryUpdate);
      geometryObserver?.disconnect();
      timers.forEach((timerId) => window.clearTimeout(timerId));
      player.destroy();
      playerRef.current = null;
    };
  }, [allowFullscreen, maxDisplayHeight, mediaSrc, subtitleSrc]);

  const playerStyle = {
    "--video-caption-color": captionColor,
    "--video-caption-background": captionBackgroundEnabled ? "rgba(0, 0, 0, 0.8)" : "transparent",
    "--video-caption-outline-color": contrastingCaptionOutline(captionColor),
    "--video-caption-outline-width": captionOutline === "thick" ? "3px" : captionOutline === "thin" ? "2px" : "0px"
  } as CSSProperties;

  if (!mediaSrc) {
    return (
      <div className={styles.placeholder} role="status" aria-label={t("video.noMediaAria", undefined, "Activité vidéo sans média")}>
        <span className={styles.placeholderIcon} aria-hidden="true" />
        <strong>{t("activity.media")}</strong>
        <span>{t("video.insertHint", undefined, "Cliquer sur le crayon pour insérer une vidéo")}</span>
      </div>
    );
  }

  return (
    <div
      className={`${styles.playerFrame} ${allowFullscreen ? "" : styles.fullscreenDisabled}`}
      key={`${mediaSrc}-${subtitleSrc ?? "no-captions"}`}
      style={playerStyle}
    >
      <video
        className={styles.video}
        crossOrigin="anonymous"
        data-paideia-plyr="true"
        poster={posterSrc ?? undefined}
        preload="metadata"
        ref={videoRef}
      >
        <source src={mediaSrc} />
        {subtitleSrc ? (
          <track
            default
            kind="captions"
            label={t("video.frenchCaptions")}
            src={subtitleSrc}
            srcLang="fr"
          />
        ) : null}
      </video>
    </div>
  );
}
