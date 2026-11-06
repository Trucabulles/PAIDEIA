import styles from "./LessonNavigationActivity.module.css";
import { NavigationButtonLabel } from "./NavigationButtonLabel";
import type { LessonNavigationActivityProps } from "./types";

export function LessonNavigationActivity({ activityType, content, label, layout = "button-only", onActivate, style }: LessonNavigationActivityProps) {
  const button = (
    <button
      className={`continue-preview-button ${styles.button}`}
      onClick={() => onActivate?.()}
      style={style}
      title={label}
      type="button"
    >
      <NavigationButtonLabel label={label} />
    </button>
  );

  return (
    <div
      className={`export-button-row ${styles.row} ${styles[activityType]} ${styles[layout]}`}
      data-course-exit-layout={activityType === "course-exit" ? layout : undefined}
      data-navigation-activity={activityType}
    >
      {layout === "button-left-text-right" ? button : null}
      {layout !== "button-only" ? <div className={styles.content}>{content}</div> : null}
      {layout !== "button-left-text-right" ? button : null}
    </div>
  );
}
