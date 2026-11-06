import { useEffect, useMemo, useState } from "react";
import type { QuizActivityData } from "../../../assessment";
import { useI18n } from "../../../i18n/react";
import { StandaloneQuestion } from "./StandaloneQuestion";

type Props = { blockId: string; quiz: QuizActivityData };

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const selected = Math.floor(Math.random() * (index + 1));
    [result[index], result[selected]] = [result[selected], result[index]];
  }
  return result;
}

export function RandomQuestions({ blockId, quiz }: Props) {
  const { t } = useI18n();
  const signature = `${blockId}|${quiz.settings.questionLimit}|${quiz.settings.shuffleQuestions}|${quiz.settings.shuffleAnswers}|${quiz.questions.map((question) => `${question.id}:${question.answers.map((answer) => answer.id).join(",")}`).join(";")}`;
  const selection = useMemo(() => {
    const source = shuffled(quiz.questions);
    const count = Math.max(1, Math.min(source.length, Number(quiz.settings.questionLimit) || 1));
    const selected = source.slice(0, count);
    if (!quiz.settings.shuffleQuestions) {
      const originalOrder = new Map(quiz.questions.map((question, index) => [question.id, index]));
      selected.sort((left, right) => (originalOrder.get(left.id) ?? 0) - (originalOrder.get(right.id) ?? 0));
    }
    return selected.map((question) => ({
      id: question.id,
      answerIds: (quiz.settings.shuffleAnswers ? shuffled(question.answers) : question.answers).map((answer) => answer.id)
    }));
  }, [signature]);
  const presented = selection.flatMap((entry) => {
    const question = quiz.questions.find((candidate) => candidate.id === entry.id);
    if (!question) return [];
    const order = new Map(entry.answerIds.map((id, index) => [id, index]));
    return [{ ...question, answers: [...question.answers].sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0)) }];
  });
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => setActiveIndex(0), [signature]);
  const currentIndex = Math.min(activeIndex, Math.max(0, presented.length - 1));
  const question = presented[currentIndex];

  if (presented.length === 0) return <p>{t("standaloneQuestion.emptyBank", undefined, "Aucune question dans cette banque.")}</p>;
  return <div>
    <StandaloneQuestion
      blockId={`${blockId}-${question.id}`}
      key={`${signature}-${currentIndex}-${question.id}`}
      mode={question.mode}
      progress={{ current: currentIndex + 1, total: presented.length }}
      onContinue={currentIndex + 1 < presented.length ? () => setActiveIndex(currentIndex + 1) : undefined}
      quiz={{ ...quiz, questions: [question] }}
    />
  </div>;
}
