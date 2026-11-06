import type { CSSProperties } from "react";
import type { ActivityItem, ImageCrop } from "../types/project";
import { translateActive } from "../i18n";

export const IMAGE_ASSET_EXTENSIONS = new Set(["gif", "jpg", "jpeg", "png", "webp"]);
export const VIDEO_ASSET_EXTENSIONS = new Set(["mp4", "webm", "ogg"]);
export const AUDIO_ASSET_EXTENSIONS = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac"]);

export const IMAGE_FILE_ACCEPT = ".gif,.jpg,.jpeg,.png,.webp,image/gif,image/jpeg,image/png,image/webp";
export const VIDEO_FILE_ACCEPT = ".mp4,.webm,.ogg,video/mp4,video/webm,video/ogg";
export const AUDIO_FILE_ACCEPT = ".mp3,.wav,.ogg,.m4a,.aac,.flac,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/flac";
export const SUBTITLE_FILE_ACCEPT = ".srt,.vtt,text/vtt,text/plain,text/srt,application/x-subrip";

export async function validateActivityImageFile(file: File): Promise<void> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const message = translateActive("image.importAllowedFormats");
  if (!IMAGE_ASSET_EXTENSIONS.has(extension)) throw new Error(message);
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const startsWith = (signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const valid = extension === "png" ? startsWith([137, 80, 78, 71, 13, 10, 26, 10])
    : extension === "jpg" || extension === "jpeg" ? startsWith([255, 216, 255])
    : extension === "gif" ? startsWith([71, 73, 70, 56, 55, 97]) || startsWith([71, 73, 70, 56, 57, 97])
    : startsWith([82, 73, 70, 70]) && bytes.length >= 12 && [87, 69, 66, 80].every((value, index) => bytes[index + 8] === value);
  if (!valid) throw new Error(message);
}

export function clampPercent(value: number) {
  if (Number.isNaN(value)) {
    return 50;
  }
  return Math.max(0, Math.min(100, value));
}

function clampCropDimension(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

export function normalizeImageCrop(crop?: ImageCrop | null): ImageCrop | null {
  if (!crop) {
    return null;
  }

  const x = clampPercent(crop.x);
  const y = clampPercent(crop.y);
  const width = clampCropDimension(crop.width);
  const height = clampCropDimension(crop.height);
  if (width <= 0.5 || height <= 0.5) {
    return null;
  }

  return {
    x,
    y,
    width: Math.min(width, 100 - x),
    height: Math.min(height, 100 - y),
    shape: crop.shape === "ellipse" ? "ellipse" : "rectangle"
  };
}

export function shouldRenderImageCrop(crop?: ImageCrop | null) {
  const normalized = normalizeImageCrop(crop);
  return Boolean(
    normalized &&
      (normalized.shape === "ellipse" ||
        normalized.width < 99.5 ||
        normalized.height < 99.5 ||
        normalized.x > 0.5 ||
        normalized.y > 0.5)
  );
}

export function cropImageStyle(crop?: ImageCrop | null): CSSProperties | undefined {
  const normalized = normalizeImageCrop(crop);
  if (!normalized) {
    return undefined;
  }

  return {
    width: `${10000 / normalized.width}%`,
    height: `${10000 / normalized.height}%`,
    left: `-${(normalized.x * 100) / normalized.width}%`,
    top: `-${(normalized.y * 100) / normalized.height}%`
  };
}

export function croppedImageFileName(fileName: string) {
  const cleanName = fileName.trim() || "image.png";
  const extensionIndex = cleanName.lastIndexOf(".");
  const cropSuffix = `_cropped_${Date.now()}`;
  if (extensionIndex <= 0) {
    return `${cleanName.replace(/_cropped(?:_\d+)?$/i, "")}${cropSuffix}.png`;
  }

  const baseName = cleanName.slice(0, extensionIndex).replace(/_cropped(?:_\d+)?$/i, "");
  return `${baseName}${cropSuffix}${cleanName.slice(extensionIndex)}`;
}

export function ellipticalCroppedImageFileName(fileName: string) {
  const rectangularName = croppedImageFileName(fileName);
  const extensionIndex = rectangularName.lastIndexOf(".");
  const baseName = extensionIndex > 0 ? rectangularName.slice(0, extensionIndex) : rectangularName;
  return `${baseName}.png`;
}

export function getAssetExtension(assetRef?: string | null) {
  return assetRef?.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
}

export function imageMimeTypeFromName(fileName: string) {
  const extension = getAssetExtension(fileName);
  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }
  if (extension === "webp") {
    return "image/webp";
  }
  return "image/png";
}

export function assetDisplayName(assetRef?: string | null) {
  if (!assetRef) {
    return "";
  }
  const normalized = assetRef.replace(/\\/g, "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

export function fileNameWithoutExtension(fileName: string) {
  const normalized = fileName.replace(/\\/g, "/").split("/").pop() ?? fileName;
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex > 0 ? normalized.slice(0, dotIndex) : normalized;
}

function decodeSynchsafeInteger(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

function decodeId3TextFrame(bytes: Uint8Array) {
  if (!bytes.length) {
    return "";
  }
  const encoding = bytes[0];
  const content = bytes.slice(1);
  try {
    if (encoding === 1 || encoding === 2) {
      return new TextDecoder("utf-16").decode(content).replace(/\0/g, "").trim();
    }
    if (encoding === 3) {
      return new TextDecoder("utf-8").decode(content).replace(/\0/g, "").trim();
    }
    return new TextDecoder("iso-8859-1").decode(content).replace(/\0/g, "").trim();
  } catch {
    return "";
  }
}

async function readAudioTitleMetadata(file: File) {
  if (!file.type.startsWith("audio/") && !AUDIO_ASSET_EXTENSIONS.has(file.name.split(".").pop()?.toLowerCase() ?? "")) {
    return "";
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 20 || new TextDecoder("ascii").decode(bytes.slice(0, 3)) !== "ID3") {
    return "";
  }

  const version = bytes[3];
  const tagEnd = Math.min(bytes.length, 10 + decodeSynchsafeInteger(bytes, 6));
  let offset = 10;
  while (offset + 10 <= tagEnd) {
    const frameId = new TextDecoder("ascii").decode(bytes.slice(offset, offset + 4));
    if (!frameId.trim() || /^\0+$/.test(frameId)) {
      break;
    }
    const frameSize = version === 4
      ? decodeSynchsafeInteger(bytes, offset + 4)
      : ((bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7]);
    const frameDataStart = offset + 10;
    const frameDataEnd = Math.min(tagEnd, frameDataStart + frameSize);
    if (frameId === "TIT2") {
      return decodeId3TextFrame(bytes.slice(frameDataStart, frameDataEnd));
    }
    if (frameSize <= 0) {
      break;
    }
    offset = frameDataEnd;
  }
  return "";
}

export async function inferAudioTrackTitle(file: File) {
  const metadataTitle = await readAudioTitleMetadata(file);
  return metadataTitle || fileNameWithoutExtension(file.name);
}

export function firstItemImageAssetRef(item: ActivityItem | null | undefined) {
  return item?.assetRefs?.find((assetRef) => IMAGE_ASSET_EXTENSIONS.has(getAssetExtension(assetRef))) ?? null;
}

export function itemImageAssetRefs(item: ActivityItem | null | undefined) {
  return item?.assetRefs?.filter((assetRef) => IMAGE_ASSET_EXTENSIONS.has(getAssetExtension(assetRef))) ?? [];
}

export function firstItemAudioAssetRef(item: ActivityItem | null | undefined) {
  return item?.assetRefs?.find((assetRef) => AUDIO_ASSET_EXTENSIONS.has(getAssetExtension(assetRef))) ?? null;
}

export function isSupportedImageAsset(assetRef?: string | null) {
  return IMAGE_ASSET_EXTENSIONS.has(getAssetExtension(assetRef));
}

export function isSupportedVideoAsset(assetRef?: string | null) {
  return VIDEO_ASSET_EXTENSIONS.has(getAssetExtension(assetRef));
}

export function isSupportedAudioAsset(assetRef?: string | null) {
  return AUDIO_ASSET_EXTENSIONS.has(getAssetExtension(assetRef));
}

export function getAssetPickerAccept(assetKind: "image" | "video" | "audio" | "subtitle") {
  switch (assetKind) {
    case "video": return VIDEO_FILE_ACCEPT;
    case "audio": return AUDIO_FILE_ACCEPT;
    case "subtitle": return SUBTITLE_FILE_ACCEPT;
    case "image":
    default: return IMAGE_FILE_ACCEPT;
  }
}

export function firstAssetRef(assetRefs: string[] | undefined, predicate: (assetRef?: string | null) => boolean) {
  return assetRefs?.find((assetRef) => predicate(assetRef)) ?? null;
}
