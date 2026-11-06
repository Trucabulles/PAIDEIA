import type {
  GlossaryAssistantEntry,
  QuestionBankQuestion,
  ReferenceBankEntry,
  QuizAnswer,
  QuizQuestionMode
} from "../../types/project";
import { normalizePastedRichTextHtml } from "../../app/richTextSanitizer";
import { fitRichInlineImageDimensions } from "../rich-text-toolbar/richInlineImage";
import { normalizeReferenceTerm } from "../rich-text-toolbar/richTextBookmarks";

type WorkbookCellValue = string | number | boolean | Date | null;
type WorkbookCell = WorkbookCellValue | {
  value: Exclude<WorkbookCellValue, null>;
  type?: StringConstructor | NumberConstructor | BooleanConstructor | DateConstructor;
  fontWeight?: "bold";
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderStyle?: "thin";
  align?: "left" | "center" | "right";
  alignVertical?: "top" | "center" | "bottom";
  wrap?: boolean;
  height?: number;
};
type WorkbookRow = WorkbookCell[];

const MAX_WORKBOOK_FILE_SIZE = 20 * 1024 * 1024;
const REFERENCE_MEDIA_SHEET = "PAIDEIA Médias";
const REFERENCE_MEDIA_PREFIX = "paideia-media:";
const REFERENCE_HTML_CHUNK_SIZE = 30_000;
const MIN_QUESTION_TAG_COLUMNS = 3;
const MIN_QUESTION_ANSWER_COLUMNS = 6;
const MIN_ASSISTANT_LIST_COLUMNS = 3;

const HEADER_STYLE = {
  type: String,
  fontWeight: "bold" as const,
  textColor: "#FFFFFF",
  backgroundColor: "#244585",
  borderColor: "#FFFFFF",
  borderStyle: "thin" as const,
  align: "center" as const,
  alignVertical: "center" as const,
  wrap: true,
  height: 34
};

const EXAMPLE_STYLE = {
  type: String,
  backgroundColor: "#FFF4CC",
  borderColor: "#D8C46A",
  borderStyle: "thin" as const,
  alignVertical: "top" as const,
  wrap: true
};

const DATA_STYLE = {
  type: String,
  borderColor: "#D7E0EF",
  borderStyle: "thin" as const,
  alignVertical: "top" as const,
  wrap: true
};

function uniqueId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function plainTextToRichHtml(value: string) {
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    return "<p></p>";
  }
  return normalized
    .split("\n")
    .map((line) => `<p>${line ? escapeHtml(line) : "<br>"}</p>`)
    .join("");
}

function optionalPlainTextToRichHtml(value: string) {
  return value.trim() ? plainTextToRichHtml(value) : "";
}

export function richHtmlToPlainText(value: string | null | undefined) {
  if (!value?.trim()) {
    return "";
  }
  const documentValue = new DOMParser().parseFromString(value, "text/html");
  documentValue.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href")?.trim();
    const label = link.textContent?.trim();
    if (href && href !== label) {
      link.append(documentValue.createTextNode(` (${href})`));
    }
  });
  documentValue.querySelectorAll("br").forEach((element) => element.replaceWith("\n"));
  documentValue.querySelectorAll("li").forEach((element) => {
    const prefix = element.parentElement?.tagName === "OL" ? "1. " : "• ";
    element.prepend(documentValue.createTextNode(prefix));
    element.append(documentValue.createTextNode("\n"));
  });
  documentValue
    .querySelectorAll("p, div, h1, h2, h3, h4, h5, blockquote, table, tr")
    .forEach((element) => element.append(documentValue.createTextNode("\n")));
  return (documentValue.body.textContent ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cellText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value).trim();
}

function requiredColumn(headers: string[], label: string, aliases: string[]) {
  const index = headers.findIndex((header) => aliases.includes(header));
  if (index < 0) {
    throw new Error(`Colonne obligatoire manquante : ${label}.`);
  }
  return index;
}

function indexedColumns(headers: string[], prefix: string) {
  return headers
    .map((header, index) => {
      const match = header.match(new RegExp(`^${prefix} (\\d+)$`));
      return match ? { index, order: Number(match[1]) } : null;
    })
    .filter((entry): entry is { index: number; order: number } => Boolean(entry))
    .sort((left, right) => left.order - right.order);
}

function styledCell(value: string | number | boolean, example: boolean): WorkbookCell {
  if (typeof value === "number") {
    return { ...DATA_STYLE, value, type: Number };
  }
  if (typeof value === "boolean") {
    return { ...DATA_STYLE, value, type: Boolean };
  }
  return { ...(example ? EXAMPLE_STYLE : DATA_STYLE), value, type: String };
}

function headerRow(labels: string[]): WorkbookRow {
  return labels.map((value) => ({ ...HEADER_STYLE, value }));
}

function workbookTextChunks(value: string) {
  const chunks: string[] = [];
  for (let start = 0; start < value.length;) {
    let end = Math.min(start + REFERENCE_HTML_CHUNK_SIZE, value.length);
    if (end < value.length && /[\uD800-\uDBFF]/.test(value[end - 1])) end -= 1;
    chunks.push(value.slice(start, end));
    start = end;
  }
  return chunks.length ? chunks : [""];
}

async function finishWorkbookBlob(blob: Blob, hiddenColumns: number[], hiddenSheet?: string) {
  if (!hiddenColumns.length && !hiddenSheet) return blob;
  const { unzipSync, zipSync, strFromU8, strToU8 } = await import("fflate");
  const archive = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  if (hiddenColumns.length) {
    const path = "xl/worksheets/sheet1.xml";
    const xml = strFromU8(archive[path])
      .replace(/<sheetView\b([^>]*)>/, '<sheetView$1 showGridLines="1">')
      .replace(/<col\b([^>]*)\/>/g, (tag, attributes: string) => {
        const first = Number(attributes.match(/\bmin="(\d+)"/)?.[1]);
        return hiddenColumns.includes(first - 1) ? `<col${attributes} hidden="1"/>` : tag;
      });
    archive[path] = strToU8(xml);
  }
  if (hiddenSheet) {
    const path = "xl/workbook.xml";
    const xml = strFromU8(archive[path]);
    const escapedName = hiddenSheet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    archive[path] = strToU8(xml.replace(new RegExp(`<sheet\\b([^>]*\\bname="${escapedName}"[^>]*)/>`), '<sheet$1 state="hidden"/>'));
  }
  return new Blob([zipSync(archive).slice().buffer], { type: blob.type });
}

async function workbookBlob(sheetName: string, rows: WorkbookRow[], widths: number[], hiddenColumns: number[] = []) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const blob = await writeXlsxFile(
    rows,
    {
      sheet: sheetName,
      columns: widths.map((width, index) => ({ width, hidden: hiddenColumns.includes(index) })),
      stickyRowsCount: 1,
      showGridLines: hiddenColumns.length > 0,
      zoomScale: 0.85
    },
    { fontFamily: "Arial", fontSize: 11 }
  ).toBlob();
  return finishWorkbookBlob(blob, hiddenColumns);
}

async function readWorkbookSheet(file: File, sheetName: string, maxSize = MAX_WORKBOOK_FILE_SIZE) {
  if (file.size > maxSize) {
    throw new Error(`Le classeur dépasse la taille maximale autorisée de ${Math.round(maxSize / 1024 / 1024)} Mo.`);
  }
  const { readSheet } = await import("read-excel-file/browser");
  try {
    return await readSheet(file, sheetName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Impossible de lire la feuille « ${sheetName} ». ${message}`);
  }
}

function normalizeMode(value: string, rowNumber: number): QuizQuestionMode {
  const normalized = normalizeHeader(value);
  if (["qcu", "single", "choix unique"].includes(normalized)) {
    return "single";
  }
  if (["qcm", "multiple", "choix multiple"].includes(normalized)) {
    return "multiple";
  }
  if (["vrai faux", "true false", "truefalse"].includes(normalized)) {
    return "true-false";
  }
  throw new Error(`Ligne ${rowNumber} : type de question inconnu.`);
}

function modeLabel(mode: QuizQuestionMode) {
  if (mode === "multiple") {
    return "QCM";
  }
  if (mode === "true-false") {
    return "Vrai/Faux";
  }
  return "QCU";
}

function parseYesNo(value: unknown, rowNumber: number, label: string) {
  if (value === true || value === 1) {
    return true;
  }
  if (value === false || value === 0 || value === null || value === "") {
    return false;
  }
  const normalized = normalizeHeader(value);
  if (["oui", "yes", "vrai", "true"].includes(normalized)) {
    return true;
  }
  if (["non", "no", "faux", "false"].includes(normalized)) {
    return false;
  }
  throw new Error(`Ligne ${rowNumber} : valeur attendue Oui ou Non dans « ${label} ».`);
}

function questionExamples(): QuestionBankQuestion[] {
  return [
    {
      id: "example_qcu",
      title: "Objectif pédagogique",
      category: "Pédagogie",
      tags: ["objectif", "alignement pédagogique"],
      mode: "single",
      questionHtml: "<p>Quel est le rôle principal d’un objectif pédagogique ?</p>",
      answers: [
        { id: "a1", textHtml: "<p>Décrire le résultat d’apprentissage attendu</p>", correct: true, feedbackHtml: "<p>Ce choix précise l'acquis attendu.</p>" },
        { id: "a2", textHtml: "<p>Choisir la couleur des supports</p>", correct: false, feedbackHtml: "<p>La couleur relève de la présentation.</p>" },
        { id: "a3", textHtml: "<p>Fixer la durée de la pause</p>", correct: false, feedbackHtml: "<p>La pause ne définit pas l'objectif.</p>" }
      ],
      generalFeedbackHtml: "<p>Un objectif pédagogique décrit un résultat observable.</p>",
      feedbackCorrectHtml: "<p>Exact : l’objectif annonce ce que l’apprenant devra savoir ou savoir faire.</p>",
      feedbackIncorrectHtml: "<p>Relisez la formulation de l’objectif et le résultat attendu.</p>",
      points: 1
    },
    {
      id: "example_qcm",
      title: "Apprentissage actif",
      category: "Pédagogie",
      tags: ["activité", "engagement", "feedback"],
      mode: "multiple",
      questionHtml: "<p>Quelles pratiques favorisent un apprentissage actif ?</p>",
      answers: [
        { id: "a1", textHtml: "<p>Faire résoudre un problème</p>", correct: true },
        { id: "a2", textHtml: "<p>Demander une justification</p>", correct: true },
        { id: "a3", textHtml: "<p>Lire les diapositives sans interaction</p>", correct: false },
        { id: "a4", textHtml: "<p>Supprimer tout feedback</p>", correct: false }
      ],
      feedbackCorrectHtml: "<p>Exact : la résolution et la justification mobilisent activement les connaissances.</p>",
      feedbackIncorrectHtml: "<p>Repérez les pratiques qui demandent une action cognitive à l’apprenant.</p>",
      points: 2
    },
    {
      id: "example_true_false",
      title: "Évaluation formative",
      category: "Pédagogie",
      tags: ["évaluation formative", "feedback"],
      mode: "true-false",
      questionHtml: "<p>Une évaluation formative sert uniquement à attribuer une note finale.</p>",
      answers: [
        { id: "a1", textHtml: "<p>Vrai</p>", correct: false },
        { id: "a2", textHtml: "<p>Faux</p>", correct: true }
      ],
      feedbackCorrectHtml: "<p>Exact : elle sert d’abord à guider les apprentissages grâce au feedback.</p>",
      feedbackIncorrectHtml: "<p>Une évaluation formative accompagne la progression avant l’évaluation finale.</p>",
      points: 1
    }
  ];
}

function questionHeaders(tagCount: number, answerCount: number) {
  const labels = ["Statut de la ligne", "Catégorie"];
  for (let index = 1; index <= tagCount; index += 1) {
    labels.push(`Mot-clé ${index}`);
  }
  labels.push("Titre", "Type de question", "Question", "Notation QCM", "Répartition du crédit");
  for (let index = 1; index <= answerCount; index += 1) {
    labels.push(`Réponse ${index}`, `Correcte ${index}`, `Crédit (%) ${index}`, `Feedback réponse ${index}`);
  }
  labels.push("Feedback général", "Feedback si correct", "Feedback si incorrect", "Points");
  return labels;
}

function questionRow(question: QuestionBankQuestion, tagCount: number, answerCount: number, example: boolean) {
  const values: Array<string | number> = [example ? "EXEMPLE — NON IMPORTÉ" : "QUESTION", question.category ?? ""];
  for (let index = 0; index < tagCount; index += 1) {
    values.push(question.tags?.[index] ?? "");
  }
  const creditMode = question.mode === "multiple"
    ? question.creditMode ?? (question.answers.some((answer) => answer.creditPercent != null) ? "custom" : null)
    : null;
  values.push(question.title ?? "", modeLabel(question.mode), richHtmlToPlainText(question.questionHtml),
    question.mode === "multiple" ? creditMode ? "Crédit partiel" : "Tout ou rien" : "",
    creditMode === "equal" ? "Automatique" : creditMode === "custom" ? "Ajustée" : "");
  for (let index = 0; index < answerCount; index += 1) {
    const answer = question.answers[index];
    values.push(answer ? richHtmlToPlainText(answer.textHtml) : "", answer ? (answer.correct ? "Oui" : "Non") : "", creditMode === "custom" ? answer?.creditPercent ?? "" : "", answer ? richHtmlToPlainText(answer.feedbackHtml) : "");
  }
  values.push(
    richHtmlToPlainText(question.generalFeedbackHtml),
    richHtmlToPlainText(question.feedbackCorrectHtml),
    richHtmlToPlainText(question.feedbackIncorrectHtml),
    Number.isFinite(question.points) && question.points >= 1 ? question.points : 1
  );
  return values.map((value) => styledCell(value, example));
}

export async function exportQuestionBankXlsx(questions: QuestionBankQuestion[]) {
  const source = questions.length ? questions : questionExamples();
  const example = questions.length === 0;
  const tagCount = Math.max(MIN_QUESTION_TAG_COLUMNS, ...source.map((question) => question.tags?.length ?? 0));
  const answerCount = Math.max(MIN_QUESTION_ANSWER_COLUMNS, ...source.map((question) => question.answers.length));
  const labels = questionHeaders(tagCount, answerCount);
  const widths = labels.map((label) => {
    if (label === "Statut de la ligne") return 25;
    if (label === "Catégorie" || label === "Titre" || label.startsWith("Mot-clé") || label === "Notation QCM" || label === "Répartition du crédit") return 22;
    if (label === "Type de question" || label.startsWith("Correcte") || label.startsWith("Crédit (%)") || label === "Points") return 15;
    return 38;
  });
  return workbookBlob("Questions", [headerRow(labels), ...source.map((question) => questionRow(question, tagCount, answerCount, example))], widths);
}

export async function importQuestionBankXlsx(file: File): Promise<QuestionBankQuestion[]> {
  const rows = await readWorkbookSheet(file, "Questions");
  const [rawHeaders, ...body] = rows;
  if (!rawHeaders) {
    throw new Error("Le classeur ne contient aucune donnée.");
  }
  const headers = rawHeaders.map(normalizeHeader);
  const statusIndex = requiredColumn(headers, "Statut de la ligne", ["statut de la ligne"]);
  const categoryIndex = requiredColumn(headers, "Catégorie", ["categorie"]);
  const titleIndex = requiredColumn(headers, "Titre", ["titre"]);
  const modeIndex = requiredColumn(headers, "Type de question", ["type de question"]);
  const questionIndex = requiredColumn(headers, "Question", ["question"]);
  const scoringIndex = headers.indexOf("notation qcm");
  const allocationIndex = headers.indexOf("repartition du credit");
  const feedbackCorrectIndex = requiredColumn(headers, "Feedback si correct", ["feedback si correct"]);
  const feedbackIncorrectIndex = requiredColumn(headers, "Feedback si incorrect", ["feedback si incorrect"]);
  const feedbackGeneralIndex = headers.indexOf("feedback general");
  const pointsIndex = requiredColumn(headers, "Points", ["points"]);
  const tagColumns = indexedColumns(headers, "mot cle");
  const answerColumns = indexedColumns(headers, "reponse");
  const correctColumns = new Map(indexedColumns(headers, "correcte").map((entry) => [entry.order, entry.index]));
  const creditColumns = new Map(indexedColumns(headers, "credit").map((entry) => [entry.order, entry.index]));
  const answerFeedbackColumns = new Map(indexedColumns(headers, "feedback reponse").map((entry) => [entry.order, entry.index]));
  if (answerColumns.length < 2) {
    throw new Error("Le classeur doit contenir au moins les colonnes Réponse 1 et Réponse 2.");
  }

  const questions = body.flatMap((row, bodyIndex) => {
    const rowNumber = bodyIndex + 2;
    if (!row.some((value) => cellText(value).length > 0)) {
      return [];
    }
    const status = normalizeHeader(row[statusIndex]);
    if (status.startsWith("exemple")) {
      return [];
    }
    if (status && status !== "question") {
      throw new Error(`Ligne ${rowNumber} : statut de ligne inconnu.`);
    }
    const questionText = cellText(row[questionIndex]);
    if (!questionText) {
      throw new Error(`Ligne ${rowNumber} : question vide.`);
    }
    const mode = normalizeMode(cellText(row[modeIndex]), rowNumber);
    const scoring = scoringIndex >= 0 ? normalizeHeader(row[scoringIndex]) : "";
    const allocation = allocationIndex >= 0 ? normalizeHeader(row[allocationIndex]) : "";
    const answerValues = answerColumns
      .map(({ index, order }) => ({
        order,
        text: cellText(row[index]),
        correct: parseYesNo(row[correctColumns.get(order) ?? -1] ?? null, rowNumber, `Correcte ${order}`),
        creditText: cellText(row[creditColumns.get(order) ?? -1]),
        feedbackHtml: optionalPlainTextToRichHtml(cellText(row[answerFeedbackColumns.get(order) ?? -1]))
      }))
      .filter((answer) => answer.text);
    let answers: QuizAnswer[];
    const hasCredit = answerValues.some((answer) => answer.creditText !== "");
    if (mode !== "multiple" && (hasCredit || scoring || allocation)) {
      throw new Error(`Ligne ${rowNumber} : la notation par crédit est réservée aux QCM.`);
    }
    if (mode === "multiple" && scoring && scoring !== "tout ou rien" && scoring !== "credit partiel") {
      throw new Error(`Ligne ${rowNumber} : notation QCM inconnue.`);
    }
    if (mode === "multiple" && allocation && allocation !== "automatique" && allocation !== "ajustee") {
      throw new Error(`Ligne ${rowNumber} : répartition du crédit inconnue.`);
    }
    if (scoring === "tout ou rien" && (allocation || hasCredit)) {
      throw new Error(`Ligne ${rowNumber} : un QCM « Tout ou rien » ne doit pas contenir de crédits.`);
    }
    if (allocation === "automatique" && hasCredit) {
      throw new Error(`Ligne ${rowNumber} : effacez les crédits chiffrés pour une répartition automatique.`);
    }
    const creditMode = mode !== "multiple" || scoring === "tout ou rien" ? null
      : allocation === "automatique" ? "equal"
        : allocation === "ajustee" || hasCredit ? "custom"
          : scoring === "credit partiel" ? "equal" : null;
    if (creditMode === "custom") {
      if (answerValues.some((answer) => answer.creditText === "")) {
        throw new Error(`Ligne ${rowNumber} : renseignez le crédit (%) de chaque réponse du QCM.`);
      }
      const credits = answerValues.map((answer) => Number(answer.creditText.replace(",", ".")));
      if (credits.some((credit) => !Number.isFinite(credit) || credit < -100 || credit > 100)
        || Math.abs(credits.reduce((total, credit) => total + Math.max(0, credit), 0) - 100) > 0.1
        || answerValues.some((answer, index) => answer.correct !== (credits[index] > 0))) {
        throw new Error(`Ligne ${rowNumber} : le barème doit totaliser 100 % de crédits positifs, avec un signe cohérent avec « Correcte ». `);
      }
    }
    if (mode === "true-false") {
      const trueAnswer = answerValues.find((answer) => normalizeHeader(answer.text) === "vrai");
      const falseAnswer = answerValues.find((answer) => normalizeHeader(answer.text) === "faux");
      if (!trueAnswer || !falseAnswer || Number(trueAnswer.correct) + Number(falseAnswer.correct) !== 1) {
        throw new Error(`Ligne ${rowNumber} : Vrai et Faux doivent être visibles et une seule réponse doit être correcte.`);
      }
      answers = [
        { id: uniqueId("answer"), textHtml: "<p>Vrai</p>", correct: trueAnswer.correct, feedbackHtml: trueAnswer.feedbackHtml },
        { id: uniqueId("answer"), textHtml: "<p>Faux</p>", correct: falseAnswer.correct, feedbackHtml: falseAnswer.feedbackHtml }
      ];
    } else {
      if (answerValues.length < 2) {
        throw new Error(`Ligne ${rowNumber} : au moins deux réponses sont requises.`);
      }
      const correctCount = answerValues.filter((answer) => answer.correct).length;
      if (correctCount < 1 || (mode === "single" && correctCount !== 1)) {
        throw new Error(`Ligne ${rowNumber} : le nombre de réponses correctes ne correspond pas au type de question.`);
      }
      answers = answerValues.map((answer) => ({
        id: uniqueId("answer"),
        textHtml: plainTextToRichHtml(answer.text),
        correct: answer.correct,
        ...(creditMode === "custom" ? { creditPercent: Number(answer.creditText.replace(",", ".")) } : {}),
        feedbackHtml: answer.feedbackHtml
      }));
    }
    const importedPoints = Number(cellText(row[pointsIndex]));
    return [{
      id: uniqueId("bank_question"),
      title: cellText(row[titleIndex]),
      category: cellText(row[categoryIndex]),
      tags: tagColumns.map(({ index }) => cellText(row[index])).filter(Boolean),
      mode,
      creditMode,
      questionHtml: plainTextToRichHtml(questionText),
      answers,
      generalFeedbackHtml: feedbackGeneralIndex >= 0 ? optionalPlainTextToRichHtml(cellText(row[feedbackGeneralIndex])) : "",
      feedbackCorrectHtml: plainTextToRichHtml(cellText(row[feedbackCorrectIndex])),
      feedbackIncorrectHtml: plainTextToRichHtml(cellText(row[feedbackIncorrectIndex])),
      points: Number.isFinite(importedPoints) && importedPoints >= 1 ? importedPoints : 1,
      sourceBankId: null,
      sourceQuestionId: null
    } satisfies QuestionBankQuestion];
  });
  if (!questions.length) {
    throw new Error("Aucune question à importer. Les lignes d’exemple ne sont jamais importées.");
  }
  return questions;
}

function assistantExample(): GlossaryAssistantEntry {
  return {
    id: "example_assistant_entry",
    term: "Évaluation formative",
    aliases: ["évaluation pour apprendre", "évaluation en cours d’apprentissage"],
    contentHtml: "<p>Une évaluation formative aide l’apprenant à progresser grâce à un retour donné pendant l’apprentissage.</p>",
    related: ["feedback", "objectif pédagogique", "évaluation sommative"],
    fuzzy: true
  };
}

function assistantHeaders(aliasCount: number, relatedCount: number) {
  const labels = ["Statut de la ligne", "Terme"];
  for (let index = 1; index <= aliasCount; index += 1) {
    labels.push(`Synonyme ${index}`);
  }
  labels.push("Définition");
  for (let index = 1; index <= relatedCount; index += 1) {
    labels.push(`Terme lié ${index}`);
  }
  labels.push("Tolérance orthographique");
  return labels;
}

function assistantRow(entry: GlossaryAssistantEntry, aliasCount: number, relatedCount: number, example: boolean) {
  const values: string[] = [example ? "EXEMPLE — NON IMPORTÉ" : "ENTRÉE", entry.term];
  for (let index = 0; index < aliasCount; index += 1) {
    values.push(entry.aliases[index] ?? "");
  }
  values.push(richHtmlToPlainText(entry.contentHtml));
  for (let index = 0; index < relatedCount; index += 1) {
    values.push(entry.related[index] ?? "");
  }
  values.push(entry.fuzzy ? "Oui" : "Non");
  return values.map((value) => styledCell(value, example));
}

export async function exportAssistantXlsx(entries: GlossaryAssistantEntry[]) {
  const source = entries.length ? entries : [assistantExample()];
  const example = entries.length === 0;
  const aliasCount = Math.max(MIN_ASSISTANT_LIST_COLUMNS, ...source.map((entry) => entry.aliases.length));
  const relatedCount = Math.max(MIN_ASSISTANT_LIST_COLUMNS, ...source.map((entry) => entry.related.length));
  const labels = assistantHeaders(aliasCount, relatedCount);
  const widths = labels.map((label) => {
    if (label === "Statut de la ligne") return 25;
    if (label === "Définition") return 48;
    if (label === "Tolérance orthographique") return 24;
    return 24;
  });
  return workbookBlob("Assistant", [headerRow(labels), ...source.map((entry) => assistantRow(entry, aliasCount, relatedCount, example))], widths);
}

export async function importAssistantXlsx(file: File): Promise<GlossaryAssistantEntry[]> {
  const rows = await readWorkbookSheet(file, "Assistant");
  const [rawHeaders, ...body] = rows;
  if (!rawHeaders) {
    throw new Error("Le classeur ne contient aucune donnée.");
  }
  const headers = rawHeaders.map(normalizeHeader);
  const statusIndex = requiredColumn(headers, "Statut de la ligne", ["statut de la ligne"]);
  const termIndex = requiredColumn(headers, "Terme", ["terme"]);
  const definitionIndex = requiredColumn(headers, "Définition", ["definition"]);
  const fuzzyIndex = requiredColumn(headers, "Tolérance orthographique", ["tolerance orthographique"]);
  const aliasColumns = indexedColumns(headers, "synonyme");
  const relatedColumns = indexedColumns(headers, "terme lie");
  const entries = body.flatMap((row, bodyIndex) => {
    const rowNumber = bodyIndex + 2;
    if (!row.some((value) => cellText(value).length > 0)) {
      return [];
    }
    const status = normalizeHeader(row[statusIndex]);
    if (status.startsWith("exemple")) {
      return [];
    }
    if (status && status !== "entree") {
      throw new Error(`Ligne ${rowNumber} : statut de ligne inconnu.`);
    }
    const term = cellText(row[termIndex]);
    if (!term) {
      throw new Error(`Ligne ${rowNumber} : terme vide.`);
    }
    return [{
      id: uniqueId("entry"),
      term,
      aliases: aliasColumns.map(({ index }) => cellText(row[index])).filter(Boolean),
      contentHtml: plainTextToRichHtml(cellText(row[definitionIndex])),
      related: relatedColumns.map(({ index }) => cellText(row[index])).filter(Boolean),
      fuzzy: parseYesNo(row[fuzzyIndex] ?? null, rowNumber, "Tolérance orthographique")
    } satisfies GlossaryAssistantEntry];
  });
  if (!entries.length) {
    throw new Error("Aucune entrée à importer. Les lignes d’exemple ne sont jamais importées.");
  }
  return entries;
}

export async function exportReferenceBankXlsx(entries: ReferenceBankEntry[]) {
  const media: { id: string; base64: string; bytes: Uint8Array; mime: string; entryIndex: number; width: number; height: number }[] = [];
  const prepared = entries.map((entry, entryIndex) => {
    const plainText = richHtmlToPlainText(entry.definitionHtml);
    if (plainText.length > 32_767) throw new Error(`« ${entry.term} » : texte de définition trop long pour une cellule Excel.`);
    const documentValue = new DOMParser().parseFromString(entry.definitionHtml || "<p></p>", "text/html");
    for (const image of documentValue.body.querySelectorAll("img")) {
      const src = image.getAttribute("src") ?? "";
      const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z\d+/]+={0,2})$/i.exec(src);
      if (!match) {
        throw new Error(`« ${entry.term} » : image de définition non intégrée.`);
      }
      const binary = atob(match[2]);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const mime = match[1].toLowerCase();
      if (!isSupportedReferenceImage(bytes, mime)) throw new Error(`« ${entry.term} » : image invalide.`);
      const id = `image-${media.length + 1}`;
      media.push({ id, base64: match[2], bytes, mime, entryIndex,
        width: Number(image.getAttribute("width")) || 1, height: Number(image.getAttribute("height")) || 1 });
      image.setAttribute("src", `${REFERENCE_MEDIA_PREFIX}${id}`);
    }
    const html = documentValue.body.innerHTML;
    return { entry, plainText, chunks: workbookTextChunks(html) };
  });
  const chunkCount = Math.max(1, ...prepared.map((item) => item.chunks.length));
  const hasIllustrations = media.length > 0;
  const headers = ["Mot", "Définition", ...(hasIllustrations ? ["Illustration(s)"] : []), "PAIDEIA ID", "PAIDEIA HTML",
    ...Array.from({ length: chunkCount - 1 }, (_, index) => `PAIDEIA HTML ${index + 2}`)];
  const previews = prepared.map((_, entryIndex) => media.filter((item) => item.entryIndex === entryIndex).slice(0, 12));
  const mediaCounts = prepared.map((_, entryIndex) => media.filter((item) => item.entryIndex === entryIndex).length);
  const rows = prepared.map(({ entry, plainText, chunks }, entryIndex) => {
    const cells = [styledCell(entry.term, false), styledCell(plainText, false)];
    if (hasIllustrations) {
      const preview = previews[entryIndex];
      const size = preview.length === 1 ? 160 : preview.length <= 4 ? 104 : 70;
      const columns = preview.length > 4 ? 3 : 2;
      const previewHeight = Math.ceil(preview.length / columns) * (size + 10) + 12;
      const textHeight = plainText.split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 70)), 0) * 20 + 12;
      cells.push({ ...DATA_STYLE, value: preview.length < mediaCounts[entryIndex]
        ? `${mediaCounts[entryIndex]} images` : "", type: String,
        height: Math.min(390, Math.max(previewHeight, textHeight) * 0.75) });
    }
    cells.push(styledCell(entry.id, false), ...Array.from({ length: chunkCount }, (_, index) => styledCell(chunks[index] ?? "", false)));
    return cells;
  });
  const hiddenColumns = Array.from({ length: chunkCount + 1 }, (_, index) => index + (hasIllustrations ? 3 : 2));
  if (!media.length) {
    const blob = await workbookBlob("Balises et renvois", [headerRow(headers), ...rows], [28, 64, 24, ...Array(chunkCount).fill(64)], hiddenColumns);
    return blob;
  }

  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const mediaChunkCount = Math.max(...media.map((item) => Math.ceil(item.base64.length / REFERENCE_HTML_CHUNK_SIZE)));
  const imageRows = [headerRow(["PAIDEIA MÉDIA", "Type", ...Array.from({ length: mediaChunkCount }, (_, index) => `Fragment ${index + 1}`)]),
    ...media.map((item) => [item.id, item.mime,
      ...Array.from({ length: mediaChunkCount }, (_, index) => item.base64.slice(index * REFERENCE_HTML_CHUNK_SIZE, (index + 1) * REFERENCE_HTML_CHUNK_SIZE))]
      .map((value) => styledCell(value, false)))];
  const blob = await writeXlsxFile([
    { sheet: "Balises et renvois", data: [headerRow(headers), ...rows],
      columns: [28, 64, 38, 24, ...Array(chunkCount).fill(64)].map((width) => ({ width })), stickyRowsCount: 1, zoomScale: 0.85,
      images: previews.flatMap((items, entryIndex) => items.map((item, imageIndex) => {
        const size = items.length === 1 ? 160 : items.length <= 4 ? 104 : 70;
        const columns = items.length > 4 ? 3 : 2;
        const scale = size / Math.max(item.width, item.height);
        return { content: new Blob([item.bytes.slice().buffer], { type: item.mime }), contentType: item.mime,
          width: Math.max(1, Math.round(item.width * scale)), height: Math.max(1, Math.round(item.height * scale)), dpi: 96,
          anchor: { row: entryIndex + 2, column: 3 }, offsetX: 8 + (imageIndex % columns) * (size + 10),
          offsetY: 8 + Math.floor(imageIndex / columns) * (size + 10),
          title: `PAIDEIA aperçu ${item.id}`, description: `paideia-preview:${item.id}` };
      })) },
    { sheet: REFERENCE_MEDIA_SHEET, data: imageRows,
      columns: [24, 20, ...Array(mediaChunkCount).fill(64)].map((width) => ({ width })) }
  ], { fontFamily: "Arial", fontSize: 11 }).toBlob();
  const completed = await finishWorkbookBlob(blob, hiddenColumns, REFERENCE_MEDIA_SHEET);
  return completed;
}

function isSupportedReferenceImage(bytes: Uint8Array, mime: string) {
  if (mime === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  if (mime === "image/jpeg") return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/webp") return bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
  return false;
}

function referenceImageMime(bytes: Uint8Array) {
  return ["image/png", "image/jpeg", "image/webp"].find((mime) => isSupportedReferenceImage(bytes, mime)) ?? null;
}

function workbookXmlElements(root: Document | Element, name: string) {
  return [...root.getElementsByTagName("*")].filter((element) => element.localName === name || element.tagName.split(":").pop() === name);
}

function resolveWorkbookPart(source: string, target: string) {
  const parts = (target.startsWith("/") ? target.slice(1) : `${source.slice(0, source.lastIndexOf("/") + 1)}${target}`).split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") resolved.pop();
    else if (part && part !== ".") resolved.push(part);
  }
  return resolved.join("/");
}

async function normalizedWorkbookDrawingImage(bytes: Uint8Array, mime: string) {
  const blob = new Blob([bytes.slice().buffer], { type: mime });
  let source: ImageBitmap | HTMLImageElement;
  if (typeof createImageBitmap === "function") {
    source = await createImageBitmap(blob);
  } else {
    const image = document.createElement("img");
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Impossible de décoder l'image du classeur."));
      image.src = `data:${mime};base64,${btoa(binary)}`;
    });
    source = image;
  }
  try {
    const sourceWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    if (!sourceWidth || !sourceHeight) throw new Error("Dimensions de l'image du classeur invalides.");
    const { width, height } = fitRichInlineImageDimensions(sourceWidth, sourceHeight);
    return { bytes, mime, width, height };
  } finally {
    if ("close" in source) source.close();
  }
}

async function workbookDrawingImages(file: File, definitionColumn: number, illustrationColumn: number) {
  const { unzipSync, strFromU8 } = await import("fflate");
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const xml = (path: string) => new DOMParser().parseFromString(archive[path] ? strFromU8(archive[path]) : "<root/>", "application/xml");
  const sheets = workbookXmlElements(xml("xl/workbook.xml"), "sheet");
  const sheet = sheets.find((item) => item.getAttribute("name") === "Balises et renvois") ?? sheets[0];
  if (!sheet) return new Map<number, string[]>();
  const sheetId = sheet.getAttribute("r:id") ?? sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  const sheetRelation = workbookXmlElements(xml("xl/_rels/workbook.xml.rels"), "Relationship")
    .find((item) => item.getAttribute("Id") === sheetId);
  if (!sheetRelation?.getAttribute("Target")) return new Map<number, string[]>();
  const sheetPath = resolveWorkbookPart("xl/workbook.xml", sheetRelation.getAttribute("Target")!);
  const sheetRelsPath = `${sheetPath.slice(0, sheetPath.lastIndexOf("/") + 1)}_rels/${sheetPath.split("/").pop()}.rels`;
  const drawingRelation = workbookXmlElements(xml(sheetRelsPath), "Relationship")
    .find((item) => item.getAttribute("Type")?.endsWith("/drawing"));
  if (!drawingRelation?.getAttribute("Target")) return new Map<number, string[]>();
  const drawingPath = resolveWorkbookPart(sheetPath, drawingRelation.getAttribute("Target")!);
  const drawingRelsPath = `${drawingPath.slice(0, drawingPath.lastIndexOf("/") + 1)}_rels/${drawingPath.split("/").pop()}.rels`;
  const drawingRels = new Map(workbookXmlElements(xml(drawingRelsPath), "Relationship")
    .map((item) => [item.getAttribute("Id") ?? "", item.getAttribute("Target") ?? ""]));
  const result = new Map<number, string[]>();
  for (const anchor of [...workbookXmlElements(xml(drawingPath), "oneCellAnchor"), ...workbookXmlElements(xml(drawingPath), "twoCellAnchor")]) {
    const from = workbookXmlElements(anchor, "from")[0];
    if (!from) continue;
    const row = Number(workbookXmlElements(from, "row")[0]?.textContent) + 1;
    const column = Number(workbookXmlElements(from, "col")[0]?.textContent);
    if (row < 2 || (column !== definitionColumn && column !== illustrationColumn)) continue;
    const properties = workbookXmlElements(anchor, "cNvPr")[0];
    if (properties?.getAttribute("descr")?.startsWith("paideia-preview:")) continue;
    const blip = workbookXmlElements(anchor, "blip")[0];
    const relationId = blip?.getAttribute("r:embed") ?? blip?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed");
    const target = drawingRels.get(relationId ?? "");
    const bytes = target ? archive[resolveWorkbookPart(drawingPath, target)] : null;
    const mime = bytes ? referenceImageMime(bytes) : null;
    if (!bytes || !mime) throw new Error(`Image du classeur invalide à la ligne ${row}.`);
    const normalized = await normalizedWorkbookDrawingImage(bytes, mime);
    let binary = "";
    for (let index = 0; index < normalized.bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...normalized.bytes.subarray(index, index + 0x8000));
    }
    const dataUrl = `data:${normalized.mime};base64,${btoa(binary)}`;
    const image = `<img class="rich-inline-image" src="${dataUrl}" width="${normalized.width}" height="${normalized.height}">`;
    result.set(row, [...(result.get(row) ?? []), image]);
  }
  return result;
}

async function referenceWorkbookMedia(file: File) {
  const mediaRows = await readWorkbookSheet(file, REFERENCE_MEDIA_SHEET, Infinity);
  const result = new Map<string, string>();
  for (const [index, row] of mediaRows.slice(1).entries()) {
    const rowNumber = index + 2;
    const id = String(row[0] ?? "").trim();
    const mime = String(row[1] ?? "").trim().toLowerCase();
    const base64 = row.slice(2).map((value) => String(value ?? "")).join("");
    const dataUrl = `data:${mime};base64,${base64}`;
    if (!id || !base64 || !/^[a-z\d+/]+={0,2}$/i.test(base64) || result.has(id)) {
      throw new Error(`Média PAIDEIA invalide à la ligne ${rowNumber}.`);
    }
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    if (!isSupportedReferenceImage(bytes, mime)) throw new Error(`Média PAIDEIA invalide à la ligne ${rowNumber}.`);
    result.set(id, dataUrl);
  }
  return result;
}

async function referenceCellRichHtml(file: File, column: number): Promise<Map<number, string>> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const parse = (path: string) => new DOMParser().parseFromString(zip[path] ? strFromU8(zip[path]) : "<root/>", "application/xml");
  const workbook = parse("xl/workbook.xml");
  const sheets = [...workbook.getElementsByTagName("sheet")];
  const sheet = sheets.find((item) => item.getAttribute("name") === "Balises et renvois") ?? sheets[0];
  const relation = [...parse("xl/_rels/workbook.xml.rels").getElementsByTagName("Relationship")].find((item) => item.getAttribute("Id") === sheet?.getAttribute("r:id"));
  const target = relation?.getAttribute("Target") ?? "worksheets/sheet1.xml";
  const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  const shared = [...parse("xl/sharedStrings.xml").getElementsByTagName("si")];
  const stylesheet = parse("xl/styles.xml");
  const fonts = [...(stylesheet.getElementsByTagName("fonts")[0]?.children ?? [])];
  const cellStyles = [...(stylesheet.getElementsByTagName("cellXfs")[0]?.children ?? [])];
  const enabled = (properties: Element | undefined, name: string) => {
    const node = properties?.getElementsByTagName(name)[0];
    return Boolean(node && !["0", "false", "none"].includes(node.getAttribute("val") ?? ""));
  };
  const decorate = (content: string, properties: Element | undefined) => {
    if (enabled(properties, "b")) content = `<strong>${content}</strong>`;
    if (enabled(properties, "i")) content = `<em>${content}</em>`;
    if (enabled(properties, "u")) content = `<u>${content}</u>`;
    if (enabled(properties, "strike")) content = `<s>${content}</s>`;
    const color = properties?.getElementsByTagName("color")[0]?.getAttribute("rgb")?.slice(-6);
    return color && /^[\da-f]{6}$/i.test(color) && color.toLowerCase() !== "000000"
      ? `<span style="color:#${color}">${content}</span>` : content;
  };
  const result = new Map<number, string>();
  for (const cell of [...parse(path).getElementsByTagName("c")]) {
    const address = cell.getAttribute("r") ?? "";
    const letters = address.match(/^[A-Z]+/)?.[0] ?? "";
    const index = [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
    if (index !== column) continue;
    const source = cell.getAttribute("t") === "s"
      ? shared[Number(cell.getElementsByTagName("v")[0]?.textContent)]
      : cell.getElementsByTagName("is")[0];
    if (!source) continue;
    const runs = [...source.getElementsByTagName("r")];
    const cellStyle = cellStyles[Number(cell.getAttribute("s") ?? 0)];
    const cellFont = fonts[Number(cellStyle?.getAttribute("fontId") ?? 0)];
    if (!runs.length) {
      const content = [...source.getElementsByTagName("t")].map((text) => escapeHtml(text.textContent ?? "")).join("").replace(/\r\n?|\n/g, "<br>");
      const decorated = decorate(content, cellFont);
      // Default worksheet fonts must not overwrite the saved Rich Text HTML.
      if (decorated !== content) result.set(Number(address.match(/\d+$/)?.[0]), `<p>${decorated}</p>`);
      continue;
    }
    const html = runs.map((run) => {
      const properties = run.getElementsByTagName("rPr")[0] ?? cellFont;
      let content = [...run.getElementsByTagName("t")].map((text) => escapeHtml(text.textContent ?? "")).join("").replace(/\r\n?|\n/g, "<br>");
      if (enabled(properties, "b")) content = `<strong>${content}</strong>`;
      if (enabled(properties, "i")) content = `<em>${content}</em>`;
      if (enabled(properties, "u")) content = `<u>${content}</u>`;
      if (enabled(properties, "strike")) content = `<s>${content}</s>`;
      const color = properties?.getElementsByTagName("color")[0]?.getAttribute("rgb")?.slice(-6);
      const size = Number(properties?.getElementsByTagName("sz")[0]?.getAttribute("val"));
      const styles = [color && /^[\da-f]{6}$/i.test(color) ? `color:#${color}` : "", size > 0 && size <= 200 ? `font-size:${size * 4 / 3}px` : ""].filter(Boolean).join(";");
      return styles ? `<span style="${styles}">${content}</span>` : content;
    }).join("");
    result.set(Number(address.match(/\d+$/)?.[0]), `<p>${html}</p>`);
  }
  return result;
}

export async function importReferenceBankXlsx(file: File, existing: ReferenceBankEntry[] = []): Promise<ReferenceBankEntry[]> {
  const { readSheet } = await import("read-excel-file/browser");
  let rows;
  try {
    rows = await readSheet(file, "Balises et renvois");
  } catch {
    rows = await readSheet(file);
  }
  const [rawHeaders, ...body] = rows;
  if (!rawHeaders) {
    throw new Error("Le classeur ne contient aucune donnée.");
  }
  const headers = rawHeaders.map(normalizeHeader);
  const termIndex = requiredColumn(headers, "Mot", ["mot"]);
  const definitionIndex = requiredColumn(headers, "Définition", ["definition"]);
  const illustrationIndex = headers.findIndex((header) => ["illustration s", "illustration", "images", "image"].includes(header));
  const idIndex = headers.indexOf("paideia id");
  const htmlIndex = headers.indexOf("paideia html");
  const htmlChunkIndices = htmlIndex < 0 ? [] : [htmlIndex, ...headers
    .map((header, index) => ({ index, number: Number(/^paideia html (\d+)$/.exec(header)?.[1]) }))
    .filter((item) => item.number >= 2)
    .sort((left, right) => left.number - right.number)
    .map((item) => item.index)];
  const nativeRichCells = await referenceCellRichHtml(file, definitionIndex);
  const drawingImages = await workbookDrawingImages(file, definitionIndex, illustrationIndex);
  const hasPackagedMedia = body.some((row) => htmlChunkIndices.some((index) => String(row[index] ?? "").includes(REFERENCE_MEDIA_PREFIX)));
  const packagedMedia = hasPackagedMedia ? await referenceWorkbookMedia(file) : new Map<string, string>();
  const usedIds = new Set<string>();
  const entries = body.flatMap((row, bodyIndex) => {
    const rowNumber = bodyIndex + 2;
    if (!row.some((value) => cellText(value).length > 0)) return [];
    const term = cellText(row[termIndex]);
    const definition = cellText(row[definitionIndex]);
    if (!term) throw new Error(`Ligne ${rowNumber} : mot vide.`);
    const storedHtml = htmlChunkIndices.map((index) => String(row[index] ?? "")).join("");
    const usesMedia = storedHtml.includes(REFERENCE_MEDIA_PREFIX);
    const externalImages = drawingImages.get(rowNumber) ?? [];
    if (!definition && !usesMedia && !externalImages.length) throw new Error(`Ligne ${rowNumber} : définition vide.`);
    const importedId = idIndex >= 0 ? cellText(row[idIndex]) : "";
    const matches = existing.filter((entry) => normalizeReferenceTerm(entry.term) === normalizeReferenceTerm(term));
    if (!importedId && matches.length > 1) throw new Error(`Ligne ${rowNumber} : mot ambigu. Utilisez un export PAIDEIA conservant les identifiants.`);
    const entryId = importedId || matches[0]?.id || uniqueId("reference_entry");
    if (usedIds.has(entryId)) throw new Error(`Ligne ${rowNumber} : identifiant dupliqué ou correspondance ambiguë.`);
    usedIds.add(entryId);
    if (usesMedia && richHtmlToPlainText(storedHtml) !== definition) {
      throw new Error(`Ligne ${rowNumber} : le texte a changé dans Excel ; la position des images n'est plus déterminable.`);
    }
    let html = usesMedia ? (() => {
      const documentValue = new DOMParser().parseFromString(storedHtml, "text/html");
      for (const image of documentValue.body.querySelectorAll("img")) {
        const src = image.getAttribute("src") ?? "";
        if (!src.startsWith(REFERENCE_MEDIA_PREFIX)) continue;
        const mediaSrc = packagedMedia.get(src.slice(REFERENCE_MEDIA_PREFIX.length));
        if (!mediaSrc) throw new Error(`Ligne ${rowNumber} : image intégrée au classeur introuvable.`);
        image.setAttribute("src", mediaSrc);
      }
      return documentValue.body.innerHTML;
    })() : nativeRichCells.get(rowNumber) ?? (storedHtml && richHtmlToPlainText(storedHtml) === definition
      ? storedHtml : (/<\/?(?:p|div|span|strong|em|b|i|u|s|ul|ol|li|br|a)\b/i.test(definition) ? definition : plainTextToRichHtml(definition)));
    for (const image of externalImages) {
      html = html.includes("[[image]]") ? html.replace("[[image]]", image) : `${html}<p>${image}</p>`;
    }
    return [{ id: entryId, term, definitionHtml: normalizePastedRichTextHtml(html) }];
  });
  if (!entries.length) {
    throw new Error("Aucune balise à importer.");
  }
  return entries;
}
