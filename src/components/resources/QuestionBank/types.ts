import type { ReactNode } from "react";
import type { QuestionBankQuestion, QuestionBankResource } from "../../../types/project";

export type QuestionBankRichTextField = "questionHtml" | "answerTextHtml" | "answerFeedbackHtml" | "generalFeedbackHtml" | "feedbackCorrectHtml" | "feedbackIncorrectHtml";

export type QuestionBankRichTextFieldRenderParams = {
  bankId: string;
  questionId: string;
  answerId?: string;
  field: QuestionBankRichTextField;
  html: string;
  label: string;
  onCommit: (html: string) => void;
  placeholder: string;
  className?: string;
};

export type QuestionBankManagerProps = {
  banks: QuestionBankResource[];
  onBanksChange: (banks: QuestionBankResource[]) => void;
  onDeleteBank: (bankId: string) => Promise<void>;
  onExportFile: (fileName: string, fileBytes: number[], format: "xlsx" | "moodle-xml") => Promise<void>;
  onExportArchive: (fileName: string, fileBytes: number[]) => Promise<void>;
  onSave: (banks: QuestionBankResource[], bankIds?: string[]) => Promise<void>;
  saveFeedbackState?: "idle" | "saving" | "saved" | "error";
  onTileImageUpload: (bankId: string, file: File) => Promise<void>;
  renderRichTextField: (params: QuestionBankRichTextFieldRenderParams) => ReactNode;
  resolveTileImageSrc: (tileImageRef?: string | null) => string | null;
};

export type QuestionBankXlsxImportResult = {
  questions: QuestionBankQuestion[];
};
