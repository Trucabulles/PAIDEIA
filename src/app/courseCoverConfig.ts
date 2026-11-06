import type { CSSProperties } from "react";
import type { CourseCoverStyle, PaideiaProject } from "../types/project";

export type CourseTitleStyle = {
  fontFamily: string;
  fontSize: string;
  color: string;
  fontWeight: string;
  fontStyle: string;
};

export const DEFAULT_COURSE_TITLE_STYLE: CourseTitleStyle = {
  fontFamily: "\"Segoe UI\", \"Helvetica Neue\", sans-serif",
  fontSize: "45px",
  color: "#ffffff",
  fontWeight: "bold",
  fontStyle: "normal"
};

export const DEFAULT_COURSE_COVER_STYLE: CourseCoverStyle = {
  heightPx: 400,
  backgroundPositionY: 50,
  backgroundColor: "#123a7a",
  titleColor: "#ffffff",
  titlePosition: "left-bottom",
  titleAlign: "left",
  overlayEnabled: true,
  overlayColor: "#123a7a",
  overlayOpacity: 0.92,
  overlayPosition: "left",
  overlaySpread: "normal",
  buttonPosition: "under-title",
  titleOutline: "none",
  titleOutlineColor: "dark"
};

export const COURSE_COVER_HEIGHT_PRESETS = [300, 400, 500] as const;

export function clampCourseCoverHeight(value?: number | null): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_COURSE_COVER_STYLE.heightPx;
  }

  return COURSE_COVER_HEIGHT_PRESETS.reduce((closest, current) =>
    Math.abs(current - Number(value)) < Math.abs(closest - Number(value)) ? current : closest
  );
}

export function clampCourseCoverBackgroundPositionY(value?: number | null): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_COURSE_COVER_STYLE.backgroundPositionY ?? 50;
  }
  return Math.max(0, Math.min(100, Number(value)));
}

export function normalizeCssHexColor(value: string | null | undefined, fallback: string): string {
  const nextValue = value?.trim() ?? "";
  return /^#[0-9a-fA-F]{6}$/.test(nextValue) ? nextValue : fallback;
}

function normalizeOverlayColor(value?: string | null): string {
  if (value?.trim().toLowerCase() === "transparent") {
    return "transparent";
  }
  return normalizeCssHexColor(value, DEFAULT_COURSE_COVER_STYLE.overlayColor ?? "#123a7a");
}

export function normalizeCourseCoverTitlePosition(value?: string | null): NonNullable<CourseCoverStyle["titlePosition"]> {
  return value === "center" || value === "center-bottom" || value === "right-bottom" ? value : "left-bottom";
}

export function normalizeCourseCoverOverlayPosition(value?: string | null): NonNullable<CourseCoverStyle["overlayPosition"]> {
  return value === "center" || value === "right" || value === "full" ? value : "left";
}

export function normalizeCourseCoverOverlaySpread(value?: string | null): NonNullable<CourseCoverStyle["overlaySpread"]> {
  return value === "compact" || value === "wide" ? value : "normal";
}

export function normalizeCourseCoverTitleOutline(value?: string | null): NonNullable<CourseCoverStyle["titleOutline"]> {
  return value === "thin" || value === "medium" || value === "thick" ? value : "none";
}

export function normalizeCourseCoverTitleOutlineColor(value?: string | null): NonNullable<CourseCoverStyle["titleOutlineColor"]> {
  return value === "light" ? "light" : "dark";
}

export function courseCoverTitleAlignForPosition(position: NonNullable<CourseCoverStyle["titlePosition"]>): NonNullable<CourseCoverStyle["titleAlign"]> {
  if (position === "center" || position === "center-bottom") {
    return "center";
  }
  if (position === "right-bottom") {
    return "right";
  }
  return "left";
}

export function courseCoverButtonPositionForTitlePosition(position: NonNullable<CourseCoverStyle["titlePosition"]>): NonNullable<CourseCoverStyle["buttonPosition"]> {
  if (position === "center" || position === "center-bottom") {
    return "center-bottom";
  }
  if (position === "right-bottom") {
    return "right-bottom";
  }
  return "under-title";
}

export function clampCourseCoverOverlayOpacity(value?: number | null): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_COURSE_COVER_STYLE.overlayOpacity ?? 0.92;
  }
  return Math.max(0, Math.min(1, Number(value)));
}

export function clampCourseCoverOverlayOpacityPercent(value?: number | null): number {
  if (!Number.isFinite(value)) {
    return Math.round((DEFAULT_COURSE_COVER_STYLE.overlayOpacity ?? 0.92) * 100);
  }

  return Math.max(0, Math.min(100, Math.round(Number(value))));
}

function hexToRgbTriplet(value: string): string {
  const normalized = normalizeCssHexColor(value, DEFAULT_COURSE_COVER_STYLE.overlayColor ?? "#123a7a").slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
}

export function normalizeCourseCoverStyle(style?: CourseCoverStyle | null): CourseCoverStyle {
  const titlePosition = normalizeCourseCoverTitlePosition(style?.titlePosition);
  const overlayOpacity = style?.overlayEnabled === false
    ? 0
    : clampCourseCoverOverlayOpacity(style?.overlayOpacity);
  return {
    heightPx: clampCourseCoverHeight(style?.heightPx),
    backgroundPositionY: clampCourseCoverBackgroundPositionY(style?.backgroundPositionY),
    backgroundColor: normalizeCssHexColor(style?.backgroundColor, DEFAULT_COURSE_COVER_STYLE.backgroundColor),
    titleColor: normalizeCssHexColor(style?.titleColor, DEFAULT_COURSE_COVER_STYLE.titleColor),
    titlePosition,
    titleAlign: courseCoverTitleAlignForPosition(titlePosition),
    overlayEnabled: overlayOpacity > 0,
    overlayColor: normalizeOverlayColor(style?.overlayColor),
    overlayOpacity,
    overlayPosition: normalizeCourseCoverOverlayPosition(style?.overlayPosition),
    overlaySpread: normalizeCourseCoverOverlaySpread(style?.overlaySpread),
    buttonPosition: courseCoverButtonPositionForTitlePosition(titlePosition),
    titleOutline: normalizeCourseCoverTitleOutline(style?.titleOutline),
    titleOutlineColor: normalizeCourseCoverTitleOutlineColor(style?.titleOutlineColor)
  };
}

export function courseCoverCssVars(project?: PaideiaProject | null): CSSProperties {
  const style = normalizeCourseCoverStyle(project?.courseCoverStyle);
  const overlayOpacity = style.overlayEnabled && style.overlayColor !== "transparent"
    ? clampCourseCoverOverlayOpacity(style.overlayOpacity)
    : 0;
  const overlaySpread = style.overlayPosition === "center"
    ? style.overlaySpread === "compact"
      ? "18%"
      : style.overlaySpread === "wide"
        ? "30%"
        : "24%"
    : style.overlaySpread === "compact"
      ? "24%"
      : style.overlaySpread === "wide"
        ? "44%"
        : "34%";
  const overlayAngle = style.overlayPosition === "right" ? "270deg" : "90deg";
  const overlayWidth = style.overlayPosition === "center" ? "100%" : overlaySpread;
  return {
    "--course-cover-height": `${style.heightPx}px`,
    "--course-cover-position-y": `${style.backgroundPositionY ?? 50}%`,
    "--course-cover-bg": style.backgroundColor,
    "--course-cover-title-color": style.titleColor,
    "--course-cover-overlay-rgb": hexToRgbTriplet(style.overlayColor ?? DEFAULT_COURSE_COVER_STYLE.overlayColor ?? "#123a7a"),
    "--course-cover-overlay-opacity": `${overlayOpacity}`,
    "--course-cover-overlay-mid-opacity": `${Math.max(0, overlayOpacity * 0.66).toFixed(2)}`,
    "--course-cover-overlay-soft-opacity": `${Math.max(0, overlayOpacity * 0.25).toFixed(2)}`,
    "--course-cover-overlay-width": overlayWidth,
    "--course-cover-overlay-angle": overlayAngle,
    "--course-cover-title-outline-width": style.titleOutline === "thin"
      ? "1px"
      : style.titleOutline === "medium"
        ? "2px"
        : style.titleOutline === "thick"
          ? "3px"
          : "0px",
    "--course-cover-title-outline-color": style.titleOutlineColor === "light" ? "#ffffff" : "#222222"
  } as CSSProperties;
}
