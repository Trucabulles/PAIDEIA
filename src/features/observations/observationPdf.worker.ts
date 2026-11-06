/// <reference lib="webworker" />

import pdfMake from "pdfmake/build/pdfmake";
import type { Content, TDocumentDefinitions, TVirtualFileSystem } from "pdfmake/interfaces";
import type { ObservationPdfWorkerRequest, ObservationPdfWorkerResponse } from "./observationPdfTypes";

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

function renderThread(thread: ObservationPdfWorkerRequest["model"]["threads"][number]): Content {
  const stack: Content[] = [
    { text: thread.target, color: "#18396f", bold: true, fontSize: 12, margin: [0, 0, 0, 3] }
  ];
  if (thread.resolvedLabel) {
    stack.push({ text: thread.resolvedLabel, color: "#39734a", bold: true, margin: [0, 2, 0, 8] });
  }
  for (const message of thread.messages) {
    stack.push(
      { text: message.heading, color: "#6c7d9f", bold: true, fontSize: 9, margin: [0, 5, 0, 2] },
      { text: message.text, color: message.deleted ? "#7d7d7d" : "#172a50", italics: message.deleted, margin: [0, 0, 0, 5] }
    );
  }
  return {
    stack,
    margin: [0, 0, 0, 16],
    unbreakable: false
  };
}

self.addEventListener("message", async (event: MessageEvent<ObservationPdfWorkerRequest>) => {
  try {
    if (event.data.fonts.length !== FONT_FILES.length) throw new Error("Variantes de police PDF incomplètes.");
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

    const definition: TDocumentDefinitions = {
      pageSize: "A4",
      pageMargins: [54, 54, 54, 54],
      defaultStyle: { font: "PaideiaDocument", fontSize: 10, color: "#172a50", lineHeight: 1.25 },
      content: [
        { text: event.data.model.title, color: "#18396f", bold: true, fontSize: 22, margin: [0, 0, 0, 4] },
        { text: event.data.model.lessonTitle, bold: true, fontSize: 14, margin: [0, 0, 0, 2] },
        { text: event.data.model.generatedAt, color: "#6c7d9f", fontSize: 9, margin: [0, 0, 0, 24] },
        ...event.data.model.threads.map(renderThread)
      ],
      footer: (currentPage, pageCount) => ({
        text: `${currentPage} / ${pageCount}`,
        alignment: "center",
        color: "#6c7d9f",
        fontSize: 8
      })
    };
    const pdf = await pdfMake.createPdf(definition).getBuffer();
    const bytes = new Uint8Array(pdf);
    const transferable = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const response: ObservationPdfWorkerResponse = { kind: "success", pdf: transferable };
    self.postMessage(response, [transferable]);
  } catch (error) {
    const response: ObservationPdfWorkerResponse = {
      kind: "failure",
      message: error instanceof Error ? error.message : String(error)
    };
    self.postMessage(response);
  }
});

export {};
