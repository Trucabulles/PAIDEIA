export const RICH_INLINE_IMAGE_MAX_SIZE = 300;

export type RichInlineImageWrap = "inline" | "left" | "right";

const RICH_INLINE_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const RICH_INLINE_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type RichInlineImageDimensions = {
  height: number;
  ratio: number;
  width: number;
};

export function validateRichInlineImageFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!RICH_INLINE_IMAGE_EXTENSIONS.has(extension) || (file.type && !RICH_INLINE_IMAGE_MIME_TYPES.has(file.type))) {
    throw new Error("Les images integrees au texte doivent etre au format JPG, JPEG, PNG ou WebP.");
  }
}

export function fitRichInlineImageDimensions(width: number, height: number): RichInlineImageDimensions {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const ratio = safeWidth / safeHeight;
  const scale = Math.min(1, RICH_INLINE_IMAGE_MAX_SIZE / Math.max(safeWidth, safeHeight));
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
    ratio
  };
}

export async function readRichInlineImageDimensions(file: File): Promise<RichInlineImageDimensions> {
  validateRichInlineImageFile(file);
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    try {
      return fitRichInlineImageDimensions(bitmap.width, bitmap.height);
    } finally {
      bitmap.close();
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("Impossible de lire les dimensions de cette image."));
      image.src = objectUrl;
    });
    return fitRichInlineImageDimensions(dimensions.width, dimensions.height);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
