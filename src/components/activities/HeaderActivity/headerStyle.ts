import type { CSSProperties } from "react";
import { DEFAULT_DARK_TEXT_COLOR, DEFAULT_LIGHT_TEXT_COLOR, resolveContrastingTextColor } from "../../../app/textContrast";

export function headerBannerStyle(
  blockLike: {
    assetRefs?: string[];
    family?: string | null;
    variant?: string | null;
    sourceFormat?: string | null;
    headerBackgroundColor?: string | null;
    headerTextColor?: string | null;
    headerTextOutline?: "none" | "thin" | "medium" | "thick" | null;
    headerTextOutlineColor?: "light" | "dark" | null;
    headerHeight?: string | null;
    headerImagePositionY?: number | null;
    paddingOffset?: number | null;
    sectionBackgroundBlur?: number | null;
    sectionBackgroundOpacity?: number | null;
    sectionBackgroundOverlayDark?: boolean | null;
  },
  resolveImageAsset: (assetRefs?: string[]) => string | null
): CSSProperties {
  const imageAsset = resolveImageAsset(blockLike.assetRefs);
  const hasImage = Boolean(imageAsset);
  const importedRiseImageHeader = hasImage && blockLike.sourceFormat === "rise-scorm";
  const configuredTextColor = blockLike.headerTextColor?.trim() || null;
  const preferredTextColor = importedRiseImageHeader && configuredTextColor?.toUpperCase() === "#102752"
    ? DEFAULT_LIGHT_TEXT_COLOR
    : configuredTextColor ?? (hasImage ? DEFAULT_LIGHT_TEXT_COLOR : DEFAULT_DARK_TEXT_COLOR);
  const backgroundPositionY = Number.isFinite(blockLike.headerImagePositionY)
    ? Math.min(100, Math.max(0, Number(blockLike.headerImagePositionY)))
    : 50;
  const legacyMinimumHeight = blockLike.family === "image" && blockLike.variant === "text overlay"
    ? "240px"
    : blockLike.paddingOffset == null ? "240px" : "70px";
  return {
    minHeight: blockLike.headerHeight ?? legacyMinimumHeight,
    height: "auto",
    boxSizing: "border-box",
    color: hasImage
      ? preferredTextColor
      : resolveContrastingTextColor(preferredTextColor, blockLike.headerBackgroundColor ?? "#d7eef0"),
    backgroundColor: hasImage ? "transparent" : blockLike.headerBackgroundColor ?? "#d7eef0",
    "--header-background-image": imageAsset ? `url("${imageAsset}")` : "none",
    "--header-height": blockLike.headerHeight ?? legacyMinimumHeight,
    "--header-background-position-y": `${backgroundPositionY}%`,
    "--header-background-blur": `${Math.max(0, blockLike.sectionBackgroundBlur ?? 0)}px`,
    "--header-background-overlay": String(
      Math.max(0, Math.min(1, 1 - (blockLike.sectionBackgroundOpacity ?? 1)))
    ),
    "--header-background-overlay-color": blockLike.sectionBackgroundOverlayDark !== false ? "0, 0, 0" : "255, 255, 255",
    "--header-text-outline-width": blockLike.headerTextOutline === "thin"
      ? "1px"
      : blockLike.headerTextOutline === "medium"
        ? "2px"
        : blockLike.headerTextOutline === "thick"
          ? "3px"
          : "0px",
    "--header-text-outline-color": blockLike.headerTextOutlineColor === "light" ? "#ffffff" : "#222222"
  } as CSSProperties;
}
