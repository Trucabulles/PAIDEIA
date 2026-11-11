export const ACTIVITY_BACKGROUND_BLOCK_TYPES = [
  "situational-dialogue",
  "image-text",
  "image-grid",
  "point-of-interest",
  "find-elements",
  "complete",
  "card-sort",
  "matching",
  "media",
  "slides",
  "rich-text",
  "tabs",
  "flip-cards",
  "divider",
  "section-marker",
  "quote",
  "note",
  "image",
  "accordion",
  "timeline",
  "result-message",
  "attachment",
  "links-resources",
  "audio",
  "continue",
  "course-exit",
  "quiz",
  "question-multiple",
  "question-unique",
  "question-true-false",
  "question-random",
  "html-custom",
  "image-360"
] as const;

// Build contract: every catalog activity must occur either above, in this
// special-purpose list, or in the explicit no-appearance list. A new activity
// with an Appearance section therefore cannot silently bypass Arion.
export const ARION_SPECIAL_APPEARANCE_BLOCK_TYPES = ["header"] as const;
export const REVIEWED_WITHOUT_ACTIVITY_APPEARANCE_BLOCK_TYPES = ["list", "mcq", "html-fallback"] as const;

export type ActivityBackgroundBlockType = typeof ACTIVITY_BACKGROUND_BLOCK_TYPES[number];
export type ActivityBackgroundProperty = "color" | "image" | "overlay" | "blur" | "wide" | "rounded" | "height";

const ACTIVITY_BACKGROUND_BLOCK_TYPE_SET = new Set<string>(ACTIVITY_BACKGROUND_BLOCK_TYPES);
const ACTIVITY_BACKGROUND_WITHOUT_HEIGHT = new Set<string>(["situational-dialogue"]);
const ACTIVITY_BACKGROUND_ALWAYS_WIDE = new Set<string>(["divider", "section-marker"]);
const ACTIVITY_BACKGROUND_WITHOUT_IMAGE = new Set<string>(["image"]);

export function supportsActivityBackground(blockType: string): blockType is ActivityBackgroundBlockType {
  return ACTIVITY_BACKGROUND_BLOCK_TYPE_SET.has(blockType);
}

export function supportsActivityBackgroundProperty(blockType: string, property: ActivityBackgroundProperty) {
  if (!supportsActivityBackground(blockType)) {
    return false;
  }
  if (property === "height") {
    return !ACTIVITY_BACKGROUND_WITHOUT_HEIGHT.has(blockType);
  }
  if (["image", "overlay", "blur"].includes(property)) {
    return !ACTIVITY_BACKGROUND_WITHOUT_IMAGE.has(blockType);
  }
  return true;
}

export function activityBackgroundWideDefault(blockType: string) {
  return blockType !== "situational-dialogue" && supportsActivityBackground(blockType);
}

export function isActivityBackgroundAlwaysWide(blockType: string) {
  return ACTIVITY_BACKGROUND_ALWAYS_WIDE.has(blockType);
}
