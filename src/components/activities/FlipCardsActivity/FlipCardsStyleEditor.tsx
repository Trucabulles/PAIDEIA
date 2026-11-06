import { AuthoringFieldGrid } from "../../authoring";
import { ColorPickerField } from "../../color-picker/ColorPickerPopover";
import { useI18n } from "../../../i18n/react";
import styles from "./FlipCardsActivity.module.css";
import type { FlipCardsStyleEditorProps } from "./types";

export function FlipCardsStyleEditor({
  frontBackgroundColor,
  backBackgroundColor,
  frontBorderColor,
  backBorderColor,
  borderStyle,
  borderWidth,
  onFrontBackgroundColorChange,
  onBackBackgroundColorChange,
  onFrontBorderColorChange,
  onBackBorderColorChange,
  onBorderStyleChange,
  onBorderWidthChange
}: FlipCardsStyleEditorProps) {
  const { t } = useI18n();

  return (
    <div className={`inspector-span-2 activity-style-panel ${styles.editor}`}>
      <span className="editor-label">{t("flipCards.cards", undefined, "Cartes")}</span>
      <AuthoringFieldGrid className="flip-card-style-grid">
        <label>
          <span>{t("sectionMarker.width", undefined, "Épaisseur")}</span>
          <select onChange={(event) => onBorderWidthChange(event.target.value)} value={borderWidth}>
            <option value="1px">{t("lineWidth.thin", undefined, "Fine")}</option>
            <option value="2px">{t("lineWidth.normal", undefined, "Normale")}</option>
            <option value="4px">{t("lineWidth.thick", undefined, "Épaisse")}</option>
          </select>
        </label>
        <label>
          <span>{t("sectionMarker.lineStyle", undefined, "Type de trait")}</span>
          <select onChange={(event) => onBorderStyleChange(event.target.value)} value={borderStyle}>
            <option value="solid">{t("lineStyle.solid", undefined, "Plein")}</option>
            <option value="dashed">{t("lineStyle.dashed", undefined, "Tirets")}</option>
            <option value="dotted">{t("lineStyle.dotted", undefined, "Pointillés")}</option>
          </select>
        </label>
      </AuthoringFieldGrid>
      <div className={styles.colorRows}>
        <div className={styles.colorRow}>
          <span className={styles.faceLabel}>{t("flipCards.frontFace", undefined, "Face avant")}</span>
          <div className={styles.colorField}>
            <span>{t("editor.background", undefined, "Fond")}</span>
            <ColorPickerField allowTransparent ariaLabel={`${t("flipCards.frontFace")} — ${t("editor.background")}`} onChange={onFrontBackgroundColorChange} value={frontBackgroundColor} />
          </div>
          <div className={styles.colorField}>
            <span>{t("editor.border", undefined, "Trait")}</span>
            <ColorPickerField ariaLabel={`${t("flipCards.frontFace")} — ${t("editor.border")}`} onChange={onFrontBorderColorChange} value={frontBorderColor} />
          </div>
        </div>
        <div className={styles.colorRow}>
          <span className={styles.faceLabel}>{t("flipCards.backFace", undefined, "Face arrière")}</span>
          <div className={styles.colorField}>
            <span>{t("editor.background", undefined, "Fond")}</span>
            <ColorPickerField allowTransparent ariaLabel={`${t("flipCards.backFace")} — ${t("editor.background")}`} onChange={onBackBackgroundColorChange} value={backBackgroundColor} />
          </div>
          <div className={styles.colorField}>
            <span>{t("editor.border", undefined, "Trait")}</span>
            <ColorPickerField ariaLabel={`${t("flipCards.backFace")} — ${t("editor.border")}`} onChange={onBackBorderColorChange} value={backBorderColor} />
          </div>
        </div>
      </div>
    </div>
  );
}
