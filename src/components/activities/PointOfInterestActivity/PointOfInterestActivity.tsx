import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./PointOfInterestActivity.module.css";
import {
  POINT_OF_INTEREST_MIN_POPUP_HEIGHT,
  POINT_OF_INTEREST_DEFAULT_POPUP_WIDTH
} from "./defaults";
import type { PointOfInterestActivityProps } from "./types";
import { useI18n } from "../../../i18n/react";
import { PointOfInterestMarkerMediaView } from "./PointOfInterestMarkerMedia";

type MarkerCardPosition = {
  left: number;
  top: number;
};

const MARKER_CARD_VIEWPORT_MARGIN = 12;
const MARKER_CARD_GAP = 12;
const MARKER_RADIUS = 21;

function stripMarkerTitleHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


function markerTextColor(backgroundColor?: string | null) {
  const value = (backgroundColor ?? "#123a7a").trim();
  const hex = value.startsWith("#") ? value.slice(1) : "";
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : hex.length === 6
        ? hex
        : null;

  if (!normalized || !/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return "#ffffff";
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

  return luminance > 0.6 ? "#102752" : "#ffffff";
}

export function PointOfInterestActivity({
  activeMarker,
  clampPercent,
  contentNode,
  displayTitle,
  hasImageAsset,
  imageAsset,
  imageAlt,
  imageRole,
  markers,
  onMarkerClose,
  onMarkerToggle,
  onImageOpen,
  resolveAssetUrl,
  richContent
}: PointOfInterestActivityProps) {
  const { t } = useI18n();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const [cardPosition, setCardPosition] = useState<MarkerCardPosition | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const ownerDocument = root?.ownerDocument;
    const ownerWindow = ownerDocument?.defaultView;
    if (!activeMarker || !root || !ownerDocument || !ownerWindow) {
      return;
    }
    const handleOutsidePointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (!(target instanceof ownerWindow.Node)) {
        return;
      }
      const targetElement = target instanceof ownerWindow.Element ? target : target.parentElement;
      if (
        root.contains(target) &&
        targetElement?.closest(".point-of-interest-marker, .point-of-interest-marker-card")
      ) {
        return;
      }
      onMarkerClose();
    };
    ownerDocument.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => ownerDocument.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [activeMarker, onMarkerClose]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const card = cardRef.current;
    if (!activeMarker || !stage || !card) {
      setCardPosition(null);
      return;
    }

    let animationFrame = 0;
    const positionCard = () => {
      if (
        card.querySelector(".plyr--fullscreen-active") ||
        (document.fullscreenElement && card.contains(document.fullscreenElement))
      ) {
        return;
      }
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const stageRect = stage.getBoundingClientRect();
        const cardWidth = card.offsetWidth;
        const cardHeight = card.offsetHeight;
        const anchorX = stageRect.left + (clampPercent(activeMarker.x) / 100) * stageRect.width;
        const anchorY = stageRect.top + (clampPercent(activeMarker.y) / 100) * stageRect.height;
        const belowTop = anchorY + MARKER_RADIUS + MARKER_CARD_GAP;
        const aboveBottom = anchorY - MARKER_RADIUS - MARKER_CARD_GAP;
        const stageLeft = stageRect.left + MARKER_CARD_VIEWPORT_MARGIN;
        const stageRight = stageRect.right - MARKER_CARD_VIEWPORT_MARGIN;
        const stageTop = stageRect.top + MARKER_CARD_VIEWPORT_MARGIN;
        const stageBottom = stageRect.bottom - MARKER_CARD_VIEWPORT_MARGIN;
        const viewportLeft = Math.min(
          Math.max(anchorX - cardWidth / 2, stageLeft),
          Math.max(stageLeft, stageRight - cardWidth)
        );
        const preferredTop = belowTop + cardHeight <= stageBottom ? belowTop : aboveBottom - cardHeight;
        const viewportTop = Math.min(
          Math.max(preferredTop, stageTop),
          Math.max(stageTop, stageBottom - cardHeight)
        );

        setCardPosition({
          left: viewportLeft - stageRect.left,
          top: viewportTop - stageRect.top
        });
      });
    };

    positionCard();
    const resizeObserver = new ResizeObserver(positionCard);
    resizeObserver.observe(card);
    resizeObserver.observe(stage);
    window.addEventListener("resize", positionCard);
    window.addEventListener("scroll", positionCard, true);
    document.addEventListener("fullscreenchange", positionCard);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", positionCard);
      window.removeEventListener("scroll", positionCard, true);
      document.removeEventListener("fullscreenchange", positionCard);
    };
  }, [activeMarker, clampPercent]);

  return (
    <div className={`point-of-interest-block ${styles.activity}`} ref={rootRef}>
      {displayTitle ? <h3 className="export-block-title">{displayTitle}</h3> : null}
      {richContent ? <div className="rich-content" dangerouslySetInnerHTML={{ __html: richContent }} /> : null}
      <div
        className={`point-of-interest-stage ${imageAsset && hasImageAsset ? "has-image" : ""}`}
        ref={stageRef}
      >
        {imageAsset && hasImageAsset ? (
          <img alt={imageAlt} className="preview-media" role={imageRole} src={imageAsset} />
        ) : (
          <div className="point-of-interest-placeholder">
            <div className="point-of-interest-placeholder-copy">
              <strong>{t("activity.point-of-interest", undefined, "Points d'intérêt")}</strong>
              <span>{t("poi.importImageForMarkers", undefined, "Importer une image pour placer les marqueurs.")}</span>
            </div>
          </div>
        )}
        {markers.map((marker) => (
          <button
            aria-label={stripMarkerTitleHtml(marker.title) || t("poi.markerNumber", { count: marker.order }, "Marqueur {count}")}
            className={`point-of-interest-marker ${activeMarker?.id === marker.id ? "active" : ""}`}
            key={marker.id}
            onClick={(event) => {
              event.stopPropagation();
              onMarkerToggle(marker.id);
            }}
            style={{
              left: `${clampPercent(marker.x)}%`,
              top: `${clampPercent(marker.y)}%`,
              backgroundColor: marker.color ?? "#123a7a",
              color: markerTextColor(marker.color)
            }}
            type="button"
          >
            {marker.label || marker.order}
          </button>
        ))}
        {activeMarker ? (
          <aside
            className="point-of-interest-marker-card"
            ref={cardRef}
            style={{
              left: cardPosition ? `${cardPosition.left}px` : `${clampPercent(activeMarker.x)}%`,
              maxHeight: "calc(100% - 24px)",
              minHeight: `min(${POINT_OF_INTEREST_MIN_POPUP_HEIGHT}, calc(100% - 24px))`,
              opacity: cardPosition ? 1 : 0,
              top: cardPosition ? `${cardPosition.top}px` : `${clampPercent(activeMarker.y)}%`,
              width:
                `min(${POINT_OF_INTEREST_DEFAULT_POPUP_WIDTH}, calc(100% - 24px), calc(100vw - 24px))`
            }}
          >
            <div className={styles.markerCardScroll}>
              {stripMarkerTitleHtml(activeMarker.title || "") ? (
                <strong dangerouslySetInnerHTML={{ __html: activeMarker.title }} />
              ) : null}
              {activeMarker.media ? (
                <PointOfInterestMarkerMediaView
                  media={activeMarker.media}
                  onImageOpen={onImageOpen}
                  resolveAssetUrl={resolveAssetUrl}
                />
              ) : null}
              {stripMarkerTitleHtml(activeMarker.contentHtml || "") ? (
                <div className="rich-content" dangerouslySetInnerHTML={{ __html: activeMarker.contentHtml }} />
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>
      {contentNode ? <div className={styles.content}>{contentNode}</div> : null}
    </div>
  );
}
