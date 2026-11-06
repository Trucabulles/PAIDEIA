import { writePdfExportAtomic } from "../../lib/projectApi";
import type { ObservationState, ObservationTarget } from "./observationTypes";
import type { ObservationPdfModel, ObservationPdfWorkerRequest, ObservationPdfWorkerResponse } from "./observationPdfTypes";

const FONT_PATHS = [
  "/fonts/Atkinson_Hyperlegible/AtkinsonHyperlegible-Regular.ttf",
  "/fonts/Atkinson_Hyperlegible/AtkinsonHyperlegible-Bold.ttf",
  "/fonts/Atkinson_Hyperlegible/AtkinsonHyperlegible-Italic.ttf",
  "/fonts/Atkinson_Hyperlegible/AtkinsonHyperlegible-BoldItalic.ttf"
] as const;

type ExportObservationsPdfOptions = {
  lessonTitle: string;
  language: string;
  state: ObservationState;
  resolveTarget: (target: Pick<ObservationTarget, "chapterId" | "pageId" | "blockId" | "blockLabel">) => ObservationTarget;
  targetLabel: (target: ObservationTarget) => string;
  title: string;
  resolvedLabel: string;
  deletedLabel: (author: string, date: string) => string;
};

function safeFileStem(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "lecon";
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function observationsPdfFileName(lessonTitle: string, date = new Date()): string {
  const day = `${pad2(date.getDate())}${pad2(date.getMonth() + 1)}${date.getFullYear()}`;
  const time = `${pad2(date.getHours())}${pad2(date.getMinutes())}`;
  return `${safeFileStem(lessonTitle)}_observations_${day}_${time}.pdf`;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function generateObservationsPdf(model: ObservationPdfModel): Promise<Uint8Array> {
  const fonts = await Promise.all(FONT_PATHS.map(async (path) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Police PDF introuvable (${response.status}).`);
    return response.arrayBuffer();
  }));
  const worker = new Worker(new URL("./observationPdf.worker.ts", import.meta.url), { type: "module" });
  try {
    return await new Promise<Uint8Array>((resolve, reject) => {
      worker.addEventListener("message", (event: MessageEvent<ObservationPdfWorkerResponse>) => {
        if (event.data.kind === "failure") reject(new Error(event.data.message));
        else resolve(new Uint8Array(event.data.pdf));
      });
      worker.addEventListener("error", (event) => reject(new Error(event.message || "Échec du Worker PDF.")), { once: true });
      const request: ObservationPdfWorkerRequest = { model, fonts };
      worker.postMessage(request, fonts);
    });
  } finally {
    worker.terminate();
  }
}

export async function exportObservationsPdfTo(targetPath: string, options: ExportObservationsPdfOptions): Promise<string> {
  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString(options.language);
  };
  const model: ObservationPdfModel = {
    title: options.title,
    lessonTitle: options.lessonTitle,
    generatedAt: new Date().toLocaleString(options.language),
    threads: options.state.threads.map((thread) => ({
      target: options.targetLabel(options.resolveTarget(thread)),
      resolvedLabel: thread.resolved ? `✓ ${options.resolvedLabel}` : null,
      messages: thread.messages.map((message) => ({
        heading: `${message.authorDisplayName ? `${message.authorDisplayName} · ` : ""}${formatDate(message.createdAt)}`,
        text: message.deletedAt
          ? (message.deletedByDisplayName ?? message.authorDisplayName)
            ? options.deletedLabel(message.deletedByDisplayName ?? message.authorDisplayName, formatDate(message.deletedAt))
            : `🗑 · ${formatDate(message.deletedAt)}`
          : message.text,
        deleted: Boolean(message.deletedAt)
      }))
    }))
  };
  const pdf = await generateObservationsPdf(model);
  return writePdfExportAtomic(targetPath, bytesToBase64(pdf));
}
