import { AuthoringFieldGrid } from "../../authoring";
import { ColorPickerField } from "../../color-picker/ColorPickerPopover";
import { useI18n } from "../../../i18n/react";
import styles from "./LessonNavigationActivity.module.css";
import { NavigationButtonLabel } from "./NavigationButtonLabel";
import type { LessonNavigationActivityEditorProps } from "./types";

export function LessonNavigationActivityEditor({
  activityType,
  backgroundColor,
  label,
  layout = "button-only",
  onBackgroundColorChange,
  onLabelChange,
  onLayoutChange,
  onTextColorChange,
  previewLabel,
  richTextField,
  showLayout = false,
  textColor
}: LessonNavigationActivityEditorProps) {
  const { t } = useI18n();

  return (
    <div className="activity-style-panel">
      {showLayout && onLayoutChange ? (
        <label>
          <span>{t("navigation.composition", undefined, "Composition")}</span>
          <select onChange={(event) => onLayoutChange(event.target.value as typeof layout)} value={layout}>
            <option value="button-only">{t("navigation.buttonOnly", undefined, "Bouton seul")}</option>
            <option value="text-left-button-right">{t("navigation.textLeftButtonRight", undefined, "Texte à gauche · bouton à droite")}</option>
            <option value="button-left-text-right">{t("navigation.buttonLeftTextRight", undefined, "Bouton à gauche · texte à droite")}</option>
            <option value="text-top-button-bottom">{t("navigation.textTopButtonBottom", undefined, "Texte au-dessus · bouton au-dessous")}</option>
          </select>
        </label>
      ) : null}
      {showLayout && layout !== "button-only" ? richTextField : null}
      <label>
        <span>{t("navigation.buttonText", undefined, "Texte du bouton")}</span>
        <input maxLength={80} onChange={(event) => onLabelChange(event.target.value.slice(0, 80))} value={label} />
      </label>
      <AuthoringFieldGrid>
        <label>
          <span>{t("navigation.buttonColor", undefined, "Couleur du bouton")}</span>
          <ColorPickerField
            allowTransparent
            ariaLabel={t("navigation.buttonColor", undefined, "Couleur du bouton")}
            onChange={onBackgroundColorChange}
            value={backgroundColor}
          />
        </label>
        <label>
          <span>{t("navigation.buttonTextColor", undefined, "Couleur du texte")}</span>
          <ColorPickerField
            ariaLabel={t("navigation.buttonTextColorAria", undefined, "Couleur du texte du bouton")}
            onChange={onTextColorChange}
            value={textColor}
          />
        </label>
      </AuthoringFieldGrid>
      <div className={`button-editor-preview ${styles.editorPreview} ${styles[activityType]}`} data-navigation-activity={activityType}>
        <button
          className={`continue-preview-button ${styles.button}`}
          style={{
            backgroundColor,
            color: textColor
          }}
          title={previewLabel}
          type="button"
        >
          <NavigationButtonLabel label={previewLabel} />
        </button>
      </div>
    </div>
  );
}
