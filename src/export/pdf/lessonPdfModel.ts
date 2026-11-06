import type { ImageCrop, NoteIconId, QuizQuestionMode } from "../../types/project";
import type { PdfActivityRenderMode } from "./activityPdfMatrix";
import type { LessonPdfLabels } from "./pdfLocalization";

export type LessonPdfAssetRole =
  | "image"
  | "poster"
  | "background"
  | "attachment"
  | "audio"
  | "video"
  | "avatar";

export type LessonPdfAsset = {
  ref: string;
  role: LessonPdfAssetRole;
  crop?: ImageCrop | null;
  rounded?: boolean;
  displayName?: string;
  face?: "front" | "back";
};

export type LessonPdfRichTextSection = {
  kind: "rich-text";
  html: string;
  label?: string;
  inlineAssets?: LessonPdfAsset[];
};

export type LessonPdfVisualSection = {
  kind: "visual";
  assets: LessonPdfAsset[];
  layout?: string | null;
  width?: string | null;
  align?: string | null;
  captionHtml?: string | null;
};

export type LessonPdfExpandedItem = {
  id: string;
  order: number;
  title: string;
  contentHtml: string;
  secondaryHtml?: string | null;
  frontText?: string | null;
  frontType?: "text" | "image";
  backType?: "text" | "image";
  backTitle?: string | null;
  dateLabel?: string | null;
  accentColor?: string | null;
  transcriptHtml?: string | null;
  assets: LessonPdfAsset[];
};

export type LessonPdfExpandedItemsSection = {
  kind: "expanded-items";
  presentation: "accordion" | "flip-cards" | "slides" | "timeline" | "tabs" | "audio" | "image-grid" | "card-sort";
  items: LessonPdfExpandedItem[];
};

export type LessonPdfPoint = {
  id: string;
  order: number;
  label: string;
  title: string;
  contentHtml: string;
  x?: number;
  y?: number;
  yaw?: number;
  pitch?: number;
  media?: {
    type: "image" | "video" | "audio";
    fileName: string;
    durationSeconds?: number | null;
    transcriptHtml?: string | null;
  } | null;
};

export type LessonPdfInteractiveVisualSection = {
  kind: "interactive-visual";
  presentation: "point-of-interest" | "image-360" | "find-elements";
  poster: LessonPdfAsset | null;
  points: LessonPdfPoint[];
};

export type LessonPdfQuizAnswer = {
  id: string;
  textHtml: string;
  correct: boolean;
  creditPercent?: number | null;
  feedbackHtml?: string | null;
};

export type LessonPdfQuizQuestion = {
  id: string;
  order: number;
  mode: QuizQuestionMode;
  questionHtml: string;
  answers: LessonPdfQuizAnswer[];
  creditMode?: "default" | "equal" | "custom" | null;
  answerFeedbackLabel?: string;
  creditLabel?: string;
  generalFeedbackHtml?: string | null;
  feedbackCorrectHtml?: string | null;
  feedbackIncorrectHtml?: string | null;
  points: number;
};

export type LessonPdfQuizSection = {
  kind: "quiz";
  titleHtml: string;
  introHtml: string;
  settingsLabel: string;
  settings: Array<{ label: string; value: string }>;
  questions: LessonPdfQuizQuestion[];
  assistantNotice?: string;
};

export type LessonPdfStandaloneQuestionSection = {
  kind: "standalone-question";
  question: LessonPdfQuizQuestion;
  showCorrectAnswer: boolean;
  showFeedback: boolean;
};

export type LessonPdfMatchingSection = {
  kind: "matching";
  pairs: Array<{
    id: string;
    order: number;
    leftHtml: string;
    rightHtml: string;
  }>;
  successFeedbackHtml: string;
  failureFeedbackHtml: string;
};

export type LessonPdfSituationalDialogueResponse = {
  id: string;
  labelHtml: string;
  feedbackHtml?: string | null;
  action?: string | null;
};

export type LessonPdfSituationalDialogueNode = {
  id: string;
  order: number;
  title: string;
  contentHtml: string;
  characterName?: string | null;
  characterRole?: string | null;
  responses: LessonPdfSituationalDialogueResponse[];
  assets: LessonPdfAsset[];
};

export type LessonPdfSituationalDialogueSection = {
  kind: "situational-dialogue";
  nodes: LessonPdfSituationalDialogueNode[];
};

export type LessonPdfAttachmentSection = {
  kind: "attachments";
  files: Array<{
    id: string;
    displayName: string;
    extension: string;
    asset: LessonPdfAsset;
  }>;
};

export type LessonPdfHtmlDescriptionSection = {
  kind: "html-description";
  description: string | null;
  packageName?: string | null;
};

export type LessonPdfMarkerSection = {
  kind: "progress-marker";
  label: string;
};

export type LessonPdfDividerSection = {
  kind: "divider";
};

export type LessonPdfSectionMarkerSection = {
  kind: "section-marker";
  label: string;
  scheme: "arabic" | "roman" | "alpha";
};

export type LessonPdfFallbackSection = {
  kind: "fallback";
  activityLabel: string;
  reason: "missing-content" | "unsupported-content";
};

export type LessonPdfActivitySection =
  | LessonPdfRichTextSection
  | LessonPdfVisualSection
  | LessonPdfExpandedItemsSection
  | LessonPdfInteractiveVisualSection
  | LessonPdfQuizSection
  | LessonPdfStandaloneQuestionSection
  | LessonPdfMatchingSection
  | LessonPdfSituationalDialogueSection
  | LessonPdfAttachmentSection
  | LessonPdfHtmlDescriptionSection
  | LessonPdfMarkerSection
  | LessonPdfDividerSection
  | LessonPdfSectionMarkerSection
  | LessonPdfFallbackSection;

export type LessonPdfActivity = {
  id: string;
  number: number;
  heading: string;
  label: string;
  sourceType: string;
  renderMode: PdfActivityRenderMode;
  title: string;
  summary: string;
  imageAltStatuses: Array<"missing" | "filled" | "decorative">;
  style: {
    panelBackgroundColor?: string | null;
    panelBorderColor?: string | null;
    panelBorderWidth?: string | null;
    panelBorderStyle?: string | null;
    panelPadding?: string | null;
    panelRounded?: boolean | null;
    panelShadow?: boolean | null;
    noteIcon?: NoteIconId | null;
    noteShowIcon?: boolean | null;
    noteIconColor?: string | null;
    noteIconMatchesBorder?: boolean | null;
    flipCardFrontBackgroundColor?: string | null;
    flipCardBackBackgroundColor?: string | null;
    flipCardFrontBorderColor?: string | null;
    flipCardBackBorderColor?: string | null;
    sectionBackgroundColor?: string | null;
    sectionBackgroundImageRef?: string | null;
    buttonBackgroundColor?: string | null;
    buttonTextColor?: string | null;
    headerBackgroundColor?: string | null;
    headerTextColor?: string | null;
    headerHeight?: string | null;
    headerImagePositionY?: number | null;
    dividerColor?: string | null;
    dividerWidth?: string | null;
    dividerStyle?: string | null;
    markerType?: string | null;
    markerTextColor?: string | null;
  };
  sections: LessonPdfActivitySection[];
};

export type LessonPdfChapter = {
  id: string;
  order: number;
  title: string;
  activities: LessonPdfActivity[];
};

export type LessonPdfGlossaryEntry = {
  id: string;
  term: string;
  aliases: string[];
  contentHtml: string;
  related: string[];
};

export type LessonPdfAssistantAppendix = {
  id: string;
  name: string;
  avatar: LessonPdfAsset | null;
  entries: LessonPdfGlossaryEntry[];
};

export type LessonPdfDocumentModel = {
  profile?: "review" | "learner";
  generatedAt?: string;
  labels: LessonPdfLabels;
  contentTextColor: string;
  lessonId: string;
  lessonTitle: string;
  estimatedDurationSeconds: number;
  coverImage: LessonPdfAsset | null;
  chapterMenu: Array<{ id: string; order: number; title: string }>;
  chapters: LessonPdfChapter[];
  assistantAppendices: LessonPdfAssistantAppendix[];
};
