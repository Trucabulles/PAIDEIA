import type { QuizActivityData } from "../../../assessment";
import { StandaloneQuestion } from "./StandaloneQuestion";
export function QuestionMultiple(props: { blockId: string; quiz: QuizActivityData }) {
  return <StandaloneQuestion {...props} mode="multiple" />;
}
