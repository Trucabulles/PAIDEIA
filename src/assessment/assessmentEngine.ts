import type { QuizActivityData, QuizQuestion, QuizResponseMap, QuizResult } from "./assessmentTypes";

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort();
}

export function isQuizQuestionCorrect(question: QuizQuestion, selectedAnswerIds: string[]) {
  const selected = uniqueSorted(selectedAnswerIds);
  const expected = uniqueSorted(question.answers.filter((answer) => answer.correct).map((answer) => answer.id));

  if (!expected.length) {
    return false;
  }

  if (selected.length !== expected.length) {
    return false;
  }

  return expected.every((answerId, index) => answerId === selected[index]);
}

export function hasValidPartialCredit(question: QuizQuestion): boolean {
  if (question.mode !== "multiple" || question.answers.length < 2) return false;
  if (!question.answers.every((answer) => Number.isFinite(answer.creditPercent) && answer.creditPercent! >= -100 && answer.creditPercent! <= 100)) return false;
  if (!question.answers.every((answer) => answer.correct === (answer.creditPercent! > 0))) return false;
  const positiveTotal = question.answers.reduce((total, answer) => total + Math.max(0, answer.creditPercent!), 0);
  return Math.abs(positiveTotal - 100) <= 0.1;
}

export function questionCreditMode(question: QuizQuestion): "default" | "equal" | "custom" {
  if (question.mode !== "multiple") return "default";
  if (question.creditMode === "equal") return "equal";
  if (question.creditMode === "custom" || question.answers.some((answer) => answer.creditPercent != null)) return "custom";
  return "default";
}

export function withQuestionCreditMode(question: QuizQuestion, mode: "default" | "equal" | "custom"): QuizQuestion {
  if (mode === "default" || mode === "equal") {
    return {
      ...question,
      creditMode: mode === "equal" ? "equal" : null,
      answers: question.answers.map((answer) => ({ ...answer, creditPercent: null }))
    };
  }
  const correctCount = question.answers.filter((answer) => answer.correct).length;
  return {
    ...question,
    creditMode: "custom",
    answers: question.answers.map((answer) => {
      if (questionCreditMode(question) === "custom" && answer.creditPercent != null) return answer;
      if (!answer.correct || !correctCount) return { ...answer, creditPercent: 0 };
      return { ...answer, creditPercent: Math.round(1_000_000 / correctCount) / 10_000 };
    })
  };
}

export function withAdjustedAnswerCredit(question: QuizQuestion, answerId: string, creditPercent: number): QuizQuestion | null {
  if (questionCreditMode(question) !== "custom" || !Number.isFinite(creditPercent) || creditPercent < -100 || creditPercent > 100) return null;
  const editedAnswer = question.answers.find((answer) => answer.id === answerId);
  if (!editedAnswer) return null;

  const otherCorrectAnswers = question.answers.filter((answer) => answer.id !== answerId && answer.correct);
  if (creditPercent <= 0 && !otherCorrectAnswers.length) return null;
  if (creditPercent > 0 && creditPercent < 100 && !otherCorrectAnswers.length && editedAnswer.correct) return null;

  const remaining = 100 - Math.max(0, creditPercent);
  const otherWeight = otherCorrectAnswers.reduce((sum, answer) => sum + Math.max(0, answer.creditPercent ?? 0), 0);
  const answers = question.answers.map((answer) => {
    if (answer.id === answerId) return { ...answer, creditPercent, correct: creditPercent > 0 };
    if (!otherCorrectAnswers.some((candidate) => candidate.id === answer.id)) return answer;
    const share = otherWeight > 0
      ? Math.max(0, answer.creditPercent ?? 0) / otherWeight
      : 1 / otherCorrectAnswers.length;
    const nextCredit = Math.round(remaining * share * 10_000) / 10_000;
    return { ...answer, creditPercent: nextCredit, correct: nextCredit > 0 };
  });
  const updated = { ...question, answers };
  return hasValidPartialCredit(updated) ? updated : null;
}

export function questionCreditStatus(question: QuizQuestion): "default" | "incomplete" | "invalid" | "active" {
  const mode = questionCreditMode(question);
  if (mode === "default") return "default";
  if (mode === "equal") return question.answers.some((answer) => answer.correct) ? "active" : "invalid";
  if (question.answers.some((answer) => answer.creditPercent == null)) return "incomplete";
  return hasValidPartialCredit(question) ? "active" : "invalid";
}

export function questionCreditPercent(question: QuizQuestion, selectedAnswerIds: string[]): number {
  if (questionCreditStatus(question) !== "active") return isQuizQuestionCorrect(question, selectedAnswerIds) ? 100 : 0;
  if (isQuizQuestionCorrect(question, selectedAnswerIds)) return 100;
  if (questionCreditMode(question) === "equal") {
    const correctAnswers = question.answers.filter((answer) => answer.correct);
    const selectedCorrectCount = correctAnswers.filter((answer) => selectedAnswerIds.includes(answer.id)).length;
    return correctAnswers.length ? selectedCorrectCount * 100 / correctAnswers.length : 0;
  }
  const total = question.answers.reduce((sum, answer) => sum + (selectedAnswerIds.includes(answer.id) ? answer.creditPercent! : 0), 0);
  return Math.max(0, Math.min(100, total));
}

export function calculateQuizResult(
  quizId: string,
  quiz: QuizActivityData,
  responses: QuizResponseMap,
  presentedQuestions: QuizQuestion[] = quiz.questions
): QuizResult {
  const questions = presentedQuestions.map((question) => {
    const pointsMax = Math.max(1, Number(question.points) || 1);
    const selectedAnswerIds = responses[question.id] ?? [];
    const correct = isQuizQuestionCorrect(question, selectedAnswerIds);
    const creditPercent = questionCreditPercent(question, selectedAnswerIds);
    return {
      questionId: question.id,
      correct,
      pointsAwarded: pointsMax * creditPercent / 100,
      pointsMax
    };
  });

  const scoreRaw = questions.reduce((total, question) => total + question.pointsAwarded, 0);
  const scoreMax = questions.reduce((total, question) => total + question.pointsMax, 0);
  const scorePercent = scoreMax > 0 ? Math.round((scoreRaw / scoreMax) * 100) : 0;
  const passingScore = Math.max(0, Math.min(100, Number(quiz.settings.passingScore) || 0));

  return {
    quizId,
    scoreRaw,
    scoreMax,
    scorePercent,
    passed: scorePercent >= passingScore,
    completed: true,
    questions
  };
}
