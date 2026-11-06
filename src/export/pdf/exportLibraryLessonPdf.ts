import type { PaideiaBlock, PaideiaProject } from "../../types/project";
import {
  loadProjectForPdfExport,
  readProjectFilesForPdfExport,
  generatePdfA4,
  writeLessonDurationLog,
  writePdfExportAtomic
} from "../../lib/projectApi";
import { buildLessonPdfModel } from "./buildLessonPdfModel";
import { generateLessonPdf } from "./generateLessonPdf";
import type { PdfGenerationPhase } from "./pdfWorkerProtocol";
import type { AppLanguage } from "../../i18n";
import { pdfContentAssetRefs } from "./pdfContentAssetRefs";
import { estimateLessonDurationBreakdown, formatLessonDurationDiagnostic } from "../../app/lessonDuration";

export type LibraryLessonPdfPhase = "loading" | PdfGenerationPhase | "saving";

const PDF_RASTER_OR_VIDEO = /\.(?:aac|flac|gif|jpe?g|m4a|m4v|mov|mp3|mp4|ogg|png|wav|webm|webp)$/i;

function normalizedRef(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/^assets\//, "");
}

function collectBlockFileRefs(block: PaideiaBlock, refs: Set<string>): void {
  const includeSourceMedia = block.type !== "situational-dialogue";
  const candidates = [
    ...(includeSourceMedia ? pdfContentAssetRefs(block) : []),
    ...(block.richInlineAssetRefs ?? []),
    ...(includeSourceMedia ? (block.activityItems ?? []).flatMap((item) => [
      ...(item.assetRefs ?? []),
      item.frontImageAssetRef,
      item.backImageAssetRef,
      item.imageAnnotationSourceAssetRef
    ]) : []),
    ...(block.situationalDialogueCharacters ?? []).flatMap((character) => {
      const introduction = character.poses.find((pose) =>
        pose.usage === "introduction" || pose.state === "introduction"
      ) ?? character.poses.find((pose) => pose.id === character.defaultPoseId);
      return introduction?.assetRef ? [introduction.assetRef] : [];
    }),
    ...(block.pointOfInterestMarkers ?? []).flatMap((marker) => {
      const media = marker.media;
      if (!media || media.type === "image") return [];
      return [media.optimizedAssetRef || media.assetRef];
    })
  ];
  for (const candidate of candidates) {
    if (candidate?.trim() && PDF_RASTER_OR_VIDEO.test(normalizedRef(candidate))) {
      refs.add(candidate.trim());
    }
  }
  if (block.htmlEntryFile?.trim()) {
    refs.add(block.htmlEntryFile.trim());
  }
}

export function collectProjectPdfFileRefs(project: PaideiaProject): string[] {
  const refs = new Set<string>();
  if (project.courseImageRef?.trim() && PDF_RASTER_OR_VIDEO.test(normalizedRef(project.courseImageRef))) {
    refs.add(project.courseImageRef.trim());
  }
  for (const block of project.course.modules
    .flatMap((module) => module.chapters)
    .flatMap((chapter) => chapter.pages)
    .flatMap((page) => page.blocks)) {
    collectBlockFileRefs(block, refs);
  }
  for (const assistant of project.glossaryAssistants ?? []) {
    if (assistant.assistantEnabled && assistant.avatarRef?.trim() && PDF_RASTER_OR_VIDEO.test(normalizedRef(assistant.avatarRef))) {
      refs.add(assistant.avatarRef.trim());
    }
  }
  return [...refs];
}

function decodeBase64Text(value: string): string {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function bundledAssetDataUrl(assetRef: string): Promise<string | null> {
  const normalized = normalizedRef(assetRef);
  if (!normalized.startsWith("default-assets/") && !normalized.startsWith("default-characters/")) {
    return null;
  }
  try {
    const response = await fetch(`/${normalized}`);
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result)), { once: true });
      reader.addEventListener("error", () => reject(reader.error), { once: true });
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function videoSnapshot(videoDataUrl: string): Promise<string | null> {
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.playsInline = true;
  const waitFor = (eventName: "loadeddata" | "seeked") => new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Délai vidéo dépassé.")), 15000);
    video.addEventListener(eventName, () => {
      window.clearTimeout(timeout);
      resolve();
    }, { once: true });
    video.addEventListener("error", () => {
      window.clearTimeout(timeout);
      reject(new Error("Décodage vidéo impossible."));
    }, { once: true });
  });
  try {
    video.src = videoDataUrl;
    await waitFor("loadeddata");
    if (Number.isFinite(video.duration) && video.duration > 0.2) {
      const seeked = waitFor("seeked");
      video.currentTime = Math.min(1, video.duration * 0.1);
      await seeked;
    }
    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;
    const scale = Math.min(1, 1600 / sourceWidth, 1000 / sourceHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}

export async function mediaDuration(dataUrl: string, kind: "audio" | "video"): Promise<number | null> {
  const media = document.createElement(kind);
  media.preload = "metadata";
  media.muted = true;
  const duration = await new Promise<number | null>((resolve) => {
    const timeout = window.setTimeout(() => resolve(null), 15000);
    media.addEventListener("loadedmetadata", () => {
      window.clearTimeout(timeout);
      resolve(Number.isFinite(media.duration) && media.duration > 0 ? media.duration : null);
    }, { once: true });
    media.addEventListener("error", () => {
      window.clearTimeout(timeout);
      resolve(null);
    }, { once: true });
    media.src = dataUrl;
  });
  media.removeAttribute("src");
  media.load();
  return duration;
}

export async function generateLibraryLessonPdf(
  sourcePath: string,
  language: AppLanguage,
  onProgress?: (phase: LibraryLessonPdfPhase) => void,
  onDurationDiagnostic?: (content: string, lessonTitle: string) => void
): Promise<Uint8Array> {
  onProgress?.("loading");
  const project = await loadProjectForPdfExport(sourcePath);
  const requestedRefs = collectProjectPdfFileRefs(project);
  const payloads = await readProjectFilesForPdfExport(sourcePath, requestedRefs);
  const rawAssets: Record<string, string> = {};
  const htmlByNormalizedRef = new Map<string, string>();
  for (const payload of payloads) {
    if (payload.mimeType === "text/html") {
      htmlByNormalizedRef.set(normalizedRef(payload.assetRef), decodeBase64Text(payload.dataBase64));
      continue;
    }
    const dataUrl = `data:${payload.mimeType};base64,${payload.dataBase64}`;
    rawAssets[payload.assetRef] = dataUrl;
    rawAssets[normalizedRef(payload.assetRef)] = dataUrl;
    rawAssets[`assets/${normalizedRef(payload.assetRef)}`] = dataUrl;
  }
  for (const ref of requestedRefs) {
    const normalized = normalizedRef(ref);
    const existing = rawAssets[ref] ?? rawAssets[normalized];
    if (!existing) {
      const bundled = await bundledAssetDataUrl(ref);
      if (bundled) {
        rawAssets[ref] = bundled;
        rawAssets[normalized] = bundled;
      }
    }
  }

  const mediaDurationByRef: Record<string, number> = {};
  const durationByDataUrl = new Map<string, number | null>();
  for (const [ref, dataUrl] of Object.entries(rawAssets)) {
    if (mediaDurationByRef[ref] != null || !dataUrl.startsWith("data:")) continue;
    const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
    const kind = mime.startsWith("audio/") ? "audio" : mime.startsWith("video/") ? "video" : null;
    if (!kind) continue;
    let duration = durationByDataUrl.get(dataUrl);
    if (duration === undefined) {
      duration = await mediaDuration(dataUrl, kind);
      durationByDataUrl.set(dataUrl, duration);
    }
    if (duration != null) mediaDurationByRef[ref] = duration;
  }

  const htmlEntryContentByBlockId: Record<string, string> = {};
  for (const block of project.course.modules
    .flatMap((module) => module.chapters)
    .flatMap((chapter) => chapter.pages)
    .flatMap((page) => page.blocks)) {
    if (block.htmlEntryFile?.trim()) {
      const html = htmlByNormalizedRef.get(normalizedRef(block.htmlEntryFile));
      if (html) {
        htmlEntryContentByBlockId[block.id] = html;
      }
    }
    if (block.type === "media") {
      const refs = pdfContentAssetRefs(block);
      const hasPoster = refs.some((ref) => /\.(?:gif|jpe?g|png|webp)$/i.test(normalizedRef(ref)));
      if (!hasPoster) {
        const videoRef = refs.find((ref) => /\.(?:m4v|mov|mp4|webm)$/i.test(normalizedRef(ref)));
        const videoData = videoRef ? rawAssets[videoRef] ?? rawAssets[normalizedRef(videoRef)] : null;
        if (videoRef && videoData?.startsWith("data:video/")) {
          const snapshot = await videoSnapshot(videoData);
          if (snapshot) {
            rawAssets[videoRef] = snapshot;
            rawAssets[normalizedRef(videoRef)] = snapshot;
          }
        }
      }
    }
  }

  const breakdown = estimateLessonDurationBreakdown(project, (ref) => mediaDurationByRef[ref]);
  onDurationDiagnostic?.(formatLessonDurationDiagnostic(project, breakdown, language), project.title);
  const model = buildLessonPdfModel(project, { htmlEntryContentByBlockId, language, mediaDurationByRef });
  return generateLessonPdf(model, {
    assets: rawAssets,
    onProgress: (phase) => onProgress?.(phase)
  });
}

export async function exportLibraryLessonPdfTo(
  sourcePath: string,
  targetPath: string,
  onProgress?: (phase: LibraryLessonPdfPhase) => void,
  profile: "review" | "learner" = "review"
): Promise<string> {
  onProgress?.("document");
  if (import.meta.env.DEV) {
    const response = await fetch("/__paideia_pdf_a4", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourcePath, profile })
    });
    if (!response.ok) throw new Error(await response.text());
    const bytes = new Uint8Array(await response.arrayBuffer());
    onProgress?.("saving");
    return writePdfExportAtomic(targetPath, bytesToBase64(bytes));
  }
  return generatePdfA4(sourcePath, targetPath, profile);
}
