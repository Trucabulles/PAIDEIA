import styles from "./FlipCardsActivity.module.css";
import type { FlipCardCssVars, FlipCardsActivityProps } from "./types";
import { FLIP_CARDS_BLOCK_DEFAULTS } from "./defaults";
import { useI18n } from "../../../i18n/react";
import { DEFAULT_DARK_TEXT_COLOR, resolveContextualTextColor } from "../../../app/textContrast";

export function FlipCardsActivity({
  block,
  displaySummary,
  displayTitle,
  flippedIds,
  getItemImageUrl,
  items,
  onFlippedIdsChange,
  renderFaceImage
}: FlipCardsActivityProps) {
  const { t } = useI18n();
  return (
    <div className={`flip-cards-block ${styles.activity}`}>
      {displayTitle ? <h3 className="export-block-title">{displayTitle}</h3> : null}
      {displaySummary ? <p className="export-block-copy">{displaySummary}</p> : null}
      {items.length ? (
        <div className="flip-card-grid">
          {items.map((item) => {
            const isFlipped = flippedIds.includes(item.id);
            const frontImage = getItemImageUrl(item, "front");
            const backImage = getItemImageUrl(item, "back");
            const frontType = item.frontType ?? "text";
            const backType = item.backType ?? "text";
            const frontText = item.frontText?.trim() || item.title || t("flipCards.card", undefined, "Carte");
            const frontBackgroundColor = block.flipCardFrontBackgroundColor ?? FLIP_CARDS_BLOCK_DEFAULTS.frontBackgroundColor;
            const backBackgroundColor = block.flipCardBackBackgroundColor ?? FLIP_CARDS_BLOCK_DEFAULTS.backBackgroundColor;
            const flipCardStyle = {
              "--flip-card-front-bg": frontBackgroundColor,
              "--flip-card-back-bg": backBackgroundColor,
              "--flip-card-front-border-color": block.flipCardFrontBorderColor ?? FLIP_CARDS_BLOCK_DEFAULTS.frontBorderColor,
              "--flip-card-back-border-color": block.flipCardBackBorderColor ?? FLIP_CARDS_BLOCK_DEFAULTS.backBorderColor,
              "--flip-card-border-width": block.panelBorderWidth ?? FLIP_CARDS_BLOCK_DEFAULTS.panelBorderWidth,
              "--flip-card-border-style": block.panelBorderStyle ?? FLIP_CARDS_BLOCK_DEFAULTS.panelBorderStyle,
              "--flip-card-text-color": resolveContextualTextColor(DEFAULT_DARK_TEXT_COLOR, frontBackgroundColor),
              "--flip-card-back-text-color": resolveContextualTextColor(DEFAULT_DARK_TEXT_COLOR, backBackgroundColor)
            } as FlipCardCssVars;
            return (
              <button
                aria-pressed={isFlipped}
                className={`flip-card ${frontType === "image" && frontImage ? "has-front-image" : ""} ${backType === "image" && backImage ? "has-back-image" : ""} ${
                  isFlipped ? "flipped" : ""
                }`}
                data-card-id={item.id}
                key={item.id}
                onClick={() =>
                  onFlippedIdsChange((current) => {
                    const next = current.includes(item.id)
                      ? current.filter((id) => id !== item.id)
                      : [...current, item.id];
                    requestAnimationFrame(() => {
                      document
                        .querySelectorAll<HTMLElement>(`.flip-card[data-card-id="${item.id}"] .flip-card-back-scroll`)
                        .forEach((face) => {
                          face.scrollTop = 0;
                        });
                    });
                    return next;
                  })
                }
                style={flipCardStyle}
                type="button"
              >
                <span className="flip-card-inner">
                  <span className="flip-card-face flip-card-front">
                    {frontType === "image" && frontImage ? (
                      renderFaceImage(item, "front", frontText)
                    ) : (
                      <span className="rich-content" dangerouslySetInnerHTML={{ __html: frontText }} />
                    )}
                  </span>
                  <span className="flip-card-face flip-card-back">
                    {backType === "image" && backImage ? renderFaceImage(item, "back", frontText) : (
                      <span className="flip-card-back-scroll">
                        <span className="rich-content" dangerouslySetInnerHTML={{ __html: item.contentHtml || "<p></p>" }} />
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="export-block-copy">{t("flipCards.empty", undefined, "Ajoutez des cartes dans l’éditeur.")}</p>
      )}
    </div>
  );
}
