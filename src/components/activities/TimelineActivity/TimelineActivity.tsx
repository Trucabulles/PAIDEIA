import styles from "./TimelineActivity.module.css";
import type { TimelineActivityProps, TimelineCssProperties } from "./types";
import { useI18n } from "../../../i18n/react";

export function TimelineActivity({
  block,
  displayTitle,
  displaySummary,
  items,
  normalizeHtml,
  renderItemField,
  onItemAdd
}: TimelineActivityProps) {
  const { t } = useI18n();
  const timelineStyle: TimelineCssProperties = {
    "--timeline-accent": block.panelBorderColor ?? "#123a7a"
  };

  return (
    <div className={styles.activity} style={timelineStyle}>
      {displayTitle ? <h3 className="export-block-title">{displayTitle}</h3> : null}
      {displaySummary ? <p className="export-block-copy">{displaySummary}</p> : null}
      {items.length ? (
        <div className={styles.list}>
          {items.map((item) => {
            const itemStyle: TimelineCssProperties = {
              "--timeline-item-accent": item.accentColor || block.panelBorderColor || "#123a7a"
            };
            const dateHtml = item.dateLabel?.trim() || "";
            const titleHtml = item.title?.trim() || "";
            const contentHtml = item.contentHtml || "<p></p>";

            return (
              <article className={styles.item} key={item.id} style={itemStyle}>
                {renderItemField ? (
                  renderItemField(block, item, "dateLabel", dateHtml, styles.time, "full")
                ) : dateHtml ? (
                  <div
                    className={styles.time}
                    dangerouslySetInnerHTML={{ __html: normalizeHtml(dateHtml) }}
                  />
                ) : null}
                <div aria-hidden="true" className={styles.rail}>
                  <div className={styles.segment} />
                  <div className={styles.dot} />
                </div>
                <div className={styles.card}>
                  {renderItemField ? (
                    renderItemField(
                      block,
                      item,
                      "title",
                      titleHtml,
                      styles.title,
                      "full"
                    )
                  ) : titleHtml ? (
                    <h4
                      className={styles.title}
                      dangerouslySetInnerHTML={{ __html: normalizeHtml(titleHtml) }}
                    />
                  ) : null}
                  {renderItemField ? (
                    renderItemField(
                      block,
                      item,
                      "contentHtml",
                      contentHtml,
                      `rich-content ${styles.content}`,
                      "full"
                    )
                  ) : (
                    <div
                      className={`rich-content ${styles.content}`}
                      dangerouslySetInnerHTML={{ __html: normalizeHtml(contentHtml) }}
                    />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="export-block-copy">{t("timeline.addEventsInEditor", undefined, "Ajoutez des évènements dans l’éditeur.")}</p>
      )}
      {onItemAdd ? (
        <div className={styles.addEvent}>
          <span aria-hidden="true" className={styles.addEventSpacer} />
          <div className={styles.addEventRail}>
            <button
              aria-label={t("timeline.addEvent", undefined, "Ajouter un évènement")}
              className={styles.addEventButton}
              onClick={() => onItemAdd(block)}
              title={t("timeline.addEvent", undefined, "Ajouter un évènement")}
              type="button"
            >
              <span aria-hidden="true" className={styles.addSymbol} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
