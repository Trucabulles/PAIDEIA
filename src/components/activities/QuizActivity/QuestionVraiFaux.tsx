import type { QuizActivityData } from "../../../assessment";
import { StandaloneQuestion } from "./StandaloneQuestion";
export function QuestionVraiFaux(props: { blockId: string; quiz: QuizActivityData }) {
  return <StandaloneQuestion {...props} mode="true-false" />;
}
