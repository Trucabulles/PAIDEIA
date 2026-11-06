import type { ActivityItem } from "../../../types/project";

export function createDefaultTimelineItem(order: number): ActivityItem {
  return {
    id: `timeline_item_${Date.now()}_${order}`,
    title: "",
    dateLabel: "",
    timeColor: null,
    titleColor: null,
    accentColor: null,
    contentHtml: "",
    assetRefs: []
  };
}
