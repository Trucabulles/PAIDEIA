import { hasValidPartialCredit, questionCreditMode } from "../../../assessment/assessmentEngine";
import { translateActive } from "../../../i18n";
import type { QuestionBankQuestion, QuizAnswer } from "../../../types/project";

export type MoodleAllOrNothingExport = "standard" | "plugin";

function xmlText(value: string): string {
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(value)) {
    throw new Error("Un texte contient un caractère interdit dans un fichier XML.");
  }
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function richField(name: string, html: string | null | undefined): string {
  if (!html?.trim()) return "";
  if (/\b(?:src|href)\s*=\s*["'](?:data:|blob:|file:|asset:)/iu.test(html)) {
    throw new Error("Un média intégré ne peut pas être exporté en XML Moodle dans ce circuit.");
  }
  return `    <${name} format="html"><text>${xmlText(html)}</text></${name}>`;
}

function answerFraction(question: QuestionBankQuestion, answer: QuizAnswer, correctCount: number, allOrNothing: MoodleAllOrNothingExport): number {
  if (question.mode !== "multiple") return answer.correct ? 100 : 0;
  const mode = questionCreditMode(question);
  if (mode === "custom") return answer.creditPercent!;
  if (mode === "default" && allOrNothing === "plugin") return answer.correct ? 100 : 0;
  if (answer.correct) return Math.round(1_000_000 / correctCount) / 10_000;
  return 0;
}

function trueFalseAnswerValue(answer: QuizAnswer): string {
  const text = answer.textHtml.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim().toLowerCase();
  if (text === "vrai" || text === "true") return "true";
  if (text === "faux" || text === "false") return "false";
  throw new Error("Une réponse Vrai/Faux n'est pas reconnue pour l'export Moodle.");
}

function serializeQuestion(question: QuestionBankQuestion, index: number, allOrNothing: MoodleAllOrNothingExport): string {
  const label = question.title?.trim() || translateActive("quiz.questionNumber", { count: index + 1 });
  const correctCount = question.answers.filter((answer) => answer.correct).length;
  if (!question.questionHtml?.trim() || question.answers.length < 2 || correctCount < 1 || (question.mode !== "multiple" && correctCount !== 1)) {
    throw new Error(`Question ${index + 1} « ${label} » : énoncé ou réponses incomplets.`);
  }
  if (question.mode === "multiple" && questionCreditMode(question) === "custom" && !hasValidPartialCredit(question)) {
    throw new Error(`Question ${index + 1} « ${label} » : barème ajusté invalide.`);
  }
  if (question.mode === "true-false" && new Set(question.answers.map(trueFalseAnswerValue)).size !== 2) {
    throw new Error(`Question ${index + 1} « ${label} » : il faut une réponse Vrai et une réponse Faux.`);
  }
  const points = Number(question.points);
  if (!Number.isFinite(points) || points < 1) throw new Error(`Question ${index + 1} « ${label} » : poids invalide.`);

  const pluginQuestion = question.mode === "multiple" && questionCreditMode(question) === "default" && allOrNothing === "plugin";
  const type = question.mode === "true-false" ? "truefalse" : pluginQuestion ? "multichoiceset" : "multichoice";
  const lines = [
    `  <question type="${type}">`,
    `    <name><text>${xmlText(label)}</text></name>`,
    richField("questiontext", question.questionHtml),
    `    <defaultgrade>${points}</defaultgrade>`,
    "    <penalty>0</penalty>",
    richField("generalfeedback", question.generalFeedbackHtml),
    richField("correctfeedback", question.feedbackCorrectHtml),
    richField("incorrectfeedback", question.feedbackIncorrectHtml)
  ];
  if (question.mode !== "true-false" && !pluginQuestion) {
    lines.push(`    <single>${question.mode === "single" ? "true" : "false"}</single>`);
    lines.push("    <shuffleanswers>false</shuffleanswers>");
  }
  for (const answer of question.answers) {
    const fraction = answerFraction(question, answer, correctCount, allOrNothing);
    const value = question.mode === "true-false" ? trueFalseAnswerValue(answer) : answer.textHtml;
    if (!value?.trim()) throw new Error(`Question ${index + 1} « ${label} » : une réponse est vide.`);
    lines.push(`    <answer fraction="${fraction}"${question.mode === "true-false" ? "" : ' format="html"'}>`);
    lines.push(`      <text>${xmlText(value)}</text>`);
    if (answer.feedbackHtml?.trim()) lines.push(`      <feedback format="html"><text>${xmlText(answer.feedbackHtml)}</text></feedback>`);
    lines.push("    </answer>");
  }
  const tags = question.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [];
  if (tags.length) lines.push("    <tags>", ...tags.map((tag) => `      <tag><text>${xmlText(tag)}</text></tag>`), "    </tags>");
  lines.push("  </question>");
  return lines.filter(Boolean).join("\n");
}

export function exportMoodleQuestionBankXml(questions: QuestionBankQuestion[], allOrNothing: MoodleAllOrNothingExport = "standard"): string {
  if (questions.length === 0) throw new Error("Une banque vide ne peut pas être exportée en XML Moodle.");
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', "<quiz>"];
  let previousCategory: string | null = null;
  for (const [index, question] of questions.entries()) {
    const category = question.category?.trim() ?? "";
    if (category !== previousCategory) {
      lines.push("  <question type=\"category\">");
      lines.push(`    <category><text>${xmlText(`$course$/top${category ? `/${category}` : ""}`)}</text></category>`);
      lines.push("  </question>");
      previousCategory = category;
    }
    lines.push(serializeQuestion(question, index, allOrNothing));
  }
  lines.push("</quiz>");
  return `${lines.join("\n")}\n`;
}
