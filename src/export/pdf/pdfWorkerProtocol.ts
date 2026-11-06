import type { LessonPdfDocumentModel } from "./lessonPdfModel";

export type PdfGenerationPhase = "fonts" | "assets" | "document" | "finalizing";

export type LessonPdfWorkerRequest = {
  model: LessonPdfDocumentModel;
  assets: Record<string, string>;
  fonts: ArrayBuffer[];
};

export type LessonPdfWorkerProgress = {
  kind: "progress";
  phase: PdfGenerationPhase;
};

export type LessonPdfWorkerSuccess = {
  kind: "success";
  pdf: ArrayBuffer;
};

export type LessonPdfWorkerFailure = {
  kind: "failure";
  message: string;
};

export type LessonPdfWorkerResponse =
  | LessonPdfWorkerProgress
  | LessonPdfWorkerSuccess
  | LessonPdfWorkerFailure;
