import type { QuizActivityData, QuizQuestionMode } from "../../../assessment";
import { createDefaultQuizActivity, createDefaultQuizQuestion } from "./quizDefaults";

export const STANDALONE_QUESTION_MODES = {
  "question-multiple": "multiple",
  "question-unique": "single",
  "question-true-false": "true-false"
} as const satisfies Record<string, QuizQuestionMode>;

export type StandaloneQuestionType = keyof typeof STANDALONE_QUESTION_MODES;

export function isStandaloneQuestionType(type: string): type is StandaloneQuestionType {
  return type in STANDALONE_QUESTION_MODES;
}

export function isQuestionActivityType(type: string): boolean {
  return isStandaloneQuestionType(type) || type === "question-random";
}

export function createRandomQuestionsData(): QuizActivityData {
  const quiz = createDefaultQuizActivity();
  return {
    ...quiz,
    titleHtml: "",
    introHtml: "",
    startLeadHtml: "",
    questions: [],
    settings: {
      ...quiz.settings,
      shuffleQuestions: true,
      limitQuestions: true,
      questionLimit: 1,
      maxAttempts: 1,
      showCorrectness: true,
      showCorrectAnswer: false,
      showFeedback: false,
      passingScore: 0,
      gateChapterUntilPassed: false,
      sendScoreToLms: false
    }
  };
}

export function createStandaloneQuestionData(type: StandaloneQuestionType): QuizActivityData {
  const quiz = createDefaultQuizActivity();
  return {
    ...quiz,
    titleHtml: "",
    introHtml: "",
    startLeadHtml: "",
    questions: [createDefaultQuizQuestion(STANDALONE_QUESTION_MODES[type])],
    settings: {
      ...quiz.settings,
      showCorrectness: true,
      showCorrectAnswer: false,
      showFeedback: false,
      maxAttempts: 1,
      gateChapterUntilPassed: false,
      sendScoreToLms: false,
      passingScore: 0
    }
  };
}
