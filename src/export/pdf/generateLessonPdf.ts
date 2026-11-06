import type { LessonPdfDocumentModel } from "./lessonPdfModel";
import type { LessonPdfWorkerRequest, LessonPdfWorkerResponse, PdfGenerationPhase } from "./pdfWorkerProtocol";

const FONT_PATHS = [
  "/fonts/Atkinson_Hyperlegible/AtkinsonHyperlegible-Regular.ttf",
  "/fonts/Atkinson_Hyperlegible/AtkinsonHyperlegible-Bold.ttf",
  "/fonts/Atkinson_Hyperlegible/AtkinsonHyperlegible-Italic.ttf",
  "/fonts/Atkinson_Hyperlegible/AtkinsonHyperlegible-BoldItalic.ttf"
] as const;

export type GenerateLessonPdfOptions = {
  assets?: Record<string, string>;
  onProgress?: (phase: PdfGenerationPhase) => void;
};

async function loadFont(path: string): Promise<ArrayBuffer> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Police PDF introuvable (${response.status}).`);
  }
  return response.arrayBuffer();
}

export async function generateLessonPdf(
  model: LessonPdfDocumentModel,
  options: GenerateLessonPdfOptions = {}
): Promise<Uint8Array> {
  const fonts = await Promise.all(FONT_PATHS.map(loadFont));
  const worker = new Worker(new URL("./lessonPdf.worker.ts", import.meta.url), { type: "module" });

  try {
    return await new Promise<Uint8Array>((resolve, reject) => {
      worker.addEventListener("message", (event: MessageEvent<LessonPdfWorkerResponse>) => {
        if (event.data.kind === "progress") {
          options.onProgress?.(event.data.phase);
          return;
        }
        if (event.data.kind === "failure") {
          reject(new Error(event.data.message));
          return;
        }
        resolve(new Uint8Array(event.data.pdf));
      });
      worker.addEventListener("error", (event) => {
        reject(new Error(event.message || "Échec du Worker PDF."));
      }, { once: true });
      const request: LessonPdfWorkerRequest = {
        model,
        assets: options.assets ?? {},
        fonts
      };
      worker.postMessage(request, fonts);
    });
  } finally {
    worker.terminate();
  }
}
