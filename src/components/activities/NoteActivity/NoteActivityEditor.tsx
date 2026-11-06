import { AuthoringCheckbox, AuthoringFieldGrid } from "../../authoring";
import { ColorPickerField } from "../../color-picker/ColorPickerPopover";
import { useI18n } from "../../../i18n/react";
import type { NoteActivityEditorProps } from "./types";
import { NOTE_ICON_IDS, NoteIconSvg, type NoteIconId } from "./noteIcons";
import styles from "./NoteActivity.module.css";

export function NoteActivityEditor({
  backgroundColor,
  borderColor,
  borderStyle,
  borderWidth,
  icon,
  iconColor,
  iconMatchesBorder,
  onBackgroundColorChange,
  onBorderColorChange,
  onBorderStyleChange,
  onBorderWidthChange,
  onIconChange,
  onIconColorChange,
  onIconMatchesBorderChange,
  onRoundedChange,
  onShadowChange,
  onShowIconChange,
  rounded,
  shadow,
  showIcon,
  showIconSettings = true
}: NoteActivityEditorProps) {
  const { t } = useI18n();
  const iconLabels: Record<NoteIconId, string> = {
    "info-circle": t("note.icon.infoCircle", undefined, "Information"),
    "no-entry": t("note.icon.noEntry", undefined, "Sens interdit"),
    "exclamation-circle": t("note.icon.exclamationCircle", undefined, "Attention ronde"),
    prohibition: t("note.icon.prohibition", undefined, "Interdiction"),
    "warning-triangle": t("note.icon.warningTriangle", undefined, "Avertissement"),
    "check-circle": t("note.icon.checkCircle", undefined, "Validation ronde"),
    check: t("note.icon.check", undefined, "Validation")
  };

  return (
    <div className="activity-style-panel">
      <span className="editor-label">{t("note.box", undefined, "Cartouche")}</span>
      {showIconSettings ? <div className={styles.iconSettings}>
        <AuthoringCheckbox checked={showIcon} compact onChange={(event) => onShowIconChange(event.target.checked)}>
          {t("note.showIcon", undefined, "Afficher le pictogramme")}
        </AuthoringCheckbox>
        <fieldset className={styles.iconPicker} disabled={!showIcon}>
          <legend>{t("note.iconChoice", undefined, "Pictogramme")}</legend>
          <div className={styles.iconOptions} role="radiogroup">
            {NOTE_ICON_IDS.map((iconId) => (
                <label aria-label={iconLabels[iconId]} className={styles.iconOption} key={iconId} title={iconLabels[iconId]}>
                  <NoteIconSvg className={styles.iconPreview} icon={iconId} />
                  <input checked={icon === iconId} name="note-icon" onChange={() => onIconChange(iconId)} type="radio" value={iconId} />
                </label>
              ))}
          </div>
        </fieldset>
      </div> : null}
      <AuthoringFieldGrid className="appearance-grid note-style-grid">
        <label>
          <span>{t("editor.background", undefined, "Fond")}</span>
          <ColorPickerField
            allowTransparent
            ariaLabel={t("note.backgroundColor", undefined, "Couleur de fond du cartouche")}
            onChange={onBackgroundColorChange}
            value={backgroundColor}
          />
        </label>
        <label>
          <span>{t("note.borderColor", undefined, "Couleur de bordure")}</span>
          <ColorPickerField
            ariaLabel={t("note.borderColor", undefined, "Couleur de bordure")}
            onChange={onBorderColorChange}
            value={borderColor}
          />
        </label>
        {showIconSettings ? <label>
          <span>{t("note.iconColor", undefined, "Couleur du pictogramme")}</span>
          <fieldset className={styles.iconColorField} disabled={!showIcon || iconMatchesBorder}>
            <ColorPickerField
              ariaLabel={t("note.iconColor", undefined, "Couleur du pictogramme")}
              onChange={onIconColorChange}
              value={iconMatchesBorder ? borderColor : iconColor}
            />
          </fieldset>
        </label> : null}
        {showIconSettings ? <AuthoringCheckbox
          checked={iconMatchesBorder}
          compact
          disabled={!showIcon}
          onChange={(event) => onIconMatchesBorderChange(event.target.checked)}
        >
          {t("note.iconMatchesBorder", undefined, "Identique à la bordure")}
        </AuthoringCheckbox> : null}
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
            <option value="none">{t("common.none", undefined, "Aucun")}</option>
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
    </div>
  );
}
