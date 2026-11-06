import type { MatchingPair } from "../../../types/project";

export type MatchingEvaluation = { correctPairIds: string[]; passed: boolean; score: number };

export function evaluateMatching(pairs: MatchingPair[], associations: Record<string, string>, threshold: number): MatchingEvaluation {
  const correctPairIds = pairs.filter((pair) => associations[pair.leftId] === pair.rightId).map((pair) => pair.id);
  const score = pairs.length ? Math.round((correctPairIds.length / pairs.length) * 100) : 0;
  return { correctPairIds, score, passed: score >= threshold };
}
