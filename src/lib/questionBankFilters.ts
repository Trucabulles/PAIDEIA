import type { QuestionBankQuestion } from "../types/project";

export const UNCATEGORIZED = "\u0000uncategorized";

export function questionCategories(questions: QuestionBankQuestion[]): string[] {
  return Array.from(new Set(questions.map((question) => question.category?.trim() ?? "").filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
}

export function questionTags(questions: QuestionBankQuestion[]): string[] {
  return Array.from(new Set(questions.flatMap((question) => question.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [])))
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
}

export function resolvedQuestionCategory(questions: QuestionBankQuestion[], category: string): string {
  if (category === UNCATEGORIZED) return questions.some((question) => !question.category?.trim()) ? category : "";
  return questionCategories(questions).includes(category) ? category : "";
}

function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

export function matchesQuestionFilters(
  question: QuestionBankQuestion,
  { category = "", tag = "", search = "" }: { category?: string; tag?: string; search?: string }
): boolean {
  const questionCategory = question.category?.trim() ?? "";
  if (category === UNCATEGORIZED ? Boolean(questionCategory) : Boolean(category && questionCategory !== category)) return false;
  if (tag && !question.tags?.some((candidate) => candidate.trim() === tag)) return false;
  const term = normalizeSearch(search);
  if (!term) return true;
  const searchable = `${question.title ?? ""} ${question.questionHtml.replace(/<[^>]*>/g, " ")}`;
  return normalizeSearch(searchable).includes(term);
}
