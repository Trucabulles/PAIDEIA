import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile, mkdir, copyFile, rm, stat, readdir } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { readSheet } from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";
import { createMassifiableStore } from './massifiable.mjs';
import { understandingStore } from './understanding.mjs';
import { knowledgeStore, validateKnowledge } from './knowledge.mjs';
import { normalizeRecognition, compileRecognitionPattern } from '../../src/features/designer-actions/designerRecognition.mjs';

const toolRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(toolRoot, "../..");
const massifiable = createMassifiableStore(repositoryRoot);
const understanding = understandingStore(repositoryRoot);
const knowledge = knowledgeStore(repositoryRoot);
const dataRoot = join(repositoryRoot, "src/features/designer-actions");
const files = {
  social: join(dataRoot, "designerSocialRegistry.data.json"),
  help: join(dataRoot, "designerHelpRegistry.data.json")
};
const frenchLocaleFile = join(repositoryRoot, "src/locales/fr.json");
const userDocumentationRoot = join(repositoryRoot, "docs/Arion_Utilisateur");
const sourceDocumentationRoot = join(repositoryRoot, "Dev_Documentation/05_Activites");
const sourceSelectionFile = join(userDocumentationRoot, ".source-selections.json");
const documentationIndexFile = join(dataRoot, "designerDocumentationRegistry.data.json");
const documentationBuilder = join(repositoryRoot, "scripts/build-arion-documentation-index.mjs");
const port = Number(process.env.PAIDEIA_ARION_EDITOR_PORT || 41791);
const serverInstanceId = randomUUID();
const serverRuntimeRoot = join(toolRoot, '.runtime');
const serverRuntimeFile = join(serverRuntimeRoot, `server-${process.pid}.json`);
let documentWrite = Promise.resolve();

function processExists(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function detectedToolServers() {
  await mkdir(serverRuntimeRoot, { recursive: true });
  const files = (await readdir(serverRuntimeRoot, { withFileTypes: true })).filter(entry => entry.isFile() && /^server-\d+\.json$/.test(entry.name));
  const servers = [];
  for (const file of files) {
    const path = join(serverRuntimeRoot, file.name);
    try {
      const value = JSON.parse(await readFile(path, 'utf8'));
      if (!Number.isInteger(value.pid) || !Number.isInteger(value.port) || !processExists(value.pid)) { await rm(path, { force: true }); continue; }
      servers.push(value);
    } catch { await rm(path, { force: true }).catch(() => {}); }
  }
  return servers.sort((left, right) => left.port - right.port);
}
async function managedDocuments() {
  const documents = await Promise.all((await readdir(userDocumentationRoot, { withFileTypes: true }))
    .filter(item => item.isFile() && item.name.endsWith('.md'))
    .map(async item => {
      const content = await readFile(join(userDocumentationRoot, item.name), 'utf8');
      return {
        name: item.name,
        title: content.match(/^#\s+(.+)$/m)?.[1]?.trim() || basename(item.name, '.md'),
        headings: [...content.matchAll(/^#{1,2}\s+(.+)$/gm)].map(match => match[1].trim()),
        content
      };
    }));
  return documents.sort((left, right) => left.title.localeCompare(right.title, 'fr'));
}

function queueDocumentWrite(callback) {
  const operation = documentWrite.then(callback);
  documentWrite = operation.catch(() => {});
  return operation;
}

function updateManagedDocument(payload) {
  return queueDocumentWrite(async () => {
    const available = await managedDocuments();
    const existing = available.find(item => item.name === payload.name);
    if (!existing || !['save', 'delete'].includes(payload.action)) throw new Error('Document ou opération invalide.');
    if (payload.previous !== existing.content) throw new Error('Ce document a changé depuis son ouverture. Rechargez-le avant de continuer.');
    if (payload.action === 'save' && (typeof payload.content !== 'string' || !/^#\s+\S+/m.test(payload.content))) throw new Error('Un titre Markdown de niveau 1 est requis.');
    const destination = join(userDocumentationRoot, existing.name);
    const backupRoot = join(toolRoot, 'backups');
    await mkdir(backupRoot, { recursive: true });
    const backup = join(backupRoot, `${Date.now()}-${existing.name}.bak`);
    await copyFile(destination, backup);
    try {
      if (payload.action === 'delete') await rm(destination);
      else { const temporary = `${destination}.tmp`; await writeFile(temporary, payload.content, 'utf8'); await rename(temporary, destination); }
      await runNodeScript(documentationBuilder);
    } catch (error) {
      await writeFile(destination, existing.content, 'utf8');
      await runNodeScript(documentationBuilder);
      throw error;
    }
    return { ok: true, backup: basename(backup) };
  });
}

function updateManagedDocuments(payload) {
  return queueDocumentWrite(async () => {
    const requested = Array.isArray(payload?.documents) ? payload.documents : [];
    if (!requested.length || requested.length > 200) throw new Error('Aucun document à enregistrer ou lot trop volumineux.');
    const available = new Map((await managedDocuments()).map(document => [document.name, document]));
    const names = new Set();
    const updates = requested.map(item => {
      const existing = available.get(item?.name);
      if (!existing || names.has(item.name)) throw new Error('Le lot contient un document invalide ou dupliqué.');
      names.add(item.name);
      if (item.previous !== existing.content) throw new Error(`${item.name} a changé depuis son ouverture. Rechargez les documents avant de continuer.`);
      if (typeof item.content !== 'string' || !/^#\s+\S+/m.test(item.content)) throw new Error(`${item.name} doit contenir un titre Markdown de niveau 1.`);
      const destination = join(userDocumentationRoot, existing.name);
      return { existing, content: item.content, destination, temporary: `${destination}.${process.pid}.${Date.now()}.tmp` };
    });
    const backupRoot = join(toolRoot, 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
    await mkdir(backupRoot, { recursive: true });
    await Promise.all(updates.map(update => copyFile(update.destination, join(backupRoot, `${update.existing.name}.bak`))));
    try {
      await Promise.all(updates.map(update => writeFile(update.temporary, update.content, 'utf8')));
      for (const update of updates) await rename(update.temporary, update.destination);
      await runNodeScript(documentationBuilder);
    } catch (error) {
      await Promise.all(updates.map(update => writeFile(update.destination, update.existing.content, 'utf8').catch(() => {})));
      await Promise.all(updates.map(update => rm(update.temporary, { force: true }).catch(() => {})));
      await runNodeScript(documentationBuilder).catch(() => {});
      throw new Error(`Enregistrement global annulé et documents restaurés : ${error.message}`);
    }
    return { ok: true, count: updates.length, backup: relative(toolRoot, backupRoot).replaceAll('\\', '/') };
  });
}

async function requestBody(request, maximumBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBytes) throw new Error("Document trop volumineux.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function runNodeScript(path) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [path], { cwd: repositoryRoot, stdio: ["ignore", "pipe", "pipe"] });
    let error = "";
    child.stderr.on("data", (chunk) => { error += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(error.trim() || "La reconstruction de l’index documentaire a échoué.")));
  });
}

async function availableMarkdownPath(fileName) {
  const safeBase = basename(fileName, extname(fileName)).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "documentation-arion";
  await mkdir(userDocumentationRoot, { recursive: true });
  for (let ordinal = 1; ordinal < 10_000; ordinal += 1) {
    const candidate = join(userDocumentationRoot, `${safeBase}${ordinal === 1 ? "" : `-${ordinal}`}.md`);
    try { await stat(candidate); } catch (error) { if (error.code === "ENOENT") return candidate; throw error; }
  }
  throw new Error("Impossible de déterminer un nom disponible pour le document.");
}

async function importDocumentation(request) {
  const suppliedName = decodeURIComponent(String(request.headers["x-paideia-file-name"] ?? ""));
  if (extname(suppliedName).toLowerCase() !== ".md") throw new Error("Seuls les fichiers Markdown .md sont acceptés.");
  const content = (await requestBody(request, 1_000_000)).toString("utf8").replace(/^\uFEFF/, "");
  if (!/^#\s+\S+/m.test(content)) throw new Error("Le document doit contenir au moins un titre Markdown de niveau 1 (# Titre). ");
  const destination = await availableMarkdownPath(suppliedName);
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, content, "utf8");
  await rename(temporary, destination);
  try {
    await runNodeScript(documentationBuilder);
  } catch (error) {
    await rm(destination, { force: true });
    await runNodeScript(documentationBuilder).catch(() => {});
    throw error;
  }
  const index = JSON.parse(await readFile(documentationIndexFile, "utf8"));
  return { ok: true, fileName: basename(destination), sections: index.entries.length };
}

function documentationPreview(source) {
  return source.replace(/<!--[^]*?-->/g, "").replace(/```[\s\S]*?```/g, " ").replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/<[^>]+>/g, " ").replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~`]/g, "").replace(/\s+/g, " ").trim().slice(0, 280);
}

async function documentationSources() {
  let selections = [];
  try { selections = JSON.parse(await readFile(sourceSelectionFile, "utf8")).selections ?? []; } catch (error) { if (error.code !== "ENOENT") throw error; }
  const sourceEntries = await readdir(sourceDocumentationRoot, { withFileTypes: true })
    .catch((error) => error.code === "ENOENT" ? [] : Promise.reject(error));
  const files = sourceEntries.filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".md").sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const documents = [];
  for (const file of files) {
    const path = join(sourceDocumentationRoot, file.name); const source = await readFile(path, "utf8");
    const relativePath = relative(join(repositoryRoot, "docs"), path).replaceAll("\\", "/");
    const title = source.match(/^#\s+(.+)$/m)?.[1]?.trim() || basename(file.name, ".md");
    const sections = [...source.matchAll(/^##\s+(.+)$/gm)].map((match, index, matches) => {
      const start = match.index + match[0].length; const end = matches[index + 1]?.index ?? source.length;
      return { heading: match[1].trim(), preview: documentationPreview(source.slice(start, end)) };
    });
    documents.push({ path: relativePath, title, preview: documentationPreview(source), sections, selectedWhole: selections.some((entry) => entry.path === relativePath && !entry.heading), selectedHeadings: selections.filter((entry) => entry.path === relativePath && entry.heading).map((entry) => entry.heading) });
  }
  return { documents };
}

async function saveDocumentationSelections(payload) {
  const catalog = await documentationSources(); const allowed = new Map(catalog.documents.map((document) => [document.path, new Set(document.sections.map((section) => section.heading))]));
  const selections = Array.isArray(payload?.selections) ? payload.selections : [];
  for (const selection of selections) {
    if (!allowed.has(selection.path) || (selection.heading && !allowed.get(selection.path).has(selection.heading))) throw new Error("Une sélection documentaire ne correspond plus aux sources disponibles.");
  }
  await mkdir(userDocumentationRoot, { recursive: true });
  const previous = await readFile(sourceSelectionFile, "utf8").catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
  const temporary = `${sourceSelectionFile}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify({ version: 1, selections }, null, 2)}\n`, "utf8");
    await rename(temporary, sourceSelectionFile); await runNodeScript(documentationBuilder);
  } catch (error) {
    if (previous === null) await rm(sourceSelectionFile, { force: true }); else await writeFile(sourceSelectionFile, previous, "utf8");
    await rm(temporary, { force: true }).catch(() => {}); await runNodeScript(documentationBuilder).catch(() => {}); throw error;
  }
  return { ok: true, selected: selections.length };
}

function normalize(value) {
  return normalizeRecognition(value);
}

function socialPlain(value) {
  return normalize(value).replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
}

function compilePatterns(patterns, path, errors) {
  if (!Array.isArray(patterns)) return [];
  return patterns.map((source, index) => {
    try {
      return compileRecognitionPattern(source);
    } catch (error) {
      errors.push(`${path}.patterns[${index}] : ${error.message}`);
      return null;
    }
  }).filter(Boolean);
}

function literalPattern(phrase, contained) {
  const escaped = normalize(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(contained ? `(?:^|\\s)${escaped}(?:\\s|$)` : `^${escaped}$`);
}

function validateIds(entries, path, errors) {
  const ids = new Set();
  for (const [index, entry] of entries.entries()) {
    if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(entry.id ?? "")) errors.push(`${path}[${index}].id : identifiant invalide.`);
    if (ids.has(entry.id)) errors.push(`${path}[${index}].id : identifiant dupliqué « ${entry.id} ».`);
    ids.add(entry.id);
  }
}

function validatePayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") return ["Document absent."];
  const social = payload.social;
  const help = payload.help;
  if (!social || social.version !== 1 || !Array.isArray(social.intents)) errors.push("Registre social invalide.");
  if (!help || help.version !== 1 || !Array.isArray(help.intents) || !Array.isArray(help.textTemplates) || !Array.isArray(help.suggestionTemplates)) errors.push("Registre d’aide invalide.");
  if (errors.length) return errors;

  validateIds(social.intents, "social.intents", errors);
  for (const [index, intent] of social.intents.entries()) {
    const patterns = [...(intent.phrases ?? []).map((phrase) => literalPattern(phrase, false)), ...compilePatterns(intent.patterns, `social.intents[${index}]`, errors)];
    if (patterns.length === 0) errors.push(`social.intents[${index}] : ajoutez une formulation simple ou une expression avancée.`);
    const examples = [...(intent.phrases ?? []), ...(intent.examples ?? [])];
    if (examples.length === 0) errors.push(`social.intents[${index}] : au moins une formulation ou un exemple est obligatoire.`);
    for (const example of examples) {
      if (!patterns.some((pattern) => pattern.test(socialPlain(example)))) errors.push(`L’exemple social « ${example} » n’est reconnu par aucune expression de « ${intent.id} ».`);
    }
    if (!Array.isArray(intent.responses) || intent.responses.length === 0) errors.push(`social.intents[${index}].responses : au moins une réponse est obligatoire.`);
    if (!['fixed', 'random'].includes(intent.selection)) errors.push(`social.intents[${index}].selection : choisir fixed ou random.`);
    if (intent.selection === "fixed" && intent.responses?.length !== 1) errors.push(`L’intention fixe « ${intent.id} » doit avoir exactement une réponse.`);
    for (const [responseIndex, response] of (intent.responses ?? []).entries()) {
      if (!/^designerActions\.[A-Za-z0-9]+$/.test(response.key ?? "")) errors.push(`social.intents[${index}].responses[${responseIndex}].key : clé invalide.`);
      if (!String(response.fallback ?? "").trim()) errors.push(`social.intents[${index}].responses[${responseIndex}].fallback : réponse vide.`);
    }
    if (intent.effect) {
      if (!['audio', 'video', 'image'].includes(intent.effect.kind)) errors.push(`Effet invalide pour « ${intent.id} ».`);
      if (!/^\/arion-easter-eggs\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(intent.effect.source ?? "") || String(intent.effect.source).includes("..")) errors.push(`Source média invalide pour « ${intent.id} ».`);
      if (intent.effect.volume != null && (!Number.isFinite(intent.effect.volume) || intent.effect.volume < 0 || intent.effect.volume > 1)) errors.push(`Volume invalide pour « ${intent.id} ».`);
    }
  }

  const requiredHelpIds = ["how-to", "recommend", "compare", "purpose", "details", "limitation"];
  validateIds(help.intents, "help.intents", errors);
  if (help.intents.map((entry) => entry.id).join("|") !== requiredHelpIds.join("|")) errors.push("Les six intentions d’aide et leur ordre sont structurels et ne doivent pas être modifiés.");
  for (const [index, intent] of help.intents.entries()) {
    const patterns = [...(intent.phrases ?? []).map((phrase) => literalPattern(phrase, true)), ...compilePatterns(intent.patterns, `help.intents[${index}]`, errors)];
    if (patterns.length === 0) errors.push(`help.intents[${index}] : ajoutez une formulation simple ou une expression avancée.`);
    const examples = [...(intent.phrases ?? []), ...(intent.examples ?? [])];
    if (examples.length === 0) errors.push(`help.intents[${index}] : au moins une formulation ou un exemple est obligatoire.`);
    for (const example of examples) {
      if (!patterns.some((pattern) => pattern.test(normalize(example)))) errors.push(`L’exemple d’aide « ${example} » n’est reconnu par aucune expression de « ${intent.id} ».`);
    }
  }
  for (const group of [help.textTemplates, help.suggestionTemplates.map((entry) => ({ id: entry.id, ...entry.command }))]) {
    validateIds(group, "help.templates", errors);
    for (const entry of group) {
      if (!/^designerActions\.[A-Za-z0-9]+$/.test(entry.key ?? "")) errors.push(`Clé de gabarit invalide pour « ${entry.id} ».`);
      if (!String(entry.fallback ?? "").trim()) errors.push(`Texte de gabarit vide pour « ${entry.id} ».`);
    }
  }
  return errors;
}

async function readRegistries() {
  const [social, help] = await Promise.all(Object.values(files).map(async (path) => JSON.parse(await readFile(path, "utf8"))));
  return { social, help };
}

async function saveRegistries(payload) {
  const errors = validatePayload(payload);
  if (errors.length) return { ok: false, errors };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = join(toolRoot, "backups", stamp);
  await mkdir(backupRoot, { recursive: true });
  await Promise.all([
    ...Object.entries(files).map(([name, path]) => copyFile(path, join(backupRoot, `${name}.json`))),
    copyFile(frenchLocaleFile, join(backupRoot, "fr.json"))
  ]);
  const frenchLocale = JSON.parse(await readFile(frenchLocaleFile, "utf8"));
  const localizedEntries = [
    ...payload.social.intents.flatMap((intent) => intent.responses),
    ...payload.help.textTemplates,
    ...payload.help.suggestionTemplates.map((template) => template.command)
  ];
  for (const entry of localizedEntries) {
    frenchLocale[entry.key] = entry.fallback;
  }
  const writes = [
    ...Object.entries(files).map(([name, path]) => ({ path, backup: join(backupRoot, `${name}.json`), content: `${JSON.stringify(payload[name], null, 2)}\n` })),
    { path: frenchLocaleFile, backup: join(backupRoot, "fr.json"), content: `${JSON.stringify(frenchLocale, null, 2)}\n` }
  ].map((entry) => ({ ...entry, temporary: `${entry.path}.${process.pid}.tmp` }));
  try {
    await Promise.all(writes.map((entry) => writeFile(entry.temporary, entry.content, "utf8")));
    for (const entry of writes) await rename(entry.temporary, entry.path);
  } catch (error) {
    await Promise.all(writes.map((entry) => copyFile(entry.backup, entry.path).catch(() => {})));
    await Promise.all(writes.map((entry) => rm(entry.temporary, { force: true }).catch(() => {})));
    throw new Error(`Enregistrement annulé et fichiers restaurés : ${error.message}`);
  }
  return { ok: true, backup: backupRoot };
}

function send(response, status, body, contentType = "application/json; charset=utf-8") {
  const payload = contentType.startsWith("application/json") ? JSON.stringify(body) : body;
  response.writeHead(status, { "Content-Type": contentType, "Content-Length": Buffer.byteLength(payload), "Cache-Control": "no-store" });
  response.end(payload);
}

async function importWorkbook(request, kind) {
  if (kind !== "social" && kind !== "help") throw new Error("Type de matrice inconnu.");
  const rows = await readSheet(await requestBody(request, 5_000_000), kind === "social" ? "Interactions" : "Aide");
  const expectedColumns = kind === "social" ? 5 : 4;
  const dataRows = rows.slice(1).filter((row) => row.slice(1, expectedColumns).some((cell) => String(cell ?? "").trim()));
  const content = dataRows.map((row) => Array.from({ length: expectedColumns }, (_, index) => String(row[index] ?? "").trim()).join("\t")).join("\n");
  if (!content) throw new Error("La matrice ne contient aucune phrase ou regex à importer.");
  return { ok: true, content };
}

function workbookCell(value, example = false) {
  return {
    value: String(value ?? ""),
    type: String,
    backgroundColor: example ? "#FFF4CC" : undefined,
    borderColor: example ? "#D8C46A" : "#D7E0EF",
    borderStyle: "thin",
    alignVertical: "top",
    wrap: true
  };
}

async function exportSocialWorkbook(payload) {
  const errors = validatePayload({ social: payload, help: (await readRegistries()).help });
  if (errors.length) return { errors };
  const headers = ["Intention — identifiant", "Phrase reconnue", "Réponse d'Arion", "Regex avancée — facultatif", "Phrase de test — facultatif"];
  const header = headers.map((value) => ({ value, type: String, fontWeight: "bold", textColor: "#FFFFFF", backgroundColor: "#244585", borderColor: "#FFFFFF", borderStyle: "thin", align: "center", alignVertical: "center", wrap: true, height: 34 }));
  const rows = [header];
  for (const intent of payload.intents) {
    const count = Math.max(1, intent.phrases?.length ?? 0, intent.responses?.length ?? 0, intent.patterns?.length ?? 0, intent.examples?.length ?? 0);
    for (let index = 0; index < count; index += 1) {
      rows.push([
        workbookCell(intent.id),
        workbookCell(intent.phrases?.[index]),
        workbookCell(intent.responses?.[index]?.fallback),
        workbookCell(intent.patterns?.[index]),
        workbookCell(intent.examples?.[index])
      ]);
    }
  }
  const guide = [
    ["Colonne", "Ce qu'il faut saisir", "Exemple"].map((value) => ({ ...header[0], value })),
    [workbookCell("Intention — identifiant"), workbookCell("Nom stable en minuscules, chiffres et tirets. Il est répété sur toutes les lignes de la même intention."), workbookCell("cafe", true)],
    [workbookCell("Phrase reconnue"), workbookCell("Une formulation utilisateur par ligne."), workbookCell("Fais-moi un café", true)],
    [workbookCell("Réponse d'Arion"), workbookCell("Une réponse possible. Plusieurs réponses produisent une sélection aléatoire."), workbookCell("Je lance la machine virtuelle.", true)],
    [workbookCell("Regex avancée — facultatif"), workbookCell("Une expression couvrant plusieurs variantes."), workbookCell("\\b(fais|prepare)[ -]moi un cafe\\b", true)],
    [workbookCell("Phrase de test — facultatif"), workbookCell("Une formulation qui doit être reconnue, sans créer une nouvelle règle."), workbookCell("Prépare-moi un café", true)]
  ];
  const document = await writeXlsxFile([
    { data: rows, sheet: "Interactions", columns: [25, 42, 55, 43, 42].map((width) => ({ width })), stickyRowsCount: 1, showGridLines: false, zoomScale: 0.85 },
    { data: guide, sheet: "Mode d'emploi", columns: [{ width: 32 }, { width: 70 }, { width: 42 }], stickyRowsCount: 1, showGridLines: false, zoomScale: 0.9 }
  ], undefined, { fontFamily: "Arial", fontSize: 11 });
  return { buffer: await document.toBuffer() };
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/api/understanding-export' && request.method === 'POST') {
      const payload=JSON.parse((await requestBody(request,1_000_000)).toString('utf8'));
      const result=await understanding.validate(payload);
      if(!result.ok)return send(response,400,result);
      const rows=[['Identifiant','Capacité','Formulations','Regex','Tests positifs','Tests négatifs'].map(workbookCell),...payload.rules.map(rule=>[rule.id,rule.capabilityId,rule.phrases.join('\n'),rule.patterns.join('\n'),rule.positive.join('\n'),rule.negative.join('\n')].map(value=>workbookCell(value)))];
      const vocabulary=[['Terme reconnu','Synonymes'].map(workbookCell),...(payload.synonyms??[]).map(item=>[item.canonical,item.forms.join('\n')].map(value=>workbookCell(value)))];
      const book=await writeXlsxFile([
        {data:rows,sheet:'Actions',columns:[24,35,45,55,45,45].map(width=>({width})),stickyRowsCount:1},
        {data:vocabulary,sheet:'Vocabulaire',columns:[30,55].map(width=>({width})),stickyRowsCount:1}
      ],undefined,{fontFamily:'Arial',fontSize:11});
      return send(response,200,await book.toBuffer(),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }
    if(url.pathname==='/api/understanding-import' && request.method==='POST') {
      const workbook=await requestBody(request,5_000_000);
      const rows=await readSheet(workbook,'Actions');
      let vocabulary=[];
      try { vocabulary=await readSheet(workbook,'Vocabulaire'); }
      catch (error) { if (!String(error?.message??error).includes('Vocabulaire')) throw error; }
      const list=value=>String(value??'').split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
      const registry={version:1,synonyms:vocabulary.slice(1).filter(row=>row.some(value=>String(value??'').trim())).map(row=>({canonical:String(row[0]??'').trim(),forms:list(row[1])})),rules:rows.slice(1).filter(row=>row.some(value=>String(value??'').trim())).map(row=>({id:String(row[0]??''),capabilityId:String(row[1]??''),phrases:list(row[2]),patterns:list(row[3]),positive:list(row[4]),negative:list(row[5])}))};
      const result=await understanding.validate(registry);
      return send(response,result.ok?200:400,{...result,registry});
    }
    if (url.pathname === '/api/knowledge' && request.method === 'GET') return send(response, 200, await knowledge.read());
    if (['/api/knowledge', '/api/knowledge-validate'].includes(url.pathname) && request.method === 'POST') {
      const payload = JSON.parse((await requestBody(request, 2_000_000)).toString('utf8'));
      const errors = validateKnowledge(payload.registry);
      return send(response, 200, url.pathname.endsWith('-validate') ? {ok:!errors.length,errors} : await knowledge.save(payload));
    }
    if (url.pathname === '/api/understanding' && request.method === 'GET') return send(response, 200, await understanding.read());
    if (['/api/understanding', '/api/understanding-test'].includes(url.pathname) && request.method === 'POST') {
      const payload = JSON.parse((await requestBody(request, 1_000_000)).toString('utf8'));
      return send(response, 200, await (url.pathname.endsWith('-test') ? understanding.validate(payload) : understanding.save(payload)));
    }
    if (url.pathname === '/api/massifiable' && request.method === 'GET') return send(response, 200, await massifiable.read());
    if (url.pathname === '/api/server-status' && request.method === 'GET') return send(response, 200, { ok: true, instanceId: serverInstanceId, pid: process.pid, port, servers: await detectedToolServers() });
    if (url.pathname === '/api/server-control' && request.method === 'POST') {
      const payload = JSON.parse((await requestBody(request, 10_000)).toString('utf8'));
      if (!['stop', 'restart'].includes(payload.action) || !['self', 'all'].includes(payload.scope ?? 'all')) throw new Error('Commande serveur invalide.');
      const scope = payload.scope ?? 'all';
      const detected = await detectedToolServers();
      send(response, 200, { ok: true, action: payload.action, affected: scope === 'all' ? detected.length : 1, instanceId: serverInstanceId });
      setTimeout(() => controlToolServers(payload.action, scope).catch(error => console.error(error)), 80);
      return;
    }
    if (url.pathname === '/api/managed-documents' && request.method === 'GET') return send(response, 200, { documents: await managedDocuments() });
    if (url.pathname === '/api/managed-documents' && request.method === 'POST') return send(response, 200, await updateManagedDocument(JSON.parse((await requestBody(request, 2_100_000)).toString('utf8'))));
    if (url.pathname === '/api/managed-documents/batch' && request.method === 'POST') return send(response, 200, await updateManagedDocuments(JSON.parse((await requestBody(request, 25_000_000)).toString('utf8'))));
    if (url.pathname === '/api/massifiable' && request.method === 'POST') return send(response, 200, await massifiable.save(JSON.parse((await requestBody(request, 1_000_000)).toString('utf8'))));
    if (url.pathname === "/api/registries" && request.method === "GET") return send(response, 200, await readRegistries());
    if (url.pathname === "/api/documentation" && request.method === "GET") return send(response, 200, JSON.parse(await readFile(documentationIndexFile, "utf8")));
    if (url.pathname === "/api/documentation-sources" && request.method === "GET") return send(response, 200, await documentationSources());
    if (url.pathname === "/api/documentation-sources" && request.method === "POST") return send(response, 200, await saveDocumentationSelections(JSON.parse((await requestBody(request, 200_000)).toString("utf8"))));
    if (url.pathname === "/api/documentation-import" && request.method === "POST") return send(response, 200, await importDocumentation(request));
    if (url.pathname === "/api/workbook-import" && request.method === "POST") return send(response, 200, await importWorkbook(request, url.searchParams.get("kind")));
    if (url.pathname === "/api/social-export" && request.method === "POST") {
      const result = await exportSocialWorkbook(JSON.parse((await requestBody(request, 2_000_000)).toString("utf8")));
      if (result.errors) return send(response, 422, { ok: false, errors: result.errors });
      return send(response, 200, result.buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }
    if ((url.pathname === "/api/validate" || url.pathname === "/api/registries") && request.method === "POST") {
      const payload = JSON.parse((await requestBody(request, 2_000_000)).toString("utf8"));
      if (url.pathname === "/api/validate") {
        const errors = validatePayload(payload);
        return send(response, errors.length ? 422 : 200, { ok: errors.length === 0, errors });
      }
      const result = await saveRegistries(payload);
      return send(response, result.ok ? 200 : 422, result);
    }
    const relative = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (!/^[a-zA-Z0-9._/-]+$/.test(relative) || relative.includes("..")) return send(response, 404, "Introuvable", "text/plain; charset=utf-8");
    const path = join(toolRoot, relative);
    const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    const contentType = types[extname(path)] ?? "text/plain; charset=utf-8";
    return send(response, 200, await readFile(path, contentType.includes("charset") ? "utf8" : undefined), contentType);
  } catch (error) {
    return send(response, 500, { ok: false, errors: [error.message] });
  }
});

let shutdownStarted = false;

async function closeCurrentServer(restart) {
  if (shutdownStarted) return;
  shutdownStarted = true;
  let shutdownCompleted = false;
  const completeShutdown = async () => {
    if (shutdownCompleted) return;
    shutdownCompleted = true;
    await rm(serverRuntimeFile, { force: true }).catch(() => {});
    if (restart) {
      spawn(process.execPath, [fileURLToPath(import.meta.url)], {
        cwd: repositoryRoot,
        env: { ...process.env, PAIDEIA_ARION_EDITOR_PORT: String(port), PAIDEIA_ARION_EDITOR_NO_OPEN: '1' },
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      }).unref();
    }
    process.exit(0);
  };
  server.close(completeShutdown);
  setTimeout(completeShutdown, 5000).unref();
}

async function controlToolServers(action, scope) {
  if (scope === 'all') {
    const siblings = (await detectedToolServers()).filter(item => item.pid !== process.pid);
    await Promise.all(siblings.map(item => fetch(`http://127.0.0.1:${item.port}/api/server-control`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop', scope: 'self' })
    }).catch(() => null)));
  }
  await closeCurrentServer(action === 'restart');
}

process.once('SIGINT', () => closeCurrentServer(false));
process.once('SIGTERM', () => closeCurrentServer(false));

server.listen(port, "127.0.0.1", async () => {
  await mkdir(serverRuntimeRoot, { recursive: true });
  await writeFile(serverRuntimeFile, `${JSON.stringify({ instanceId: serverInstanceId, pid: process.pid, port, startedAt: new Date().toISOString() })}\n`, 'utf8');
  const url = `http://127.0.0.1:${port}`;
  console.log(`Éditeur Arion disponible sur ${url}`);
  if (process.platform === "win32" && process.env.PAIDEIA_ARION_EDITOR_NO_OPEN !== "1") spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
});
