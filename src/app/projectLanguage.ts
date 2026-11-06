import { ACTIVITY_LABELS, type KnownActivityType } from "./activityLabels";
import {
  SUPPORTED_APP_LANGUAGES,
  normalizeAppLanguage,
  translate,
  type AppLanguage,
  type TranslationParams
} from "../i18n";
import type { ActivityItem, PaideiaBlock, PaideiaProject } from "../types/project";

const DEFAULT_TITLED_BLOCK_TYPES = new Set([
  "header", "slides", "attachment", "tabs", "quiz", "question-multiple", "question-unique", "question-true-false", "question-random", "complete", "card-sort",
  "matching", "result-message", "find-elements"
]);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function translatedValues(key: string, params?: TranslationParams) {
  return SUPPORTED_APP_LANGUAGES.map((language) => translate(language, key, params));
}

function replaceKnownPlainDefault(
  value: string | null | undefined,
  key: string,
  language: AppLanguage,
  params?: TranslationParams,
  legacy: string[] = []
) {
  const current = value ?? "";
  const comparableCurrent = current.trim();
  return [...translatedValues(key, params), ...legacy].some((candidate) => candidate.trim() === comparableCurrent)
    ? translate(language, key, params)
    : current;
}

function replaceKnownHtmlDefault(
  value: string | null | undefined,
  key: string,
  language: AppLanguage,
  params?: TranslationParams,
  tag = "p",
  legacy: string[] = []
) {
  const current = (value ?? "").trim();
  const candidates = translatedValues(key, params).map((text) => `<${tag}>${escapeHtml(text)}</${tag}>`);
  return [...candidates, ...legacy].includes(current)
    ? `<${tag}>${escapeHtml(translate(language, key, params))}</${tag}>`
    : value ?? "";
}

function replaceKnownNumberedHtmlDefault(
  value: string | null | undefined,
  key: string,
  order: number,
  language: AppLanguage,
  legacy: string[] = []
) {
  const current = (value ?? "").trim();
  const candidates = SUPPORTED_APP_LANGUAGES.map(
    (sourceLanguage) => `<p>${escapeHtml(translate(sourceLanguage, key))} ${order}</p>`
  );
  return [...candidates, ...legacy].includes(current)
    ? `<p>${escapeHtml(translate(language, key))} ${order}</p>`
    : value ?? "";
}

function numberedActivityTitle(value: string, type: string, language: AppLanguage) {
  const key = ACTIVITY_LABELS[type as KnownActivityType];
  if (!key) return value;
  for (const sourceLanguage of SUPPORTED_APP_LANGUAGES) {
    const prefix = translate(sourceLanguage, key);
    const match = value.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(\\d+)$`, "i"));
    if (match) return `${translate(language, key)} ${match[1]}`;
  }
  return value;
}

function localizeActivityItem(item: ActivityItem, blockType: string, index: number, language: AppLanguage) {
  const order = index + 1;
  const next = { ...item };
  if (blockType === "slides") {
    next.title = replaceKnownPlainDefault(item.title, "slides.slideNumber", language, { number: order });
  } else if (blockType === "situational-dialogue") {
    const key = item.nodeType === "introduction"
      ? "situationalDialogue.introduction"
      : item.nodeType === "conclusion"
        ? "situationalDialogue.conclusion"
        : "situationalDialogue.sequenceNumber";
    const params = item.nodeType === "introduction" || item.nodeType === "conclusion" ? undefined : { number: order };
    next.title = replaceKnownPlainDefault(item.title, key, language, params);
  } else if (blockType === "result-message") {
    const key = item.kind === "result-success"
      ? "resultMessage.successBranch"
      : item.kind === "result-failure"
        ? "resultMessage.failureBranch"
        : null;
    if (key) next.title = replaceKnownPlainDefault(item.title, key, language);
  } else if (blockType === "links-resources") {
    next.title = replaceKnownPlainDefault(item.title, "linksResources.defaultAction", language);
  } else if (blockType === "audio") {
    next.title = replaceKnownPlainDefault(item.title, "audio.trackNumber", language, { count: order }, ["Piste audio"]);
  } else if (blockType === "image-grid") {
    next.title = replaceKnownPlainDefault(item.title, "imageGrid.imageNumber", language, { count: order }, [`Élément ${order}`]);
    next.contentHtml = replaceKnownHtmlDefault(item.contentHtml, "editor.contentPlaceholder", language);
  } else if (blockType === "flip-cards") {
    next.title = replaceKnownPlainDefault(item.title, "flipCards.cardNumber", language, { count: order }, [`Élément ${order}`]);
    next.frontText = replaceKnownPlainDefault(item.frontText, "flipCards.cardNumber", language, { count: order }, [`Élément ${order}`]);
    next.contentHtml = replaceKnownHtmlDefault(item.contentHtml, "editor.contentPlaceholder", language);
  } else if (blockType === "card-sort") {
    next.title = replaceKnownPlainDefault(item.title, "cardSort.card", language, { index: order });
    next.contentHtml = replaceKnownHtmlDefault(item.contentHtml, "cardSort.card", language, { index: order });
  }
  return next;
}

function localizeBlock(block: PaideiaBlock, language: AppLanguage): PaideiaBlock {
  const next: PaideiaBlock = { ...block };
  const activityKey = ACTIVITY_LABELS[block.type as KnownActivityType];
  if (activityKey && DEFAULT_TITLED_BLOCK_TYPES.has(block.type)) {
    next.title = replaceKnownPlainDefault(block.title, activityKey, language);
  }
  if (activityKey && (block.type === "continue" || block.type === "course-exit")) {
    next.summary = replaceKnownPlainDefault(block.summary, activityKey, language);
  }
  if (block.type === "find-elements") {
    next.contentHtml = replaceKnownHtmlDefault(block.contentHtml, "findElements.introHelp", language);
    if (block.findElements) {
      next.findElements = {
        ...block.findElements,
        labels: {
          description: replaceKnownPlainDefault(block.findElements.labels.description, "findElements.label.description", language, undefined, ["Description"]),
          risk: replaceKnownPlainDefault(block.findElements.labels.risk, "findElements.label.risk", language, undefined, ["Risque"]),
          correction: replaceKnownPlainDefault(block.findElements.labels.correction, "findElements.label.correction", language, undefined, ["Correction"])
        }
      };
    }
  }
  if (block.quiz) {
    next.quiz = {
      ...block.quiz,
      titleHtml: block.quiz.titleMode === "auto"
        ? `<p>${escapeHtml(numberedActivityTitle(block.quiz.titleHtml.replace(/<[^>]*>/g, "").trim(), "quiz", language))}</p>`
        : block.quiz.titleHtml,
      startLeadHtml: replaceKnownHtmlDefault(block.quiz.startLeadHtml, "quiz.startPlaceholder", language)
    };
  }
  if (block.complete) {
    next.complete = {
      ...block.complete,
      cover: {
        ...block.complete.cover,
        titleHtml: replaceKnownHtmlDefault(block.complete.cover.titleHtml, "activity.complete", language, undefined, "h1", ["<h1>Texte à compléter</h1>"])
      },
      ending: {
        successHtml: replaceKnownHtmlDefault(
          block.complete.ending.successHtml,
          "complete.success",
          language,
          undefined,
          "p",
          ["<p>Vous avez réussi cet exercice avec succès !</p><p>Vous pouvez continuer la leçon.</p>"]
        ),
        failureHtml: replaceKnownHtmlDefault(
          block.complete.ending.failureHtml,
          "complete.attemptsEnded",
          language,
          undefined,
          "p",
          ["<p>Vous n’avez pas atteint le score requis.</p><p>Si une nouvelle tentative est disponible, vous pouvez recommencer l’exercice pour améliorer votre résultat.</p>"]
        )
      }
    };
  }
  if (block.cardSort) {
    next.cardSort = {
      ...block.cardSort,
      categories: block.cardSort.categories.map((category, index) => {
        const params = { index: index + 1 };
        const label = replaceKnownPlainDefault(category.label, "cardSort.category", language, params);
        return {
          ...category,
          label,
          labelHtml: replaceKnownHtmlDefault(category.labelHtml, "cardSort.category", language, params)
        };
      }),
      successFeedbackHtml: replaceKnownHtmlDefault(block.cardSort.successFeedbackHtml, "cardSort.successFeedback", language, undefined, "p", ["<p>Votre tri est réussi.</p>"]),
      failureFeedbackHtml: replaceKnownHtmlDefault(block.cardSort.failureFeedbackHtml, "cardSort.failureFeedback", language, undefined, "p", ["<p>Votre tri comporte encore des erreurs. Recommencez si une nouvelle tentative est disponible.</p>"])
    };
  }
  if (block.matching) {
    next.matching = {
      ...block.matching,
      pairs: block.matching.pairs.map((pair, index) => ({
        ...pair,
        leftHtml: replaceKnownNumberedHtmlDefault(pair.leftHtml, "matching.leftElement", index + 1, language, [`<p>Élément ${index + 1}</p>`]),
        rightHtml: replaceKnownNumberedHtmlDefault(pair.rightHtml, "matching.rightElement", index + 1, language, [`<p>Correspondance ${index + 1}</p>`])
      })),
      successFeedbackHtml: replaceKnownHtmlDefault(block.matching.successFeedbackHtml, "matching.successFeedback", language, undefined, "p", ["<p>Vous avez correctement relié tous les éléments.</p>"]),
      failureFeedbackHtml: replaceKnownHtmlDefault(block.matching.failureFeedbackHtml, "matching.failureFeedback", language, undefined, "p", ["<p>Certaines associations sont incorrectes. Recommencez si une nouvelle tentative est disponible.</p>"])
    };
  }
  next.image360Hotspots = block.image360Hotspots?.map((hotspot) => ({
    ...hotspot,
    title: replaceKnownPlainDefault(
      hotspot.title,
      "image360.pointNumber",
      language,
      { count: hotspot.order },
      [`Point ${hotspot.order}`]
    )
  }));
  next.activityItems = block.activityItems?.map((item, index) => localizeActivityItem(item, block.type, index, language));
  return next;
}

export function projectLanguage(project: PaideiaProject | null | undefined, fallback: AppLanguage): AppLanguage {
  return normalizeAppLanguage(project?.defaultLocale) ?? fallback;
}

// Localization only edits generated labels. Retain untouched objects, including
// large banks and media data, and use identity to detect an unchanged project.
function reuseUnchanged<T>(before: T, candidate: T): T {
  if (before === candidate) return before;
  if (!before || !candidate || typeof before !== "object" || typeof candidate !== "object") return candidate;
  if (Array.isArray(before) !== Array.isArray(candidate)) return candidate;
  if (Array.isArray(before) && Array.isArray(candidate) && before.length !== candidate.length) return candidate;
  const original = before as Record<string, unknown>;
  const next = candidate as Record<string, unknown>;
  let unchanged = true;
  for (const key of Object.keys(next)) {
    const value = reuseUnchanged(original[key], next[key]);
    next[key] = value;
    if (value !== original[key]) unchanged = false;
  }
  for (const key of Object.keys(original)) {
    if (!(key in next) && original[key] !== undefined) unchanged = false;
  }
  return unchanged ? before : candidate;
}

export function localizeProjectGeneratedContent(project: PaideiaProject, language: AppLanguage): PaideiaProject {
  const modules = project.course.modules.map((module) => ({
    ...module,
    chapters: module.chapters.map((chapter) => ({
      ...chapter,
      title: replaceKnownPlainDefault(chapter.title, "lesson.newChapter", language),
      pages: chapter.pages.map((page) => ({
        ...page,
        title: replaceKnownPlainDefault(page.title, "lesson.newChapter", language),
        blocks: page.blocks.map((block) => localizeBlock(block, language))
      }))
    }))
  }));
  return reuseUnchanged(project, {
    ...project,
    defaultLocale: language,
    locales: [language],
    course: { ...project.course, modules }
  });
}
