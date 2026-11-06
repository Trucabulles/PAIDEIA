import type { ActivityItem } from "../../../types/project";
import { TimelineItemEditor } from "./TimelineActivityEditor";
import { useI18n } from "../../../i18n/react";

export type TimelineItemsEditorProps = {
  collapsedItemIds: string[];
  defaultColor: string;
  items: ActivityItem[];
  onRemoveItem: (itemId: string) => void;
  onToggleCollapse: (itemId: string) => void;
  onUpdateItem: (itemId: string, patch: Partial<ActivityItem>) => void;
};

export function TimelineItemsEditor({
  collapsedItemIds,
  defaultColor,
  items,
  onRemoveItem,
  onToggleCollapse,
  onUpdateItem
}: TimelineItemsEditorProps) {
  const { t } = useI18n();
  return (
    <div className="inspector-span-2 activity-items-editor">
      <div className="interactive-editor-header">
        <span className="editor-label">{t("timeline.events", undefined, "Évènements de la frise")}</span>
      </div>
      <div className="activity-item-editor-list">
        {items.map((item) => {
          const isCollapsed = collapsedItemIds.includes(item.id);
          return (
            <article className={`activity-item-editor-card ${isCollapsed ? "collapsed" : ""}`} key={item.id}>
              <div className="marker-editor-card-header activity-item-card-header">
                <button
                  aria-expanded={!isCollapsed}
                  aria-label={t(isCollapsed ? "richText.expand" : "common.collapse")}
                  className="activity-item-collapse-button"
                  onClick={() => onToggleCollapse(item.id)}
                  type="button"
                >
                  {isCollapsed ? "›" : "⌄"}
                </button>
                <strong>{t("timeline.event", undefined, "Évènement")}</strong>
                <button className="ghost-pill compact" onClick={() => onRemoveItem(item.id)} type="button">
                  {t("common.delete")}
                </button>
              </div>
              {isCollapsed ? null : (
                <TimelineItemEditor
                  color={item.accentColor || defaultColor}
                  onColorChange={(value) =>
                    onUpdateItem(item.id, {
                      accentColor: value,
                      timeColor: null,
                      titleColor: null
                    })
                  }
                />
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
