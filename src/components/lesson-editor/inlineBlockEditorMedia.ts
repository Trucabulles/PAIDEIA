import type { CSSProperties } from "react";
import { normalizeImageCrop } from "../../app/mediaAssets";
import type { ImageCrop } from "../../types/project";

const IMAGE_SIZE_TOKENS = ["small", "medium", "large"] as const;

export function normalizeImageSizeToken(value?: string | null) {
  const raw = value?.trim().toLowerCase() ?? "";
  if (IMAGE_SIZE_TOKENS.includes(raw as (typeof IMAGE_SIZE_TOKENS)[number])) {
    return raw as (typeof IMAGE_SIZE_TOKENS)[number];
  }

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    return "medium";
  }

  if (parsed <= 37.5) {
    return "small";
  }

  if (parsed <= 62.5) {
    return "medium";
  }

  return "large";
}

export function imageSizeToPercent(sizeToken?: string | null) {
  switch (normalizeImageSizeToken(sizeToken)) {
    case "small":
      return 40;
    case "large":
      return 60;
    case "medium":
    default:
      return 50;
  }
}

type InlineBlockEditorMediaInput = {
  blockType: string;
  draftImageCrop: ImageCrop | null;
  imageAsset: string | null;
  imageCrop: ImageCrop | null;
  imageSize?: string | null;
  isCropMode: boolean;
  mediaLayout: string;
};

export function deriveInlineBlockEditorMedia({
  blockType,
  draftImageCrop,
  imageAsset,
  imageCrop,
  imageSize,
  isCropMode,
  mediaLayout
}: InlineBlockEditorMediaInput) {
  const inlineImageEditingEnabled = ["image", "image-text", "quote"].includes(blockType);
  const editorMediaLayout = blockType === "quote"
    ? ["image-left", "image-right", "image-center"].includes(mediaLayout)
      ? mediaLayout
      : "image-left"
    : blockType === "image-text" && mediaLayout === "image-full"
      ? "image-center"
      : blockType === "image" && !["image-center", "image-full", "page-width"].includes(mediaLayout)
        ? "image-center"
        : mediaLayout;

  return {
    cropPreviewActive: Boolean(isCropMode && inlineImageEditingEnabled && imageAsset),
    editorImageLayoutStyle: {
      "--image-size": `${imageSizeToPercent(imageSize)}%`
    } as CSSProperties,
    editorMediaLayout,
    inlineImageEditingEnabled,
    liveEditorCrop: normalizeImageCrop(draftImageCrop ?? imageCrop) ?? null
  };
}
