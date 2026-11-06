import type { CSSProperties } from "react";
import { AuthoringFieldGrid } from "../../authoring";
import { ColorPickerField } from "../../color-picker/ColorPickerPopover";
import { useI18n } from "../../../i18n/react";
import { DividerActivity } from "./DividerActivity";
import type { DividerActivityEditorProps } from "./types";

export function DividerActivityEditor({
  color,
  onColorChange,
  onStyleChange,
  onWidthChange,
  style,
  width
}: DividerActivityEditorProps) {
  const { t } = useI18n();

  return (
    <div className="activity-style-panel">
      <span className="editor-label">{t("activity.divider")}</span>
      <AuthoringFieldGrid>
        <label>
          <span>{t("common.color", undefined, "Couleur")}</span>
          <ColorPickerField
            ariaLabel={t("divider.colorAria", undefined, "Couleur du séparateur")}
            onChange={onColorChange}
            value={color}
          />
        </label>
        <label>
          <span>{t("sectionMarker.width", undefined, "Épaisseur")}</span>
          <select onChange={(event) => onWidthChange(event.target.value)} value={width}>
            <option value="1px">{t("lineWidth.thin", undefined, "Fine")}</option>
            <option value="2px">{t("lineWidth.normal", undefined, "Normale")}</option>
            <option value="4px">{t("lineWidth.thick", undefined, "Épaisse")}</option>
            <option value="6px">{t("lineWidth.veryThick", undefined, "Très épaisse")}</option>
          </select>
        </label>
        <label>
          <span>{t("sectionMarker.lineStyle", undefined, "Type de trait")}</span>
          <select onChange={(event) => onStyleChange(event.target.value)} value={style}>
            <option value="none">{t("common.none", undefined, "Aucun")}</option>
            <option value="solid">{t("lineStyle.solid", undefined, "Plein")}</option>
            <option value="dashed">{t("lineStyle.dashed", undefined, "Tirets")}</option>
            <option value="dotted">{t("lineStyle.dotted", undefined, "Pointillés")}</option>
          </select>
        </label>
      </AuthoringFieldGrid>
      <DividerActivity
        style={{
          borderTopColor: color,
          borderTopStyle: style as CSSProperties["borderTopStyle"],
          borderTopWidth: width
        }}
      />
    </div>
  );
}
