import { activityLabel } from "../../app/activityLabels";
import type { ActivityItem, PaideiaBlock, PaideiaProject } from "../../types/project";
import { pdfActivityMatrixEntry } from "./activityPdfMatrix";
import { extractHtmlMetaDescription } from "./htmlMetadata";
import { blockImageAltStatuses } from "../../lib/imageAccessibility";
import type {
  LessonPdfActivity,
  LessonPdfActivitySection,
  LessonPdfAsset,
  LessonPdfDocumentModel,
  LessonPdfExpandedItem,
  LessonPdfVisualSection
} from "./lessonPdfModel";
import { formatSectionMarker, normalizeSectionMarkerScheme } from "../../components/activities/SectionMarkerActivity";
import { translate, type AppLanguage } from "../../i18n";
import { lessonPdfLabels, type LessonPdfLabels } from "./pdfLocalization";
import { resolveBlockCourseAppearance, resolvedPdfTextColor } from "../../app/courseAppearanceConfig";
import { pdfContentAssetRefs } from "./pdfContentAssetRefs";
import { normalizeCompleteData } from "../../components/activities/CompleteActivity";
import { cardSortCategoryLabelText } from "../../components/activities/CardSortActivity/cardSortDefaults";
import { estimateLessonDuration, type MediaDurationResolver } from "../../app/lessonDuration";
import { courseExitLayoutHasText } from "../../components/activities/LessonNavigationActivity";

export type BuildLessonPdfModelOptions = {
  profile?: "review" | "learner";
  subtitleHtmlByBlockId?: Readonly<Record<string, string>>;
  htmlEntryContentByBlockId?: Readonly<Record<string, string>>;
  language?: AppLanguage;
  mediaDurationByRef?: Readonly<Record<string, number>>;
};

const LEARNER_OMITTED_TYPES = new Set([
  "quiz", "mcq", "question-multiple", "question-unique", "question-true-false", "question-random",
  "complete", "card-sort", "matching", "situational-dialogue", "find-elements",
  "html-custom", "html-fallback", "continue", "course-exit", "result-message"
]);

const RASTER_IMAGE_EXTENSION = /\.(?:gif|jpe?g|png|webp)$/i;
const VIDEO_EXTENSION = /\.(?:m4v|mov|mp4|webm)$/i;
const AUDIO_EXTENSION = /\.(?:aac|flac|m4a|mp3|ogg|wav)$/i;

function normalizedExtensionRef(ref: string): string {
  return ref.trim().replace(/[?#].*$/, "");
}

function isRasterImageRef(ref: string): boolean {
  return RASTER_IMAGE_EXTENSION.test(normalizedExtensionRef(ref));
}

function isVideoRef(ref: string): boolean {
  return VIDEO_EXTENSION.test(normalizedExtensionRef(ref));
}

function isAudioRef(ref: string): boolean {
  return AUDIO_EXTENSION.test(normalizedExtensionRef(ref));
}

function uniqueRefs(refs: Array<string | null | undefined>): string[] {
  return [...new Set(refs.map((ref) => ref?.trim() ?? "").filter(Boolean))];
}

function assetsFromRefs(
  refs: Array<string | null | undefined>,
  role: LessonPdfAsset["role"],
  block?: PaideiaBlock
): LessonPdfAsset[] {
  return uniqueRefs(refs).map((ref) => ({
    ref,
    role,
    crop: block?.imageCrop,
    rounded: block?.imageRounded ?? undefined
  }));
}

function richText(
  html: string | null | undefined,
  label?: string,
  inlineAssetRefs: string[] = []
): LessonPdfActivitySection[] {
  const normalized = html?.trim();
  return normalized ? [{
    kind: "rich-text",
    html: normalized,
    label,
    inlineAssets: assetsFromRefs(inlineAssetRefs.filter(isRasterImageRef), "image")
  }] : [];
}

function isAuthoringPlaceholderHtml(html: string | null | undefined): boolean {
  const plainText = (html ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.…]+$/u, "")
    .trim();
  return !plainText || plainText === "Nouveau contenu" || plainText === "Saisissez votre texte ici";
}

function richContentOrSummary(block: PaideiaBlock): LessonPdfActivitySection[] {
  return richText(
    block.contentHtml,
    undefined,
    block.richInlineAssetRefs
  );
}

function rasterRefs(block: PaideiaBlock): string[] {
  return uniqueRefs(pdfContentAssetRefs(block)).filter(isRasterImageRef);
}

function visualSection(
  block: PaideiaBlock,
  role: LessonPdfAsset["role"] = "image",
  refs: string[] = rasterRefs(block)
): LessonPdfVisualSection | null {
  const assets = assetsFromRefs(refs.filter(isRasterImageRef), role, block);
  return assets.length
    ? {
        kind: "visual",
        assets,
        layout: block.mediaLayout,
        width: block.imageSize,
        align: block.contentAlign,
        captionHtml: null
      }
    : null;
}

function visualOrFallback(block: PaideiaBlock, label: string): LessonPdfActivitySection[] {
  const visual = visualSection(block);
  if (visual) {
    return [visual];
  }
  return [{
    kind: "fallback",
    activityLabel: label,
    reason: pdfContentAssetRefs(block).length > 0 ? "unsupported-content" : "missing-content"
  }];
}

function itemAssets(item: ActivityItem, role: LessonPdfAsset["role"] = "image"): LessonPdfAsset[] {
  const refs = uniqueRefs(item.assetRefs ?? []);
  const selected = role === "audio" ? refs.filter(isAudioRef) : refs.filter(isRasterImageRef);
  return selected.map((ref) => ({
    ref,
    role,
    crop: item.imageCrop,
    rounded: item.imageRounded ?? undefined
  }));
}

function flipCardItemAssets(item: ActivityItem): LessonPdfAsset[] {
  const assets: LessonPdfAsset[] = [];
  if (item.frontImageAssetRef) {
    assets.push({ ref: item.frontImageAssetRef, role: "image", face: "front", crop: item.frontImageCrop });
  }
  if (item.backImageAssetRef) {
    assets.push({ ref: item.backImageAssetRef, role: "image", face: "back", crop: item.backImageCrop });
  }
  return assets;
}

function expandedItems(block: PaideiaBlock, labels: LessonPdfLabels): LessonPdfExpandedItem[] {
  const cardSortCategories = new Map((block.cardSort?.categories ?? []).map((category) => [category.id, {
    borderColor: category.borderColor,
    label: cardSortCategoryLabelText(category.labelHtml) || category.label
  }]));
  const sourceItems = block.type === "card-sort"
    ? [...(block.activityItems ?? [])].sort((left, right) => {
        const categoryIds = block.cardSort?.categories.map((category) => category.id) ?? [];
        const leftCategory = categoryIds.indexOf(left.correctCategoryId ?? "");
        const rightCategory = categoryIds.indexOf(right.correctCategoryId ?? "");
        return (leftCategory < 0 ? Number.MAX_SAFE_INTEGER : leftCategory) - (rightCategory < 0 ? Number.MAX_SAFE_INTEGER : rightCategory);
      })
    : block.activityItems ?? [];
  return sourceItems.map((item, index) => ({
    id: item.id,
    order: index + 1,
    title: block.type === "card-sort"
      ? `${cardSortCategories.get(item.correctCategoryId ?? "")?.label ?? "—"} — ${item.title?.trim() || `${labels.item} ${index + 1}`}`
      : item.title?.trim() || item.contentTitle?.trim() || `${labels.item} ${index + 1}`,
    contentHtml: item.contentHtml?.trim() ?? "",
    secondaryHtml: block.type === "flip-cards"
      ? [item.frontText, item.backTitle].filter(Boolean).join(" — ") || null
      : null,
    frontText: block.type === "flip-cards" ? item.frontText?.trim() || null : null,
    frontType: block.type === "flip-cards" ? item.frontType ?? "text" : undefined,
    backType: block.type === "flip-cards" ? item.backType ?? "text" : undefined,
    backTitle: block.type === "flip-cards" ? item.backTitle?.trim() || null : null,
    dateLabel: item.dateLabel,
    accentColor: block.type === "card-sort"
      ? cardSortCategories.get(item.correctCategoryId ?? "")?.borderColor
      : item.accentColor,
    transcriptHtml: block.type === "audio" && item.transcriptStatus === "validated"
      ? item.transcriptHtml?.trim() || null
      : null,
    assets: block.type === "flip-cards"
      ? flipCardItemAssets(item)
      : block.type === "card-sort" && item.frontImageAssetRef
        ? [{ ref: item.frontImageAssetRef, role: "image", crop: item.frontImageCrop, rounded: block.cardSort?.cardAppearance.rounded }]
      : itemAssets(item, block.type === "audio" ? "audio" : "image")
  }));
}

function structuredSections(block: PaideiaBlock, labels: LessonPdfLabels): LessonPdfActivitySection[] {
  const presentation = block.type as "accordion" | "flip-cards" | "slides" | "timeline" | "tabs" | "audio" | "image-grid" | "card-sort";
  const sections: LessonPdfActivitySection[] = block.type === "audio"
    ? richContentOrSummary(block)
    : [];
  sections.push({ kind: "expanded-items", presentation, items: expandedItems(block, labels) });
  return sections;
}

function quizUsesAutomaticTitle(block: PaideiaBlock): boolean {
  const quiz = block.quiz;
  if (!quiz || quiz.titleMode === "auto") return true;
  if (quiz.titleMode === "custom") return false;
  const title = (quiz.titleHtml ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  return !title || /^quiz(?:\s+\d+)?$/i.test(title);
}

function quizSections(block: PaideiaBlock, hasAssistant: boolean, labels: LessonPdfLabels, language: AppLanguage, automaticTitle: string): LessonPdfActivitySection[] {
  const quiz = block.quiz;
  if (!quiz) {
    return [{ kind: "fallback", activityLabel: activityLabel(block.type, language), reason: "missing-content" }];
  }
  const tr = (key: string, fallback: string) => translate(language, key, undefined, fallback);
  const yes = tr("common.yes", "Oui");
  const no = tr("common.no", "Non");
  const bool = (value: boolean) => value ? yes : no;
  const settings = quiz.settings;
  const reviewMode = settings.reviewMode === "after-pass"
    ? tr("quiz.afterPass", "Après réussite")
    : settings.reviewMode === "after-attempts"
      ? `${tr("quiz.afterAttempts", "Après X essais")} (${settings.reviewAfterAttempts})`
      : tr("common.none", "Aucun");
  return [{
    kind: "quiz",
    titleHtml: quizUsesAutomaticTitle(block)
      ? `<p>${automaticTitle}</p>`
      : quiz.titleHtml?.trim() || `<p>${automaticTitle}</p>`,
    introHtml: quiz.introHtml?.trim() ?? "",
    settingsLabel: tr("quiz.settingsAria", "Paramètres du quiz"),
    settings: [
      { label: tr("quiz.shuffleAnswers", "Mélanger les réponses"), value: bool(settings.shuffleAnswers) },
      { label: tr("quiz.shuffleQuestions", "Mélanger les questions"), value: bool(settings.shuffleQuestions) },
      { label: tr("quiz.limitPresentedQuestions", "Limiter les questions présentées"), value: settings.limitQuestions ? `${yes} (${settings.questionLimit})` : no },
      { label: tr("quiz.showFeedback", "Afficher les feedbacks"), value: bool(settings.showFeedback) },
      { label: tr("quiz.showCorrectAnswer", "Afficher la bonne réponse"), value: bool(settings.showCorrectAnswer) },
      { label: tr("quiz.maxAttempts", "Nombre de tentatives autorisées"), value: settings.maxAttempts === 0 ? tr("quiz.unlimitedAttempts", "Tentatives illimitées") : String(Math.max(1, settings.maxAttempts)) },
      { label: tr("quiz.passingScore", "Score de réussite (%)"), value: `${settings.passingScore} %` },
      { label: tr("quiz.review", "Relecture"), value: reviewMode },
      { label: tr("quiz.sendScoreToLms", "Envoyer le score au LMS"), value: bool(settings.sendScoreToLms) },
      {
        label: tr("quiz.gateUntilPassed", "Bloquer la suite jusqu’à réussite"),
        value: settings.maxAttempts === 0
          ? bool(settings.gateChapterUntilPassed)
          : tr("quiz.gateFiniteAttemptsHint", "Avec une limite, la suite reste bloquée jusqu’à la réussite ou l’épuisement des tentatives.")
      }
    ],
    questions: quiz.questions.map((question, index) => ({
      id: question.id,
      order: index + 1,
      mode: question.mode,
      questionHtml: question.questionHtml,
      answers: question.answers.map((answer) => ({
        id: answer.id,
        textHtml: answer.textHtml,
        correct: answer.correct,
        creditPercent: answer.creditPercent,
        feedbackHtml: answer.feedbackHtml
      })),
      creditMode: question.creditMode,
      answerFeedbackLabel: tr("cardSort.feedbackTitle", "Feedback"),
      creditLabel: tr("quiz.creditPercent", "Crédit de cette réponse (%)"),
      generalFeedbackHtml: question.generalFeedbackHtml,
      feedbackCorrectHtml: question.feedbackCorrectHtml,
      feedbackIncorrectHtml: question.feedbackIncorrectHtml,
      points: question.points
    })),
    assistantNotice: hasAssistant ? labels.quizAssistantNotice : undefined
  }];
}

function SituationalDialogueSections(block: PaideiaBlock, labels: LessonPdfLabels): LessonPdfActivitySection[] {
  const characters = block.situationalDialogueCharacters ?? [];
  const defaultCharacter = characters[0];
  const usesSubstitutedRiseCharacter = block.sourceFormat === "rise-scorm" && Boolean(defaultCharacter);
  const introductionPose = defaultCharacter?.poses.find((pose) =>
    pose.usage === "introduction" || pose.state === "introduction"
  ) ?? defaultCharacter?.poses.find((pose) => pose.id === defaultCharacter.defaultPoseId);
  return [{
    kind: "situational-dialogue",
    nodes: (block.activityItems ?? []).map((item, index) => ({
      id: item.id,
      order: index + 1,
      title: item.title?.trim() || `${labels.step} ${index + 1}`,
      contentHtml: item.contentHtml?.trim() ?? "",
      characterName: usesSubstitutedRiseCharacter ? defaultCharacter?.name : item.characterName,
      characterRole: usesSubstitutedRiseCharacter ? defaultCharacter?.role : item.characterRole,
      responses: (item.responses ?? []).map((response) => ({
        id: response.id,
        labelHtml: response.label,
        feedbackHtml: response.feedbackHtml,
        action: response.action
      })),
      assets: [
        ...(index === 0 && introductionPose?.assetRef && isRasterImageRef(introductionPose.assetRef)
          ? [{ ref: introductionPose.assetRef, role: "image" as const }]
          : [])
      ]
    }))
  }];
}

function attachmentSections(block: PaideiaBlock, language: AppLanguage): LessonPdfActivitySection[] {
  const sections = richText(block.contentHtml, undefined, block.richInlineAssetRefs);
  const files = (block.attachmentFiles ?? []).map((file) => ({
    id: file.id,
    displayName: file.displayName,
    extension: file.extension,
    asset: {
      ref: file.assetRef,
      role: "attachment" as const,
      displayName: file.displayName
    }
  }));
  if (files.length) {
    sections.push({ kind: "attachments", files });
  } else {
    sections.push({ kind: "fallback", activityLabel: activityLabel(block.type, language), reason: "missing-content" });
  }
  return sections;
}

function linksResourcesSections(block: PaideiaBlock): LessonPdfActivitySection[] {
  const plainText = (value: string) => value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  const descriptions = (block.activityItems ?? [])
    .map((item) => plainText(item.contentHtml ?? ""))
    .filter(Boolean)
    .join(" ");
  const intro = plainText(block.contentHtml ?? "") === descriptions ? "" : block.contentHtml;
  const sections = richText(intro, undefined, block.richInlineAssetRefs);
  const escapeHtml = (value: string) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  for (const item of block.activityItems ?? []) {
    const url = item.resourceValid !== false && /^(https?:\/\/|mailto:)/i.test(item.resourceUrl?.trim() ?? "")
      ? item.resourceUrl!.trim()
      : "";
    const description = item.contentHtml?.trim() || "";
    const title = escapeHtml(item.title);
    const link = url ? `<p><a href="${escapeHtml(url)}">${title}</a></p>` : `<p><strong>${title}</strong></p>`;
    sections.push({ kind: "rich-text", html: `${link}${description}` });
  }
  if (block.summary?.trim()) {
    sections.push({ kind: "rich-text", html: `<p>${escapeHtml(block.summary)}</p>` });
  }
  return sections;
}

function mediaSections(block: PaideiaBlock, language: AppLanguage): LessonPdfActivitySection[] {
  const refs = uniqueRefs(pdfContentAssetRefs(block));
  const posterAssets = assetsFromRefs(refs.filter(isRasterImageRef), "poster", block);
  const videoAssets = assetsFromRefs(refs.filter(isVideoRef), "video", block);
  const sections: LessonPdfActivitySection[] = [];
  if (posterAssets.length || videoAssets.length) {
    sections.push({
      kind: "visual",
      assets: [...posterAssets, ...videoAssets],
      layout: block.mediaLayout,
      width: block.imageSize,
      align: block.contentAlign,
      captionHtml: block.contentHtml
    });
  } else {
    sections.push({ kind: "fallback", activityLabel: activityLabel(block.type, language), reason: "missing-content" });
  }
  sections.push(...richContentOrSummary(block));
  return sections;
}

function interactiveSections(
  block: PaideiaBlock,
  mediaDurationByRef?: Readonly<Record<string, number>>
): LessonPdfActivitySection[] {
  const posterRef = rasterRefs(block)[0];
  if (block.type === "find-elements") {
    const data = block.findElements;
    return [{
      kind: "interactive-visual",
      presentation: "find-elements",
      poster: posterRef ? assetsFromRefs([posterRef], "poster", block)[0] : null,
      points: (data?.zones ?? []).map((zone, index) => ({
        id: zone.id,
        order: index + 1,
        label: zone.title,
        title: zone.title,
        contentHtml: `${zone.descriptionHtml || ""}${zone.riskHtml ? `<p><strong>${data?.labels.risk || "Risque"}</strong></p>${zone.riskHtml}` : ""}${zone.correctionHtml ? `<p><strong>${data?.labels.correction || "Correction"}</strong></p>${zone.correctionHtml}` : ""}`,
        ...(zone.shape === "rectangle"
          ? { x: (zone.x ?? 0) + (zone.width ?? 0) / 2, y: (zone.y ?? 0) + (zone.height ?? 0) / 2 }
          : (() => {
              const points = zone.points ?? [];
              const total = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
              return points.length ? { x: total.x / points.length, y: total.y / points.length } : {};
            })())
      }))
    }];
  }
  if (block.type === "image-360") {
    return [{
      kind: "interactive-visual",
      presentation: "image-360",
      poster: posterRef ? assetsFromRefs([posterRef], "poster", block)[0] : null,
      points: [...(block.image360Hotspots ?? [])]
        .sort((left, right) => left.order - right.order)
        .map((point) => ({
          id: point.id,
          order: point.order,
          label: point.title,
          title: point.title,
          contentHtml: point.contentHtml,
          yaw: point.yaw,
          pitch: point.pitch
        }))
    }];
  }
  return [{
    kind: "interactive-visual",
    presentation: "point-of-interest",
    poster: posterRef ? assetsFromRefs([posterRef], "poster", block)[0] : null,
    points: [...(block.pointOfInterestMarkers ?? [])]
      .sort((left, right) => left.order - right.order)
      .map((point) => ({
        id: point.id,
        order: point.order,
        label: point.label,
        title: point.title,
        contentHtml: point.contentHtml,
        media: point.media ? {
          type: point.media.type,
          fileName: point.media.fileName,
          durationSeconds: point.media.type === "image"
            ? null
            : mediaDurationByRef?.[point.media.optimizedAssetRef || point.media.assetRef] ?? null,
          transcriptHtml: point.media.type === "audio" && point.media.transcriptStatus === "validated"
            ? point.media.transcriptHtml?.trim() || null
            : null
        } : null,
        x: point.x,
        y: point.y
      }))
  }];
}

function htmlCustomSections(
  block: PaideiaBlock,
  options: BuildLessonPdfModelOptions
): LessonPdfActivitySection[] {
  const source = options.htmlEntryContentByBlockId?.[block.id] ?? block.sourceRawHtml ?? block.contentHtml;
  const description = extractHtmlMetaDescription(source);
  const sections: LessonPdfActivitySection[] = [];
  const visual = visualSection(block, "poster");
  if (visual) {
    sections.push(visual);
  }
  sections.push({
    kind: "html-description",
    description,
    packageName: block.htmlPackageName
  });
  return sections;
}

function buildActivitySections(
  block: PaideiaBlock,
  hasAssistant: boolean,
  options: BuildLessonPdfModelOptions,
  sectionMarkerLabel: string | undefined,
  labels: LessonPdfLabels,
  language: AppLanguage,
  quizAutomaticTitle: string
): LessonPdfActivitySection[] {
  if (block.type === "complete") {
    const complete = normalizeCompleteData(block.complete, block.contentHtml ?? "<p></p>");
    const coverVisual = complete.cover.enabled ? visualSection(block) : null;
    const coverSections: LessonPdfActivitySection[] = complete.cover.enabled ? [
      ...richText(complete.cover.titleHtml, block.title || activityLabel(block.type, language)),
      ...richText(complete.cover.descriptionHtml),
      ...(coverVisual ? [coverVisual] : [])
    ] : [];
    const endingSections: LessonPdfActivitySection[] = [
      ...richText(
        complete.ending.successHtml,
        translate(language, "resultMessage.successBranch", undefined, "Après réussite")
      ),
      ...richText(
        complete.ending.failureHtml,
        translate(language, "resultMessage.failureBranch", undefined, "Après échec final")
      )
    ];
    return [...coverSections, ...complete.exercises.map((exercise) => {
      const answers = new Map(exercise.blanks.map((blank) => [blank.id, blank.answer]));
      const html = exercise.contentHtml.replace(/<span[^>]*data-paideia-complete-id=["']([^"']+)["'][^>]*>[\s\S]*?<\/span>/gi, (_marker, id: string) => `<strong>${answers.get(id) || labels.answer}</strong>`);
      return { kind: "rich-text" as const, html, label: activityLabel(block.type, language) };
    }), ...endingSections];
  }
  switch (block.type) {
    case "image":
      return visualOrFallback(block, activityLabel(block.type, language));
    case "image-text":
      return [...visualOrFallback(block, activityLabel(block.type, language)), ...richContentOrSummary(block)];
    case "point-of-interest":
      return [
        ...interactiveSections(block, options.mediaDurationByRef),
        ...richText(
          isAuthoringPlaceholderHtml(block.contentHtml) ? "" : block.contentHtml,
          undefined,
          block.richInlineAssetRefs
        )
      ];
    case "image-360":
    case "find-elements":
      return [...interactiveSections(block, options.mediaDurationByRef), ...richText(block.contentHtml, undefined, block.richInlineAssetRefs)];
    case "accordion":
    case "flip-cards":
    case "slides":
    case "timeline":
    case "tabs":
    case "audio":
    case "image-grid":
    case "card-sort":
      return structuredSections(block, labels);
    case "matching":
      return block.matching ? [{
        kind: "matching",
        pairs: block.matching.pairs.map((pair, index) => ({
          id: pair.id,
          order: index + 1,
          leftHtml: pair.leftHtml,
          rightHtml: pair.rightHtml
        })),
        successFeedbackHtml: block.matching.successFeedbackHtml,
        failureFeedbackHtml: block.matching.failureFeedbackHtml
      }] : [{ kind: "fallback", activityLabel: activityLabel(block.type, language), reason: "missing-content" }];
    case "quiz":
    case "mcq":
      return quizSections(block, hasAssistant, labels, language, quizAutomaticTitle);
    case "question-multiple":
    case "question-unique":
    case "question-true-false": {
      const question = block.quiz?.questions[0];
      if (!question) return [{ kind: "fallback", activityLabel: activityLabel(block.type, language), reason: "missing-content" }];
      return [{
        kind: "standalone-question",
        question: { ...question, order: 1, answers: question.answers.map((answer) => ({ ...answer })), answerFeedbackLabel: translate(language, "cardSort.feedbackTitle", undefined, "Feedback"), creditLabel: translate(language, "quiz.creditPercent", undefined, "Crédit de cette réponse (%)") },
        showCorrectAnswer: Boolean(block.quiz?.settings.showCorrectAnswer),
        showFeedback: Boolean(block.quiz?.settings.showFeedback)
      }];
    }
    case "question-random":
      return (block.quiz?.questions ?? []).map((question, index) => ({
        kind: "standalone-question" as const,
        question: { ...question, order: index + 1, answers: question.answers.map((answer) => ({ ...answer })), answerFeedbackLabel: translate(language, "cardSort.feedbackTitle", undefined, "Feedback"), creditLabel: translate(language, "quiz.creditPercent", undefined, "Crédit de cette réponse (%)") },
        showCorrectAnswer: Boolean(block.quiz?.settings.showCorrectAnswer),
        showFeedback: Boolean(block.quiz?.settings.showFeedback)
      }));
    case "result-message":
      return (block.activityItems ?? [])
        .filter((item) => item.kind === "result-success" || item.kind === "result-failure")
        .filter((item) => Boolean(item.contentHtml?.trim()))
        .map((item) => ({
          kind: "rich-text" as const,
          html: item.contentHtml,
          label: item.kind === "result-success"
            ? translate(language, "resultMessage.successBranch", undefined, "Après réussite")
            : translate(language, "resultMessage.failureBranch", undefined, "Après échec final")
        }));
    case "situational-dialogue":
      return SituationalDialogueSections(block, labels);
    case "attachment":
      return attachmentSections(block, language);
    case "links-resources":
      return linksResourcesSections(block);
    case "media":
      return mediaSections(block, language);
    case "html-custom":
    case "html-fallback":
      return htmlCustomSections(block, options);
    case "continue":
      return [{ kind: "progress-marker", label: block.summary?.trim() || activityLabel(block.type, language) }];
    case "course-exit":
      return [
        ...(courseExitLayoutHasText(block.mediaLayout)
          ? richText(block.contentHtml, undefined, block.richInlineAssetRefs)
          : []),
        { kind: "progress-marker", label: block.summary?.trim() || activityLabel(block.type, language) }
      ];
    case "divider":
      return [{ kind: "divider" }];
    case "section-marker":
      return [{ kind: "section-marker", label: sectionMarkerLabel ?? "1", scheme: normalizeSectionMarkerScheme(block.markerScheme) }];
    case "header": {
      const visual = visualSection(block, "background");
      return [...(visual ? [visual] : []), ...richContentOrSummary(block)];
    }
    case "quote": {
      const visual = visualSection(block, "image", pdfContentAssetRefs(block));
      return [
        ...(visual ? [visual] : []),
        ...richText(block.contentHtml, undefined, block.richInlineAssetRefs),
        ...richText(block.quoteShowAuthor === false ? null : block.quoteAuthorHtml, labels.author)
      ];
    }
    case "rich-text":
    case "list":
    case "note":
      return richContentOrSummary(block);
    default:
      return [
        ...richText(block.contentHtml, undefined, block.richInlineAssetRefs),
        { kind: "fallback", activityLabel: activityLabel(block.type, language), reason: "unsupported-content" }
      ];
  }
}

function buildActivity(
  block: PaideiaBlock,
  number: number,
  hasAssistant: boolean,
  options: BuildLessonPdfModelOptions,
  sectionMarkerLabel: string | undefined,
  labels: LessonPdfLabels,
  language: AppLanguage,
  quizAutomaticTitle: string
): LessonPdfActivity {
  const label = activityLabel(block.type, language);
  return {
    id: block.id,
    number,
    heading: `${labels.activity} ${number} — ${label} — ID ${block.id}`,
    label,
    sourceType: block.type,
    renderMode: pdfActivityMatrixEntry(block.type).mode,
    title: block.title?.trim() ?? "",
    summary: block.summary?.trim() ?? "",
    imageAltStatuses: blockImageAltStatuses(block),
    style: {
      panelBackgroundColor: block.panelBackgroundColor,
      panelBorderColor: block.panelBorderColor,
      panelBorderWidth: block.panelBorderWidth,
      panelBorderStyle: block.panelBorderStyle,
      panelPadding: block.panelPadding,
      panelRounded: block.panelRounded,
      panelShadow: block.panelShadow,
      noteIcon: block.noteIcon,
      noteShowIcon: block.noteShowIcon,
      noteIconColor: block.noteIconColor,
      noteIconMatchesBorder: block.noteIconMatchesBorder,
      flipCardFrontBackgroundColor: block.flipCardFrontBackgroundColor,
      flipCardBackBackgroundColor: block.flipCardBackBackgroundColor,
      flipCardFrontBorderColor: block.flipCardFrontBorderColor,
      flipCardBackBorderColor: block.flipCardBackBorderColor,
      // Activity backgrounds are intentionally excluded from the PDF rendering.
      sectionBackgroundColor: null,
      sectionBackgroundImageRef: null,
      buttonBackgroundColor: block.buttonBackgroundColor,
      buttonTextColor: block.buttonTextColor,
      headerBackgroundColor: block.headerBackgroundColor,
      headerTextColor: block.headerTextColor,
      headerHeight: block.headerHeight,
      headerImagePositionY: block.headerImagePositionY,
      dividerColor: block.dividerColor,
      dividerWidth: block.dividerWidth,
      dividerStyle: block.dividerStyle,
      markerType: block.markerType,
      markerTextColor: block.markerTextColor
    },
    sections: buildActivitySections(block, hasAssistant, options, sectionMarkerLabel, labels, language, quizAutomaticTitle)
  };
}

export function buildLessonPdfModel(
  project: PaideiaProject,
  options: BuildLessonPdfModelOptions = {}
): LessonPdfDocumentModel {
  const language = options.language ?? "fr";
  const labels: LessonPdfLabels = {
    ...lessonPdfLabels(language),
    transcript: translate(language, "transcript.title", undefined, "Transcription")
  };
  const learner = options.profile === "learner";
  const assistants = learner ? [] : (project.glossaryAssistants ?? []).filter((assistant) => assistant.assistantEnabled);
  let quizIndex = 0;
  const chapters = project.course.modules.flatMap((module) => module.chapters).map((chapter, chapterIndex) => {
    const blocks = chapter.pages.flatMap((page) => page.blocks).filter((block) => !learner || !LEARNER_OMITTED_TYPES.has(block.type));
    const markerCounts = { arabic: 0, roman: 0, alpha: 0 };
    const title = chapter.title?.trim() || `${labels.chapter} ${chapterIndex + 1}`;
    return {
      id: chapter.id,
      order: chapterIndex + 1,
      title,
      activities: blocks.flatMap((sourceBlock, blockIndex) => {
        const block = resolveBlockCourseAppearance(sourceBlock, project.courseAppearance);
        if (learner && (block.type === "audio" || block.type === "video" || (block.type === "media" && (block.variant === "video" || (block.assetRefs ?? []).some((ref) => isVideoRef(ref)))))) {
          const transcripts = block.type === "audio"
            ? (block.activityItems ?? []).filter((item) => item.transcriptStatus === "validated" && item.transcriptHtml?.trim()).map((item) => item.transcriptHtml!.trim())
            : [options.subtitleHtmlByBlockId?.[block.id]?.trim()].filter((html): html is string => Boolean(html));
          if (!transcripts.length) return [];
          const label = translate(language, block.type === "audio" ? "transcript.kicker" : "transcript.videoTitle");
          return [{
            id: block.id, number: blockIndex + 1, heading: "", label, sourceType: "learner-transcript",
            renderMode: "course-layout" as const, title: label, summary: "", imageAltStatuses: [], style: {},
            sections: transcripts.map((html) => ({ kind: "rich-text" as const, html }))
          }];
        }
        let markerLabel: string | undefined;
        if (block.type === "section-marker") {
          const scheme = normalizeSectionMarkerScheme(block.markerScheme);
          markerCounts[scheme] += 1;
          markerLabel = formatSectionMarker(markerCounts[scheme], scheme);
        }
        if (block.type === "quiz" || block.type === "mcq") {
          quizIndex += 1;
        }
        const quizAutomaticTitle = `${translate(language, "activity.quiz", undefined, "Quiz")} ${Math.max(1, quizIndex)}`;
        const activity = buildActivity(block, blockIndex + 1, assistants.length > 0, options, markerLabel, labels, language, quizAutomaticTitle);
        return [learner ? { ...activity, heading: "", imageAltStatuses: [] } : activity];
      })
    };
  });

  return {
    profile: learner ? "learner" : "review",
    generatedAt: new Date().toISOString(),
    labels,
    contentTextColor: resolvedPdfTextColor(project.courseAppearance),
    lessonId: project.id,
    lessonTitle: project.title?.trim() || project.course.title?.trim() || labels.lessonFallback,
    estimatedDurationSeconds: estimateLessonDuration(project, (ref) => options.mediaDurationByRef?.[ref]),
    coverImage: project.courseImageRef?.trim() && isRasterImageRef(project.courseImageRef)
      ? { ref: project.courseImageRef.trim(), role: "image" }
      : null,
    chapterMenu: chapters.map(({ id, order, title }) => ({ id, order, title })),
    chapters,
    assistantAppendices: assistants.map((assistant) => ({
      id: assistant.id,
      name: assistant.name?.trim() || labels.assistant,
      avatar: assistant.avatarRef?.trim()
        ? { ref: assistant.avatarRef.trim(), role: "avatar" }
        : null,
      entries: assistant.entries.map((entry) => ({
        id: entry.id,
        term: entry.term,
        aliases: [...entry.aliases],
        contentHtml: entry.contentHtml,
        related: [...entry.related]
      }))
    }))
  };
}
