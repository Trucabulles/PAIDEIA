import type { NativeImageAnnotation, NativeImageAnnotationDocument, NativeImageAnnotationPoint } from "../../../types/project";

type FlattenNativeImageAnnotationsOptions = {
  document: NativeImageAnnotationDocument;
  imageElement?: HTMLImageElement | null;
  imageSrc: string;
  mimeType?: string;
  quality?: number;
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function rgba(hex: string, opacity: number) {
  const normalized = hex.replace("#", "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized;
  if (expanded.length !== 6) {
    return hex;
  }
  if (opacity >= 100) {
    return `#${expanded}`;
  }
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(100, opacity)) / 100})`;
}

function bounds(annotation: NativeImageAnnotation) {
  if (annotation.kind === "path") {
    const xs = annotation.points.map((point: NativeImageAnnotationPoint) => point.x);
    const ys = annotation.points.map((point: NativeImageAnnotationPoint) => point.y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };
  }

  if (annotation.kind === "line") {
    return {
      x: Math.min(annotation.x1, annotation.x2),
      y: Math.min(annotation.y1, annotation.y2),
      width: Math.abs(annotation.x2 - annotation.x1),
      height: Math.abs(annotation.y2 - annotation.y1)
    };
  }

  return {
    x: annotation.x,
    y: annotation.y,
    width: annotation.width,
    height: annotation.height
  };
}

function pxX(percent: number, width: number) {
  return (clampPercent(percent) / 100) * width;
}

function pxY(percent: number, height: number) {
  return (clampPercent(percent) / 100) * height;
}

const MAX_BLUR_LEVEL = 10;
const BLUR_EDGE_PADDING_PX = 150;

function blurLevel(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.min(MAX_BLUR_LEVEL, Math.round(value)));
}

function strokeWidthPx(width: number, styleScale: number) {
  return Math.max(1, width * styleScale);
}

function loadHtmlImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Impossible de charger l'image à annoter."));
    image.src = src;
  });
}

async function loadOriginCleanImage(src: string) {
  let objectUrl = "";
  try {
    const response = await fetch(src);
    if (!response.ok) {
      throw new Error(`Image annotation fetch failed: ${response.status}`);
    }
    const blob = await response.blob();
    objectUrl = URL.createObjectURL(blob);
    const image = await loadHtmlImage(objectUrl);
    return {
      image,
      cleanup: () => URL.revokeObjectURL(objectUrl)
    };
  } catch {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
    const image = await loadHtmlImage(src);
    return {
      image,
      cleanup: () => undefined
    };
  }
}

function drawIconPath(
  context: CanvasRenderingContext2D,
  iconType: "arrow" | "arrow2" | "arrow3" | "star" | "position" | "bubble",
  x: number,
  y: number,
  width: number,
  height: number,
  rotation = 0,
  flipX = false,
  flipY = false
) {
  const path = new Path2D(
    iconType === "arrow"
      ? "M2.5 11.5v9h18v5.293L30.293 16 20.5 6.207V11.5h-18z"
      : iconType === "arrow2"
        ? "M21.793 18.5H2.5v-5h18.935l-7.6-8h5.872l10.5 10.5-10.5 10.5h-5.914l8-8z"
        : iconType === "arrow3"
          ? "M25.288 16.42L14.208 27.5H6.792l11.291-11.291L6.826 4.5h7.381l11.661 11.661-.58.258z"
          : iconType === "star"
            ? "M25.292 29.878l-1.775-10.346 7.517-7.327-10.388-1.51L16 1.282l-4.646 9.413-10.388 1.51 7.517 7.327-1.775 10.346L16 24.993l9.292 4.885z"
            : iconType === "position"
              ? "M16 31.28C23.675 23.302 27.5 17.181 27.5 13c0-6.351-5.149-11.5-11.5-11.5S4.5 6.649 4.5 13c0 4.181 3.825 10.302 11.5 18.28zM16 17.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z"
              : "M22.207 24.5L16.5 30.207V24.5H8A6.5 6.5 0 0 1 1.5 18V9A6.5 6.5 0 0 1 8 2.5h16A6.5 6.5 0 0 1 30.5 9v9a6.5 6.5 0 0 1-6.5 6.5h-1.793z"
  );
  context.save();
  const ratio = { width: 32, height: 32 };
  const ratioValue = ratio.width / ratio.height;
  const boundsRatio = height > 0 ? width / height : ratioValue;
  const iconWidth = boundsRatio > ratioValue ? height * ratioValue : width;
  const iconHeight = boundsRatio > ratioValue ? height : width / ratioValue;
  context.translate(x + width / 2, y + height / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  context.translate(-iconWidth / 2, -iconHeight / 2);
  context.scale(iconWidth / 32, iconHeight / 32);
  if (iconType === "position") {
    context.fill(path, "evenodd");
  } else {
    context.fill(path);
  }
  context.restore();
}

function drawShapePath(
  context: CanvasRenderingContext2D,
  annotation: Extract<NativeImageAnnotation, { kind: "rect" | "ellipse" }>,
  x: number,
  y: number,
  w: number,
  h: number
) {
  context.beginPath();
  if (annotation.kind === "rect") {
    context.rect(x, y, w, h);
    return;
  }
  context.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
}

function drawPaddedImageSource(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  padding: number
) {
  const sourceWidth = image.naturalWidth || image.width || width;
  const sourceHeight = image.naturalHeight || image.height || height;
  const lastX = Math.max(0, sourceWidth - 1);
  const lastY = Math.max(0, sourceHeight - 1);

  context.drawImage(image, 0, 0, sourceWidth, sourceHeight, padding, padding, width, height);

  if (padding <= 0) {
    return;
  }

  context.drawImage(image, 0, 0, 1, sourceHeight, 0, padding, padding, height);
  context.drawImage(image, lastX, 0, 1, sourceHeight, padding + width, padding, padding, height);
  context.drawImage(image, 0, 0, sourceWidth, 1, padding, 0, width, padding);
  context.drawImage(image, 0, lastY, sourceWidth, 1, padding, padding + height, width, padding);
  context.drawImage(image, 0, 0, 1, 1, 0, 0, padding, padding);
  context.drawImage(image, lastX, 0, 1, 1, padding + width, 0, padding, padding);
  context.drawImage(image, 0, lastY, 1, 1, 0, padding + height, padding, padding);
  context.drawImage(image, lastX, lastY, 1, 1, padding + width, padding + height, padding, padding);
}

function drawBitmapBlur(
  context: CanvasRenderingContext2D,
  annotation: Extract<NativeImageAnnotation, { kind: "rect" | "ellipse" }>,
  image: HTMLImageElement,
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
  styleScale: number
) {
  if (annotation.blurEnabled !== true) {
    return;
  }

  const blurRadius = Math.max(0.2, blurLevel(annotation.blurAmount) / 2) * styleScale * 8;
  const padding = Math.ceil(Math.max(BLUR_EDGE_PADDING_PX * styleScale, blurRadius * 3));
  const sourceCanvas = window.document.createElement("canvas");
  sourceCanvas.width = width + padding * 2;
  sourceCanvas.height = height + padding * 2;
  const sourceContext = sourceCanvas.getContext("2d");
  const blurCanvas = window.document.createElement("canvas");
  blurCanvas.width = sourceCanvas.width;
  blurCanvas.height = sourceCanvas.height;
  const blurContext = blurCanvas.getContext("2d");

  if (!sourceContext || !blurContext) {
    return;
  }

  drawPaddedImageSource(sourceContext, image, width, height, padding);
  blurContext.filter = `blur(${blurRadius}px)`;
  blurContext.drawImage(sourceCanvas, 0, 0);
  blurContext.filter = "none";

  context.save();
  drawShapePath(context, annotation, x, y, w, h);
  context.clip();
  context.drawImage(blurCanvas, -padding, -padding);
  context.restore();
}

function drawAnnotation(
  context: CanvasRenderingContext2D,
  annotation: NativeImageAnnotation,
  image: HTMLImageElement,
  width: number,
  height: number,
  styleScale: number
) {
  context.save();
  context.filter = "none";
  context.strokeStyle = rgba(annotation.stroke.color, annotation.stroke.opacity);
  context.fillStyle = rgba(annotation.fill.color, annotation.fill.opacity);
  context.lineWidth = strokeWidthPx(annotation.stroke.width, styleScale);
  context.lineCap = "round";
  context.lineJoin = "round";

  if (annotation.kind === "path") {
    context.fillStyle = "rgba(0, 0, 0, 0)";
    context.beginPath();
    annotation.points.forEach((point: NativeImageAnnotationPoint, index: number) => {
      const x = pxX(point.x, width);
      const y = pxY(point.y, height);
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    context.stroke();
    context.restore();
    return;
  }

  if (annotation.kind === "line") {
    context.fillStyle = "rgba(0, 0, 0, 0)";
    context.beginPath();
    context.moveTo(pxX(annotation.x1, width), pxY(annotation.y1, height));
    context.lineTo(pxX(annotation.x2, width), pxY(annotation.y2, height));
    context.stroke();
    context.restore();
    return;
  }

  const box = bounds(annotation);
  const x = pxX(box.x, width);
  const y = pxY(box.y, height);
  const w = pxX(box.width, width);
  const h = pxY(box.height, height);

  if (annotation.kind === "rect") {
    drawBitmapBlur(context, annotation, image, width, height, x, y, w, h, styleScale);
    drawShapePath(context, annotation, x, y, w, h);
    if (annotation.fill.opacity > 0) {
      context.fill();
    }
    context.stroke();
    context.restore();
    return;
  }

  if (annotation.kind === "ellipse") {
    drawBitmapBlur(context, annotation, image, width, height, x, y, w, h, styleScale);
    drawShapePath(context, annotation, x, y, w, h);
    if (annotation.fill.opacity > 0) {
      context.fill();
    }
    context.stroke();
    context.restore();
    return;
  }

  if (annotation.kind === "icon") {
    context.fillStyle = rgba(annotation.stroke.color, annotation.stroke.opacity);
    drawIconPath(context, annotation.iconType, x, y, w, h, annotation.iconRotation ?? 0, annotation.iconFlipX ?? false, annotation.iconFlipY ?? false);
    context.restore();
    return;
  }

  if (annotation.text.backgroundOpacity > 0) {
    context.fillStyle = rgba(annotation.text.backgroundColor, annotation.text.backgroundOpacity);
    context.beginPath();
    context.roundRect(x, y, w, h, 4 * styleScale);
    context.fill();
  }

  context.fillStyle = annotation.text.color;
  const fontSize = Math.max(12, annotation.text.fontSize) * styleScale;
  const paddingX = 8 * styleScale;
  const paddingY = 5.6 * styleScale;
  context.font = `600 ${fontSize}px Inter, Arial, sans-serif`;
  context.textBaseline = "top";
  const lines = annotation.content.split(/\r\n|\r|\n/);
  const lineHeight = Math.max(14 * styleScale, annotation.text.fontSize * 1.35 * styleScale);
  lines.forEach((line: string, index: number) => {
    context.fillText(line, x + paddingX, y + paddingY + index * lineHeight, Math.max(12, w - paddingX * 2));
  });
  context.restore();
}

export async function flattenNativeImageAnnotationsToDataUrl({
  document: annotationDocument,
  imageElement,
  imageSrc,
  mimeType = "image/png",
  quality = 0.92
}: FlattenNativeImageAnnotationsOptions) {
  const loadedImage = imageSrc ? await loadOriginCleanImage(imageSrc) : null;
  const image = loadedImage?.image ?? (imageElement && (imageElement.naturalWidth || imageElement.width)
    ? imageElement
    : null);
  if (!image) {
    return "";
  }
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) {
    loadedImage?.cleanup();
    return "";
  }
  const displayRect = imageElement?.getBoundingClientRect();
  const displayWidth = displayRect?.width || imageElement?.width || width;
  const displayHeight = displayRect?.height || imageElement?.height || height;
  const styleScaleX = displayWidth > 0 ? width / displayWidth : 1;
  const styleScaleY = displayHeight > 0 ? height / displayHeight : styleScaleX;
  const styleScale = Math.max(0.1, (styleScaleX + styleScaleY) / 2);

  const canvas = window.document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    loadedImage?.cleanup();
    return "";
  }

  try {
    context.drawImage(image, 0, 0, width, height);
    for (const annotation of annotationDocument.annotations) {
      drawAnnotation(context, annotation, image, width, height, styleScale);
    }
    return canvas.toDataURL(mimeType, quality);
  } finally {
    loadedImage?.cleanup();
  }
}
