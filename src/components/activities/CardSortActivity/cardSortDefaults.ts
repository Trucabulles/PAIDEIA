import type { ActivityItem, CardSortActivityData } from "../../../types/project";
import { translateActive } from "../../../i18n";

export const CARD_SORT_DEFAULT_SUCCESS_FEEDBACK_HTML = "<p>Votre tri est réussi.</p>";
export const CARD_SORT_DEFAULT_FAILURE_FEEDBACK_HTML = "<p>Votre tri comporte encore des erreurs. Recommencez si une nouvelle tentative est disponible.</p>";

function hasMeaningfulRichText(html?: string | null) {
  if (!html?.trim()) return false;
  const textOnly = html
    .replace(/<br\s*\/?>(?:\s*)/gi, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, "")
    .trim();
  return textOnly.length > 0;
}

export const CARD_SORT_DEFAULT_APPEARANCE = {
  backgroundColor: "#FFFFFF",
  borderColor: "#244585",
  borderWidth: "1px",
  borderStyle: "solid",
  rounded: true
} as const;

const DEFAULT_CATEGORY_BORDER = "#244585";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

export function cardSortCategoryLabelText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

export function createDefaultCardSortData(categoryLabel = (index: number) => `Catégorie ${index}`): CardSortActivityData {
  return {
    categories: [
      { id: "category_1", label: categoryLabel(1), labelHtml: `<p>${escapeHtml(categoryLabel(1))}</p>`, borderColor: DEFAULT_CATEGORY_BORDER },
      { id: "category_2", label: categoryLabel(2), labelHtml: `<p>${escapeHtml(categoryLabel(2))}</p>`, borderColor: DEFAULT_CATEGORY_BORDER }
    ],
    maxAttempts: 0,
    successThreshold: 100,
    gateChapterUntilPassed: false,
    interactionMode: "direct",
    successFeedbackHtml: `<p>${translateActive("cardSort.successFeedback")}</p>`,
    failureFeedbackHtml: `<p>${translateActive("cardSort.failureFeedback")}</p>`,
    cardAppearance: { ...CARD_SORT_DEFAULT_APPEARANCE }
  };
}

export function createDefaultCardSortItem(order: number, categoryId = "category_1", title = `Carte ${order}`): ActivityItem {
  return {
    id: `card_sort_${Date.now()}_${order}`,
    title,
    contentHtml: `<p>${escapeHtml(title)}</p>`,
    assetRefs: [],
    mediaFileName: null,
    imageRounded: true,
    frontImageAssetRef: null,
    frontImageFileName: null,
    frontImageCrop: null,
    frontImageAccessibility: null,
    correctCategoryId: categoryId,
    cardBackgroundColor: null,
    cardFeedbackHtml: null,
    cardFeedbackCorrectHtml: null,
    cardFeedbackIncorrectHtml: null
  };
}

export function normalizeCardSortData(value?: CardSortActivityData | null): CardSortActivityData {
  const fallback = createDefaultCardSortData();
  const categories = (value?.categories ?? fallback.categories)
    .map((category, index) => {
      const fallbackLabel = category.label?.trim() || `Catégorie ${index + 1}`;
      const labelHtml = category.labelHtml?.trim() || `<p>${escapeHtml(fallbackLabel)}</p>`;
      const legacyBackgroundColor = (category as typeof category & { backgroundColor?: string }).backgroundColor;
      return {
        id: category.id?.trim() || `category_${index + 1}`,
        label: cardSortCategoryLabelText(labelHtml) || fallbackLabel,
        labelHtml,
        borderColor: category.borderColor?.trim() || legacyBackgroundColor?.trim() || DEFAULT_CATEGORY_BORDER
      };
    })
    .filter((category, index, list) => list.findIndex((candidate) => candidate.id === category.id) === index);
  while (categories.length < 2) {
    const order = categories.length + 1;
    categories.push({ id: `category_${order}`, label: `Catégorie ${order}`, labelHtml: `<p>Catégorie ${order}</p>`, borderColor: DEFAULT_CATEGORY_BORDER });
  }
  return {
    categories,
    maxAttempts: Number.isFinite(value?.maxAttempts) ? Math.max(0, Math.min(10, Number(value?.maxAttempts))) : fallback.maxAttempts,
    successThreshold: Number.isFinite(value?.successThreshold) ? Math.max(0, Math.min(100, Number(value?.successThreshold))) : fallback.successThreshold,
    gateChapterUntilPassed: false, // Champ legacy conservé pour compatibilité de schéma ; la logique Card Sort ne l’utilise plus.
    interactionMode: value?.interactionMode === "feedback" ? "feedback" : "direct",
    successFeedbackHtml: hasMeaningfulRichText(value?.successFeedbackHtml)
      ? value!.successFeedbackHtml
      : fallback.successFeedbackHtml,
    failureFeedbackHtml: hasMeaningfulRichText(value?.failureFeedbackHtml)
      ? value!.failureFeedbackHtml
      : fallback.failureFeedbackHtml,
    cardAppearance: {
      backgroundColor: value?.cardAppearance?.backgroundColor || fallback.cardAppearance.backgroundColor,
      borderColor: value?.cardAppearance?.borderColor || fallback.cardAppearance.borderColor,
      borderWidth: value?.cardAppearance?.borderWidth || fallback.cardAppearance.borderWidth,
      borderStyle: value?.cardAppearance?.borderStyle || fallback.cardAppearance.borderStyle,
      rounded: value?.cardAppearance?.rounded ?? fallback.cardAppearance.rounded
    }
  };
}

export function normalizeCardSortItems(items: ActivityItem[], data: CardSortActivityData) {
  const validCategories = new Set(data.categories.map((category) => category.id));
  const fallbackCategory = data.categories[0]?.id ?? "category_1";
  return items.map((item) => ({
    ...item,
    contentHtml: item.contentHtml || "<p></p>",
    correctCategoryId: item.correctCategoryId && validCategories.has(item.correctCategoryId)
      ? item.correctCategoryId
      : fallbackCategory,
    cardBackgroundColor: item.cardBackgroundColor || null,
    cardFeedbackHtml: item.cardFeedbackHtml || null, // legacy : conservé sans être utilisé par le nouveau renderer.
    cardFeedbackCorrectHtml: item.cardFeedbackCorrectHtml ?? item.cardFeedbackHtml ?? null,
    cardFeedbackIncorrectHtml: item.cardFeedbackIncorrectHtml ?? null
  }));
}
