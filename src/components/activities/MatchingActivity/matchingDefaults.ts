import type { MatchingActivityData, MatchingPair } from "../../../types/project";
import { translateActive } from "../../../i18n";

export const MATCHING_DEFAULT_SUCCESS_FEEDBACK_HTML = "<p>Vous avez correctement relié tous les éléments.</p>";
export const MATCHING_DEFAULT_FAILURE_FEEDBACK_HTML = "<p>Certaines associations sont incorrectes. Recommencez si une nouvelle tentative est disponible.</p>";

const meaningful = (html?: string | null) => Boolean(html?.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim());

export function createDefaultMatchingPair(order: number): MatchingPair {
  const stamp = `${Date.now()}_${order}`;
  return {
    id: `matching_pair_${stamp}`,
    leftId: `matching_left_${stamp}`,
    rightId: `matching_right_${stamp}`,
    leftHtml: `<p>${translateActive("matching.leftElement")} ${order}</p>`,
    rightHtml: `<p>${translateActive("matching.rightElement")} ${order}</p>`,
    leftBackgroundColor: null,
    rightBackgroundColor: null
  };
}

export function createDefaultMatchingData(): MatchingActivityData {
  return {
    pairs: [createDefaultMatchingPair(1), createDefaultMatchingPair(2)],
    maxAttempts: 3,
    successThreshold: 100,
    showAttemptFeedback: true,
    successFeedbackHtml: `<p>${translateActive("matching.successFeedback")}</p>`,
    failureFeedbackHtml: `<p>${translateActive("matching.failureFeedback")}</p>`,
    labelAppearance: {
      backgroundColor: "#FFFFFF",
      borderColor: "#244585",
      borderWidth: "1px",
      borderStyle: "solid",
      rounded: true
    }
  } as MatchingActivityData & { showAttemptFeedback: boolean };
}

export function normalizeMatchingData(value?: MatchingActivityData | null): MatchingActivityData {
  const fallback = createDefaultMatchingData();
  const pairs: MatchingPair[] = (value?.pairs ?? fallback.pairs).slice(0, 10).map((pair, index) => {
    const base = createDefaultMatchingPair(index + 1);
    return {
      id: pair.id || base.id,
      leftId: pair.leftId || base.leftId,
      rightId: pair.rightId || base.rightId,
      leftHtml: pair.leftHtml || "<p></p>",
      rightHtml: pair.rightHtml || "<p></p>",
      leftBackgroundColor: pair.leftBackgroundColor || null,
      rightBackgroundColor: pair.rightBackgroundColor || null
    };
  });
  while (pairs.length < 2) pairs.push(createDefaultMatchingPair(pairs.length + 1));
  const source = value as (MatchingActivityData & { showAttemptFeedback?: boolean }) | null | undefined;
  return {
    pairs,
    maxAttempts: Number.isFinite(value?.maxAttempts) ? (Number(value?.maxAttempts) === 0 ? 0 : Math.max(1, Math.min(10, Number(value?.maxAttempts)))) : fallback.maxAttempts,
    successThreshold: 100,
    showAttemptFeedback: source?.showAttemptFeedback ?? true,
    successFeedbackHtml: meaningful(value?.successFeedbackHtml) ? value!.successFeedbackHtml : fallback.successFeedbackHtml,
    failureFeedbackHtml: meaningful(value?.failureFeedbackHtml) ? value!.failureFeedbackHtml : fallback.failureFeedbackHtml,
    labelAppearance: {
      backgroundColor: value?.labelAppearance?.backgroundColor || fallback.labelAppearance.backgroundColor,
      borderColor: value?.labelAppearance?.borderColor || fallback.labelAppearance.borderColor,
      borderWidth: value?.labelAppearance?.borderWidth || fallback.labelAppearance.borderWidth,
      borderStyle: value?.labelAppearance?.borderStyle || fallback.labelAppearance.borderStyle,
      rounded: value?.labelAppearance?.rounded ?? fallback.labelAppearance.rounded
    }
  } as MatchingActivityData & { showAttemptFeedback: boolean };
}
