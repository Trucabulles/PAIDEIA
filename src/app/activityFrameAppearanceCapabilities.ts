export type ActivityFrameAppearanceProperty =
  | "background-color"
  | "border-color"
  | "accent-color"
  | "border-width"
  | "border-style"
  | "rounded"
  | "shadow";

const FULL_FRAME_TYPES = ["note", "audio", "accordion", "tabs", "links-resources", "quote"] as const;

export const ACTIVITY_FRAME_APPEARANCE_TYPES: Record<ActivityFrameAppearanceProperty, readonly string[]> = {
  "background-color": [...FULL_FRAME_TYPES, "attachment", "matching", "slides"],
  "border-color": [...FULL_FRAME_TYPES, "attachment"],
  "accent-color": ["audio", "accordion", "tabs", "links-resources", "quote"],
  "border-width": [...FULL_FRAME_TYPES, "flip-cards"],
  "border-style": [...FULL_FRAME_TYPES, "flip-cards"],
  rounded: [...FULL_FRAME_TYPES, "attachment", "matching", "find-elements", "slides", "card-sort"],
  shadow: [...FULL_FRAME_TYPES, "find-elements", "slides", "situational-dialogue"]
};

export function supportsActivityFrameAppearance(blockType: string, property: ActivityFrameAppearanceProperty) {
  return ACTIVITY_FRAME_APPEARANCE_TYPES[property].includes(blockType);
}

export function activityAccentStorageProperty(blockType: string) {
  if (blockType === "audio" || blockType === "quote") return "buttonTextColor" as const;
  if (blockType === "links-resources") return "buttonBackgroundColor" as const;
  return "panelBorderColor" as const;
}
