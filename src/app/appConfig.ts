import type { ChapterScormTracking } from "../types/project";

export const APP_VERSION = "1.1.26315";
export const APP_BUILD_COMMIT = import.meta.env.VITE_PAIDEIA_GIT_COMMIT || "indisponible";

export const PROJECT_TABS_KEY = "paideia.openProjectTabs";
export const AUTOSAVE_ENABLED_KEY = "paideia.autosave.enabled";
export const AUTOSAVE_MINUTES_KEY = "paideia.autosave.minutes";
export const INCREMENTAL_SAVE_ENABLED_KEY = "paideia.incrementalSave.enabled";
export const INCREMENTAL_SAVE_MINUTES_KEY = "paideia.incrementalSave.minutes";
export const INCREMENTAL_SAVE_COUNTERS_KEY = "paideia.incrementalSave.counters";
export const LIBRARY_ROOT_KEY = "paideia.libraryRoot";
export const CHROME_COMPACT_KEY = "paideia.chrome.compact";

export const COURSE_COVER_TITLE_INLINE_ID = "course-cover-title";
export const COURSE_COVER_TITLE_PLACEHOLDER = "Saisissez le titre de la leçon ici";
export const COURSE_INTRO_INLINE_ID = "course-intro";
export const COURSE_INTRO_PLACEHOLDER = "Saisissez votre texte ici";
export const HEADER_INLINE_PLACEHOLDER = "Saisissez votre titre ici";
export const USER_CHARACTER_DRAFT_ID = "__draft_user_character__";

export const SCORM_COMPLETION_TRACKING: ChapterScormTracking = {
  mode: "completion",
  successStatus: "completed",
  failureStatus: "incomplete"
};

export const SCORM_BLOCKING_TRACKING: ChapterScormTracking = {
  mode: "quiz-blocking",
  successStatus: "passed",
  failureStatus: "incomplete"
};

export const SCORM_CERTIFICATION_TRACKING: ChapterScormTracking = {
  mode: "quiz-certification",
  successStatus: "passed",
  failureStatus: "failed"
};

export const SCORM_ALLOWED_STATUS_PAIRS = new Set([
  "completed:incomplete",
  "completed:failed",
  "passed:incomplete",
  "passed:failed"
]);
