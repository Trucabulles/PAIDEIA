import type { PaideiaBlock, PaideiaChapter, PaideiaProject } from "../types/project";
import { createTranslator, type AppLanguage } from "../i18n";

export const READING_WORDS_PER_MINUTE = 150;
export const PEDAGOGICAL_COEFFICIENT = 1.5;
export const INTERACTION_TIMES = {
  simpleReveal: 4,
  question: 15,
  sortableItem: 10,
  searchableElement: 25,
  scenarioDecision: 25
} as const;
export const FEEDBACK_READING_FACTOR = 0.5;

export type MediaDurationResolver = (ref: string) => number | undefined;

export type LessonDurationMediaDetail = {
  chapterTitle: string;
  activityTitle: string;
  ref: string;
  kind: "audio" | "video";
  seconds: number | null;
};

export type LessonDurationInteractionDetail = {
  chapterTitle: string;
  activityTitle: string;
  kind: string;
  elementCount: number;
  secondsPerElement: number;
  seconds: number;
};

export type LessonDurationChapterBreakdown = {
  chapterTitle: string;
  pedagogicalWords: number;
  interfaceWords: number;
  textWords: number;
  textSeconds: number;
  videoSeconds: number;
  audioSeconds: number;
  interactionElements: number;
  interactionSeconds: number;
  totalSeconds: number;
};

export type LessonDurationBreakdown = {
  customHtmlActivityCount: number;
  pedagogicalWords: number;
  interfaceWords: number;
  textWords: number;
  textSeconds: number;
  videoSeconds: number;
  audioSeconds: number;
  interactionElements: number;
  interactionSeconds: number;
  totalSeconds: number;
  chapters: LessonDurationChapterBreakdown[];
  media: LessonDurationMediaDetail[];
  interactions: LessonDurationInteractionDetail[];
};

function htmlText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(?:head|style|script|template)\b[^>]*>[\s\S]*?<\/(?:head|style|script|template)>/gi, " ")
    .replace(/<br\s*\/?>(?=\S)/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"').replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}

function wordCount(value: string): number {
  return htmlText(value).trim().split(/\s+/u).filter(Boolean).length;
}

function isTemporalMediaRef(value: string): boolean {
  return /\.(?:aac|flac|m4a|m4v|mov|mp3|mp4|ogg|wav|webm)(?:[?#].*)?$/i.test(value.trim());
}

function temporalMediaKind(value: string): "audio" | "video" {
  return /\.(?:aac|flac|m4a|mp3|ogg|wav)(?:[?#].*)?$/i.test(value.trim()) ? "audio" : "video";
}

function present(...values: Array<string | null | undefined>): string[] {
  return values.filter((value): value is string => typeof value === "string" && Boolean(htmlText(value).trim()));
}

function itemTitleAndContent(block: PaideiaBlock): string[] {
  return (block.activityItems ?? []).flatMap((item) => present(item.title, item.contentHtml));
}

/**
 * Returns only text that the learner can encounter in the rendered activity.
 * Storage helpers (import summaries, aggregate HTML, technical titles and
 * rematching markers) must never be collected recursively.
 */
type VisibleActivityText = {
  pedagogical: string[];
  interface: string[];
};

function visibleActivityText(block: PaideiaBlock): VisibleActivityText {
  const pedagogical = (...values: Array<string | null | undefined>): VisibleActivityText => ({
    pedagogical: present(...values),
    interface: []
  });
  const learnerInterface = (...values: Array<string | null | undefined>): VisibleActivityText => ({
    pedagogical: [],
    interface: present(...values)
  });
  switch (block.type) {
    case "divider":
    case "section-marker":
    case "image":
      return pedagogical(block.contentHtml);
    case "continue":
    case "course-exit":
      return learnerInterface(block.summary || block.contentHtml || block.title);
    case "tabs":
    case "accordion":
    case "slides":
    case "timeline":
      return {
        pedagogical: (block.activityItems ?? []).flatMap((item) => present(item.contentHtml)),
        interface: (block.activityItems ?? []).flatMap((item) => present(item.title))
      };
    case "image-grid":
      return pedagogical(...(block.activityItems ?? []).flatMap((item) => present(item.contentHtml)));
    case "flip-cards":
      return pedagogical(...(block.activityItems ?? []).flatMap((item) => present(
        item.frontText || item.title,
        item.backTitle,
        item.contentHtml
      )));
    case "point-of-interest":
      return pedagogical(...(block.pointOfInterestMarkers ?? []).flatMap((marker) => present(marker.title, marker.contentHtml)));
    case "image-360":
      return pedagogical(...(block.image360Hotspots ?? []).flatMap((hotspot) => present(hotspot.title, hotspot.contentHtml)));
    case "quiz":
    case "mcq":
      return pedagogical(...[
        ...present(block.quiz?.titleHtml, block.quiz?.introHtml, block.quiz?.startLeadHtml),
        ...(block.quiz?.questions ?? []).flatMap((question) => [
          ...present(question.questionHtml, question.generalFeedbackHtml, question.feedbackCorrectHtml, question.feedbackIncorrectHtml),
          ...question.answers.flatMap((answer) => present(answer.textHtml))
        ])
      ]);
    case "question-multiple":
    case "question-unique":
    case "question-true-false":
    case "question-random":
      return pedagogical(...(block.quiz?.questions ?? []).flatMap((question) => [
        ...present(question.questionHtml, question.feedbackCorrectHtml, question.feedbackIncorrectHtml),
        ...question.answers.flatMap((answer) => present(answer.textHtml))
      ]));
    case "find-elements":
      return pedagogical(...[
        ...present(block.contentHtml),
        ...(block.findElements?.zones ?? []).flatMap((zone) => present(zone.title, zone.descriptionHtml, zone.riskHtml, zone.correctionHtml))
      ]);
    case "complete":
      return pedagogical(...[
        ...present(
          block.complete?.cover.enabled ? block.complete.cover.titleHtml : null,
          block.complete?.cover.enabled ? block.complete.cover.descriptionHtml : null,
          block.complete?.ending.successHtml,
          block.complete?.ending.failureHtml
        ),
        ...(block.complete?.exercises ?? []).flatMap((exercise) => present(exercise.contentHtml))
      ]);
    case "card-sort":
      return pedagogical(...[
        ...present(block.contentHtml, block.cardSort?.successFeedbackHtml, block.cardSort?.failureFeedbackHtml),
        ...(block.cardSort?.categories ?? []).flatMap((category) => present(category.labelHtml || category.label)),
        ...(block.activityItems ?? []).flatMap((item) => present(item.title, item.contentHtml, item.cardFeedbackHtml, item.cardFeedbackCorrectHtml, item.cardFeedbackIncorrectHtml))
      ]);
    case "matching":
      return pedagogical(...[
        ...present(block.contentHtml, block.matching?.successFeedbackHtml, block.matching?.failureFeedbackHtml),
        ...(block.matching?.pairs ?? []).flatMap((pair) => present(pair.leftHtml, pair.rightHtml))
      ]);
    case "situational-dialogue":
      return pedagogical(...(block.activityItems ?? []).flatMap((item) => [
        ...present(item.title, item.contentHtml),
        ...(item.responses ?? []).flatMap((response) => present(response.label, response.feedbackHtml))
      ]));
    case "html-custom":
      return pedagogical();
    default:
      return pedagogical(...[
        ...present(block.contentHtml),
        ...itemTitleAndContent(block)
      ]);
  }
}

function visibleActivityWordCounts(block: PaideiaBlock): { pedagogicalWords: number; interfaceWords: number; totalWords: number } {
  const text = visibleActivityText(block);
  const pedagogicalWords = text.pedagogical.reduce((total, value) => total + wordCount(value), 0);
  const interfaceWords = text.interface.reduce((total, value) => total + wordCount(value), 0);
  return { pedagogicalWords, interfaceWords, totalWords: pedagogicalWords + interfaceWords };
}

function mediaRefs(value: unknown, output = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => mediaRefs(item, output));
  else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      if (key === "assetRefs" && Array.isArray(child)) {
        child.forEach((ref) => {
          if (typeof ref === "string" && isTemporalMediaRef(ref)) output.add(ref);
        });
        return;
      }
      if (
        typeof child === "string" &&
        ((/(?:video|audio).*Ref/i.test(key) && isTemporalMediaRef(child)) ||
          (/^(?:audio|video)(?:Src|File|Url)$/i.test(key) && isTemporalMediaRef(child)))
      ) output.add(child);
      else mediaRefs(child, output);
    });
  }
  return output;
}

function activityMediaOccurrences(block: PaideiaBlock): string[] {
  if (block.type === "html-custom") return [];
  if (block.type === "video") {
    const activeVideoRef = (block.assetRefs ?? []).find(
      (ref) => isTemporalMediaRef(ref) && temporalMediaKind(ref) === "video"
    );
    return activeVideoRef ? [activeVideoRef] : [];
  }
  if (block.type === "audio") {
    const audioRefs = (block.activityItems ?? []).flatMap((item) => {
      const activeAudioRef = (item.assetRefs ?? []).find(
        (ref) => isTemporalMediaRef(ref) && temporalMediaKind(ref) === "audio"
      );
      return activeAudioRef ? [activeAudioRef] : [];
    });
    return audioRefs;
  }
  if (block.type === "point-of-interest") {
    return (block.pointOfInterestMarkers ?? []).flatMap((marker) => {
      const media = marker.media;
      if (!media || (media.type !== "video" && media.type !== "audio")) return [];
      const activeRef = media.optimizedAssetRef || media.assetRef;
      return activeRef && isTemporalMediaRef(activeRef) ? [activeRef] : [];
    });
  }
  return [...mediaRefs(block)];
}

export function collectLessonMediaRefs(project: PaideiaProject): string[] {
  const refs = new Set<string>();
  project.course.modules.flatMap((module) => module.chapters).flatMap((chapter) => chapter.pages)
    .flatMap((page) => page.blocks).forEach((block) => activityMediaOccurrences(block).forEach((ref) => refs.add(ref)));
  return [...refs];
}

/**
 * Identifies the measurable lesson content, independently from authoring
 * metadata and appearance settings. The signature changes only when the
 * duration estimator's inputs change.
 */
export function lessonDurationContentSignature(project: PaideiaProject): string {
  const activities = project.course.modules
    .flatMap((module) => module.chapters)
    .flatMap((chapter) => chapter.pages)
    .flatMap((page) => page.blocks)
    .map((block) => {
      const words = visibleActivityWordCounts(block);
      const interaction = activityInteractionMeasure(block);
      return {
        type: block.type,
        pedagogicalWords: words.pedagogicalWords,
        interfaceWords: words.interfaceWords,
        mediaRefs: [...activityMediaOccurrences(block)].sort(),
        interaction: interaction
          ? [interaction.kind, interaction.elementCount, interaction.secondsPerElement]
          : null,
        customHtml: block.type === "html-custom"
      };
    })
    .sort((left, right) => {
      const leftValue = JSON.stringify(left);
      const rightValue = JSON.stringify(right);
      return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
    });

  const canonical = JSON.stringify({
    version: 1,
    readingWordsPerMinute: READING_WORDS_PER_MINUTE,
    pedagogicalCoefficient: PEDAGOGICAL_COEFFICIENT,
    activities
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `duration-v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function readMediaDuration(url: string): Promise<number | undefined> {
  const kind = /\.(?:aac|flac|m4a|mp3|ogg|wav)(?:[?#].*)?$/i.test(url) ? "audio" : "video";
  const media = document.createElement(kind);
  media.preload = "metadata";
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => resolve(undefined), 12000);
    const finish = (value: number | undefined) => {
      window.clearTimeout(timeout);
      media.removeAttribute("src");
      media.load();
      resolve(value);
    };
    media.addEventListener("loadedmetadata", () => finish(Number.isFinite(media.duration) && media.duration > 0 ? media.duration : undefined), { once: true });
    media.addEventListener("error", () => finish(undefined), { once: true });
    media.src = url;
  });
}

function activityInteractionMeasure(block: PaideiaBlock): { kind: string; elementCount: number; secondsPerElement: number; seconds: number } | null {
  const items = block.activityItems?.length ?? 0;
  let kind = "";
  let elementCount = 0;
  let secondsPerElement = 0;
  switch (block.type) {
    case "accordion": kind = "accordion"; elementCount = items; secondsPerElement = INTERACTION_TIMES.simpleReveal; break;
    case "flip-cards": kind = "flipCard"; elementCount = items; secondsPerElement = INTERACTION_TIMES.simpleReveal; break;
    case "tabs": kind = "tab"; elementCount = items; secondsPerElement = INTERACTION_TIMES.simpleReveal; break;
    case "slides": kind = "slide"; elementCount = items; secondsPerElement = INTERACTION_TIMES.simpleReveal; break;
    case "timeline": kind = "timelineStep"; elementCount = items; secondsPerElement = INTERACTION_TIMES.simpleReveal; break;
    case "point-of-interest": kind = "pointOfInterest"; elementCount = block.pointOfInterestMarkers?.length ?? 0; secondsPerElement = INTERACTION_TIMES.simpleReveal; break;
    case "image-360": kind = "image360Hotspot"; elementCount = block.image360Hotspots?.length ?? 0; secondsPerElement = INTERACTION_TIMES.simpleReveal; break;
    case "quiz": case "mcq": case "question-multiple": case "question-unique": case "question-true-false": case "question-random": kind = "question"; elementCount = block.type === "question-random" ? Math.min(block.quiz?.questions.length ?? 0, block.quiz?.settings.questionLimit ?? 1) : block.quiz?.questions.length ?? 0; secondsPerElement = INTERACTION_TIMES.question; break;
    case "card-sort": kind = "sortableItem"; elementCount = items; secondsPerElement = INTERACTION_TIMES.sortableItem; break;
    case "matching": kind = "matchingPair"; elementCount = block.matching?.pairs.length ?? items; secondsPerElement = INTERACTION_TIMES.sortableItem; break;
    case "find-elements": kind = "searchableElement"; elementCount = block.findElements?.zones.length ?? 0; secondsPerElement = INTERACTION_TIMES.searchableElement; break;
    case "situational-dialogue": kind = "scenarioDecision"; elementCount = items; secondsPerElement = INTERACTION_TIMES.scenarioDecision; break;
    case "complete": kind = "completionExercise"; elementCount = block.complete?.exercises.length ?? 0; secondsPerElement = INTERACTION_TIMES.question; break;
    default: return null;
  }
  if (!elementCount) return null;
  return { kind, elementCount, secondsPerElement, seconds: elementCount * secondsPerElement };
}

export function estimateActivityDuration(block: PaideiaBlock, resolveMediaDuration?: MediaDurationResolver): number {
  const textSeconds = visibleActivityWordCounts(block).totalWords / READING_WORDS_PER_MINUTE * 60;
  const mediaSeconds = activityMediaOccurrences(block).reduce((total, ref) => total + (resolveMediaDuration?.(ref) ?? 0), 0);
  return Math.max(0, Math.round(textSeconds + mediaSeconds));
}

export function estimateChapterDuration(chapter: PaideiaChapter, resolveMediaDuration?: MediaDurationResolver): number {
  return chapter.pages.flatMap((page) => page.blocks).reduce((total, block) => total + estimateActivityDuration(block, resolveMediaDuration), 0);
}

export function estimateLessonDuration(project: PaideiaProject, resolveMediaDuration?: MediaDurationResolver): number {
  const consultationBaseSeconds = project.course.modules.flatMap((module) => module.chapters)
    .reduce((total, chapter) => total + estimateChapterDuration(chapter, resolveMediaDuration), 0);
  return Math.round(consultationBaseSeconds * PEDAGOGICAL_COEFFICIENT);
}

export function estimateLessonDurationBreakdown(
  project: PaideiaProject,
  resolveMediaDuration?: MediaDurationResolver
): LessonDurationBreakdown {
  const chapters: LessonDurationChapterBreakdown[] = [];
  const media: LessonDurationMediaDetail[] = [];
  const interactions: LessonDurationInteractionDetail[] = [];
  let customHtmlActivityCount = 0;

  for (const chapter of project.course.modules.flatMap((module) => module.chapters)) {
    let textSeconds = 0;
    let pedagogicalWords = 0;
    let interfaceWords = 0;
    let textWords = 0;
    let videoSeconds = 0;
    let audioSeconds = 0;
    let interactionElements = 0;
    let interactionSeconds = 0;

    for (const block of chapter.pages.flatMap((page) => page.blocks)) {
      if (block.type === "html-custom") customHtmlActivityCount += 1;
      const blockWords = visibleActivityWordCounts(block);
      pedagogicalWords += blockWords.pedagogicalWords;
      interfaceWords += blockWords.interfaceWords;
      textWords += blockWords.totalWords;
      textSeconds += blockWords.totalWords / READING_WORDS_PER_MINUTE * 60;
      const interaction = activityInteractionMeasure(block);
      if (interaction) {
        interactionElements += interaction.elementCount;
        interactionSeconds += interaction.seconds;
        interactions.push({
          chapterTitle: chapter.title,
          activityTitle: block.title || block.type,
          ...interaction
        });
      }
      for (const ref of activityMediaOccurrences(block)) {
        const resolvedSeconds = resolveMediaDuration?.(ref);
        const seconds = resolvedSeconds && resolvedSeconds > 0 ? resolvedSeconds : null;
        const kind = temporalMediaKind(ref);
        if (seconds != null) {
          if (kind === "audio") audioSeconds += seconds;
          else videoSeconds += seconds;
        }
        media.push({
          chapterTitle: chapter.title,
          activityTitle: block.title || block.type,
          ref,
          kind,
          seconds
        });
      }
    }

    const chapterBreakdown = {
      chapterTitle: chapter.title,
      pedagogicalWords,
      interfaceWords,
      textWords,
      textSeconds: Math.round(textSeconds),
      videoSeconds: Math.round(videoSeconds),
      audioSeconds: Math.round(audioSeconds),
      interactionElements,
      interactionSeconds: Math.round(interactionSeconds),
      totalSeconds: Math.round(textSeconds + videoSeconds + audioSeconds)
    };
    chapters.push(chapterBreakdown);
  }

  const pedagogicalWords = chapters.reduce((total, chapter) => total + chapter.pedagogicalWords, 0);
  const interfaceWords = chapters.reduce((total, chapter) => total + chapter.interfaceWords, 0);
  const textWords = pedagogicalWords + interfaceWords;
  const textSeconds = Math.round(textWords / READING_WORDS_PER_MINUTE * 60);
  const videoSeconds = Math.round(media.reduce((total, item) => total + (item.kind === "video" ? item.seconds ?? 0 : 0), 0));
  const audioSeconds = Math.round(media.reduce((total, item) => total + (item.kind === "audio" ? item.seconds ?? 0 : 0), 0));

  return {
    customHtmlActivityCount,
    pedagogicalWords,
    interfaceWords,
    textWords,
    textSeconds,
    videoSeconds,
    audioSeconds,
    interactionElements: chapters.reduce((total, chapter) => total + chapter.interactionElements, 0),
    interactionSeconds: chapters.reduce((total, chapter) => total + chapter.interactionSeconds, 0),
    totalSeconds: textSeconds + videoSeconds + audioSeconds,
    chapters,
    media,
    interactions
  };
}

function formatDiagnosticDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  if (hours) return `${hours} h ${String(minutes).padStart(2, "0")} min ${String(remainingSeconds).padStart(2, "0")} s`;
  return `${minutes} min ${String(remainingSeconds).padStart(2, "0")} s`;
}

function mediaDisplayName(ref: string): string {
  const normalized = ref.replace(/\\/g, "/");
  const fileName = normalized.slice(normalized.lastIndexOf("/") + 1) || normalized;
  try {
    return decodeURIComponent(fileName);
  } catch {
    return fileName;
  }
}

export function formatLessonDurationDiagnostic(
  project: PaideiaProject,
  breakdown: LessonDurationBreakdown,
  language: AppLanguage = "fr"
): string {
  const t = createTranslator(language);
  const number = (value: number) => value.toLocaleString(language);
  const coefficientLabel = PEDAGOGICAL_COEFFICIENT.toLocaleString(language);
  const recommendedSeconds = breakdown.totalSeconds * PEDAGOGICAL_COEFFICIENT;
  const lines = [
    t("lessonDuration.report.title"),
    "",
    t("lessonDuration.report.lesson", { title: project.title }),
    t("lessonDuration.report.generatedAt", { date: new Date().toLocaleString(language) }),
    "",
    t("lessonDuration.report.summary"),
    "",
    t("lessonDuration.report.consultationBase", { duration: formatDiagnosticDuration(breakdown.totalSeconds) }),
    t("lessonDuration.report.pedagogicalDuration", { duration: formatDiagnosticDuration(recommendedSeconds) }),
    t("lessonDuration.report.indicativeEnvelope", { duration: formatEstimatedDuration(recommendedSeconds) }),
    "",
    t("lessonDuration.report.referenceHypothesis"),
    "",
    t("lessonDuration.report.hypothesisNewContent"),
    t("lessonDuration.report.hypothesisNotExpert"),
    "",
    t("lessonDuration.report.envelopeNotice"),
    t("lessonDuration.report.methodNotice"),
    "",
    t("lessonDuration.report.factsHeading"),
    "",
    t("lessonDuration.report.pedagogicalContent", { count: number(breakdown.pedagogicalWords) }),
    t("lessonDuration.report.visibleInterface", { count: number(breakdown.interfaceWords) }),
    t("lessonDuration.report.totalVisibleText", { count: number(breakdown.textWords) }),
    t("lessonDuration.report.videoDuration", { duration: formatDiagnosticDuration(breakdown.videoSeconds) }),
    t("lessonDuration.report.audioDuration", { duration: formatDiagnosticDuration(breakdown.audioSeconds) }),
    t("lessonDuration.report.interactionsCount", { count: number(breakdown.interactionElements) }),
    "",
    t("lessonDuration.report.factsOrigin"),
    "",
    t("lessonDuration.report.parametersHeading"),
    "",
    t("lessonDuration.report.readingSpeed", { count: READING_WORDS_PER_MINUTE }),
    t("lessonDuration.report.coefficient", { coefficient: coefficientLabel }),
    t("lessonDuration.report.interactionParameters", INTERACTION_TIMES),
    t("lessonDuration.report.interactionsAbsorbed", { coefficient: coefficientLabel }),
    t("lessonDuration.report.navigation"),
    t("lessonDuration.report.subtitles"),
    "",
    t("lessonDuration.report.globalHeading"),
    "",
    t("lessonDuration.report.estimatedReading", { words: number(breakdown.textWords), speed: READING_WORDS_PER_MINUTE, duration: formatDiagnosticDuration(breakdown.textSeconds) }),
    t("lessonDuration.report.videos", { duration: formatDiagnosticDuration(breakdown.videoSeconds) }),
    t("lessonDuration.report.audios", { duration: formatDiagnosticDuration(breakdown.audioSeconds) }),
    t("lessonDuration.report.interactionNominal", { duration: formatDiagnosticDuration(breakdown.interactionSeconds) }),
    t("lessonDuration.report.consultationBaseItem", { duration: formatDiagnosticDuration(breakdown.totalSeconds) }),
    t("lessonDuration.report.weighting", { coefficient: coefficientLabel, duration: formatDiagnosticDuration(recommendedSeconds) }),
    t("lessonDuration.report.roundedEnvelope", { duration: formatEstimatedDuration(recommendedSeconds) }),
    "",
    t("lessonDuration.report.chapterHeading"),
    ""
  ];

  breakdown.chapters.forEach((chapter, index) => {
    lines.push(
      `${index + 1}. ${chapter.chapterTitle}`,
      t("lessonDuration.report.chapterFacts", { pedagogical: number(chapter.pedagogicalWords), interface: number(chapter.interfaceWords), total: number(chapter.textWords) }),
      t("lessonDuration.report.chapterBase", { duration: formatDiagnosticDuration(chapter.totalSeconds) }),
      t("lessonDuration.report.chapterDetail", { reading: formatDiagnosticDuration(chapter.textSeconds), videos: formatDiagnosticDuration(chapter.videoSeconds), audios: formatDiagnosticDuration(chapter.audioSeconds), count: number(chapter.interactionElements), interactions: formatDiagnosticDuration(chapter.interactionSeconds) }),
      t("lessonDuration.report.chapterEstimate", { duration: formatDiagnosticDuration(chapter.totalSeconds * PEDAGOGICAL_COEFFICIENT) })
    );
  });

  lines.push("", t("lessonDuration.report.interactionsHeading"), "");
  if (!breakdown.interactions.length) {
    lines.push(t("lessonDuration.report.noInteractions"));
  } else {
    breakdown.interactions.forEach((item) => {
      lines.push(
        t("lessonDuration.report.interactionDetail", { chapter: item.chapterTitle, activity: item.activityTitle, count: number(item.elementCount), kind: t(`lessonDuration.interactionKind.${item.kind}`), seconds: item.secondsPerElement, duration: formatDiagnosticDuration(item.seconds), coefficient: coefficientLabel })
      );
    });
  }

  lines.push("", t("lessonDuration.report.mediaHeading"), "");
  if (!breakdown.media.length) {
    lines.push(t("lessonDuration.report.noMedia"));
  } else {
    breakdown.media.forEach((item) => {
      lines.push(
        t("lessonDuration.report.mediaDetail", { kind: t(item.kind === "audio" ? "lessonDuration.report.mediaAudio" : "lessonDuration.report.mediaVideo"), chapter: item.chapterTitle, activity: item.activityTitle, file: mediaDisplayName(item.ref), duration: item.seconds == null ? t("lessonDuration.report.mediaUnavailable") : formatDiagnosticDuration(item.seconds) })
      );
    });
  }

  lines.push(
    "",
    t("lessonDuration.report.limitsHeading"),
    "",
    t("lessonDuration.report.limitBase"),
    t("lessonDuration.report.limitAverage"),
    t("lessonDuration.report.limitExpert"),
    t("lessonDuration.report.limitCoefficient", { coefficient: coefficientLabel }),
    t("lessonDuration.report.limitNotMeasure"),
    t("lessonDuration.report.limitVariation"),
  );

  if (breakdown.customHtmlActivityCount > 0) {
    const count = breakdown.customHtmlActivityCount;
    lines.push(
      "",
      t("lessonDuration.report.htmlHeading"),
      "",
      t(count > 1 ? "lessonDuration.report.htmlMany" : "lessonDuration.report.htmlOne", { count: number(count) })
    );
  }

  lines.push(
    "",
    t("lessonDuration.report.referencesHeading"),
    "",
    "- Brysbaert, M. (2019). How many words do we read per minute? A review and meta-analysis of reading rate. Journal of Memory and Language, 109, 104047. DOI : 10.1016/j.jml.2019.104047.",
    t("lessonDuration.report.riceReference"),
    "- Carver, R. P. (1982). Optimal Rate of Reading Prose. Reading Research Quarterly, 18(1), 56–88.",
    "- Carver, R. P. (1992). Reading Rate: Theory, Research, and Practical Implications. Journal of Reading, 36(2), 84–95.",
    "- Carroll, J. B. (1963). A Model of School Learning. Teachers College Record, 64(8). DOI : 10.1177/016146816306400801.",
    "- Lee, Y. (2018). Effect of uninterrupted time-on-task on students’ success in Massive Open Online Courses (MOOCs). Computers in Human Behavior, 86, 174–180. DOI : 10.1016/j.chb.2018.04.043.",
    "- Kovanović, V. et al. (2015/2016). Does Time-on-task Estimation Matter? Journal of Learning Analytics, 2(3), 81–110. DOI : 10.18608/jla.2015.23.6.",
    "- Godwin, K. E. et al. (2021). The elusive relationship between time on-task and learning. Educational Psychology, 41(4), 502–519. DOI : 10.1080/01443410.2021.1894324.",
    ""
  );
  return lines.join("\r\n");
}

export function formatEstimatedDuration(seconds: number): string {
  const minutes = Math.max(0, seconds) / 60;
  if (minutes < 1) return "< 1 min";
  return `≈ ${Math.max(1, Math.ceil(minutes / 5) * 5)} min`;
}
