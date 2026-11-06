import type { CompleteActivityData, CompleteBlank, CompleteExercise } from "../../../types/project";
import { translateActive } from "../../../i18n";

export const COMPLETE_MARKER_ATTRIBUTE = "data-paideia-complete-id";
export const COMPLETE_MARKER_KIND_ATTRIBUTE = "data-paideia-complete-kind";
export const COMPLETE_COVER_BACKGROUND_COLOR = "#F3F3EC";
export type CompleteResponseKind = "text" | "list";

type CompleteCoverWithBackground = CompleteActivityData["cover"] & { backgroundColor?: string };

export function completeCoverBackgroundColor(data: Pick<CompleteActivityData, "cover">) {
  const cover = data.cover as CompleteCoverWithBackground;
  return cover.backgroundColor?.trim() || COMPLETE_COVER_BACKGROUND_COLOR;
}

export function completeCoverWithBackgroundColor(cover: CompleteActivityData["cover"], backgroundColor: string): CompleteActivityData["cover"] {
  return {
    ...cover,
    backgroundColor: backgroundColor.trim() || COMPLETE_COVER_BACKGROUND_COLOR
  } as CompleteActivityData["cover"];
}

export function completeAttemptsUnlimited(data: Pick<CompleteActivityData, "maxAttempts">) {
  return Number(data.maxAttempts) === 0;
}

export const COMPLETE_DEFAULTS: CompleteActivityData = {
  orientation: "landscape",
  revealAnswersOnFinalReview: false,
  cover: {
    enabled: true,
    titleHtml: "<p></p>",
    descriptionHtml: "<p></p>",
    backgroundColor: COMPLETE_COVER_BACKGROUND_COLOR
  } as CompleteActivityData["cover"],
  ending: {
    successHtml: "<p>Vous avez réussi cet exercice avec succès !</p><p>Vous pouvez continuer la leçon.</p>",
    failureHtml: "<p>Vous n’avez pas atteint le score requis.</p><p>Si une nouvelle tentative est disponible, vous pouvez recommencer l’exercice pour améliorer votre résultat.</p>"
  },
  exercises: [],
  maxAttempts: 3,
  successThreshold: 80,
  gateChapterUntilPassed: false
};

export function createDefaultCompleteData(): CompleteActivityData {
  return {
    ...COMPLETE_DEFAULTS,
    cover: {
      ...COMPLETE_DEFAULTS.cover,
      titleHtml: COMPLETE_DEFAULTS.cover.titleHtml
    },
    ending: {
      successHtml: `<p>${translateActive("complete.success")}</p>`,
      failureHtml: `<p>${translateActive("complete.attemptsEnded")}</p>`
    },
    exercises: [createCompleteExercise(1)]
  };
}

function stableId(prefix: string, order: number) {
  return `${prefix}_${Date.now()}_${order}`;
}

export function createCompleteExercise(order: number): CompleteExercise {
  return { id: stableId("complete_exercise", order), contentHtml: "<p></p>", blanks: [] };
}

export function createCompleteBlank(order: number, answer = ""): CompleteBlank {
  return {
    id: stableId("complete_blank", order),
    answer,
    variants: [],
    caseSensitive: false
  };
}

export function completeBlankMarker(blankId: string, selectedHtml: string, kind: CompleteResponseKind = "text") {
  const kindAttribute = kind === "list" ? ` ${COMPLETE_MARKER_KIND_ATTRIBUTE}="list"` : "";
  return `<span ${COMPLETE_MARKER_ATTRIBUTE}="${blankId}"${kindAttribute} contenteditable="false">${selectedHtml}</span>&#8203;`;
}

export function completeResponseKindsById(html: string) {
  const documentNode = new DOMParser().parseFromString(html || "<p></p>", "text/html");
  const kinds = new Map<string, CompleteResponseKind>();
  documentNode.body.querySelectorAll<HTMLElement>(`[${COMPLETE_MARKER_ATTRIBUTE}]`).forEach((marker) => {
    const id = marker.dataset.paideiaCompleteId;
    if (!id) return;
    kinds.set(id, marker.dataset.paideiaCompleteKind === "list" ? "list" : "text");
  });
  return kinds;
}

/**
 * Compléter behaves as one continuous RichText document. The persisted
 * `exercises` array is kept for schema/backward compatibility only: legacy
 * multi-page projects are merged in reading order and the runtime paginates
 * the resulting document from the available folio geometry.
 */
export function completeDocumentExercise(data: Pick<CompleteActivityData, "exercises">): CompleteExercise {
  const exercises = data.exercises?.length ? data.exercises : [{ id: "complete_document_1", contentHtml: "<p></p>", blanks: [] }];
  const firstExercise = exercises[0];
  const contentParts = exercises
    .map((exercise) => exercise.contentHtml?.trim())
    .filter((html): html is string => Boolean(html));

  return {
    id: firstExercise?.id || "complete_document_1",
    contentHtml: contentParts.length ? contentParts.join("<p><br></p>") : "<p></p>",
    blanks: exercises.flatMap((exercise) => exercise.blanks ?? [])
  };
}

function normalizeMaxAttempts(value: number | null | undefined) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric === 0) return 0;
  const fallback = COMPLETE_DEFAULTS.maxAttempts;
  return Math.max(1, Math.min(10, Math.round(numeric) || fallback));
}

const LEGACY_COMPLETE_FAILURE_DEFAULT_TEXTS = new Set([
  "Vous n'avez pas ou atteint un score insuffisant. Nous vous conseillons de reprendre la leçon depuis le début pour consolider vos connaissances et recommencer l'exercice. Vous pouvez malgré tout continuer la leçon si vous le souhaitez.",
  "Vous n'avez pas atteint le score requis. Nous vous conseillons de reprendre la leçon depuis le début pour consolider vos connaissances et recommencer l'exercice. Vous pouvez malgré tout continuer la leçon si vous le souhaitez."
]);

function normalizeCompleteEndingText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;|&apos;|&rsquo;|’/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function completeEndingHtmlOrDefault(value: string | null | undefined, fallback: string, migrateLegacyFailure = false) {
  if (!value) return fallback;
  if (migrateLegacyFailure && LEGACY_COMPLETE_FAILURE_DEFAULT_TEXTS.has(normalizeCompleteEndingText(value))) {
    return fallback;
  }
  return value;
}

export function normalizeCompleteData(value?: CompleteActivityData | null, legacyContentHtml = "<p></p>"): CompleteActivityData {
  const source = value ?? COMPLETE_DEFAULTS;
  const legacy = source as CompleteActivityData & { blanks?: CompleteBlank[] };
  const exercises = source.exercises?.length
    ? source.exercises
    : [{ id: "complete_exercise_1", contentHtml: legacyContentHtml, blanks: legacy.blanks ?? [] }];
  const sourceCover = (source.cover ?? COMPLETE_DEFAULTS.cover) as CompleteCoverWithBackground;
  return {
    orientation: source.orientation === "landscape" ? "landscape" : "portrait",
    cover: {
      enabled: sourceCover.enabled ?? COMPLETE_DEFAULTS.cover.enabled,
      titleHtml: sourceCover.titleHtml || COMPLETE_DEFAULTS.cover.titleHtml,
      descriptionHtml: sourceCover.descriptionHtml || COMPLETE_DEFAULTS.cover.descriptionHtml,
      backgroundColor: sourceCover.backgroundColor?.trim() || COMPLETE_COVER_BACKGROUND_COLOR
    } as CompleteActivityData["cover"],
    ending: {
      successHtml: completeEndingHtmlOrDefault(source.ending?.successHtml, COMPLETE_DEFAULTS.ending.successHtml),
      failureHtml: completeEndingHtmlOrDefault(source.ending?.failureHtml, COMPLETE_DEFAULTS.ending.failureHtml, true)
    },
    exercises: exercises.map((exercise, exerciseIndex) => ({
      id: exercise.id || `complete_exercise_${exerciseIndex + 1}`,
      contentHtml: exercise.contentHtml || "<p></p>",
      blanks: (exercise.blanks ?? []).map((blank, blankIndex) => ({
        id: blank.id || `complete_blank_${exerciseIndex + 1}_${blankIndex + 1}`,
        answer: blank.answer ?? "",
        // Preserve the author's raw textarea lines while editing. Trimming, empty-line
        // filtering and de-duplication belong to evaluation/runtime interpretation,
        // otherwise a trailing space is removed on every keystroke and multi-word
        // answers/choices become impossible to type.
        variants: (blank.variants ?? []).map((item) => item ?? ""),
        caseSensitive: Boolean(blank.caseSensitive)
      }))
    })),
    maxAttempts: normalizeMaxAttempts(source.maxAttempts),
    successThreshold: Math.max(0, Math.min(100, Math.round(Number(source.successThreshold) || COMPLETE_DEFAULTS.successThreshold))),
    revealAnswersOnFinalReview: Boolean(source.revealAnswersOnFinalReview),
    gateChapterUntilPassed: Boolean(source.gateChapterUntilPassed)
  };
}
