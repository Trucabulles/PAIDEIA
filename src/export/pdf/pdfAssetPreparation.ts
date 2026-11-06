import type { LessonPdfDocumentModel } from "./lessonPdfModel";
import { decodeHtmlEntities } from "./htmlMetadata";

const RASTER_IMAGE = /^data:image\/(?:gif|jpeg|png|webp);base64,/i;
const MAX_IMAGE_EDGE = 2400;
const MAX_IMAGE_PIXELS = 6_000_000;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function canvasPngDataUrl(canvas: OffscreenCanvas): Promise<string> {
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return `data:image/png;base64,${arrayBufferToBase64(await blob.arrayBuffer())}`;
}

async function rasterizeImage(dataUrl: string): Promise<string | null> {
  if (!RASTER_IMAGE.test(dataUrl)) {
    return null;
  }
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  try {
    const edgeScale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const pixelScale = Math.min(1, Math.sqrt(MAX_IMAGE_PIXELS / (bitmap.width * bitmap.height)));
    const scale = Math.min(edgeScale, pixelScale);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    return await canvasPngDataUrl(canvas);
  } finally {
    bitmap.close();
  }
}

function plainTextFromHtml(html: string): string {
  return decodeHtmlEntities(html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:h[1-6]|p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function canvasColor(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized && normalized.toLocaleLowerCase("en-US") !== "transparent" ? normalized : fallback;
}

function wrapCanvasText(context: OffscreenCanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) {
      lines.push(line);
    }
  }
  return lines;
}

async function composeHeader(
  source: string | null,
  html: string,
  backgroundColor: string | null | undefined,
  textColor: string | null | undefined,
  heightValue: string | null | undefined,
  imagePositionY: number | null | undefined
): Promise<string> {
  const width = 1400;
  const cssHeight = Number.parseFloat(heightValue ?? "240") || 240;
  const height = clamp(Math.round(cssHeight * width / 1200), 170, 520);
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas PDF indisponible");
  }
  context.fillStyle = canvasColor(backgroundColor, "#d7eef0");
  context.fillRect(0, 0, width, height);
  if (source) {
    const bitmap = await createImageBitmap(await (await fetch(source)).blob());
    try {
      const scale = Math.max(width / bitmap.width, height / bitmap.height);
      const drawnWidth = bitmap.width * scale;
      const drawnHeight = bitmap.height * scale;
      const positionY = clamp(Number(imagePositionY ?? 50) / 100, 0, 1);
      const x = (width - drawnWidth) / 2;
      const y = (height - drawnHeight) * positionY;
      context.drawImage(bitmap, x, y, drawnWidth, drawnHeight);
    } finally {
      bitmap.close();
    }
  }
  const text = plainTextFromHtml(html);
  if (text) {
    const fontSize = clamp(Math.round(height * 0.2), 34, 76);
    context.font = `700 ${fontSize}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = canvasColor(textColor, "#102752");
    const lines = wrapCanvasText(context, text, width * 0.78);
    const lineHeight = fontSize * 1.12;
    const firstY = height / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => context.fillText(line, width / 2, firstY + index * lineHeight));
  }
  return canvasPngDataUrl(canvas);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

async function addPointOverlay(
  source: string,
  points: Array<{ order: number; x?: number; y?: number; yaw?: number; pitch?: number }>
): Promise<string> {
  const bitmap = await createImageBitmap(await (await fetch(source)).blob());
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) {
      return source;
    }
    context.drawImage(bitmap, 0, 0);
    const radius = clamp(Math.min(bitmap.width, bitmap.height) * 0.025, 12, 34);
    context.font = `bold ${Math.round(radius * 1.05)}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    points.forEach((point, index) => {
      const normalizedX = point.x != null
        ? clamp(point.x / 100, 0, 1)
        : clamp(((point.yaw ?? 0) + 180) / 360, 0, 1);
      const normalizedY = point.y != null
        ? clamp(point.y / 100, 0, 1)
        : clamp((90 - (point.pitch ?? 0)) / 180, 0, 1);
      const x = normalizedX * bitmap.width;
      const y = normalizedY * bitmap.height;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = "#1d4ed8";
      context.fill();
      context.lineWidth = Math.max(2, radius * 0.14);
      context.strokeStyle = "#ffffff";
      context.stroke();
      context.fillStyle = "#ffffff";
      context.fillText(String(index + 1), x, y + 1);
    });
    return await canvasPngDataUrl(canvas);
  } finally {
    bitmap.close();
  }
}

export async function preparePdfAssets(
  model: LessonPdfDocumentModel,
  rawAssets: Readonly<Record<string, string>>
): Promise<Record<string, string>> {
  const prepared: Record<string, string> = {};
  for (const [ref, dataUrl] of Object.entries(rawAssets)) {
    try {
      const normalized = await rasterizeImage(dataUrl);
      if (normalized) {
        prepared[ref] = normalized;
      }
    } catch {
      // L'absence d'un média ne doit pas interrompre l'export documentaire.
    }
  }

  for (const chapter of model.chapters) {
    for (const activity of chapter.activities) {
      if (activity.sourceType === "header") {
        const visual = activity.sections.find((section) => section.kind === "visual");
        const copy = activity.sections.find((section) => section.kind === "rich-text");
        const background = visual?.assets[0] ? prepared[visual.assets[0].ref] ?? null : null;
        if (copy?.html.trim() || background) {
          try {
            prepared[`header:${activity.id}`] = await composeHeader(
              background,
              copy?.html ?? "",
              activity.style.headerBackgroundColor,
              activity.style.headerTextColor,
              activity.style.headerHeight,
              activity.style.headerImagePositionY
            );
          } catch {
            if (background) {
              prepared[`header:${activity.id}`] = background;
            }
          }
        }
      }
      const interactive = activity.sections.find((section) => section.kind === "interactive-visual");
      if (!interactive?.poster) {
        continue;
      }
      const poster = prepared[interactive.poster.ref];
      if (!poster || !interactive.points.length) {
        continue;
      }
      try {
        prepared[`interactive:${activity.id}`] = await addPointOverlay(poster, interactive.points);
      } catch {
        prepared[`interactive:${activity.id}`] = poster;
      }
    }
  }
  return prepared;
}
