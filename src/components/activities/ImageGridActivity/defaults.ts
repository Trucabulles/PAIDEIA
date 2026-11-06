import type { ActivityItem } from "../../../types/project";
import { createDefaultActivityItem } from "../activityItems";
import { translateActive } from "../../../i18n";

export const IMAGE_GRID_MIN_ITEMS = 2;
export const IMAGE_GRID_MAX_ITEMS = 4;
export const IMAGE_GRID_DEFAULT_ITEM_COUNT = 2;

export const IMAGE_GRID_BLOCK_DEFAULTS = {
  columns: IMAGE_GRID_DEFAULT_ITEM_COUNT,
  sectionBackgroundWide: true
} as const;

export function createDefaultImageGridItem(order: number): ActivityItem {
  return createDefaultActivityItem(order, translateActive("imageGrid.imageNumber", { count: order }));
}

export function createDefaultImageGridItems(count = IMAGE_GRID_DEFAULT_ITEM_COUNT): ActivityItem[] {
  const safeCount = Math.max(IMAGE_GRID_MIN_ITEMS, Math.min(IMAGE_GRID_MAX_ITEMS, count));
  return Array.from({ length: safeCount }, (_, index) => createDefaultImageGridItem(index + 1));
}

export function imageGridItemCount(items: ActivityItem[], fallback = IMAGE_GRID_DEFAULT_ITEM_COUNT): number {
  if (items.length >= IMAGE_GRID_MIN_ITEMS && items.length <= IMAGE_GRID_MAX_ITEMS) {
    return items.length;
  }
  return Math.max(IMAGE_GRID_MIN_ITEMS, Math.min(IMAGE_GRID_MAX_ITEMS, fallback));
}
