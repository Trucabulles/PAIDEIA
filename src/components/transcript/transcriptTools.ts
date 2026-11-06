export type TranscriptSource = "manual" | "whisper" | "imported";
export type TranscriptStatus = "draft" | "validated";

export type TranscriptValue = {
  transcriptHtml?: string | null;
  transcriptLanguage?: string | null;
  transcriptSource?: TranscriptSource | null;
  transcriptStatus?: TranscriptStatus | null;
  transcriptAllowDownload?: boolean | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function plainTextToTranscriptHtml(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.split("\n").map((line) => line.trim()).filter(Boolean).join(" "))
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}

export function transcriptHtmlToPlainText(value?: string | null) {
  if (!value?.trim()) return "";
  const documentNode = new DOMParser().parseFromString(value, "text/html");
  const blocks = Array.from(documentNode.body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote"));
  if (blocks.length) return blocks.map((node) => node.textContent?.trim() ?? "").filter(Boolean).join("\n\n");
  return documentNode.body.textContent?.trim() ?? "";
}

function rtfEscape(value: string) {
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const character = value[index];
    if (character === "\\" || character === "{" || character === "}") output += `\\${character}`;
    else if (code === 10) output += "\\par\n";
    else if (code >= 32 && code <= 126) output += character;
    else output += `\\u${code > 32767 ? code - 65536 : code}?`;
  }
  return output;
}

const RTF_LANGUAGE_CODES: Record<string, number> = {
  bg: 1026, br: 1150, co: 1155, cs: 1029, cy: 1106, da: 1030, de: 1031,
  el: 1032, en: 1033, es: 3082, et: 1061, eu: 1069, fi: 1035, fr: 1036,
  ga: 2108, hr: 1050, hu: 1038, it: 1040, lt: 1063, lv: 1062, mt: 1082,
  nl: 1043, pl: 1045, pt: 2070, ro: 1048, sk: 1051, sl: 1060, sv: 1053,
  tr: 1055
};

export function transcriptRtfLanguageCode(language: string) {
  const code = language.trim().toLocaleLowerCase("en-US").split(/[-_]/)[0];
  return RTF_LANGUAGE_CODES[code] ?? 1024;
}

export function buildTranscriptRtf(title: string, language: string, html: string) {
  const plainText = transcriptHtmlToPlainText(html);
  const paragraphs = plainText.split(/\n\s*\n/).filter(Boolean);
  const languageCode = transcriptRtfLanguageCode(language);
  return `{\\rtf1\\ansi\\ansicpg1252\\uc1\\deff0{\\fonttbl{\\f0 Inter;}{\\f1 Arial;}}\\viewkind4\\lang${languageCode}\\f0\\fs36 `
    + `{\\b ${rtfEscape(title || "Transcription")}\\b0}\\par\\par `
    + paragraphs.map((paragraph) => rtfEscape(paragraph)).join("\\par\\par ")
    + "}";
}

export function buildPlainTextRtf(title: string, language: string, text: string, secondarySectionMarker?: string) {
  const languageCode = transcriptRtfLanguageCode(language);
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const secondaryStart = secondarySectionMarker
    ? lines.findIndex((line) => line.trim() === secondarySectionMarker.trim())
    : -1;
  const body = lines
    .map((line, index) => {
      const escaped = rtfEscape(line);
      return secondaryStart >= 0 && index > secondaryStart ? `{\\i\\fs30 ${escaped}}` : escaped;
    })
    .join("\\line\n");
  return `{\\rtf1\\ansi\\ansicpg1252\\uc1\\deff0{\\fonttbl{\\f0 Inter;}{\\f1 Arial;}}\\viewkind4\\lang${languageCode}\\f0\\fs36 `
    + `{\\b ${rtfEscape(title || "Rapport")}\\b0}\\par\\par `
    + body
    + "}";
}

export function safeTranscriptFileName(value: string) {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  return `${(normalized || "transcription").slice(0, 120)}.rtf`;
}

export async function downloadTranscriptRtf(title: string, language: string, html: string) {
  const targetPath = await save({
    defaultPath: safeTranscriptFileName(title),
    filters: [{ name: "Rich Text Format", extensions: ["rtf"] }]
  });
  if (!targetPath) return null;
  return writeTranscriptRtf(targetPath, buildTranscriptRtf(title, language, html));
}
import { save } from "@tauri-apps/plugin-dialog";
import { writeTranscriptRtf } from "../../lib/projectApi";
