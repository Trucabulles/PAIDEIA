import type { ReactNode } from "react";
import type { CompleteActivityData, ImageCrop } from "../../../types/project";

export type CompleteActivityCompletionResult = {
  score: number;
  passed: boolean;
  bestScore: number;
  lastScore: number;
  attemptsUsed: number;
  unlimitedAttempts: boolean;
  scoreEligibleForLms: boolean;
};

export type CompleteActivityProps = {
  authoringMode?: boolean;
  data: CompleteActivityData;
  coverImageAlt?: string;
  coverImageCrop?: ImageCrop | null;
  coverImageRounded?: boolean;
  coverImageSrc?: string;
  title?: string;
  onComplete?: (result: CompleteActivityCompletionResult) => void;
};

export type CompleteContentRichTextFieldOptions = {
  className?: string;
  controls?: ReactNode;
  exerciseId: string;
  html: string;
  onCommit: (html: string) => void;
  onEditorChange?: (editor: HTMLDivElement | null) => void;
  placeholder: string;
};

export type CompleteActivityEditorProps = {
  coverMediaEditor?: ReactNode;
  data: CompleteActivityData;
  onDataChange: (updater: (current: CompleteActivityData) => CompleteActivityData) => void;
  renderContentRichTextField: (options: CompleteContentRichTextFieldOptions) => ReactNode;
  renderCoverRichTextField: (options: {
    field: "titleHtml" | "descriptionHtml" | "successHtml" | "failureHtml";
    html: string;
    label: string;
    placeholder: string;
  }) => ReactNode;
};
