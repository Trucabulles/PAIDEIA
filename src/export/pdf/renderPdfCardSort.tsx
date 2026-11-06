import { renderToStaticMarkup } from "react-dom/server";
import { CardSortActivity } from "../../components/activities/CardSortActivity/CardSortActivity";
import { normalizeCardSortData } from "../../components/activities/CardSortActivity/cardSortDefaults";
import cardSortCss from "../../components/activities/CardSortActivity/CardSortActivity.module.css?inline";
import type { ActivityItem, PaideiaBlock } from "../../types/project";

// Render the real component's initial state, without mounting interactive effects.
// The existing documentary answer list is appended by the PDF renderer.
export { cardSortCss };
export function renderPdfCardSort(
  block: PaideiaBlock,
  safeRich: (html: string) => string,
  imageUrl: (item: ActivityItem) => string | null
): string {
  const data = normalizeCardSortData(block.cardSort);
  const safeData = { ...data, categories: data.categories.map(category => ({
    ...category, labelHtml: safeRich(category.labelHtml || "")
  })) };
  const items = (block.activityItems ?? []).map(item => ({ ...item, contentHtml: safeRich(item.contentHtml || "") }));
  return `<div class="card-sort-monobloc">${renderToStaticMarkup(<CardSortActivity data={safeData} items={items} getItemImageUrl={imageUrl} />)}</div>`;
}
