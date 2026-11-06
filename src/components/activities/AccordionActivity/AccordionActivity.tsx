import type { CSSProperties } from "react";
import styles from "./AccordionActivity.module.css";
import type { AccordionActivityProps } from "./types";
import type { ImageCrop } from "../../../types/project";
import { imageAltAttributes } from "../../../lib/imageAccessibility";
import { useI18n } from "../../../i18n/react";
import { EditableNavigationTitle } from "../EditableNavigationTitle";

type AccordionCssVars = CSSProperties & {
  "--accordion-background": string;
  "--accordion-accent": string;
  "--accordion-border-color": string;
  "--accordion-border-style": string;
  "--accordion-border-width": string;
  "--accordion-radius": string;
};

function stripHtml(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function itemTitleHtml(value: string | null | undefined, index: number, fallbackLabel: string) {
  return value?.trim() || `<span data-mock-accordion-title="true">${fallbackLabel} ${index + 1}</span>`;
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

function imageFrameClass(crop: ImageCrop | null | undefined, rounded: boolean | null | undefined) {
  return [
    styles.imageFrame,
    crop ? styles.cropped : "",
    crop?.shape === "ellipse" ? styles.ellipse : "",
    rounded ? styles.roundedImage : ""
  ]
    .filter(Boolean)
    .join(" ");
}

export function AccordionActivity({
  block,
  displaySummary,
  displayTitle,
  getItemImageUrl,
  items,
  onImageOpen,
  renderItemContent,
  renderItemTitle,
  onBeforePanelToggle,
  onOpenIdsChange,
  openIds
}: AccordionActivityProps) {
  const { t } = useI18n();
  const style = {
    "--accordion-background": block.panelBackgroundColor ?? "#edf4ff",
    "--accordion-accent": block.panelBorderColor ?? "#d5dae3",
    "--accordion-border-color": block.panelBorderColor ?? "#d5dae3",
    "--accordion-border-style": block.panelBorderStyle ?? "solid",
    "--accordion-border-width": block.panelBorderWidth ?? "1px",
    "--accordion-radius": block.panelRounded ? "18px" : "0px"
  } as AccordionCssVars;

  return (
    <div className={`accordion-block ${styles.activity} ${block.panelShadow ? styles.shadow : ""}`} style={style}>
      {displayTitle ? <h3 className="export-block-title">{displayTitle}</h3> : null}
      {displaySummary ? <p className="export-block-copy">{displaySummary}</p> : null}
      {items.length ? (
        <div className="accordion-list">
          {items.map((item) => {
            const itemIndex = items.findIndex((candidate) => candidate.id === item.id);
            const fallbackLabel = t("accordion.panel", undefined, "Panneau");
            const itemTitle = stripHtml(item.title) || `${fallbackLabel} ${itemIndex + 1}`;
            const itemTitleMarkup = itemTitleHtml(item.title, itemIndex, fallbackLabel);
            const isOpen = openIds.includes(item.id);
            const itemImage = getItemImageUrl(item);
            return (
              <article className={`accordion-item ${isOpen ? "open" : ""}`} key={item.id}>
                <EditableNavigationTitle
                  renderEditor={renderItemTitle ? (finish) => renderItemTitle(item, finish) : undefined}
                  onBeginEditing={() => {
                    // Undo the first click; the second click is not a navigation click.
                    onOpenIdsChange((current) => current.includes(item.id)
                      ? current.filter((id) => id !== item.id) : [...current, item.id]);
                  }}
                  aria-expanded={isOpen}
                  className="accordion-trigger"
                  onClick={() => {
                    onBeforePanelToggle?.();
                    onOpenIdsChange((current) =>
                      current.includes(item.id)
                        ? current.filter((id) => id !== item.id)
                        : [...current, item.id]
                    );
                  }}
                  type="button"
                >
                  <span aria-hidden="true" className="accordion-icon">{isOpen ? "−" : "+"}</span>
                  <span className="accordion-title" dangerouslySetInnerHTML={{ __html: itemTitleMarkup }} />
                </EditableNavigationTitle>
                {isOpen ? (
                  <div className="accordion-panel">
                    {renderItemContent ? renderItemContent(item) : (
                      <div className="rich-content" dangerouslySetInnerHTML={{ __html: item.contentHtml || "<p></p>" }} />
                    )}
                    {itemImage ? (
                      <span
                        className={imageFrameClass(item.imageCrop, item.imageRounded)}
                        onClick={() => onImageOpen?.(itemImage, itemTitle)}
                        style={item.imageCrop ? { aspectRatio: `${item.imageCrop.width} / ${item.imageCrop.height}` } : undefined}
                      >
                        <img
                          {...imageAltAttributes(item.imageAccessibility)}
                          className="zoomable-media"
                          src={itemImage}
                          style={cropImageStyle(item.imageCrop)}
                        />
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="export-block-copy">{t("accordion.empty", undefined, "Ajoutez des panneaux dans l’éditeur.")}</p>
      )}
    </div>
  );
}
