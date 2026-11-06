import { buildLessonPdfModel } from "./buildLessonPdfModel";
import { collectProjectPdfFileRefs, mediaDuration, videoSnapshot } from "./exportLibraryLessonPdf";
import { preparePdfAssets } from "./pdfAssetPreparation";
import { renderLessonPdfHtml, prepareLessonPdfHtmlForPrint, PDF_HTML_PRINT_ZOOM } from "./renderLessonPdfHtml";
import type { PaideiaProject } from "../../types/project";

// Executed only in the dedicated print WebView, which has no editor or project IPC.
const state = {
  project: null as PaideiaProject | null,
  profile: "review" as "review" | "learner",
  raw: {} as Record<string, string>,
  assets: {} as Record<string, string>,
  model: null as ReturnType<typeof buildLessonPdfModel> | null
};
const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function setProject(project: PaideiaProject, profile: "review" | "learner"): string[] {
  state.project = project;
  state.profile = profile;
  state.raw = {};
  state.assets = {};
  state.model = null;
  return collectProjectPdfFileRefs(project);
}

export function setAsset(ref: string, data: string): void {
  state.raw[ref] = data;
}

export function setCapture(id: string, data: string): void {
  state.assets[`pdf-html-first-view/${id}`] = data;
}

export async function prepare(
  htmlEntries: Record<string, string>,
  subtitles: Record<string, string>,
  omittedVideos: string[]
): Promise<void> {
  const project = state.project!;
  const durations: Record<string, number> = {};
  for (const [ref, data] of Object.entries(state.raw)) {
    const kind = data.startsWith("data:video/") ? "video" : data.startsWith("data:audio/") ? "audio" : null;
    if (!kind) continue;
    const url = URL.createObjectURL(await (await fetch(data)).blob());
    try {
      const duration = await mediaDuration(url, kind);
      if (duration) durations[ref] = duration;
      if (kind === "video") {
        const snapshot = await videoSnapshot(url);
        if (snapshot) state.raw[ref] = snapshot;
        else { delete state.raw[ref]; omittedVideos.push(ref); }
      } else delete state.raw[ref];
    } finally { URL.revokeObjectURL(url); }
  }
  const subtitleHtmlByBlockId: Record<string, string> = {};
  const blocks = project.course.modules.flatMap(m => m.chapters).flatMap(c => c.pages).flatMap(p => p.blocks);
  for (const block of blocks.filter(b => ["video", "media"].includes(b.type))) {
    const lines = (block.subtitleRefs ?? []).flatMap(ref => (subtitles[ref] ?? "").replace(/^\uFEFF/, "").split(/\r?\n/)
      .filter(line => line.trim() && !/^WEBVTT(?:\s.*)?$/i.test(line.trim()) && !/^\d+$/.test(line.trim()) && !/^(?:\d{2}:)?\d{2}:\d{2}[,.]\d{3}\s*-->/.test(line.trim())));
    if (lines.length) subtitleHtmlByBlockId[block.id] = `<p>${lines.map(line => escape(line.trim())).join(" ")}</p>`;
  }
  const model = buildLessonPdfModel(project, {
    language: "fr", profile: state.profile, htmlEntryContentByBlockId: htmlEntries,
    mediaDurationByRef: durations, subtitleHtmlByBlockId
  });
  for (const block of blocks.filter(b => ["video", "media"].includes(b.type))) {
    const activity = model.chapters.flatMap(c => c.activities).find(a => a.id === block.id);
    if (!activity) continue;
    const videoRefs = collectProjectPdfFileRefs({ ...project, course: { modules: [{ chapters: [{ pages: [{ blocks: [block] }] }] }] } } as PaideiaProject)
      .filter(ref => /\.(mp4|webm)$/i.test(ref));
    if (videoRefs.some(ref => omittedVideos.includes(ref))) {
      activity.sections.push({ kind: "rich-text", html: `<p><strong>Vidéo :</strong> ${videoRefs.map(ref => escape(ref.split(/[\\/]/).pop()!)).join(", ")}</p><p>Aperçu non disponible.</p>` });
    }
    if (state.profile !== "learner" && subtitleHtmlByBlockId[block.id]) {
      activity.sections.push({ kind: "rich-text", label: "Transcription", html: subtitleHtmlByBlockId[block.id] });
    }
  }
  state.model = model;
  state.assets = await preparePdfAssets(model, state.raw);
  state.raw = {};
}

export function render(fontCss: string): string {
  return renderLessonPdfHtml(state.model!, state.project!, state.assets, fontCss);
}

export async function readyForPrint() {
  await document.fonts.ready;
  await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  prepareLessonPdfHtmlForPrint(document);
  const diagnostics = {
    width: document.body.getBoundingClientRect().width,
    activities: document.querySelectorAll(".activity").length,
    brokenImages: [...document.images].filter(i => !i.naturalWidth).length,
    overflow: [...document.querySelectorAll(".rich,table,.composition,.note-panel")]
      .filter(e => e.getBoundingClientRect().right > document.body.getBoundingClientRect().right + 2).map(e => e.tagName),
    defaultFont: getComputedStyle(document.body).fontSize,
    printZoom: PDF_HTML_PRINT_ZOOM
  };
  if (diagnostics.brokenImages || diagnostics.overflow.length) throw new Error("Image manquante ou contenu débordant dans le PDF A4.");
  return diagnostics;
}
