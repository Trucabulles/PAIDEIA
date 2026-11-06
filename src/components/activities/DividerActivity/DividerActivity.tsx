import type { CSSProperties } from "react";
import styles from "./DividerActivity.module.css";
import type { DividerActivityProps } from "./types";

function normalizeDividerStyle(style?: CSSProperties): CSSProperties {
  const borderTopStyle = style?.borderTopStyle;
  const normalizedBorderTopStyle = borderTopStyle || "solid";

  return {
    ...style,
    borderTopColor: style?.borderTopColor || "#123a7a",
    borderTopWidth: style?.borderTopWidth || "2px",
    borderTopStyle: normalizedBorderTopStyle
  };
}

export function DividerActivity({ style }: DividerActivityProps) {
  return <hr className={styles.divider} style={normalizeDividerStyle(style)} />;
}
