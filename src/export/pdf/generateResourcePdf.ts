import pdfMake from "pdfmake/build/pdfmake";
import type { Content, TDocumentDefinitions, TVirtualFileSystem } from "pdfmake/interfaces";
import type { GlossaryAssistantEntry, ReferenceBankEntry } from "../../types/project";
import { richHtmlToPdf } from "./richHtmlToPdf";

const FONT_FILES = ["AtkinsonHyperlegible-Regular.ttf", "AtkinsonHyperlegible-Bold.ttf", "AtkinsonHyperlegible-Italic.ttf", "AtkinsonHyperlegible-BoldItalic.ttf"] as const;

async function fonts() {
  const files = await Promise.all(FONT_FILES.map(async (name) => {
    const response = await fetch(`/fonts/Atkinson_Hyperlegible/${name}`);
    if (!response.ok) throw new Error(`Police PDF introuvable : ${name}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return btoa(binary);
  }));
  pdfMake.addVirtualFileSystem(Object.fromEntries(FONT_FILES.map((name, index) => [name, files[index]])) as TVirtualFileSystem);
  pdfMake.addFonts({ PaideiaDocument: { normal: FONT_FILES[0], bold: FONT_FILES[1], italics: FONT_FILES[2], bolditalics: FONT_FILES[3] } });
}

export async function generateResourcePdf(
  kind: "glossary" | "references",
  name: string,
  entries: GlossaryAssistantEntry[] | ReferenceBankEntry[]
): Promise<Uint8Array> {
  await fonts();
  const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const content: Content[] = [
    { text: kind === "glossary" ? "Glossaire" : "Balises et renvois", fontSize: 12, color: "#64748b", margin: [0, 0, 0, 5] },
    { text: name, bold: true, fontSize: 26, color: "#0f2450", margin: [0, 0, 0, 10] },
    { text: `Édité le ${date}`, fontSize: 10, color: "#64748b", margin: [0, 0, 0, 28] }
  ];
  for (const entry of [...entries].sort((left, right) => left.term.localeCompare(right.term, "fr", { sensitivity: "base" }))) {
    const glossary = "contentHtml" in entry;
    const body: Content[] = [
      { text: entry.term, bold: true, fontSize: 14, color: "#0f3b70", margin: [0, 0, 0, 5] },
      ...(glossary && entry.aliases.length ? [{ text: `Alias : ${entry.aliases.join(", ")}`, italics: true, color: "#64748b", margin: [0, 0, 0, 6] } as Content] : []),
      ...richHtmlToPdf(glossary ? entry.contentHtml : entry.definitionHtml),
      ...(glossary && entry.related.length ? [{ text: `Termes associés : ${entry.related.join(", ")}`, color: "#475569", margin: [0, 6, 0, 0] } as Content] : [])
    ];
    content.push({ stack: body, margin: [0, 0, 0, 18] });
  }
  const definition: TDocumentDefinitions = {
    info: { title: name, subject: kind === "glossary" ? "Glossaire" : "Balises et renvois" },
    pageSize: "A4", pageMargins: [46, 48, 46, 48],
    defaultStyle: { font: "PaideiaDocument", fontSize: 11, lineHeight: 1.3, color: "#182b4b" },
    footer: (page, pages) => ({ text: `${page} / ${pages}`, alignment: "center", fontSize: 8, color: "#64748b", margin: [0, 10, 0, 0] }),
    content
  };
  return new Uint8Array(await pdfMake.createPdf(definition).getBuffer());
}
