import { normalizePastedRichTextHtml } from "../../../app/richTextSanitizer";
import type { QuestionBankQuestion, QuizAnswer, QuizQuestionMode } from "../../../types/project";

const MAX_MOODLE_XML_BYTES = 20 * 1024 * 1024;

export type MoodleQuestionBankImport = {
  questions: QuestionBankQuestion[];
  categoryCount: number;
  partialCreditQuestions: number;
  ignoredPenaltyQuestions: number;
  shuffleAnswerQuestions: number;
};

function child(parent: Element, name: string): Element | null {
  return Array.from(parent.children).find((item) => item.tagName === name) ?? null;
}

function children(parent: Element, name: string): Element[] {
  return Array.from(parent.children).filter((item) => item.tagName === name);
}

function field(parent: Element, name: string): string {
  const element = child(parent, name);
  if (!element) return "";
  return (child(element, "text") ?? element).textContent?.trim() ?? "";
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function richField(parent: Element, name: string): string {
  const element = child(parent, name);
  if (!element) return "";
  if (element.querySelector("file")) {
    throw new Error(`Un média intégré au champ « ${name} » n'est pas encore pris en charge.`);
  }
  const content = (element.tagName === "text" ? element : child(element, "text"))?.textContent?.trim() ?? "";
  if (!content) return "";
  const html = (element.getAttribute("format") ?? parent.getAttribute("format")) === "html" && /<[^>]+>/.test(content)
    ? content
    : `<p>${escapeHtml(content)}</p>`;
  return normalizePastedRichTextHtml(html);
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readableCategory(raw: string): string {
  return raw.replace(/^\$course\$\/top\/?/, "").trim();
}

function parseQuestion(source: Element, category: string, index: number): { question: QuestionBankQuestion; partialCredit: boolean; penalty: boolean; shuffle: boolean } {
  const type = source.getAttribute("type");
  if (type !== "multichoice" && type !== "truefalse" && type !== "multichoiceset") {
    throw new Error(`Question ${index} : le type Moodle « ${type ?? "inconnu"} » n'est pas pris en charge.`);
  }
  const mode: QuizQuestionMode = type === "truefalse" ? "true-false" : type === "multichoiceset" || field(source, "single") === "false" ? "multiple" : "single";
  const title = field(source, "name");
  const questionHtml = richField(source, "questiontext");
  if (!questionHtml) throw new Error(`Question ${index} : l'énoncé est vide.`);
  const answerElements = children(source, "answer");
  if (answerElements.length < 2) throw new Error(`Question ${index} : il faut au moins deux réponses.`);
  const fractions = answerElements.map((answer) => answer.hasAttribute("fraction") ? Number(answer.getAttribute("fraction")) : NaN);
  if (fractions.some((fraction) => !Number.isFinite(fraction) || fraction < -100 || fraction > 100)) {
    throw new Error(`Question ${index} : une fraction de réponse est invalide.`);
  }
  if (mode !== "multiple" && fractions.some((fraction) => fraction < 0)) {
    throw new Error(`Question ${index} : le crédit négatif n'est pris en charge que pour les QCM.`);
  }
  const correctCount = fractions.filter((fraction) => fraction > 0).length;
  if (correctCount < 1 || (mode !== "multiple" && correctCount !== 1)) {
    throw new Error(`Question ${index} : les réponses correctes ne correspondent pas au type de question.`);
  }
  const totalCredit = fractions.reduce((sum, fraction) => sum + Math.max(0, fraction), 0);
  if (type !== "multichoiceset" && Math.abs(totalCredit - 100) > 0.1) {
    throw new Error(`Question ${index} : les fractions des réponses ne totalisent pas 100 %.`);
  }
  const answers: QuizAnswer[] = answerElements.map((answer, answerIndex) => {
    let textHtml = richField(answer, "text");
    if (mode === "true-false") {
      const value = field(answer, "text").toLowerCase();
      if (value !== "true" && value !== "false") throw new Error(`Question ${index} : réponse vrai/faux inconnue.`);
      textHtml = value === "true" ? "<p>Vrai</p>" : "<p>Faux</p>";
    }
    if (!textHtml) throw new Error(`Question ${index}, réponse ${answerIndex + 1} : texte vide.`);
    return {
      id: makeId("answer"),
      textHtml,
      correct: fractions[answerIndex] > 0,
      feedbackHtml: richField(answer, "feedback"),
      ...(mode === "multiple" && type !== "multichoiceset" ? { creditPercent: fractions[answerIndex] } : {})
    };
  });
  if (mode === "true-false" && (answers.length !== 2 || answers[0].textHtml === answers[1].textHtml)) {
    throw new Error(`Question ${index} : les réponses Vrai et Faux sont incomplètes.`);
  }
  const rawPoints = field(source, "defaultgrade");
  const points = rawPoints ? Number(rawPoints) : 1;
  if (!Number.isFinite(points) || points < 1) {
    throw new Error(`Question ${index} : le poids « ${rawPoints} » ne peut pas être représenté dans PAIDEIA (minimum 1).`);
  }
  return {
    question: {
      id: makeId("bank_question"),
      title,
      category,
      tags: child(source, "tags") ? children(child(source, "tags")!, "tag").map((tag) => field(tag, "text")).filter(Boolean) : [],
      mode,
      creditMode: mode === "multiple" && type !== "multichoiceset" ? "custom" : null,
      questionHtml,
      answers,
      generalFeedbackHtml: richField(source, "generalfeedback"),
      feedbackCorrectHtml: richField(source, "correctfeedback"),
      feedbackIncorrectHtml: richField(source, "incorrectfeedback"),
      points,
      sourceBankId: null,
      sourceQuestionId: null
    },
    partialCredit: mode === "multiple" && type !== "multichoiceset",
    penalty: Number(field(source, "penalty")) > 0,
    shuffle: field(source, "shuffleanswers") === "true"
  };
}

export function parseMoodleQuestionBankXml(xml: string): MoodleQuestionBankImport {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Le XML Moodle ne doit pas contenir de DTD ni d'entités externes.");
  const documentValue = new DOMParser().parseFromString(xml, "application/xml");
  if (documentValue.querySelector("parsererror") || documentValue.documentElement.tagName !== "quiz") {
    throw new Error("Le fichier n'est pas un export XML Moodle valide (<quiz> attendu).");
  }
  let category = "";
  const categories = new Set<string>();
  const questions: QuestionBankQuestion[] = [];
  let partialCreditQuestions = 0;
  let ignoredPenaltyQuestions = 0;
  let shuffleAnswerQuestions = 0;
  for (const element of children(documentValue.documentElement, "question")) {
    if (element.getAttribute("type") === "category") {
      category = readableCategory(field(element, "category"));
      if (category) categories.add(category);
      continue;
    }
    const parsed = parseQuestion(element, category, questions.length + 1);
    questions.push(parsed.question);
    if (parsed.partialCredit) partialCreditQuestions += 1;
    if (parsed.penalty) ignoredPenaltyQuestions += 1;
    if (parsed.shuffle) shuffleAnswerQuestions += 1;
  }
  if (!questions.length) throw new Error("Le fichier Moodle ne contient aucune question importable.");
  return { questions, categoryCount: categories.size, partialCreditQuestions, ignoredPenaltyQuestions, shuffleAnswerQuestions };
}

export async function importMoodleQuestionBankXml(file: File): Promise<MoodleQuestionBankImport> {
  if (file.size > MAX_MOODLE_XML_BYTES) throw new Error("Le fichier XML Moodle dépasse 20 Mo.");
  return parseMoodleQuestionBankXml(await file.text());
}
