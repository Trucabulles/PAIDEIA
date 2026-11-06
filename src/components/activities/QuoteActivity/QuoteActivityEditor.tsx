import { AuthoringCheckbox, AuthoringFieldGrid } from "../../authoring";
import { ColorPickerField } from "../../color-picker/ColorPickerPopover";
import { useI18n } from "../../../i18n/react";
import type { QuoteActivityEditorProps } from "./types";

export function QuoteActivityEditor({
  accentColor,
  authorField,
  backgroundColor,
  borderColor,
  borderStyle,
  borderWidth,
  shadow,
  showAuthor,
  onAccentColorChange,
  onBackgroundColorChange,
  onBorderColorChange,
  onBorderStyleChange,
  onBorderWidthChange,
  onRoundedChange,
  onShadowChange,
  onShowAuthorChange,
  rounded
}: QuoteActivityEditorProps) {
  const { t } = useI18n();

  return (
    <div className="activity-style-panel">
      <span className="editor-label">{t("activity.quote")}</span>
      <AuthoringFieldGrid>
        <AuthoringCheckbox checked={showAuthor} compact onChange={(event) => onShowAuthorChange(event.target.checked)}>
          {t("quote.showSignature", undefined, "Afficher la signature")}
        </AuthoringCheckbox>
        <div className="inspector-span-2">{authorField}</div>
      </AuthoringFieldGrid>

      <section className="appearance-section" aria-label={t("quote.appearanceAria", undefined, "Apparence de l'activité citation")}>
        <span className="appearance-title">{t("editor.activityAppearance", undefined, "Apparence activité")}</span>
        <AuthoringFieldGrid className="appearance-grid">
          <label>
            <span>{t("editor.background", undefined, "Fond")}</span>
            <ColorPickerField
              allowTransparent
              ariaLabel={t("quote.backgroundColor", undefined, "Couleur de fond de la citation")}
              onChange={onBackgroundColorChange}
              value={backgroundColor}
            />
          </label>
          <label>
            <span>{t("editor.border", undefined, "Trait")}</span>
            <ColorPickerField ariaLabel={t("quote.borderColor", undefined, "Couleur du trait")} onChange={onBorderColorChange} value={borderColor} />
          </label>
          <label>
            <span>{t("editor.accent", undefined, "Accent")}</span>
            <ColorPickerField ariaLabel={t("quote.accentColor", undefined, "Couleur des guillemets")} onChange={onAccentColorChange} value={accentColor} />
          </label>
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
          <AuthoringCheckbox checked={rounded} compact onChange={(event) => onRoundedChange(event.target.checked)}>
            {t("editor.roundedCorners", undefined, "Coins arrondis")}
          </AuthoringCheckbox>
          <AuthoringCheckbox checked={shadow} compact onChange={(event) => onShadowChange(event.target.checked)}>
            {t("editor.shadow", undefined, "Ombre")}
          </AuthoringCheckbox>
        </AuthoringFieldGrid>
      </section>
    </div>
  );
}
