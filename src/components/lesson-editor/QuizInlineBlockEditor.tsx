import type { ReactNode } from "react";
import type { QuizActivityData } from "../../assessment";
import type { QuestionBankResource } from "../../types/project";
import {
  QuizActivityEditorPanel,
  type QuizRichTextFieldParams
} from "../activities/QuizActivity";

type QuizInlineBlockEditorProps = {
  active: boolean;
  automaticTitle: string;
  onImportQuestionsFromBank: (bankId: string, questionIds: string[]) => Promise<void>;
  onQuizChange: (updater: (quiz: QuizActivityData) => QuizActivityData) => void;
  onToggleSendScoreToLms: (checked: boolean) => void;
  questionBanks: QuestionBankResource[];
  quiz: QuizActivityData | null;
  renderRichTextField: (params: QuizRichTextFieldParams) => ReactNode;
};

export function QuizInlineBlockEditor({
  active,
  automaticTitle,
  onImportQuestionsFromBank,
  onQuizChange,
  onToggleSendScoreToLms,
  questionBanks,
  quiz,
  renderRichTextField
}: QuizInlineBlockEditorProps) {
  if (!active || !quiz) {
    return null;
  }

  return (
    <QuizActivityEditorPanel
      automaticTitle={automaticTitle}
      onImportQuestionsFromBank={onImportQuestionsFromBank}
      onQuizChange={onQuizChange}
      onToggleSendScoreToLms={onToggleSendScoreToLms}
      questionBanks={questionBanks}
      quiz={quiz}
      renderRichTextField={renderRichTextField}
    />
  );
}
