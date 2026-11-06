import type { ActivityItem } from "../../../types/project";
import { translateActive } from "../../../i18n";

export function slidesContentMockLabel(_kind?: ActivityItem["kind"] | null) {
  return translateActive("editor.enterTextEllipsis");
}

export function isDefaultSlidesContentHtml(value?: string | null, kind?: ActivityItem["kind"] | null) {
  const text = (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const legacyLabels = new Set([
    "Commencez ici.",
    "Terminez ici.",
    "Contenu à compléter."
  ]);
  return !text || text === slidesContentMockLabel(kind) || legacyLabels.has(text);
}

export function createDefaultSlidesItem(order: number): ActivityItem {
  return {
    id: `slides_item_${Date.now()}_${order}`,
    title: translateActive("slides.slideNumber", { number: order }),
    kind: "step",
    contentHtml: "<p></p>",
    assetRefs: [],
    mediaFileName: null,
    mediaLayout: "image-left",
    imageSize: "small",
    imageRounded: false,
    imageCrop: null,
    imageAnnotationStateRef: null,
    imageAnnotationSourceAssetRef: null
  };
}

export function defaultSlidesImageSize(layout?: string | null) {
  return layout === "image-center" ? "large" : "small";
}

export function nextRealSlideNumber(items: ActivityItem[]) {
  return items.length + 1;
}

export function slidesItemLabel(_item: ActivityItem, index: number, _total: number, _items: ActivityItem[]) {
  return translateActive("slides.slideNumber", { number: index + 1 });
}
