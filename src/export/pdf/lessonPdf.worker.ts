/// <reference lib="webworker" />

import pdfMake from "pdfmake/build/pdfmake";
import type { TVirtualFileSystem } from "pdfmake/interfaces";
import { preparePdfAssets } from "./pdfAssetPreparation";
import { renderLessonPdfDocument } from "./renderLessonPdfDocument";
import type { LessonPdfWorkerRequest, LessonPdfWorkerResponse, PdfGenerationPhase } from "./pdfWorkerProtocol";

const FONT_FILES = [
  "AtkinsonHyperlegible-Regular.ttf",
  "AtkinsonHyperlegible-Bold.ttf",
  "AtkinsonHyperlegible-Italic.ttf",
  "AtkinsonHyperlegible-BoldItalic.ttf"
] as const;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function progress(phase: PdfGenerationPhase): void {
  const response: LessonPdfWorkerResponse = { kind: "progress", phase };
  self.postMessage(response);
}

self.addEventListener("message", async (event: MessageEvent<LessonPdfWorkerRequest>) => {
  try {
    progress("fonts");
    if (event.data.fonts.length !== FONT_FILES.length) {
      throw new Error("Variantes de police PDF incomplètes.");
    }
    const vfs: TVirtualFileSystem = Object.fromEntries(FONT_FILES.map((fileName, index) => [
      fileName,
      arrayBufferToBase64(event.data.fonts[index])
    ]));
    pdfMake.addVirtualFileSystem(vfs);
    pdfMake.addFonts({
      PaideiaDocument: {
        normal: FONT_FILES[0],
        bold: FONT_FILES[1],
        italics: FONT_FILES[2],
        bolditalics: FONT_FILES[3]
      }
    });

    progress("assets");
    const assets = await preparePdfAssets(event.data.model, event.data.assets);
    progress("document");
    const definition = renderLessonPdfDocument(event.data.model, assets);
    const pdf = await pdfMake.createPdf(definition).getBuffer();
    progress("finalizing");
    const bytes = new Uint8Array(pdf);
    const transferable = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const response: LessonPdfWorkerResponse = { kind: "success", pdf: transferable };
    self.postMessage(response, [transferable]);
  } catch (error) {
    const response: LessonPdfWorkerResponse = {
      kind: "failure",
      message: error instanceof Error ? error.message : String(error)
    };
    self.postMessage(response);
  }
});

export {};
