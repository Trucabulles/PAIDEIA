import type { ReactNode } from "react";
import type { QuizActivityData, QuizAnswer, QuizQuestion, QuizResult } from "../../../assessment";
import type { QuestionBankResource } from "../../../types/project";

export type QuizRichTextFieldParams = {
  className?: string;
  field: string;
  html: string;
  label: string;
  ownerId: string;
  placeholder: string;
  wrapperClassName?: string;
};

export type QuizActivityProps = {
  automaticTitle?: string;
  authoringMode?: boolean;
  blockId: string;
  quiz: QuizActivityData;
  onComplete?: (result: QuizResult) => void;
  onStart?: () => void;
  started?: boolean;
};

export type QuizActivityEditorProps = {
  automaticTitle: string;
  quiz: QuizActivityData;
  questionBanks: QuestionBankResource[];
  onAddAnswer: (questionId: string) => void;
  onAddQuestion: () => void;
  onDuplicateQuestion: (questionId: string) => void;
  onImportQuestionsFromBank: (bankId: string, questionIds: string[]) => Promise<void>;
  onMoveAnswer: (questionId: string, answerId: string, direction: -1 | 1) => void;
  onMoveQuestion: (questionId: string, direction: -1 | 1) => void;
  onRemoveAnswer: (questionId: string, answerId: string) => void;
  onRemoveQuestion: (questionId: string) => void;
  onSetAnswerCorrect: (questionId: string, answerId: string, correct: boolean) => void;
  onToggleSendScoreToLms: (checked: boolean) => void;
  onUpdateAnswer: (questionId: string, answerId: string, patch: Partial<QuizAnswer>) => void;
  onUpdateQuestion: (questionId: string, patch: Partial<QuizQuestion>) => void;
  onUpdateQuiz: (patch: Partial<QuizActivityData>) => void;
  renderRichTextField: (params: QuizRichTextFieldParams) => ReactNode;
};
