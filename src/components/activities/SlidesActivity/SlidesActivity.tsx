import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ActivityItem } from "../../../types/project";
import { useI18n } from "../../../i18n/react";
import { defaultSlidesImageSize, isDefaultSlidesContentHtml } from "./SlidesItems";
import styles from "./SlidesActivity.module.css";
import type { SlidesActivityProps } from "./types";
import { hasLegacySlidesNavigationDefaults, SLIDES_NAVIGATION_DEFAULTS } from "./defaults";

const INTERACTIVE_TARGET_SELECTOR =
  "input, textarea, select, button, a, video, audio, [contenteditable='true']";

const SLIDES_REFERENCE_HEIGHT_FLOOR = 420;
const SLIDES_REFERENCE_HEIGHT_CEILING = 700;
const SLIDES_VIEWPORT_RESERVED_HEIGHT = 220;

function slidesReferenceHeight(heights: number[], viewportHeight: number): number | null {
  const sortedHeights = heights
    .filter((height) => Number.isFinite(height) && height > 0)
    .map((height) => Math.ceil(height))
    .sort((left, right) => left - right);
  if (!sortedHeights.length) {
    return null;
  }

  const viewportCeiling = Math.max(
    SLIDES_REFERENCE_HEIGHT_FLOOR,
    Math.min(SLIDES_REFERENCE_HEIGHT_CEILING, viewportHeight - SLIDES_VIEWPORT_RESERVED_HEIGHT)
  );
  let representativeHeight = sortedHeights[sortedHeights.length - 1];
  if (sortedHeights.length >= 5) {
    representativeHeight = sortedHeights[Math.floor((sortedHeights.length - 1) * 0.85)];
  } else if (sortedHeights.length >= 2) {
    const previousHeight = sortedHeights[sortedHeights.length - 2];
    if (representativeHeight > previousHeight * 1.5) {
      representativeHeight = previousHeight;
    }
  }

  return Math.max(
    Math.min(SLIDES_REFERENCE_HEIGHT_FLOOR, viewportCeiling),
    Math.min(viewportCeiling, representativeHeight)
  );
}

export function SlidesActivity({
  block,
  displayTitle,
  displaySummary,
  items,
  activeIndex,
  normalizeHtml,
  stripHtml,
  imageSizeToPercent,
  getItemImageUrl,
  renderItemImage,
  renderItemField,
  onActiveIndexChange,
  onImageOpen,
  onItemAdd
}: SlidesActivityProps) {
  const { t } = useI18n();
  const measurementRef = useRef<HTMLDivElement | null>(null);
  const slideRef = useRef<HTMLElement | null>(null);
  const [referenceHeight, setReferenceHeight] = useState<number | null>(null);
  const safeActiveIndex = items.length ? Math.max(0, Math.min(items.length - 1, activeIndex)) : -1;
  const activeItem = safeActiveIndex >= 0 ? items[safeActiveIndex] : null;
  const hasLegacyNavigationDefaults = hasLegacySlidesNavigationDefaults(block);
  const navigationStyle = {
    "--slides-navigation-accent": hasLegacyNavigationDefaults
      ? SLIDES_NAVIGATION_DEFAULTS.accentColor
      : block.panelBorderColor ?? SLIDES_NAVIGATION_DEFAULTS.accentColor,
    "--slides-navigation-background": hasLegacyNavigationDefaults
      ? SLIDES_NAVIGATION_DEFAULTS.backgroundColor
      : block.panelBackgroundColor ?? SLIDES_NAVIGATION_DEFAULTS.backgroundColor,
    "--slides-navigation-text": hasLegacyNavigationDefaults
      ? SLIDES_NAVIGATION_DEFAULTS.textColor
      : block.buttonTextColor ?? SLIDES_NAVIGATION_DEFAULTS.textColor,
    "--slides-navigation-border-width": hasLegacyNavigationDefaults
      ? SLIDES_NAVIGATION_DEFAULTS.borderWidth
      : block.panelBorderWidth ?? SLIDES_NAVIGATION_DEFAULTS.borderWidth,
    "--slides-navigation-radius": (hasLegacyNavigationDefaults
      ? SLIDES_NAVIGATION_DEFAULTS.rounded
      : block.panelRounded ?? SLIDES_NAVIGATION_DEFAULTS.rounded) ? "18px" : "0px",
    "--slides-navigation-shadow": (block.panelShadow ?? SLIDES_NAVIGATION_DEFAULTS.shadow)
      ? "0 6px 18px rgba(18, 58, 122, 0.12)"
      : "none"
  } as CSSProperties;
  const activityAppearanceStyle = {
    "--slides-activity-background": block.slidesActivityBackgroundColor ?? "#ffffff",
    "--slides-activity-border-color": block.slidesActivityBorderColor ?? "#123a7a",
    "--slides-activity-border-width": block.slidesActivityBorderWidth ?? "2px",
    "--slides-activity-border-style": block.slidesActivityBorderStyle ?? "solid",
    "--slides-activity-radius": (block.slidesActivityRounded ?? true) ? "22px" : "0px",
    "--slides-activity-shadow": (block.slidesActivityShadow ?? true)
      ? "0 12px 30px rgba(18, 58, 122, 0.14)"
      : "none"
  } as CSSProperties;

  const changeSlide = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= items.length || nextIndex === safeActiveIndex) {
        return;
      }
      onActiveIndexChange(nextIndex);
    },
    [items.length, onActiveIndexChange, safeActiveIndex]
  );

  useEffect(() => {
    window.requestAnimationFrame(() => slideRef.current?.focus({ preventScroll: true }));
  }, [safeActiveIndex]);

  useEffect(() => {
    const measurementRoot = measurementRef.current;
    if (!measurementRoot) {
      setReferenceHeight(null);
      return;
    }

    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const heights = Array.from(
          measurementRoot.querySelectorAll<HTMLElement>("[data-slides-measure-body]")
        ).map((node) => node.scrollHeight);
        const nextHeight = slidesReferenceHeight(heights, window.innerHeight);
        setReferenceHeight((currentHeight) =>
          currentHeight === nextHeight ? currentHeight : nextHeight
        );
      });
    };

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(measure);
    resizeObserver?.observe(measurementRoot);
    measurementRoot
      .querySelectorAll<HTMLElement>("[data-slides-measure-body]")
      .forEach((node) => resizeObserver?.observe(node));
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(measure);
    measure();

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [block.imageSize, block.mediaLayout, items]);

  const handleKeyboardNavigation = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(INTERACTIVE_TARGET_SELECTOR)) {
      return;
    }
    if (event.key === "ArrowLeft" && safeActiveIndex > 0) {
      event.preventDefault();
      changeSlide(safeActiveIndex - 1);
    } else if (event.key === "ArrowRight" && safeActiveIndex < items.length - 1) {
      event.preventDefault();
      changeSlide(safeActiveIndex + 1);
    }
  };

  const renderContent = (item: ActivityItem, itemIndex: number, measurement = false) => {
    const imageUrl = getItemImageUrl(item);
    const layout = item.mediaLayout ?? block.mediaLayout ?? "image-left";
    const imageSize = imageSizeToPercent(
      item.imageSize ?? block.imageSize ?? defaultSlidesImageSize(layout)
    );
    const rounded = item.imageRounded ?? block.imageRounded ?? false;
    const contentHtml = isDefaultSlidesContentHtml(item.contentHtml, item.kind)
      ? "<p></p>"
      : item.contentHtml || "<p></p>";
    const hasImage = Boolean(imageUrl);
    const fallbackTitle = t(
      "slides.slideNumber",
      { number: itemIndex + 1 },
      "Diapo {number}"
    );
    const titleHtml = item.title?.trim() || fallbackTitle;
    const titleText = stripHtml(titleHtml) || titleHtml;
    const titleId = `presentation-slide-title-${block.id}-${itemIndex}${measurement ? "-measure" : ""}`;

    return (
      <article
        aria-hidden={measurement || undefined}
        aria-labelledby={measurement ? undefined : titleId}
        className={`${styles.slide} ${styles[layout] ?? ""}`}
        key={item.id}
        ref={(node) => {
          if (!measurement) {
            slideRef.current = node;
          }
        }}
        tabIndex={measurement ? undefined : -1}
      >
        <div
          className={`${styles.slideBody} ${styles[layout] ?? ""} ${
            hasImage ? styles.hasImage : styles.noImage
          }`}
          data-slides-measure-body={measurement ? "" : undefined}
          style={{ "--image-size": `${imageSize}%` } as CSSProperties}
        >
          <div className={`${styles.titleShell} ${hasImage ? styles.withImage : styles.noImage}`}>
            {renderItemField && !measurement ? (
              <div id={titleId}>
                {renderItemField(block, item, "title", titleHtml, styles.title, "full")}
              </div>
            ) : (
              <h4
                className={styles.title}
                dangerouslySetInnerHTML={{ __html: normalizeHtml(titleHtml) }}
                id={titleId}
              />
            )}
          </div>
          {imageUrl
            ? renderItemImage(item, {
                alt: titleText,
                className: `${styles.image} zoomable-media`,
                rounded,
                onClick: measurement
                  ? () => undefined
                  : () => onImageOpen?.(imageUrl, titleText, rounded)
              })
            : null}
          <div className={styles.copy}>
            {renderItemField && !measurement ? (
              renderItemField(
                block,
                item,
                "contentHtml",
                contentHtml,
                `rich-content ${styles.content}`,
                "full"
              )
            ) : (
              <div
                className={`rich-content ${styles.content}`}
                dangerouslySetInnerHTML={{ __html: normalizeHtml(contentHtml) }}
              />
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className={styles.activity} onKeyDown={handleKeyboardNavigation}>
      {displayTitle ? <h3 className="export-block-title">{displayTitle}</h3> : null}
      {displaySummary ? <p className="export-block-copy">{displaySummary}</p> : null}
      {activeItem ? (
        <>
          <div className={styles.activitySurface} style={activityAppearanceStyle}>
          <div
            className={styles.slideShell}
            style={
              referenceHeight == null
                ? undefined
                : ({ "--slides-reference-height": `${referenceHeight}px` } as CSSProperties)
            }
          >
            {renderContent(activeItem, safeActiveIndex)}
            <div aria-hidden="true" className={styles.measurementLayer} ref={measurementRef}>
              {items.map((item, itemIndex) => renderContent(item, itemIndex, true))}
            </div>
          </div>
          <nav
            aria-label={t("activity.slides", undefined, "Présentation")}
            className={styles.navigation}
            style={navigationStyle}
          >
            <button
              aria-label={t("scorm.previousSlideAria", undefined, "Diapositive précédente")}
              className={styles.navigationButton}
              disabled={safeActiveIndex <= 0}
              onClick={() => changeSlide(safeActiveIndex - 1)}
              type="button"
            >
              <span aria-hidden="true" className={styles.chevron}>‹</span>
              <span className={styles.navigationLabel}>{t("scorm.previousSlideAria", undefined, "Précédent")}</span>
            </button>
            <span className={styles.counter} role="status">
              {safeActiveIndex + 1} / {items.length}
            </span>
            {safeActiveIndex >= items.length - 1 ? (
              <button
                aria-label={t("common.restart")}
                className={`${styles.navigationButton} ${styles.nextButton} ${styles.restartButton}`}
                onClick={() => changeSlide(0)}
                title={t("common.restart")}
                type="button"
              >
                <svg
                  aria-hidden="true"
                  className={styles.restartIcon}
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M8.5 8.1H3.8V3.4"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.4"
                  />
                  <path
                    d="M4.2 8.1C6.1 5.6 9 4.1 12.2 4.2c4.7.2 8.3 4 8.1 8.7-.2 4.6-4 8.2-8.7 8-2.4-.1-4.6-1.2-6.1-3"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.4"
                  />
                </svg>
              </button>
            ) : (
              <button
                aria-label={t("scorm.nextSlideAria", undefined, "Diapositive suivante")}
                className={`${styles.navigationButton} ${styles.nextButton}`}
                onClick={() => changeSlide(safeActiveIndex + 1)}
                type="button"
              >
                <span className={styles.navigationLabel}>{t("scorm.nextSlideAria", undefined, "Suivant")}</span>
                <span aria-hidden="true" className={styles.chevron}>›</span>
              </button>
            )}
          </nav>
          </div>
          {onItemAdd ? (
            <div className={styles.actions}>
              <button className="ghost-pill" onClick={() => onItemAdd(block)} type="button">
                {t("slides.addSlide", undefined, "Ajouter une diapo")}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="export-block-copy">
          {t("slides.empty", undefined, "Ajoutez des diapos dans l’éditeur.")}
        </p>
      )}
    </div>
  );
}
