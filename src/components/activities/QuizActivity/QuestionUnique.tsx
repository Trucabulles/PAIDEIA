import type { QuizActivityData } from "../../../assessment";
import { StandaloneQuestion } from "./StandaloneQuestion";
export function QuestionUnique(props: { blockId: string; quiz: QuizActivityData }) {
  return <StandaloneQuestion {...props} mode="single" />;
}
