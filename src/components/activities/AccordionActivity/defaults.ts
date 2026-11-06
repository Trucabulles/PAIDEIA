import type { ActivityItem } from "../../../types/project";

export function createDefaultAccordionItem(order: number): ActivityItem {
  return {
    id: `accordion_item_${Date.now()}_${order}`,
    title: "",
    kind: "step",
    contentHtml: "",
    assetRefs: [],
    mediaFileName: null,
    mediaLayout: "image-below",
    imageSize: "medium",
    imageRounded: false,
    imageCrop: null
  };
}

export function createDefaultAccordionItems(count = 2) {
  return Array.from({ length: count }, (_, index) => createDefaultAccordionItem(index + 1));
}
