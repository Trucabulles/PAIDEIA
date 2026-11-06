import type { CourseAppearance, PaideiaBlock } from "../types/project";
import { resolveContrastingTextColor } from "./textContrast";

export const DEFAULT_COURSE_APPEARANCE: CourseAppearance = {
  roundedCorners: true,
  shadows: true,
  textColorMode: "default",
  textColor: "#222222",
  backgroundColor: "#FFFFFF"
};

export function normalizeCourseTextColor(value?: string | null): string {
  const normalized = String(value ?? "").trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : DEFAULT_COURSE_APPEARANCE.textColor;
}

export function normalizeCourseBackgroundColor(value?: string | null): string {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "TRANSPARENT") {
    return "transparent";
  }
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : DEFAULT_COURSE_APPEARANCE.backgroundColor;
}

export function normalizeCourseAppearance(value?: CourseAppearance | null): CourseAppearance {
  return {
    roundedCorners: value?.roundedCorners !== false,
    shadows: value?.shadows !== false,
    textColorMode: value?.textColorMode === "custom" ? "custom" : "default",
    textColor: normalizeCourseTextColor(value?.textColor),
    backgroundColor: normalizeCourseBackgroundColor(value?.backgroundColor)
  };
}

export function resolvedCourseTextColor(value?: CourseAppearance | null): string {
  const appearance = normalizeCourseAppearance(value);
  if (appearance.textColorMode === "custom") {
    return appearance.textColor;
  }
  const preferred = DEFAULT_COURSE_APPEARANCE.textColor;
  return resolveContrastingTextColor(preferred, appearance.backgroundColor);
}

export function resolvedPdfTextColor(value?: CourseAppearance | null): string {
  const appearance = normalizeCourseAppearance(value);
  const preferred = appearance.textColorMode === "custom" ? appearance.textColor : DEFAULT_COURSE_APPEARANCE.textColor;
  return resolveContrastingTextColor(preferred, DEFAULT_COURSE_APPEARANCE.backgroundColor);
}

const ACTIVITY_PANEL_DEFAULTS: Record<string, { rounded: boolean; shadow: boolean }> = {
  audio: { rounded: true, shadow: true },
  accordion: { rounded: true, shadow: false },
  "flip-cards": { rounded: false, shadow: false },
  "image-360": { rounded: true, shadow: true },
  "links-resources": { rounded: false, shadow: true },
  note: { rounded: true, shadow: true },
  quote: { rounded: false, shadow: true },
  slides: { rounded: true, shadow: true },
  "situational-dialogue": { rounded: true, shadow: true },
  tabs: { rounded: true, shadow: true },
  timeline: { rounded: false, shadow: false },
  attachment: { rounded: true, shadow: true },
  "result-message": { rounded: false, shadow: true }
};

function inheritedPanelValue(
  block: PaideiaBlock,
  value: boolean | null | undefined,
  globalValue: boolean,
  key: "rounded" | "shadow"
): boolean {
  if (value == null) {
    return globalValue;
  }
  const defaults = ACTIVITY_PANEL_DEFAULTS[block.type];
  return defaults && value === defaults[key] ? globalValue : value;
}

export function resolveBlockCourseAppearance(
  block: PaideiaBlock,
  value?: CourseAppearance | null
): PaideiaBlock {
  const appearance = normalizeCourseAppearance(value);
  return {
    ...block,
    imageRounded: block.type === "image" && block.mediaLayout === "page-width"
      ? false
      : block.imageRounded ?? appearance.roundedCorners,
    panelRounded: inheritedPanelValue(block, block.panelRounded, appearance.roundedCorners, "rounded"),
    panelShadow: inheritedPanelValue(block, block.panelShadow, appearance.shadows, "shadow"),
    activityItems: (block.activityItems ?? []).map((item) => ({
      ...item,
      imageRounded: item.imageRounded ?? appearance.roundedCorners
    }))
  };
}
