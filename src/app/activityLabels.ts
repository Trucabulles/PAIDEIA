import { translate, translateActive, type AppLanguage } from "../i18n";

export const ACTIVITY_LABELS = {
  "rich-text": "activity.rich-text",
  list: "activity.list",
  quote: "activity.quote",
  note: "activity.note",
  header: "activity.header",
  image: "activity.image",
  "image-text": "activity.image-text",
  "image-grid": "activity.image-grid",
  "point-of-interest": "activity.point-of-interest",
  "find-elements": "activity.find-elements",
  accordion: "activity.accordion",
  "flip-cards": "activity.flip-cards",
  slides: "activity.slides",
  timeline: "activity.timeline",
  tabs: "activity.tabs",
  "image-360": "activity.image-360",
  quiz: "activity.quiz",
  "question-multiple": "activity.question-multiple",
  "question-unique": "activity.question-unique",
  "question-true-false": "activity.question-true-false",
  "question-random": "activity.question-random",
  complete: "activity.complete",
  "card-sort": "activity.card-sort",
  matching: "activity.matching",
  "result-message": "activity.result-message",
  "situational-dialogue": "activity.situational-dialogue",
  attachment: "activity.attachment",
  "links-resources": "activity.links-resources",
  media: "activity.media",
  audio: "activity.audio",
  "html-custom": "activity.html-custom",
  continue: "activity.continue",
  "course-exit": "activity.course-exit",
  divider: "activity.divider",
  "section-marker": "activity.section-marker",
  mcq: "activity.mcq",
  "html-fallback": "activity.html-fallback"
} as const;

export type KnownActivityType = keyof typeof ACTIVITY_LABELS;

export function activityLabel(blockType: string, language?: AppLanguage): string {
  const key = ACTIVITY_LABELS[blockType as KnownActivityType] ?? "activity.rich-text";
  return language ? translate(language, key) : translateActive(key);
}
