import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/react";
import type { ImageAccessibility } from "../../types/project";

export function ImageAltDialog({
  initialValue,
  onApply,
  onClose
}: {
  initialValue?: ImageAccessibility | null;
  onApply: (value: ImageAccessibility) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [altText, setAltText] = useState(initialValue?.altText ?? "");
  const [decorative, setDecorative] = useState(Boolean(initialValue?.decorative));
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="paideia-modal-backdrop" role="presentation">
      <form
        aria-labelledby="image-alt-dialog-title"
        aria-modal="true"
        className="paideia-modal image-alt-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onApply({ altText: decorative ? "" : altText.trim(), decorative });
        }}
        role="dialog"
      >
        <p className="modal-kicker">{t("imageAlt.kicker")}</p>
        <h2 id="image-alt-dialog-title">{t("imageAlt.title")}</h2>
        <label className="modal-field">
          {t("imageAlt.descriptionLabel")}
          <textarea
            disabled={decorative}
            onChange={(event) => setAltText(event.target.value)}
            placeholder={t("imageAlt.placeholder")}
            ref={inputRef}
            rows={4}
            value={altText}
          />
        </label>
        <label className="modal-check-row">
          <input checked={decorative} onChange={(event) => setDecorative(event.target.checked)} type="checkbox" />
          {t("imageAlt.decorative")}
        </label>
        <div className="modal-actions">
          <button className="ghost-pill" onClick={onClose} type="button">{t("common.cancel")}</button>
          <button className="primary-pill" type="submit">{t("common.save")}</button>
        </div>
      </form>
    </div>
  );
}
