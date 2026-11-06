import { useEffect, useMemo, useRef, useState } from "react";
import { RICH_INLINE_IMAGE_MAX_SIZE, type RichInlineImageDimensions, type RichInlineImageWrap } from "./richInlineImage";
import { useI18n } from "../../i18n/react";

type RichInlineImageResizeDialogProps = {
  dimensions: RichInlineImageDimensions & { altText: string; decorative: boolean; wrap: RichInlineImageWrap; rounded?: boolean; zoom?: boolean };
  onApply: (width: number, height: number, altText: string, decorative: boolean, wrap: RichInlineImageWrap, rounded: boolean, zoom: boolean) => void;
  onClose: () => void;
  onDelete: () => void;
};

function clamp(value: number, maximum: number) {
  return Math.max(1, Math.min(maximum, Math.round(value)));
}

export function RichInlineImageResizeDialog({
  dimensions,
  onApply,
  onClose,
  onDelete
}: RichInlineImageResizeDialogProps) {
  const { t } = useI18n();
  const ratio = dimensions.ratio > 0 ? dimensions.ratio : dimensions.width / dimensions.height;
  const maximumWidth = Math.max(1, Math.round(ratio >= 1 ? RICH_INLINE_IMAGE_MAX_SIZE : RICH_INLINE_IMAGE_MAX_SIZE * ratio));
  const maximumHeight = Math.max(1, Math.round(ratio <= 1 ? RICH_INLINE_IMAGE_MAX_SIZE : RICH_INLINE_IMAGE_MAX_SIZE / ratio));
  const initialWidth = clamp(dimensions.width, maximumWidth);
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(() => clamp(initialWidth / ratio, maximumHeight));
  const [altText, setAltText] = useState(dimensions.altText);
  const [decorative, setDecorative] = useState(dimensions.decorative);
  const [rounded, setRounded] = useState(dimensions.rounded ?? false);
  const [zoom, setZoom] = useState(dimensions.zoom ?? false);
  const [wrap, setWrap] = useState<RichInlineImageWrap>(dimensions.wrap);
  const widthInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    widthInputRef.current?.focus();
    widthInputRef.current?.select();
  }, []);

  const sizeLabel = useMemo(() => `${width} x ${height} px`, [height, width]);

  return (
    <div
      className="paideia-modal-backdrop rich-text-dialog-backdrop"
      data-rich-inline-image-dialog="true"
      data-rich-text-dialog="true"
      role="presentation"
    >
      <form
        aria-labelledby="rich-inline-image-dialog-title"
        aria-modal="true"
        className="paideia-modal rich-inline-image-dialog"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onApply(width, height, altText, decorative, wrap, rounded, zoom);
        }}
        role="dialog"
      >
        <p className="modal-kicker">{t("richText.inlineImage", undefined, "Image intégrée au texte")}</p>
        <h2 id="rich-inline-image-dialog-title">{t("richText.imageProperties", undefined, "Propriétés de l'image")}</h2>
        <h3>{t("richText.dimensions", undefined, "Dimensions")}</h3>
        <div className="rich-inline-image-size-fields">
          <label className="modal-field">
            {t("richText.widthPx", undefined, "Largeur (px)")}
            <input
              max={maximumWidth}
              min="1"
              onChange={(event) => {
                const nextWidth = clamp(Number(event.target.value) || 1, maximumWidth);
                setWidth(nextWidth);
                setHeight(clamp(nextWidth / ratio, maximumHeight));
              }}
              ref={widthInputRef}
              type="number"
              value={width}
            />
          </label>
          <label className="modal-field">
            {t("richText.heightPx", undefined, "Hauteur (px)")}
            <input
              max={maximumHeight}
              min="1"
              onChange={(event) => {
                const nextHeight = clamp(Number(event.target.value) || 1, maximumHeight);
                setHeight(nextHeight);
                setWidth(clamp(nextHeight * ratio, maximumWidth));
              }}
              type="number"
              value={height}
            />
          </label>
        </div>
        <p className="rich-inline-image-size-summary">{t("richText.ratioKept", { size: sizeLabel }, "Ratio conservé : {size}. Dimension maximale : 300 px.")}</p>
        <h3>{t("richText.imageWrap", undefined, "Habillage du texte")}</h3>
        <div aria-label={t("richText.imageWrap", undefined, "Habillage du texte")} className="rich-inline-image-wrap-options" role="group">
          {(["inline", "left", "right"] as const).map((option) => (
            <button
              aria-pressed={wrap === option}
              className={wrap === option ? "is-selected" : ""}
              key={option}
              onClick={() => setWrap(option)}
              type="button"
            >
              {option === "inline" ? t("richText.imageWrapInline", undefined, "Dans le texte") : option === "left" ? t("richText.imageWrapLeft", undefined, "À gauche") : t("richText.imageWrapRight", undefined, "À droite")}
            </button>
          ))}
        </div>
        <h3>{t("richText.imageDisplay")}</h3>
        <label className="modal-check-row">
          <input checked={rounded} onChange={(event) => setRounded(event.target.checked)} type="checkbox" />
          {t("richText.imageRounded")}
        </label>
        <label className="modal-check-row">
          <input checked={zoom} onChange={(event) => setZoom(event.target.checked)} type="checkbox" />
          {t("richText.imageZoom")}
        </label>
        <h3>{t("richText.accessibility", undefined, "Accessibilité")}</h3>
        <label className="modal-field">
          {t("richText.imageAltDescription", undefined, "Description de l'image (ALT)")}
          <textarea
            disabled={decorative}
            onChange={(event) => setAltText(event.target.value)}
            placeholder={t("imageAlt.placeholder")}
            rows={3}
            value={altText}
          />
        </label>
        <label className="modal-check-row">
          <input checked={decorative} onChange={(event) => setDecorative(event.target.checked)} type="checkbox" />
          {t("imageAlt.decorative")}
        </label>
        <div className="modal-actions">
          <button className="rich-inline-image-remove" onClick={onDelete} type="button">{t("editor.removeImage")}</button>
          <button className="ghost-pill" onClick={onClose} type="button">{t("common.cancel")}</button>
          <button className="primary-pill" type="submit">{t("common.apply", undefined, "Appliquer")}</button>
        </div>
      </form>
    </div>
  );
}
