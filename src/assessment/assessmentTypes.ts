export type QuizQuestionMode = "single" | "multiple" | "true-false";
export type QuizReviewMode = "disabled" | "after-pass" | "after-attempts";

export type QuizAnswer = {
  id: string;
  textHtml: string;
  correct: boolean;
  feedbackHtml?: string | null;
  creditPercent?: number | null;
};

export type QuizQuestion = {
  id: string;
  sourceQuestionId?: string | null;
  sourceBankId?: string | null;
  mode: QuizQuestionMode;
  creditMode?: "equal" | "custom" | null;
  questionHtml: string;
  answers: QuizAnswer[];
  generalFeedbackHtml?: string | null;
  feedbackCorrectHtml?: string | null;
  feedbackIncorrectHtml?: string | null;
  points: number;
};

export type QuizSettings = {
  shuffleAnswers: boolean;
  shuffleQuestions: boolean;
  limitQuestions: boolean;
  questionLimit: number;
  showFeedback: boolean;
  showCorrectness?: boolean;
  showCorrectAnswer: boolean;
  allowRetry: boolean;
  maxAttempts: number;
  passingScore: number;
  reviewMode: QuizReviewMode;
  reviewAfterAttempts: number;
  sendScoreToLms: boolean;
  gateChapterUntilPassed: boolean;
};

export type QuizActivityData = {
  titleHtml: string;
  titleMode?: "auto" | "custom";
  introHtml: string;
  startLeadHtml: string;
  questions: QuizQuestion[];
  settings: QuizSettings;
};

export type QuizResponseMap = Record<string, string[]>;

export type QuizQuestionResult = {
  questionId: string;
  correct: boolean;
  pointsAwarded: number;
  pointsMax: number;
};

export type QuizResult = {
  quizId: string;
  scoreRaw: number;
  scoreMax: number;
  scorePercent: number;
  passed: boolean;
  completed: boolean;
  questions: QuizQuestionResult[];
};
