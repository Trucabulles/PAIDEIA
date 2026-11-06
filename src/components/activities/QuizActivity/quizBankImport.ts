import type { QuestionBankQuestion, QuizQuestion } from "../../../types/project";

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function copyQuestionBankQuestionToQuiz(bankId: string, source: QuestionBankQuestion): QuizQuestion {
  return {
    id: makeId("question"),
    sourceBankId: bankId,
    sourceQuestionId: source.id,
    mode: source.mode,
    creditMode: source.creditMode ?? null,
    questionHtml: source.questionHtml || "<p></p>",
    answers: source.answers.map((answer) => ({
      id: makeId("answer"),
      textHtml: answer.textHtml || "<p></p>",
      correct: Boolean(answer.correct),
      feedbackHtml: answer.feedbackHtml ?? "",
      creditPercent: answer.creditPercent ?? null
    })),
    generalFeedbackHtml: source.generalFeedbackHtml ?? "",
    feedbackCorrectHtml: source.feedbackCorrectHtml ?? "",
    feedbackIncorrectHtml: source.feedbackIncorrectHtml ?? "",
    points: Math.max(1, Number(source.points) || 1)
  };
}
