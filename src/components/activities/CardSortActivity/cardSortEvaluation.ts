import type { ActivityItem } from "../../../types/project";

export type CardSortEvaluation = {
  correctCardIds: string[];
  passed: boolean;
  score: number;
};

export function evaluateCardSort(items: ActivityItem[], placements: Record<string, string>, threshold: number): CardSortEvaluation {
  const correctCardIds = items
    .filter((item) => Boolean(item.correctCategoryId) && placements[item.id] === item.correctCategoryId)
    .map((item) => item.id);
  const score = items.length ? Math.round((correctCardIds.length / items.length) * 100) : 0;
  return { correctCardIds, score, passed: score >= threshold };
}
