import type { ActivityItem } from "../../../types/project";

export const TABS_MIN_ITEMS = 2;
export const TABS_DEFAULT_ITEM_COUNT = 3;

export const TABS_BLOCK_DEFAULTS = {
  imageRounded: true,
  panelBackgroundColor: "#ffffff",
  panelBorderColor: "#123a7a",
  panelBorderWidth: "1px",
  panelBorderStyle: "solid",
  panelRounded: true,
  panelShadow: true
} as const;

export function createDefaultTabsItem(order: number): ActivityItem {
  return {
    id: `tabs_item_${Date.now()}_${order}`,
    title: "",
    contentTitle: "",
    contentHtml: "",
    assetRefs: [],
    mediaFileName: null,
    mediaLayout: "image-left",
    imageSize: "medium",
    imageRounded: false,
    imageCrop: null
  };
}

export function createDefaultTabsItems(count = TABS_DEFAULT_ITEM_COUNT) {
  return Array.from({ length: count }, (_, index) => createDefaultTabsItem(index + 1));
}
