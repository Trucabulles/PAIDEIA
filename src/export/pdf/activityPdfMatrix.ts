import type { KnownActivityType } from "../../app/activityLabels";

export type PdfActivityRenderMode =
  | "course-layout"
  | "expanded-items"
  | "interactive-poster"
  | "assessment"
  | "documentary-fallback"
  | "progress-marker"
  | "section-marker"
  | "divider";

export type PdfActivityMatrixEntry = {
  mode: PdfActivityRenderMode;
  includeAllStates: boolean;
  includePrimaryVisual: boolean;
};

export const PDF_ACTIVITY_MATRIX = {
  "rich-text": { mode: "course-layout", includeAllStates: false, includePrimaryVisual: false },
  list: { mode: "course-layout", includeAllStates: false, includePrimaryVisual: false },
  quote: { mode: "course-layout", includeAllStates: false, includePrimaryVisual: true },
  note: { mode: "course-layout", includeAllStates: false, includePrimaryVisual: false },
  header: { mode: "course-layout", includeAllStates: false, includePrimaryVisual: true },
  image: { mode: "course-layout", includeAllStates: false, includePrimaryVisual: true },
  "image-text": { mode: "course-layout", includeAllStates: false, includePrimaryVisual: true },
  "image-grid": { mode: "expanded-items", includeAllStates: true, includePrimaryVisual: true },
  "point-of-interest": { mode: "interactive-poster", includeAllStates: true, includePrimaryVisual: true },
  "find-elements": { mode: "interactive-poster", includeAllStates: true, includePrimaryVisual: true },
  accordion: { mode: "expanded-items", includeAllStates: true, includePrimaryVisual: true },
  "flip-cards": { mode: "expanded-items", includeAllStates: true, includePrimaryVisual: true },
  slides: { mode: "expanded-items", includeAllStates: true, includePrimaryVisual: true },
  timeline: { mode: "expanded-items", includeAllStates: true, includePrimaryVisual: true },
  tabs: { mode: "expanded-items", includeAllStates: true, includePrimaryVisual: true },
  "image-360": { mode: "interactive-poster", includeAllStates: true, includePrimaryVisual: true },
  quiz: { mode: "assessment", includeAllStates: true, includePrimaryVisual: false },
  "question-multiple": { mode: "assessment", includeAllStates: true, includePrimaryVisual: false },
  "question-unique": { mode: "assessment", includeAllStates: true, includePrimaryVisual: false },
  "question-true-false": { mode: "assessment", includeAllStates: true, includePrimaryVisual: false },
  "question-random": { mode: "assessment", includeAllStates: true, includePrimaryVisual: false },
  complete: { mode: "assessment", includeAllStates: true, includePrimaryVisual: true },
  "card-sort": { mode: "assessment", includeAllStates: true, includePrimaryVisual: true },
  matching: { mode: "assessment", includeAllStates: true, includePrimaryVisual: false },
  "result-message": { mode: "course-layout", includeAllStates: true, includePrimaryVisual: false },
  "situational-dialogue": { mode: "expanded-items", includeAllStates: true, includePrimaryVisual: true },
  attachment: { mode: "documentary-fallback", includeAllStates: true, includePrimaryVisual: false },
  "links-resources": { mode: "documentary-fallback", includeAllStates: true, includePrimaryVisual: false },
  media: { mode: "interactive-poster", includeAllStates: false, includePrimaryVisual: true },
  audio: { mode: "documentary-fallback", includeAllStates: true, includePrimaryVisual: false },
  "html-custom": { mode: "documentary-fallback", includeAllStates: false, includePrimaryVisual: true },
  continue: { mode: "progress-marker", includeAllStates: false, includePrimaryVisual: false },
  "course-exit": { mode: "progress-marker", includeAllStates: false, includePrimaryVisual: false },
  divider: { mode: "divider", includeAllStates: false, includePrimaryVisual: false },
  "section-marker": { mode: "section-marker", includeAllStates: false, includePrimaryVisual: false },
  mcq: { mode: "assessment", includeAllStates: true, includePrimaryVisual: false },
  "html-fallback": { mode: "documentary-fallback", includeAllStates: false, includePrimaryVisual: true }
} satisfies Record<KnownActivityType, PdfActivityMatrixEntry>;

export function pdfActivityMatrixEntry(blockType: string): PdfActivityMatrixEntry {
  return PDF_ACTIVITY_MATRIX[blockType as KnownActivityType] ?? {
    mode: "documentary-fallback",
    includeAllStates: false,
    includePrimaryVisual: false
  };
}
