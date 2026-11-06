import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";

const root = resolve(".");
const docsRoot = join(root, "docs");
const userDocsRoot = join(docsRoot, "Arion_Utilisateur");
const sourceSelectionFile = join(userDocsRoot, ".source-selections.json");
const output = join(root, "src", "features", "designer-actions", "designerDocumentationRegistry.data.json");

const normalizeId = (value) => String(value ?? "document").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "document";

function metadata(source) {
  const match = source.match(/<!--\s*arion:meta\s+({[\s\S]*?})\s*-->/i);
  if (!match) return {};
  try { return JSON.parse(match[1]); } catch (error) { throw new Error(`Métadonnées Arion invalides : ${error.message}`); }
}

function plainMarkdown(source) {
  return source.replace(/<!--[^]*?-->/g, "").replace(/^```[^\n]*\n|```$/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "").replace(/^#{1,6}\s+/gm, "").replace(/[*_~`]/g, "").replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n").trim();
}

function entriesFromUserDocument(source, fileName) {
  const meta = metadata(source);
  const withoutMeta = source.replace(/<!--\s*arion:meta\s+{[\s\S]*?}\s*-->/i, "").trim();
  const documentTitle = withoutMeta.match(/^#\s+(.+)$/m)?.[1]?.trim() || basename(fileName, extname(fileName));
  const chunks = withoutMeta.split(/^##\s+/m);
  const intro = chunks.shift()?.replace(/^#\s+.*$/m, "").trim() ?? "";
  const sections = chunks.map((chunk) => {
    const newline = chunk.indexOf("\n");
    return { title: (newline >= 0 ? chunk.slice(0, newline) : chunk).trim(), body: newline >= 0 ? chunk.slice(newline + 1).trim() : "" };
  }).filter((section) => section.body);
  if (intro) sections.unshift({ title: documentTitle, body: intro });
  if (!sections.length) sections.push({ title: documentTitle, body: withoutMeta.replace(/^#\s+.*$/m, "").trim() });
  const groupId = normalizeId(meta.id ?? documentTitle);
  return sections.map((section, index) => ({
    id: meta.sections?.[section.title]?.id ?? `${normalizeId(meta.id ?? documentTitle)}${sections.length > 1 ? `-${index + 1}` : ""}`,
    title: section.title,
    aliases: [...new Set([documentTitle, ...(meta.aliases ?? []), ...(meta.sections?.[section.title]?.aliases ?? []), ...(index ? [] : [section.title])])],
    keywords: [...new Set([...(meta.keywords ?? []), ...(meta.sections?.[section.title]?.keywords ?? [])])],
    activities: meta.activities ?? [],
    groupId,
    content: plainMarkdown(section.body),
    markdown: section.body.replace(/<!--[^]*?-->/g, '').trim()
  })).filter((entry) => entry.content);
}

function markedEntries(source, fileName) {
  const entries = [];
  const searchableSource = source.replace(/```[\s\S]*?```/g, "");
  const pattern = /^[ \t]*<!--\s*arion:start\s+({[^\r\n]*})\s*-->[ \t]*\r?\n([\s\S]*?)^[ \t]*<!--\s*arion:end\s*-->[ \t]*$/gim;
  for (const match of searchableSource.matchAll(pattern)) {
    let meta;
    try { meta = JSON.parse(match[1]); } catch (error) { throw new Error(`${fileName} : métadonnées de section Arion invalides (${error.message})`); }
    const content = plainMarkdown(match[2]);
    if (!meta.id || !meta.title || !content) throw new Error(`${fileName} : une section Arion exige id, title et contenu.`);
    entries.push({ id: normalizeId(meta.id), title: meta.title, aliases: meta.aliases ?? [], keywords: meta.keywords ?? [], activities: meta.activities ?? [], groupId: normalizeId(meta.groupId ?? basename(fileName, extname(fileName))), content, markdown: match[2].replace(/<!--[^]*?-->/g, '').trim() });
  }
  return entries;
}

function selectedSourceEntry(source, fileName, selection) {
  const documentTitle = source.match(/^#\s+(.+)$/m)?.[1]?.trim() || basename(fileName, extname(fileName));
  let title = documentTitle;
  let body = source.replace(/^#\s+.*$/m, "").trim();
  if (selection.heading) {
    title = selection.heading;
    const escaped = selection.heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const section = source.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^#{1,2}\\s+|$)`, "mi"));
    if (!section) throw new Error(`${fileName} : section introuvable « ${selection.heading} ».`);
    body = section[1].trim();
  }
  const content = plainMarkdown(body);
  if (!content) throw new Error(`${fileName} : la sélection « ${title} » est vide.`);
  return {
    id: normalizeId(selection.id ?? `${basename(fileName, extname(fileName))}-${selection.heading || "document"}`),
    title,
    aliases: selection.aliases ?? [documentTitle],
    keywords: selection.keywords ?? [],
    activities: selection.activities ?? [],
    groupId: normalizeId(selection.groupId ?? basename(fileName, extname(fileName))),
    content,
    markdown: body.replace(/<!--[^]*?-->/g, '').trim()
  };
}

async function markdownFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await markdownFiles(path));
    else if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") result.push(path);
  }
  return result;
}

await mkdir(userDocsRoot, { recursive: true });
const entries = [];
let sourceSelections = [];
try { sourceSelections = JSON.parse(await readFile(sourceSelectionFile, "utf8")).selections ?? []; } catch (error) { if (error.code !== "ENOENT") throw error; }
for (const path of await markdownFiles(docsRoot)) {
  const source = await readFile(path, "utf8");
  entries.push(...(path.startsWith(userDocsRoot) ? entriesFromUserDocument(source, path) : markedEntries(source, relative(root, path))));
}
for (const selection of sourceSelections) {
  const path = resolve(docsRoot, selection.path);
  if (!path.startsWith(docsRoot) || path.startsWith(userDocsRoot) || extname(path).toLowerCase() !== ".md") throw new Error(`Sélection documentaire interdite : ${selection.path}`);
  entries.push(selectedSourceEntry(await readFile(path, "utf8"), selection.path, selection));
}
const ids = new Set();
for (const entry of entries) {
  if (ids.has(entry.id)) throw new Error(`Identifiant documentaire Arion dupliqué : ${entry.id}`);
  ids.add(entry.id);
}
entries.sort((a, b) => a.id.localeCompare(b.id, "fr"));
await writeFile(output, `${JSON.stringify({ version: 1, entries }, null, 2)}\n`, "utf8");
console.log(`Index documentaire Arion : ${entries.length} section(s).`);
