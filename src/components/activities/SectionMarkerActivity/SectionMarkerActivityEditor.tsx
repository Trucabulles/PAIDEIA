import { AuthoringFieldGrid } from "../../authoring";
import { ColorPickerField } from "../../color-picker/ColorPickerPopover";
import { useI18n } from "../../../i18n/react";
import { SectionMarkerActivity } from "./SectionMarkerActivity";
import styles from "./SectionMarkerActivityEditor.module.css";
import { formatSectionMarker } from "./sectionMarker";

type EditableProps = {
  dividerColor: string;
  dividerStyle: string;
  dividerWidth: string;
  markerScheme: string;
  markerTextColor: string;
  markerType: string;
};
export type SectionMarkerActivityEditorProps = EditableProps & { label?: string; markerFontSize?: string; onChange: (patch: Partial<EditableProps>) => void };

export function SectionMarkerActivityEditor(props: SectionMarkerActivityEditorProps) {
  const { t } = useI18n();
  function changeMarkerType(markerType: string) {
    const markerTextColorIsDefault = props.markerTextColor.trim().toLowerCase() === "#123a7a";
    props.onChange(markerType === "filled" && markerTextColorIsDefault
      ? { markerType, markerTextColor: "#ffffff" }
      : { markerType });
  }

  return (
    <div className="activity-style-panel">
      <span className="editor-label">{t("sectionMarker.title")}</span>
      <AuthoringFieldGrid>
        <label><span>{t("sectionMarker.numbering")}</span><select value={props.markerScheme} onChange={(event) => props.onChange({ markerScheme:event.target.value })}><option value="arabic">{t("sectionMarker.arabic")}</option><option value="roman">{t("sectionMarker.roman")}</option><option value="alpha">{t("sectionMarker.alpha")}</option></select></label>
        <label><span>{t("sectionMarker.dividerColor")}</span><ColorPickerField ariaLabel={t("sectionMarker.dividerColor")} value={props.dividerColor} onChange={(dividerColor) => props.onChange({ dividerColor })} /></label>
        <label><span>{t("sectionMarker.textColor")}</span><ColorPickerField ariaLabel={t("sectionMarker.markerColorAria")} value={props.markerTextColor} onChange={(markerTextColor) => props.onChange({ markerTextColor })} /></label>
        <div className={styles.selectRow}>
          <label><span>{t("sectionMarker.lineStyle")}</span><select value={props.dividerStyle} onChange={(event) => props.onChange({ dividerStyle:event.target.value })}><option value="solid">{t("lineStyle.solid")}</option><option value="dashed">{t("lineStyle.dashed")}</option><option value="dotted">{t("lineStyle.dotted")}</option></select></label>
          <label><span>{t("sectionMarker.width")}</span><select value={props.dividerWidth} onChange={(event) => props.onChange({ dividerWidth:event.target.value })}><option value="1px">{t("lineWidth.thin")}</option><option value="2px">{t("lineWidth.normal")}</option><option value="4px">{t("lineWidth.thick")}</option><option value="6px">{t("lineWidth.veryThick")}</option></select></label>
          <label><span>{t("sectionMarker.markerType")}</span><select value={props.markerType} onChange={(event) => changeMarkerType(event.target.value)}><option value="none">{t("sectionMarker.markerType.none")}</option><option value="outline">{t("sectionMarker.markerType.outline")}</option><option value="filled">{t("sectionMarker.markerType.filled")}</option></select></label>
        </div>
      </AuthoringFieldGrid>
      <SectionMarkerActivity {...props} label={props.label ?? formatSectionMarker(1, props.markerScheme)} />
    </div>
  );
}
