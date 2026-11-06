import { AuthoringFieldGrid } from "../../authoring";
import { ColorPickerField } from "../../color-picker/ColorPickerPopover";
import { useI18n } from "../../../i18n/react";
import styles from "./TimelineActivity.module.css";
import type { TimelineActivityEditorProps, TimelineItemEditorProps } from "./types";

export function TimelineActivityEditor({
  color,
  onColorChange
}: TimelineActivityEditorProps) {
  const { t } = useI18n();

  return (
    <div className={`activity-style-panel ${styles.editorPanel}`}>
      <span className="editor-label">{t("activity.timeline")}</span>
      <AuthoringFieldGrid>
        <label>
          <span>{t("timeline.defaultColor", undefined, "Couleur par défaut")}</span>
          <ColorPickerField
            ariaLabel={t("timeline.defaultColorAria", undefined, "Couleur par défaut de la frise")}
            onChange={onColorChange}
            value={color}
          />
        </label>
      </AuthoringFieldGrid>
    </div>
  );
}

export function TimelineItemEditor({
  color,
  onColorChange
}: TimelineItemEditorProps) {
  const { t } = useI18n();

  return (
    <>
      <div className={styles.itemColorGrid}>
        <label>
          <span>{t("timeline.eventColor", undefined, "Couleur de l'évènement")}</span>
          <ColorPickerField
            ariaLabel={t("timeline.eventColor", undefined, "Couleur de l'évènement")}
            onChange={onColorChange}
            value={color}
          />
        </label>
      </div>
      <p className="editor-helper">
        {t("timeline.inlineEditHint", undefined, "La date, le titre et le contenu se modifient directement dans la page de leçon.")}
      </p>
    </>
  );
}
