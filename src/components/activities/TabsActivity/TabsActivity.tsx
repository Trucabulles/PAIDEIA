import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../../i18n/react";
import styles from "./TabsActivity.module.css";
import { tabsCompositionHtml } from "./composition";
import type { TabsActivityProps, TabsCssVars } from "./types";
import type { ActivityItem, ImageCrop } from "../../../types/project";
import { imageAltAttributes } from "../../../lib/imageAccessibility";
import { EditableNavigationTitle } from "../EditableNavigationTitle";

const MAX_VISIBLE_TABS = 4;

function hasText(value: string | null | undefined) {
  return Boolean(
    value
      ?.replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .trim()
  );
}

function hasMeaningfulHtml(value: string | null | undefined) {
  return hasText(value) || /<(?:img|table)\b/i.test(value ?? "");
}

function cropImageStyle(crop: ImageCrop | null | undefined) {
  if (!crop) {
    return undefined;
  }

  const width = Math.max(1, crop.width);
  const height = Math.max(1, crop.height);
  return {
    width: `${10000 / width}%`,
    height: `${10000 / height}%`,
    left: `${(-crop.x * 100) / width}%`,
    top: `${(-crop.y * 100) / height}%`
  };
}

function cropFrameClass(crop: ImageCrop | null | undefined, rounded: boolean) {
  return [
    styles.imageFrame,
    crop ? styles.cropped : "",
    crop?.shape === "ellipse" ? styles.ellipse : "",
    rounded ? styles.roundedImage : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function tabLabelHtml(item: ActivityItem, fallback: string, authoringMode: boolean) {
  return item.title?.trim() || (authoringMode ? `<span data-mock-tab-label="true">${fallback}</span>` : "");
}

function contentTitleHtml(item: ActivityItem) {
  return item.contentTitle?.trim() || "";
}

function tabsImageSize(value: string | null | undefined) {
  switch (value?.trim().toLowerCase()) {
    case "small": return "35%";
    case "large": return "65%";
    default: return "50%";
  }
}

function tabsImageLayout(value: string | null | undefined) {
  return ["image-left", "image-right", "image-center", "image-below"].includes(value ?? "")
    ? value!
    : "image-left";
}

export function TabsActivity({ authoringMode = false, block, contentTextColor, displaySummary, displayTitle, getItemImageUrl, items, onImageOpen, renderItemField, onBeforeTabChange }: TabsActivityProps) {
  const { t } = useI18n();
  const normalizedItems = useMemo(
    () => authoringMode ? items : items.filter((item) => item.title || item.contentTitle || item.contentHtml || (item.assetRefs?.length ?? 0) > 0),
    [authoringMode, items]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [tabWindowStart, setTabWindowStart] = useState(0);
  const shouldFocusActiveTab = useRef(false);
  const tabBarRef = useRef<HTMLDivElement | null>(null);
  const tabLabelMeasureRef = useRef<HTMLDivElement | null>(null);
  const resolvedActiveIndex = Math.min(activeIndex, Math.max(0, normalizedItems.length - 1));
  const hasManyTabs = normalizedItems.length > MAX_VISIBLE_TABS;
  const maxWindowStart = Math.max(0, normalizedItems.length - MAX_VISIBLE_TABS);
  const resolvedWindowStart = Math.min(tabWindowStart, maxWindowStart);
  const visibleItems = normalizedItems.slice(resolvedWindowStart, resolvedWindowStart + MAX_VISIBLE_TABS);
  const style = {
    "--tabs-accent": block.panelBorderColor ?? "#1d5fbf",
    "--tabs-background": block.panelBackgroundColor?.trim() || "#ffffff",
    ...(contentTextColor ? { "--tabs-content-text": contentTextColor } : {}),
    "--tabs-radius": block.panelRounded ? "24px" : "0px"
  } as TabsCssVars;

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, normalizedItems.length - 1)));
  }, [normalizedItems.length]);

  useEffect(() => {
    setTabWindowStart((current) => {
      const boundedCurrent = Math.min(current, maxWindowStart);
      if (resolvedActiveIndex < boundedCurrent) {
        return resolvedActiveIndex;
      }
      if (resolvedActiveIndex >= boundedCurrent + MAX_VISIBLE_TABS) {
        return Math.min(maxWindowStart, resolvedActiveIndex - MAX_VISIBLE_TABS + 1);
      }
      return boundedCurrent;
    });
  }, [maxWindowStart, resolvedActiveIndex]);

  useEffect(() => {
    if (!shouldFocusActiveTab.current) {
      return;
    }
    shouldFocusActiveTab.current = false;
    document.getElementById(`tabs-tab-${block.id}-${resolvedActiveIndex}`)?.focus();
  }, [block.id, resolvedActiveIndex, resolvedWindowStart]);

  useLayoutEffect(() => {
    const tabBar = tabBarRef.current;
    const measure = tabLabelMeasureRef.current;
    if (!tabBar || !measure) {
      return;
    }

    const updateLabelHeight = () => {
      const labels = Array.from(measure.querySelectorAll<HTMLElement>("[data-tabs-label-measure]"));
      const tallest = labels.reduce((height, label) => Math.max(height, label.getBoundingClientRect().height), 0);
      if (tallest > 0) {
        tabBar.style.setProperty("--tabs-label-height", `${Math.ceil(tallest)}px`);
      } else {
        tabBar.style.removeProperty("--tabs-label-height");
      }
    };

    updateLabelHeight();
    const observer = new ResizeObserver(updateLabelHeight);
    observer.observe(tabBar);
    return () => observer.disconnect();
  }, [authoringMode, normalizedItems]);

  const activateTab = (nextIndex: number, focusTab = false) => {
    const boundedIndex = Math.max(0, Math.min(normalizedItems.length - 1, nextIndex));
    if (boundedIndex !== resolvedActiveIndex) {
      onBeforeTabChange?.();
    }
    shouldFocusActiveTab.current = focusTab;
    setActiveIndex(boundedIndex);
    setTabWindowStart((current) => {
      if (boundedIndex < current) {
        return boundedIndex;
      }
      if (boundedIndex >= current + MAX_VISIBLE_TABS) {
        return Math.min(maxWindowStart, boundedIndex - MAX_VISIBLE_TABS + 1);
      }
      return Math.min(current, maxWindowStart);
    });
  };

  if (!normalizedItems.length) {
    return (
      <div className={styles.activity} style={style}>
        {displayTitle ? <h3 className="export-block-title">{displayTitle}</h3> : null}
        {displaySummary ? <p className="export-block-copy">{displaySummary}</p> : null}
        {authoringMode ? <p className="export-block-copy">{t("tabs.empty", undefined, "Ajoutez des onglets dans l'éditeur.")}</p> : null}
      </div>
    );
  }

  return (
    <div className={`${styles.activity} ${block.panelShadow ? styles.shadow : ""}`} style={style}>
      {displayTitle ? <h3 className="export-block-title">{displayTitle}</h3> : null}
      {displaySummary ? <p className="export-block-copy">{displaySummary}</p> : null}
      <div className={`${styles.shell} ${renderItemField ? styles.inlineShell : ""}`}>
        <div className={styles.tabBarWrap}>
          {hasManyTabs ? (
            <button
              aria-label={t("tabs.previousTab", undefined, "Onglet précédent")}
              className={styles.navButton}
              disabled={resolvedActiveIndex === 0}
              onClick={() => activateTab(resolvedActiveIndex - 1)}
              type="button"
            >
              ‹
            </button>
          ) : null}
          <div className={styles.tabBar} ref={tabBarRef} role="tablist">
            <div
              aria-hidden="true"
              className={styles.tabLabelMeasure}
              ref={tabLabelMeasureRef}
              style={{ "--tabs-visible-count": Math.min(MAX_VISIBLE_TABS, normalizedItems.length) } as TabsCssVars}
            >
              {normalizedItems.map((item, index) => (
                <span
                  dangerouslySetInnerHTML={{ __html: tabLabelHtml(item, t("tabs.defaultLabel", { count: index + 1 }), authoringMode) }}
                  data-tabs-label-measure
                  key={`measure-${item.id}`}
                />
              ))}
            </div>
            {visibleItems.map((item, visibleIndex) => {
              const index = resolvedWindowStart + visibleIndex;
              return (
              <EditableNavigationTitle
                aria-controls={`tabs-panel-${block.id}-${index}`}
                renderEditor={renderItemField ? (onFinish) => renderItemField({
                  item, field: "title", html: item.title || "", label: "", placeholder: t("tabs.defaultLabel", { count: index + 1 }), onFinish
                }) : undefined}
                aria-selected={index === resolvedActiveIndex}
                className={`${styles.tab} ${index === resolvedActiveIndex ? styles.activeTab : ""}`}
                id={`tabs-tab-${block.id}-${index}`}
                key={item.id}
                onClick={() => activateTab(index)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    activateTab(resolvedActiveIndex - 1, true);
                  } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    activateTab(resolvedActiveIndex + 1, true);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    activateTab(0, true);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    activateTab(normalizedItems.length - 1, true);
                  }
                }}
                role="tab"
                tabIndex={index === resolvedActiveIndex ? 0 : -1}
                title={item.title.replace(/<[^>]*>/g, " ").trim()}
                type="button"
              >
                <span dangerouslySetInnerHTML={{ __html: tabLabelHtml(item, t("tabs.defaultLabel", { count: index + 1 }), authoringMode) }} />
              </EditableNavigationTitle>
              );
            })}
          </div>
          {hasManyTabs ? (
            <button
              aria-label={t("tabs.nextTab", undefined, "Onglet suivant")}
              className={styles.navButton}
              disabled={resolvedActiveIndex >= normalizedItems.length - 1}
              onClick={() => activateTab(resolvedActiveIndex + 1)}
              type="button"
            >
              ›
            </button>
          ) : null}
        </div>
        <div className={styles.panels}>
          {normalizedItems.map((item, index) => {
            const image = getItemImageUrl(item);
            const isActive = index === resolvedActiveIndex;
            const imageLayout = tabsImageLayout(item.mediaLayout);
            return (
              <div
                aria-hidden={!isActive}
                aria-labelledby={`tabs-tab-${block.id}-${index}`}
                className={`${styles.panel} ${image ? `${styles.withImage} ${styles[imageLayout]}` : styles.withoutImage} ${isActive ? styles.activePanel : styles.inactivePanel}`}
                id={`tabs-panel-${block.id}-${index}`}
                key={item.id}
                ref={(node) => node?.toggleAttribute("inert", !isActive)}
                role="tabpanel"
                style={{ "--tabs-image-size": tabsImageSize(item.imageSize) } as TabsCssVars}
              >
                <div className={styles.copy}>
                  {!renderItemField && hasText(contentTitleHtml(item)) ? (
                    <h3 dangerouslySetInnerHTML={{ __html: contentTitleHtml(item) }} />
                  ) : null}
                  {renderItemField ? renderItemField({
                    item,
                    field: "contentHtml",
                    html: tabsCompositionHtml(item),
                    label: t("editor.content"),
                    placeholder: t("editor.enterText"),
                    className: "rich-content"
                  }) : hasMeaningfulHtml(item.contentHtml) ? (
                    <div className="rich-content" dangerouslySetInnerHTML={{ __html: item.contentHtml }} />
                  ) : null}
                </div>
                {image ? (
                  <span className={cropFrameClass(item.imageCrop, block.imageRounded ?? false)}>
                    <img
                      {...imageAltAttributes(item.imageAccessibility)}
                      className="zoomable-media"
                      onClick={() => onImageOpen?.(
                        image,
                        item.title.replace(/<[^>]*>/g, " ").trim() || "Illustration"
                      )}
                      src={image}
                      style={cropImageStyle(item.imageCrop)}
                    />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
