import type { CSSProperties } from "react";
import styles from "./NoteActivity.module.css";
import type { NoteActivityProps } from "./types";
import { DEFAULT_NOTE_ICON, NoteIconSvg } from "./noteIcons";

type NoteCssVars = CSSProperties & {
  "--note-accent": string;
};

function normalizeNoteBorderWidth(value: CSSProperties["borderWidth"]) {
  if (typeof value !== "string") {
    return "2px";
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 2) {
    return "2px";
  }

  return value;
}

export function NoteActivity({ content, icon = DEFAULT_NOTE_ICON, iconColor, rounded = false, shadow = true, showIcon = true, style, title }: NoteActivityProps) {
  const { padding: _padding, ...safeStyle } = style ?? {};
  const noteStyle: CSSProperties = {
    ...safeStyle,
    borderColor: safeStyle.borderColor || "#123a7a",
    borderStyle: safeStyle.borderStyle || "solid",
    borderWidth: normalizeNoteBorderWidth(safeStyle.borderWidth),
    borderRadius: rounded ? "22px" : "0px",
    backgroundColor: safeStyle.backgroundColor || "#ffffff",
    "--note-accent": iconColor || String(safeStyle.borderColor || "#123a7a")
  } as NoteCssVars;

  return (
    <div className={`note-activity ${styles.note}${shadow ? ` ${styles.shadow}` : ""}${showIcon ? "" : ` ${styles.withoutIcon}`}`} style={noteStyle}>
      {showIcon ? <NoteIconSvg className={styles.icon} icon={icon} /> : null}
      <div className={styles.copy}>
        {title ? <h3 className="export-block-title">{title}</h3> : null}
        {content}
      </div>
    </div>
  );
}
