import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { Window } from "happy-dom";
import { readSheet } from "read-excel-file/browser";
import writeXlsxFile from "write-excel-file/browser";
import { createServer } from "vite";

const window = new Window();
globalThis.DOMParser = window.DOMParser;
globalThis.document = window.document;
globalThis.Node = window.Node;
globalThis.HTMLElement = window.HTMLElement;
for (const key of ["HTMLAnchorElement", "HTMLImageElement", "HTMLTableElement", "HTMLTableCellElement", "Element", "Text"]) globalThis[key] = window[key];
const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" });

const {
  exportAssistantXlsx,
  exportReferenceBankXlsx,
  exportQuestionBankXlsx,
  importAssistantXlsx,
  importReferenceBankXlsx,
  importQuestionBankXlsx
} = await vite.ssrLoadModule("/src/components/resources/resourceWorkbook.ts");
const { exportBankPackage, importBankFiles } = await vite.ssrLoadModule("/src/components/resources/resourceBankPackage.ts");

function xlsxFile(blob, name) {
  return new File([blob], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

function imageSources(html) {
  return [...new DOMParser().parseFromString(html, "text/html").querySelectorAll("img")]
    .map((image) => image.getAttribute("src"));
}

const questions = [
  {
    id: "q1",
    title: "Ponctuation, séparateurs et mise en forme",
    category: "Pédagogie",
    tags: ["évaluation, formative", "mot|conservé"],
    mode: "multiple",
    questionHtml: "<p>Quelle <strong>pratique</strong> convient ?</p>",
    answers: [
      { id: "a1", textHtml: "<p>Donner un retour, précis</p>", correct: true, creditPercent: 50, feedbackHtml: "<p>Bon choix.</p>" },
      { id: "a2", textHtml: "<p>Faire réfléchir | puis expliquer</p>", correct: true, creditPercent: 50, feedbackHtml: "<p>Autre bon choix.</p>" },
      { id: "a3", textHtml: "<p>Ignorer les réponses</p>", correct: false, creditPercent: -25, feedbackHtml: "<p>Ce choix est incorrect.</p>" }
    ],
    generalFeedbackHtml: "<p>Revenez aux objectifs.</p>",
    feedbackCorrectHtml: "<p>Exact.</p>",
    feedbackIncorrectHtml: "<p>Réessayez.</p>",
    points: 0
  },
  {
    id: "q2",
    title: "Vrai ou faux",
    category: "Pédagogie",
    tags: [],
    mode: "true-false",
    questionHtml: "<p>Le feedback accompagne l’apprentissage.</p>",
    answers: [
      { id: "a1", textHtml: "<p>Vrai</p>", correct: true },
      { id: "a2", textHtml: "<p>Faux</p>", correct: false }
    ],
    feedbackCorrectHtml: "",
    feedbackIncorrectHtml: "",
    points: 1
  },
  {
    id: "q3",
    title: "Crédit réparti automatiquement",
    category: "Pédagogie",
    tags: [],
    mode: "multiple",
    creditMode: "equal",
    questionHtml: "<p>Choisissez les bonnes réponses.</p>",
    answers: [
      { id: "a1", textHtml: "<p>Une</p>", correct: true },
      { id: "a2", textHtml: "<p>Deux</p>", correct: true },
      { id: "a3", textHtml: "<p>Trois</p>", correct: true },
      { id: "a4", textHtml: "<p>Quatre</p>", correct: false }
    ],
    points: 10
  }
];

const questionBlob = await exportQuestionBankXlsx(questions);
const zippedQuestions = await exportBankPackage([{ name: "Questions", bytes: new Uint8Array(await questionBlob.arrayBuffer()) }]);
const [unzippedQuestions] = await importBankFiles(new File([Uint8Array.from(zippedQuestions)], "questions.zip"), ["xlsx"]);
assert.equal(unzippedQuestions.name, "Questions.xlsx");
assert.equal((await importQuestionBankXlsx(unzippedQuestions)).length, questions.length);
const questionArchive = unzipSync(new Uint8Array(await questionBlob.arrayBuffer()));
const questionSheetXml = strFromU8(questionArchive["xl/worksheets/sheet1.xml"]);
assert.match(questionSheetXml, /zoomScale="85"/);
assert.doesNotMatch(questionSheetXml, /zoomScale="8500"/);
const questionFile = xlsxFile(questionBlob, "questions.xlsx");
const questionRows = await readSheet(questionFile, "Questions");
assert.equal(questionRows[0][0], "Statut de la ligne");
assert.equal(questionRows[1][0], "QUESTION");
assert.equal(questionRows[1].some((value) => typeof value === "string" && /<\/?[a-z]/i.test(value)), false);
assert.equal(questionRows[1].includes("évaluation, formative"), true);
assert.equal(questionRows[1].includes("mot|conservé"), true);
assert.equal(questionRows[2].includes("Vrai"), true);
assert.equal(questionRows[2].includes("Faux"), true);

const importedQuestions = await importQuestionBankXlsx(questionFile);
assert.equal(importedQuestions.length, 3);
assert.equal(importedQuestions[0].creditMode, "custom");
assert.equal(importedQuestions[0].answers.length, 3);
assert.equal(importedQuestions[0].answers.filter((answer) => answer.correct).length, 2);
assert.deepEqual(importedQuestions[0].answers.map((answer) => answer.creditPercent), [50, 50, -25]);
assert.equal(importedQuestions[0].points, 1);
assert.equal(importedQuestions[0].questionHtml.includes("font-size"), false);
assert.deepEqual(importedQuestions[0].tags, ["évaluation, formative", "mot|conservé"]);
assert.match(importedQuestions[0].generalFeedbackHtml, /Revenez aux objectifs/);
assert.deepEqual(importedQuestions[0].answers.map((answer) => answer.feedbackHtml), [
  "<p>Bon choix.</p>", "<p>Autre bon choix.</p>", "<p>Ce choix est incorrect.</p>"
]);
assert.deepEqual(importedQuestions[1].answers.map((answer) => [answer.textHtml, answer.correct]), [
  ["<p>Vrai</p>", true],
  ["<p>Faux</p>", false]
]);
assert.equal(importedQuestions[2].creditMode, "equal");
assert.equal(importedQuestions[2].answers.filter((answer) => answer.correct).length, 3);
assert.equal(importedQuestions[2].answers.every((answer) => answer.creditPercent == null), true);

const legacyColumnIndexes = questionRows[0]
  .map((label, index) => /^(Feedback réponse|Crédit \(%\)) \d+$/.test(String(label)) || ["Feedback général", "Notation QCM", "Répartition du crédit"].includes(label) ? -1 : index)
  .filter((index) => index >= 0);
const legacyBlob = await writeXlsxFile(
  questionRows.map((row) => legacyColumnIndexes.map((index) => ({ value: String(row[index] ?? ""), type: String }))),
  { sheet: "Questions" }
).toBlob();
const legacyQuestions = await importQuestionBankXlsx(xlsxFile(legacyBlob, "questions-ancien-format.xlsx"));
assert.equal(legacyQuestions.length, 3);
assert.equal(legacyQuestions[0].answers[0].feedbackHtml, "");
assert.equal(legacyQuestions[0].answers[0].creditPercent, undefined);
assert.equal(legacyQuestions[0].generalFeedbackHtml, "");
const previousCreditColumnIndexes = questionRows[0]
  .map((label, index) => ["Notation QCM", "Répartition du crédit"].includes(label) ? -1 : index)
  .filter((index) => index >= 0);
const previousCreditBlob = await writeXlsxFile(
  questionRows.map((row) => previousCreditColumnIndexes.map((index) => ({ value: String(row[index] ?? ""), type: String }))),
  { sheet: "Questions" }
).toBlob();
const previousCreditQuestions = await importQuestionBankXlsx(xlsxFile(previousCreditBlob, "questions-credit-ancien-format.xlsx"));
assert.equal(previousCreditQuestions[0].creditMode, "custom");
assert.deepEqual(previousCreditQuestions[0].answers.map((answer) => answer.creditPercent), [50, 50, -25]);

const emptyQuestionFile = xlsxFile(await exportQuestionBankXlsx([]), "questions-empty.xlsx");
await assert.rejects(() => importQuestionBankXlsx(emptyQuestionFile), /lignes d’exemple/i);

const entries = [
  {
    id: "entry1",
    term: "Étayage",
    aliases: ["aide, temporaire", "soutien|progressif"],
    contentHtml: "<p>Une <strong>aide</strong> retirée progressivement.</p>",
    related: ["autonomie", "zone proximale"],
    fuzzy: true
  }
];
const assistantBlob = await exportAssistantXlsx(entries);
const assistantFile = xlsxFile(assistantBlob, "assistant.xlsx");
const assistantRows = await readSheet(assistantFile, "Assistant");
assert.equal(assistantRows[0][0], "Statut de la ligne");
assert.equal(assistantRows[1][0], "ENTRÉE");
assert.equal(assistantRows[1].some((value) => typeof value === "string" && /<\/?[a-z]/i.test(value)), false);
const importedEntries = await importAssistantXlsx(assistantFile);
assert.equal(importedEntries.length, 1);
assert.deepEqual(importedEntries[0].aliases, ["aide, temporaire", "soutien|progressif"]);
assert.deepEqual(importedEntries[0].related, ["autonomie", "zone proximale"]);
assert.equal(importedEntries[0].contentHtml.includes("font-size"), false);

const emptyAssistantFile = xlsxFile(await exportAssistantXlsx([]), "assistant-empty.xlsx");
await assert.rejects(() => importAssistantXlsx(emptyAssistantFile), /lignes d’exemple/i);

const referenceEntries = [
  { id: "ref1", term: "DNS", definitionHtml: "<p>Système de noms de domaine.</p><p>Deuxième ligne.</p>" },
  { id: "ref2", term: "DNS", definitionHtml: "<p>Doublon volontaire.</p>" }
];
const referenceBlob = await exportReferenceBankXlsx(referenceEntries);
const referenceFile = xlsxFile(referenceBlob, "balises.xlsx");
const referenceArchive = unzipSync(new Uint8Array(await referenceBlob.arrayBuffer()));
const referenceSheetXml = strFromU8(referenceArchive["xl/worksheets/sheet1.xml"]);
const referenceSheet = new DOMParser().parseFromString(referenceSheetXml, "application/xml");
const referenceStyles = new DOMParser().parseFromString(strFromU8(referenceArchive["xl/styles.xml"]), "application/xml");
assert.match(referenceSheetXml, /showGridLines="1"/);
const definitionCell = [...referenceSheet.getElementsByTagName("c")].find((cell) => cell.getAttribute("r") === "B2");
const definitionStyle = referenceStyles.getElementsByTagName("cellXfs")[0].children[Number(definitionCell.getAttribute("s"))];
assert.equal(definitionStyle.getElementsByTagName("alignment")[0].getAttribute("wrapText"), "1");
const definitionBorder = referenceStyles.getElementsByTagName("borders")[0].children[Number(definitionStyle.getAttribute("borderId"))];
for (const side of ["left", "right", "top", "bottom"]) assert.equal(definitionBorder.getElementsByTagName(side)[0].getAttribute("style"), "thin");
const referenceColumns = [...referenceSheet.getElementsByTagName("col")];
assert.equal(referenceColumns[0].getAttribute("hidden"), null);
assert.equal(referenceColumns[1].getAttribute("hidden"), null);
assert.equal(referenceColumns[2].getAttribute("hidden"), "1");
assert.equal(referenceColumns[3].getAttribute("hidden"), "1");
const referenceRows = await readSheet(referenceFile, "Balises et renvois");
assert.deepEqual(referenceRows[0], ["Mot", "Définition", "PAIDEIA ID", "PAIDEIA HTML"]);
const importedReferences = await importReferenceBankXlsx(referenceFile);
assert.equal(importedReferences.length, 2);
assert.equal(importedReferences[0].term, "DNS");
assert.match(importedReferences[0].definitionHtml, /Deuxième ligne/);
assert.notEqual(importedReferences[0].id, importedReferences[1].id);
assert.equal(importedReferences[0].id, "ref1");
const enriched = [{ id: "rich", term: "SSO", definitionHtml: '<p>Une <strong>définition</strong>.</p><p>Suite.</p>' }];
const enrichedFile = xlsxFile(await exportReferenceBankXlsx(enriched), "rich.xlsx");
const roundtrip = await importReferenceBankXlsx(enrichedFile, enriched);
assert.equal(roundtrip[0].id, "rich");
assert.match(roundtrip[0].definitionHtml, /<strong>définition<\/strong>/);

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==";
const withMedia = [
  { id: "illustrated", term: "Ventirad", definitionHtml: `<p><strong>Avant</strong> <span class="paideia-rich-image-float" data-paideia-rich-image-wrap="left" contenteditable="false"><img class="rich-inline-image" src="${png}" width="1" height="1" alt="Exemple"></span> <em>après</em>.</p>` },
  { id: "image-only", term: "Vue", definitionHtml: `<p><img class="rich-inline-image" src="${png}" width="1" height="1"></p>` }
];
const mediaBlob = await exportReferenceBankXlsx(withMedia);
const mediaArchive = unzipSync(new Uint8Array(await mediaBlob.arrayBuffer()));
const mediaMainRows = await readSheet(xlsxFile(mediaBlob, "media.xlsx"), "Balises et renvois");
assert.deepEqual(mediaMainRows[0].slice(0, 3), ["Mot", "Définition", "Illustration(s)"]);
assert.ok(mediaArchive["xl/drawings/drawing1.xml"], "exported illustrations must be visible in Calc and Excel");
assert.ok(mediaArchive["xl/media/sheet1-image1.png"], "the visible illustration must be inside the XLSX");
assert.match(strFromU8(mediaArchive["xl/drawings/drawing1.xml"]), /paideia-preview:image-1/);
const visibleColumns = [...new DOMParser().parseFromString(strFromU8(mediaArchive["xl/worksheets/sheet1.xml"]), "application/xml")
  .getElementsByTagName("col")];
assert.equal(visibleColumns[2].getAttribute("hidden"), null, "illustrations column must be visible");
assert.ok(mediaArchive["xl/worksheets/sheet2.xml"], "the media sheet is inside the XLSX archive");
assert.match(strFromU8(mediaArchive["xl/workbook.xml"]), /name="PAIDEIA Médias"[^>]*state="hidden"/);
assert.doesNotMatch(strFromU8(mediaArchive["xl/worksheets/sheet1.xml"]), /data:image\/png/,
  "image base64 must not overflow an Excel text cell");
const mediaRows = await readSheet(xlsxFile(mediaBlob, "media.xlsx"), "PAIDEIA Médias");
assert.equal(mediaRows.length, 3);
assert.ok(mediaRows[1].slice(2).every((value) => String(value).length <= 30_000));
const restoredMedia = await importReferenceBankXlsx(xlsxFile(mediaBlob, "media.xlsx"));
assert.equal(restoredMedia.length, 2);
assert.match(restoredMedia[0].definitionHtml, /<strong>Avant<\/strong>/);
assert.match(restoredMedia[0].definitionHtml, /<em>après<\/em>/);
assert.match(restoredMedia[0].definitionHtml, /paideia-rich-image-float/);
assert.match(restoredMedia[0].definitionHtml, /alt="Exemple"/);
assert.match(restoredMedia[0].definitionHtml, /data:image\/png;base64,/);
assert.match(restoredMedia[1].definitionHtml, /data:image\/png;base64,/,
  "image-only definitions must survive the import");
assert.deepEqual(imageSources(restoredMedia[0].definitionHtml), imageSources(withMedia[0].definitionHtml));
assert.deepEqual(imageSources(restoredMedia[1].definitionHtml), imageSources(withMedia[1].definitionHtml));
const externalBlob = await writeXlsxFile([{
  sheet: "Mes définitions",
  data: [
    [{ value: "Mot", type: String }, { value: "Définition", type: String }, { value: "Illustration(s)", type: String }],
    [{ value: "Ventirad", type: String }, { value: "Texte externe", type: String }, { value: "", type: String }],
    [{ value: "Vue", type: String }, { value: "", type: String }, { value: "", type: String }],
    [{ value: "JPEG", type: String }, { value: "Photo", type: String }, { value: "", type: String }],
    [{ value: "WebP", type: String }, { value: "Illustration", type: String }, { value: "", type: String }]
  ],
  images: [
    { content: new Blob([Uint8Array.from(atob(png.split(",")[1]), (character) => character.charCodeAt(0))], { type: "image/png" }),
      contentType: "image/png", width: 80, height: 80, dpi: 96, anchor: { row: 2, column: 3 }, offsetX: 8, offsetY: 8 },
    { content: new Blob([Uint8Array.from(atob(png.split(",")[1]), (character) => character.charCodeAt(0))], { type: "image/png" }),
      contentType: "image/png", width: 80, height: 80, dpi: 96, anchor: { row: 3, column: 2 }, offsetX: 8, offsetY: 8 },
    { content: new Blob([readFileSync("public/default-assets/image360-demo.jpg")], { type: "image/jpeg" }),
      contentType: "image/jpeg", width: 80, height: 80, dpi: 96, anchor: { row: 4, column: 3 }, offsetX: 8, offsetY: 8 },
    { content: new Blob([readFileSync("src/assets/image-default-preview.webp")], { type: "image/webp" }),
      contentType: "image/webp", width: 80, height: 80, dpi: 96, anchor: { row: 5, column: 3 }, offsetX: 8, offsetY: 8 }
  ]
}], { fontFamily: "Arial", fontSize: 11 }).toBlob();
const externalFile = xlsxFile(externalBlob, "external.xlsx");
const externalImported = await importReferenceBankXlsx(externalFile);
assert.equal(externalImported.length, 4);
assert.match(externalImported[0].definitionHtml, /Texte externe/);
assert.deepEqual(imageSources(externalImported[0].definitionHtml), [png]);
assert.deepEqual(imageSources(externalImported[1].definitionHtml), [png]);
assert.deepEqual(imageSources(externalImported[2].definitionHtml),
  [`data:image/jpeg;base64,${readFileSync("public/default-assets/image360-demo.jpg").toString("base64")}`]);
assert.deepEqual(imageSources(externalImported[3].definitionHtml),
  [`data:image/webp;base64,${readFileSync("src/assets/image-default-preview.webp").toString("base64")}`]);
for (const entry of externalImported) {
  const image = new DOMParser().parseFromString(entry.definitionHtml, "text/html").querySelector("img");
  assert.ok(Number(image.getAttribute("width")) > 0 && Number(image.getAttribute("height")) > 0);
  assert.ok(Math.max(Number(image.getAttribute("width")), Number(image.getAttribute("height"))) <= 300);
}
assert.equal(new DOMParser().parseFromString(externalImported[0].definitionHtml, "text/html").querySelector("img").getAttribute("width"), "1",
  "a small source image must keep its actual display dimensions");
if (process.env.PAIDEIA_REFERENCE_EXTERNAL_FIXTURE_PATH) {
  await writeFile(process.env.PAIDEIA_REFERENCE_EXTERNAL_FIXTURE_PATH, new Uint8Array(await externalBlob.arrayBuffer()));
}
if (process.env.PAIDEIA_REFERENCE_EXTERNAL_IMPORT_FIXTURE_PATH) {
  const imported = await importReferenceBankXlsx(new File([readFileSync(process.env.PAIDEIA_REFERENCE_EXTERNAL_IMPORT_FIXTURE_PATH)], "external-resaved.xlsx"));
  assert.ok(imported.length >= 2);
  assert.match(imported[0].definitionHtml, /Texte externe/);
  for (const entry of imported) assert.equal(imageSources(entry.definitionHtml).length, 1);
  if (imported.length === 4) {
    assert.ok(imageSources(imported[3].definitionHtml)[0].length > 1_500_000,
      "LibreOffice's large converted image must not be truncated or reduced to fit an arbitrary byte limit");
    const reexported = await exportReferenceBankXlsx(imported);
    const reimported = await importReferenceBankXlsx(xlsxFile(reexported, "external-reexported.xlsx"));
    assert.deepEqual(imageSources(reimported[3].definitionHtml), imageSources(imported[3].definitionHtml));
  }
}
if (process.env.PAIDEIA_REFERENCE_FIXTURE_PATH) {
  await writeFile(process.env.PAIDEIA_REFERENCE_FIXTURE_PATH, new Uint8Array(await mediaBlob.arrayBuffer()));
}
if (process.env.PAIDEIA_REFERENCE_IMPORT_FIXTURE_PATH) {
  const imported = await importReferenceBankXlsx(new File([readFileSync(process.env.PAIDEIA_REFERENCE_IMPORT_FIXTURE_PATH)], "resaved.xlsx"));
  assert.match(imported[0].definitionHtml, /<strong>Avant<\/strong>/);
  assert.match(imported[0].definitionHtml, /<em>après<\/em>/);
  assert.match(imported[0].definitionHtml, /paideia-rich-image-float/);
  assert.match(imported[0].definitionHtml, /data:image\/png;base64,/);
  assert.match(imported[1].definitionHtml, /data:image\/png;base64,/);
  assert.deepEqual(imageSources(imported[0].definitionHtml), imageSources(withMedia[0].definitionHtml));
  assert.deepEqual(imageSources(imported[1].definitionHtml), imageSources(withMedia[1].definitionHtml));
}
const imageFormats = [
  { mime: "image/jpeg", file: "public/default-assets/image360-demo.jpg" },
  { mime: "image/webp", file: "src/assets/image-default-preview.webp" }
];
const alternateMedia = imageFormats.map(({ mime, file }, index) => ({
  id: `format-${index}`, term: `Format ${index}`,
  definitionHtml: `<p>Texte <img class="rich-inline-image" src="data:${mime};base64,${readFileSync(file).toString("base64")}" width="300" height="150"></p>`
}));
const alternateBlob = await exportReferenceBankXlsx(alternateMedia);
const alternateRestored = await importReferenceBankXlsx(xlsxFile(alternateBlob, "formats.xlsx"));
for (const [index, { mime }] of imageFormats.entries()) {
  assert.match(alternateRestored[index].definitionHtml, new RegExp(`data:${mime};base64,`));
  assert.deepEqual(imageSources(alternateRestored[index].definitionHtml), imageSources(alternateMedia[index].definitionHtml));
}
if (process.env.PAIDEIA_REFERENCE_FORMATS_FIXTURE_PATH) {
  await writeFile(process.env.PAIDEIA_REFERENCE_FORMATS_FIXTURE_PATH, new Uint8Array(await alternateBlob.arrayBuffer()));
}
if (process.env.PAIDEIA_REFERENCE_FORMATS_IMPORT_FIXTURE_PATH) {
  const imported = await importReferenceBankXlsx(new File([readFileSync(process.env.PAIDEIA_REFERENCE_FORMATS_IMPORT_FIXTURE_PATH)], "formats-resaved.xlsx"));
  for (const [index, { mime }] of imageFormats.entries()) {
    assert.match(imported[index].definitionHtml, new RegExp(`data:${mime};base64,`));
    assert.deepEqual(imageSources(imported[index].definitionHtml), imageSources(alternateMedia[index].definitionHtml));
  }
}
const editedMediaArchive = unzipSync(new Uint8Array(await mediaBlob.arrayBuffer()));
editedMediaArchive["xl/sharedStrings.xml"] = strToU8(strFromU8(editedMediaArchive["xl/sharedStrings.xml"])
  .replace("Avant  après.", "Modifié  après."));
await assert.rejects(() => importReferenceBankXlsx(xlsxFile(new Blob([zipSync(editedMediaArchive)]), "edited-media.xlsx")),
  /position des images/i, "an Excel text edit must not silently discard or move images");
delete mediaArchive["xl/worksheets/sheet2.xml"];
await assert.rejects(() => importReferenceBankXlsx(xlsxFile(new Blob([zipSync(mediaArchive)]), "missing-media.xlsx")),
  /image|média/i, "a damaged workbook must never silently discard an image");

const verboseHtml = `<p>${"<strong>a</strong>".repeat(2500)}</p>`;
const verboseFile = xlsxFile(await exportReferenceBankXlsx([{ id: "verbose", term: "Long", definitionHtml: verboseHtml }]), "long.xlsx");
const verboseRows = await readSheet(verboseFile, "Balises et renvois");
assert.ok(verboseRows[0].length > 4, "long RichText HTML must be split across Excel cells");
const verboseRestored = await importReferenceBankXlsx(verboseFile);
assert.equal((verboseRestored[0].definitionHtml.match(/<strong>a<\/strong>/g) ?? []).length, 2500);
if (process.env.PAIDEIA_REFERENCE_LONG_FIXTURE_PATH) {
  await writeFile(process.env.PAIDEIA_REFERENCE_LONG_FIXTURE_PATH, new Uint8Array(await verboseFile.arrayBuffer()));
}
if (process.env.PAIDEIA_REFERENCE_LONG_IMPORT_FIXTURE_PATH) {
  const imported = await importReferenceBankXlsx(new File([readFileSync(process.env.PAIDEIA_REFERENCE_LONG_IMPORT_FIXTURE_PATH)], "long-resaved.xlsx"));
  assert.equal((imported[0].definitionHtml.match(/<strong>a<\/strong>/g) ?? []).length, 2500);
}

// Spreadsheet formatting must take priority even when the visible text is unchanged.
const formattedArchive = unzipSync(new Uint8Array(await referenceBlob.arrayBuffer()));
let stylesXml = strFromU8(formattedArchive["xl/styles.xml"]);
const styleDocument = new DOMParser().parseFromString(stylesXml, "application/xml");
const fontCount = styleDocument.getElementsByTagName("fonts")[0].children.length;
const styleCount = styleDocument.getElementsByTagName("cellXfs")[0].children.length;
stylesXml = stylesXml.replace(/<fonts count="\d+">/, `<fonts count="${fontCount + 1}">`)
  .replace("</fonts>", '<font><b/><i/><u val="single"/><color rgb="FFCC0000"/></font></fonts>')
  .replace(/<cellXfs count="\d+">/, `<cellXfs count="${styleCount + 1}">`)
  .replace("</cellXfs>", `<xf fontId="${fontCount}" applyFont="1"/></cellXfs>`);
formattedArchive["xl/styles.xml"] = strToU8(stylesXml);
formattedArchive["xl/worksheets/sheet1.xml"] = strToU8(referenceSheetXml.replace(/(<c r="B2" s=")\d+/, `$1${styleCount}`));
const formattedReferences = await importReferenceBankXlsx(xlsxFile(new Blob([zipSync(formattedArchive)]), "cell-style.xlsx"));
assert.match(formattedReferences[0].definitionHtml, /<strong>/);
assert.match(formattedReferences[0].definitionHtml, /<em>/);
assert.match(formattedReferences[0].definitionHtml, /<u>/);
assert.match(formattedReferences[0].definitionHtml, /color:\s*#cc0000/i);
assert.equal(formattedReferences[0].id, "ref1");

formattedArchive["xl/worksheets/sheet1.xml"] = strToU8(referenceSheetXml.replace(/<c r="B2"[^>]*>.*?<\/c>/,
  '<c r="B2" t="inlineStr"><is><r><rPr><b/><u/></rPr><t>Système de noms de domaine.</t></r><r><rPr><i/></rPr><t>\nDeuxième ligne.</t></r></is></c>'));
const runReferences = await importReferenceBankXlsx(xlsxFile(new Blob([zipSync(formattedArchive)]), "rich-runs.xlsx"));
assert.match(runReferences[0].definitionHtml, /<strong>/);
assert.match(runReferences[0].definitionHtml, /<u>/);
assert.match(runReferences[0].definitionHtml, /<em>/);
assert.match(runReferences[0].definitionHtml, /<br\s*\/?\s*>/);

const invalidReferenceBlob = await exportReferenceBankXlsx([{ id: "x", term: "", definitionHtml: "<p>Définition</p>" }]);
await assert.rejects(() => importReferenceBankXlsx(xlsxFile(invalidReferenceBlob, "invalid.xlsx")), /mot vide/i);

console.log("Resource XLSX workbook contract: OK");
await vite.close();
