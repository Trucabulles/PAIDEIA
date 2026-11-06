import type { QuizActivityData, QuizQuestion, QuizQuestionMode } from "../../../assessment";
import { translateActive } from "../../../i18n";

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createDefaultQuizQuestion(mode: QuizQuestionMode = "single"): QuizQuestion {
  const questionId = makeId("question");
  const isTrueFalse = mode === "true-false";

  return {
    id: questionId,
    mode,
    questionHtml: "<p></p>",
    answers: isTrueFalse
      ? [
          { id: makeId("answer"), textHtml: `<p>${translateActive("quiz.true")}</p>`, correct: true },
          { id: makeId("answer"), textHtml: `<p>${translateActive("quiz.false")}</p>`, correct: false }
        ]
      : [
          { id: makeId("answer"), textHtml: "<p></p>", correct: true },
          { id: makeId("answer"), textHtml: "<p></p>", correct: false }
        ],
    generalFeedbackHtml: "",
    feedbackCorrectHtml: "",
    feedbackIncorrectHtml: "",
    points: 1
  };
}

function escapeHtmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function createDefaultQuizActivity(
  startLeadText = translateActive("quiz.startPlaceholder"),
  titleText = translateActive("activity.quiz")
): QuizActivityData {
  return {
    titleHtml: `<p>${escapeHtmlText(titleText)}</p>`,
    titleMode: "auto",
    introHtml: "<p></p>",
    startLeadHtml: `<p>${escapeHtmlText(startLeadText)}</p>`,
    questions: [createDefaultQuizQuestion("single")],
    settings: {
      shuffleAnswers: false,
      shuffleQuestions: false,
      limitQuestions: false,
      questionLimit: 1,
      showFeedback: false,
      showCorrectAnswer: false,
      allowRetry: false,
      maxAttempts: 1,
      passingScore: 80,
      reviewMode: "disabled",
      reviewAfterAttempts: 1,
      sendScoreToLms: false,
      gateChapterUntilPassed: true
    }
  };
}
