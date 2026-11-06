import type { CSSProperties } from "react";
import { useI18n } from "../../../i18n/react";
import styles from "./SectionMarkerActivity.module.css";
import { normalizeSectionMarkerType } from "./sectionMarker";

export type SectionMarkerActivityProps = {
  dividerColor?: string | null;
  dividerStyle?: string | null;
  dividerWidth?: string | null;
  label: string;
  markerScheme?: string | null;
  markerFontSize?: string;
  markerTextColor?: string | null;
  markerType?: string | null;
};

export function SectionMarkerActivity({ dividerColor, dividerStyle, dividerWidth, label, markerFontSize = "1.5rem", markerTextColor, markerType }: SectionMarkerActivityProps) {
  const { t } = useI18n();
  const normalizedMarkerType = normalizeSectionMarkerType(markerType);
  const style = {
    "--section-marker-divider-color": dividerColor || "#123a7a",
    "--section-marker-divider-style": dividerStyle || "solid",
    "--section-marker-divider-width": dividerWidth || "2px",
    "--section-marker-font-size": markerFontSize,
    "--section-marker-text-color": markerTextColor || dividerColor || "#123a7a"
  } as CSSProperties;
  return (
    <div aria-label={t("sectionMarker.aria", { label }, "Repère {label}")} className={styles.marker} role="separator" style={style}>
      <span aria-hidden="true" className={styles.line} />
      <span className={`${styles.badge} ${styles[normalizedMarkerType]}`}>{label}</span>
      <span aria-hidden="true" className={styles.line} />
    </div>
  );
}
