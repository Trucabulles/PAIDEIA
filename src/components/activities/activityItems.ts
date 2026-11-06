import type { ActivityItem } from "../../types/project";
import { translateActive } from "../../i18n";

export function createDefaultActivityItem(
  order: number,
  title = translateActive("flipCards.cardNumber", { count: order })
): ActivityItem {
  return {
    id: `item_${Date.now()}_${order}`,
    title,
    kind: "step",
    contentHtml: `<p>${translateActive("editor.contentPlaceholder")}</p>`,
    assetRefs: [],
    mediaFileName: null,
    mediaLayout: "image-left",
    imageSize: "medium",
    imageRounded: false,
    imageCrop: null,
    frontType: "text",
    frontText: title,
    frontImageAssetRef: null,
    frontImageFileName: null,
    frontImageCrop: null,
    frontImageAccessibility: null,
    backType: "text",
    backTitle: "",
    backImageAssetRef: null,
    backImageFileName: null,
    backImageCrop: null,
    backImageAccessibility: null
  };
}
