import type { CompleteActivityData } from "../../../types/project";
import { completeResponseKindsById } from "./completeDefaults";

export type CompleteEvaluation = { correctIds: string[]; score: number; passed: boolean };

function normalize(value: string, caseSensitive: boolean) {
  const trimmed = value.trim();
  return caseSensitive ? trimmed : trimmed.toLocaleLowerCase();
}

export function evaluateComplete(data: CompleteActivityData, responses: Record<string, string>): CompleteEvaluation {
  const responseKinds = new Map(
    data.exercises.flatMap((exercise) => Array.from(completeResponseKindsById(exercise.contentHtml).entries()))
  );
  const blanks = data.exercises.flatMap((exercise) => exercise.blanks);
  const correctIds = blanks
    .filter((blank) => {
      const accepted = responseKinds.get(blank.id) === "list" ? [blank.answer] : [blank.answer, ...blank.variants];
      return accepted.some((value) => normalize(responses[blank.id] ?? "", blank.caseSensitive) === normalize(value, blank.caseSensitive));
    })
    .map((blank) => blank.id);
  const score = blanks.length ? Math.round((correctIds.length / blanks.length) * 100) : 0;
  return { correctIds, score, passed: score >= data.successThreshold };
}
