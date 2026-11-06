import type { ActivityItem, ImageAccessibility, PaideiaBlock, PaideiaChapter } from "../types/project";
import { translateActive } from "../i18n";

export type ImageAltStatus = "missing" | "filled" | "decorative";

export const ALT_ELIGIBLE_BLOCK_TYPES = new Set([
  "image",
  "image-text",
  "point-of-interest",
  "image-360",
  "quote"
]);

export const ALT_ELIGIBLE_ITEM_BLOCK_TYPES = new Set(["accordion", "flip-cards", "slides", "tabs"]);

export function normalizeImageAccessibility(value?: ImageAccessibility | null): ImageAccessibility | null {
  if (!value) return null;
  return { altText: value.altText?.trim() ?? "", decorative: Boolean(value.decorative) };
}

export function imageAltStatus(value?: ImageAccessibility | null): ImageAltStatus {
  if (value?.decorative) return "decorative";
  return value?.altText?.trim() ? "filled" : "missing";
}

export function imageAltAttributes(value?: ImageAccessibility | null): {
  alt?: string;
  role?: "presentation";
} {
  if (value?.decorative) return { alt: "", role: "presentation" };
  const alt = value?.altText?.trim();
  return alt ? { alt } : {};
}

export function imageAltPdfLabel(value?: ImageAccessibility | null): string {
  const status = imageAltStatus(value);
  return translateActive(`imageAlt.pdf.${status}`);
}

function hasRasterAsset(refs?: string[] | null): boolean {
  return Boolean(refs?.some((ref) => /\.(?:avif|bmp|gif|jpe?g|png|webp)(?:$|[?#])/i.test(ref)));
}

export function blockHasEligibleImage(block: PaideiaBlock): boolean {
  if (!ALT_ELIGIBLE_BLOCK_TYPES.has(block.type)) return false;
  return hasRasterAsset(block.assetRefs);
}

export function itemHasEligibleImage(item: ActivityItem): boolean {
  return hasRasterAsset(item.assetRefs);
}

export function richInlineImageStatuses(html?: string | null): ImageAltStatus[] {
  if (!html) return [];
  return (html.match(/<img\b[^>]*>/gi) ?? [])
    .filter((tag) => /class\s*=\s*["'][^"']*\brich-inline-image\b/i.test(tag))
    .map((tag) => {
      if (/data-paideia-decorative\s*=\s*["']true["']/i.test(tag) || /role\s*=\s*["']presentation["']/i.test(tag)) {
        return "decorative";
      }
      const alt = tag.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1]?.trim();
      return alt ? "filled" : "missing";
    });
}

export function blockImageAltStatuses(block: PaideiaBlock): ImageAltStatus[] {
  const statuses: ImageAltStatus[] = [];
  if (blockHasEligibleImage(block)) statuses.push(imageAltStatus(block.imageAccessibility));
  if (ALT_ELIGIBLE_ITEM_BLOCK_TYPES.has(block.type)) {
    for (const item of block.activityItems ?? []) {
      if (block.type === "flip-cards") {
        if (item.frontType === "image" && item.frontImageAssetRef) {
          statuses.push(imageAltStatus(item.frontImageAccessibility));
        }
        if (item.backType === "image" && item.backImageAssetRef) {
          statuses.push(imageAltStatus(item.backImageAccessibility));
        }
      } else if (itemHasEligibleImage(item)) {
        statuses.push(imageAltStatus(item.imageAccessibility));
      }
    }
  }
  statuses.push(...richInlineImageStatuses(block.contentHtml));
  return statuses;
}

export function countMissingAltInChapter(chapter?: PaideiaChapter | null): number {
  if (!chapter) return 0;
  return chapter.pages.reduce(
    (total, page) => total + page.blocks.reduce((sum, block) => sum + blockImageAltStatuses(block).filter((s) => s === "missing").length, 0),
    0
  );
}
