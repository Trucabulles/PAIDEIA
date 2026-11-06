import assert from "node:assert/strict";
import { ACTIVITY_LIBRARY_SECTIONS } from "../src/app/libraryConfig";
import { resolveBlockCourseAppearance, resolvedCourseTextColor } from "../src/app/courseAppearanceConfig";
import { PDF_ACTIVITY_MATRIX } from "../src/export/pdf/activityPdfMatrix";
import { buildLessonPdfModel } from "../src/export/pdf/buildLessonPdfModel";
import { decodeHtmlEntities, extractHtmlMetaDescription } from "../src/export/pdf/htmlMetadata";
import { resolveContextualTextColor } from "../src/app/textContrast";
import { lessonPdfFileName } from "../src/export/pdf/pdfExportNaming";
import { renderLessonPdfDocument } from "../src/export/pdf/renderLessonPdfDocument";
import { richHtmlToPdf } from "../src/export/pdf/richHtmlToPdf";
import { collectProjectPdfFileRefs } from "../src/export/pdf/exportLibraryLessonPdf";
import type { PaideiaBlock, PaideiaProject } from "../src/types/project";

function block(id: string, type: string, extra: Partial<PaideiaBlock> = {}): PaideiaBlock {
  return {
    id,
    type,
    title: "",
    summary: "",
    trackingKey: id,
    ...extra
  };
}

const project: PaideiaProject = {
  id: "lesson-1",
  slug: "lecon-test",
  title: "Leçon de contrôle",
  description: "",
  createdAt: "2026-07-16T10:00:00.000Z",
  updatedAt: "2026-07-16T10:00:00.000Z",
  createdBy: "contract",
  defaultLocale: "fr-FR",
  locales: ["fr-FR"],
  status: "draft",
  currentVersion: "1",
  rootCourseId: "course-1",
  courseImageRef: "images/cover.png",
  course: {
    id: "course-1",
    title: "Cours technique invisible",
    modules: [{
      id: "module-1",
      title: "Module technique invisible",
      chapters: [{
        id: "chapter-1",
        title: "Premier chapitre",
        pages: [
          {
            id: "page-1",
            title: "Page technique invisible",
            blocks: [
              block("text-1", "rich-text", { contentHtml: "<p>Bonjour</p>", summary: "Bonjour" }),
              block("quiz-1", "quiz", {
                quiz: {
                  titleHtml: "<p>Évaluation</p>",
                  introHtml: "<p>Introduction</p>",
                  startLeadHtml: "",
                  settings: {
                    shuffleAnswers: false,
                    shuffleQuestions: false,
                    limitQuestions: false,
                    questionLimit: 1,
                    showFeedback: true,
                    showCorrectAnswer: true,
                    allowRetry: true,
                    maxAttempts: 2,
                    passingScore: 80,
                    reviewMode: "after-pass",
                    reviewAfterAttempts: 1,
                    sendScoreToLms: false,
                    gateChapterUntilPassed: false
                  },
                  questions: [{
                    id: "question-1",
                    mode: "single",
                    questionHtml: "<p>Question ?</p>",
                    points: 1,
                    answers: [
                      { id: "answer-1", textHtml: "<p>Oui</p>", correct: true },
                      { id: "answer-2", textHtml: "<p>Non</p>", correct: false }
                    ],
                    generalFeedbackHtml: "<p>Retour général</p>",
                    feedbackCorrectHtml: "<p>Correct</p>",
                    feedbackIncorrectHtml: "<p>Incorrect</p>"
                  }]
                }
              }),
              block("html-1", "html-custom", {
                htmlPackageName: "activité-externe",
                sourceRawHtml: "<!doctype html><meta content=\"Description &amp; contexte\" name=\"description\"><script>ignored()</script>"
              }),
              block("image-svg", "image", { assetRefs: ["assets/interdit.svg"] })
            ]
          },
          {
            id: "page-2",
            title: "Deuxième page invisible",
            blocks: [
              block("tabs-1", "tabs", {
                activityItems: [
                  { id: "tab-1", title: '<span style="font-family: &quot;Segoe UI&quot;, sans-serif">Onglet 1</span>', contentHtml: "<p>Un</p>" },
                  { id: "tab-2", title: "Onglet 2", contentHtml: "<p>Deux</p>" }
                ]
              }),
              block("situational-dialogue-1", "situational-dialogue", {
                situationalDialogueCharacters: [{
                  id: "character-1",
                  name: "Personnage",
                  defaultPoseId: "pose-neutral",
                  poses: [
                    { id: "pose-intro", label: "Introduction", usage: "introduction", assetRef: "default-characters/Personnage/introduction.png" },
                    { id: "pose-neutral", label: "Neutre", usage: "neutral", assetRef: "default-characters/Personnage/neutral.png" }
                  ]
                }],
                activityItems: [
                  { id: "situational-dialogue-intro", title: "Introduction", contentHtml: "<p>Bienvenue</p>", assetRefs: ["images/rise-character.png"] },
                  { id: "situational-dialogue-sequence", title: "Séquence", contentHtml: "<p>Question</p>" }
                ]
              }),
              block("timeline-1", "timeline", {
                summary: "Repères",
                panelBorderColor: "#123a7a",
                activityItems: [{
                  id: "event-1",
                  title: "Événement",
                  dateLabel: "2026",
                  accentColor: "#e53935",
                  contentHtml: "<p>Description</p>"
                }]
              }),
              block("cards-1", "flip-cards", {
                summary: "technical-card-summary",
                sectionBackgroundColor: "#f4f6f9",
                activityItems: [{
                  id: "card-1",
                  title: "Carte",
                  frontText: "Recto",
                  contentHtml: "<p>Verso</p>"
                }]
              }),
              block("quote-1", "quote", {
                contentHtml: "<p>Citation</p>",
                assetRefs: ["images/portrait.png"],
                mediaLayout: "image-right",
                imageSize: "large",
                sectionBackgroundImageRef: "images/banner.png"
              }),
              block("media-1", "media", {
                contentHtml: "<p>Vidéo de contrôle</p>",
                // Legacy projects could keep the activity background in both
                // fields. It must never become a PDF poster.
                assetRefs: ["video/lesson.mp4", "images/video-background.jpg"],
                sectionBackgroundColor: "#101820",
                sectionBackgroundImageRef: "images/video-background.jpg"
              }),
              block("image360-1", "image-360", {
                assetRefs: ["images/panorama.jpg"],
                image360Hotspots: Array.from({ length: 4 }, (_, index) => ({
                  id: `point-${index + 1}`,
                  order: index + 1,
                  yaw: index * 20,
                  pitch: 0,
                  title: index === 0 ? '<span style="font-weight:bold">Point 1</span>' : `Point ${index + 1}`,
                  contentHtml: `<p>Détail ${index + 1}</p>`,
                  color: "#123a7a"
                }))
              }),
              block("audio-transcript-1", "audio", {
                activityItems: [
                  {
                    id: "audio-track-validated",
                    title: "Piste validée",
                    contentHtml: "",
                    assetRefs: ["audio/validated.mp3"],
                    transcriptHtml: "<p>Transcription audio validée dans le PDF.</p>",
                    transcriptLanguage: "fr",
                    transcriptSource: "manual",
                    transcriptStatus: "validated",
                    transcriptAllowDownload: false
                  },
                  {
                    id: "audio-track-draft",
                    title: "Piste brouillon",
                    contentHtml: "",
                    assetRefs: ["audio/draft.mp3"],
                    transcriptHtml: "<p>Cette transcription brouillon ne doit pas sortir.</p>",
                    transcriptLanguage: "fr",
                    transcriptSource: "whisper",
                    transcriptStatus: "draft",
                    transcriptAllowDownload: false
                  }
                ]
              }),
              block("poi-transcript-1", "point-of-interest", {
                assetRefs: ["images/poi.jpg"],
                pointOfInterestMarkers: [{
                  id: "poi-audio-1",
                  order: 1,
                  x: 50,
                  y: 50,
                  label: "1",
                  title: "Point audio",
                  contentHtml: "<p>Contexte du point.</p>",
                  media: {
                    type: "audio",
                    assetRef: "audio/poi.mp3",
                    fileName: "poi.mp3",
                    transcriptHtml: "<p>Transcription validée du point d’intérêt.</p>",
                    transcriptLanguage: "fr",
                    transcriptSource: "imported",
                    transcriptStatus: "validated",
                    transcriptAllowDownload: false
                  }
                }]
              }),
              block("course-exit-1", "course-exit", {
                summary: "Quitter maintenant",
                contentHtml: "<p>Merci pour votre participation.</p>",
                mediaLayout: "text-left-button-right"
              })
            ]
          }
        ]
      }, {
        id: "chapter-2",
        title: "Deuxième chapitre",
        pages: [{
          id: "page-3",
          title: "Page invisible",
          blocks: [
            block("continue-1", "continue"),
            block("note-pdf", "note", {
              contentHtml: "<p>Note imprimable</p>",
              panelBackgroundColor: "#101010",
              panelBorderColor: "#abcdef",
              panelBorderStyle: "solid",
              panelBorderWidth: "2px",
              noteIcon: "warning-triangle",
              noteShowIcon: true,
              noteIconColor: "#cc3322",
              noteIconMatchesBorder: false
            })
          ]
        }]
      }]
    }]
  },
  glossaryAssistants: [{
    id: "assistant-1",
    name: "Assistant métier",
    avatarRef: "avatars/assistant.png",
    entries: [{
      id: "entry-1",
      term: "Terme",
      aliases: ["Alias"],
      contentHtml: "<p>Définition</p>",
      related: ["Proche"],
      fuzzy: false
    }],
    fallbackResponses: [],
    caseInsensitive: true,
    ignoreAccents: true,
    fuzzyEnabled: false,
    fuzzyThreshold: 0.8,
    assistantEnabled: true,
    alwaysVisible: false,
    position: "bottom-right",
    shortcut: "Ctrl+K",
    lessonIds: [],
    collectionIds: []
  }]
};

assert.equal(resolvedCourseTextColor({
  roundedCorners: false,
  shadows: false,
  textColorMode: "custom",
  textColor: "#E53935",
  backgroundColor: "#121419"
}), "#E53935");
assert.equal(resolvedCourseTextColor({
  roundedCorners: false,
  shadows: false,
  textColorMode: "default",
  textColor: "#E53935",
  backgroundColor: "#121419"
}), "#FFFFFF");
assert.equal(resolveContextualTextColor("#E53935", "#FFFFFF"), "#E53935");
assert.equal(resolveContextualTextColor("#000000", "#000000"), "#FFFFFF");
assert.equal(resolveContextualTextColor("#FFFFFF", "#FFFFFF"), "#222222");
assert.equal(resolveBlockCourseAppearance({ type: "tabs", panelRounded: true, panelShadow: true } as PaideiaBlock, {
  roundedCorners: false,
  shadows: false,
  textColorMode: "default",
  textColor: "#222222",
  backgroundColor: "#FFFFFF"
}).panelRounded, false);
assert.equal(resolveBlockCourseAppearance({ type: "tabs", panelRounded: false, panelShadow: false } as PaideiaBlock, {
  roundedCorners: true,
  shadows: true,
  textColorMode: "default",
  textColor: "#222222",
  backgroundColor: "#FFFFFF"
}).panelRounded, false);

project.courseAppearance = {
  roundedCorners: false,
  shadows: false,
  textColorMode: "custom",
  textColor: "#E53935",
  backgroundColor: "#121419"
};
const model = buildLessonPdfModel(project);
const courseExitActivity = model.chapters[0]?.activities.find((activity) => activity.id === "course-exit-1");
assert.ok(courseExitActivity);
assert.equal(courseExitActivity.sections[0]?.kind, "rich-text");
assert.equal(courseExitActivity.sections[1]?.kind, "progress-marker");
assert.equal(courseExitActivity.sections[1]?.kind === "progress-marker" ? courseExitActivity.sections[1].label : "", "Quitter maintenant");
assert.equal(model.contentTextColor, "#222222");

assert.equal(model.lessonTitle, "Leçon de contrôle");
assert.equal(model.coverImage?.ref, "images/cover.png");
assert.deepEqual(model.chapterMenu.map((chapter) => chapter.title), ["Premier chapitre", "Deuxième chapitre"]);
assert.equal(model.chapters[0].activities[0].heading, "Activité 1 — Texte — ID text-1");
assert.equal(model.chapters[0].activities[4].heading, "Activité 5 — Onglets — ID tabs-1");
assert.equal(model.chapters[1].activities[0].heading, "Activité 1 — Continuer — ID continue-1");

const quiz = model.chapters[0].activities[1].sections.find((section) => section.kind === "quiz");
assert.equal(quiz?.assistantNotice, model.labels.quizAssistantNotice);
assert.equal(quiz?.questions[0].answers.filter((answer) => answer.correct).length, 1);
assert.equal(quiz?.questions[0].feedbackIncorrectHtml, "<p>Incorrect</p>");

const htmlDescription = model.chapters[0].activities[2].sections.find((section) => section.kind === "html-description");
assert.equal(htmlDescription?.description, "Description & contexte");
assert.equal(extractHtmlMetaDescription("<meta NAME='description' CONTENT='Définition'>"), "Définition");

const svgFallback = model.chapters[0].activities[3].sections.find((section) => section.kind === "fallback");
assert.equal(svgFallback?.activityLabel, "Image");
assert.equal(svgFallback?.reason, "unsupported-content");

const tabs = model.chapters[0].activities[4].sections.find((section) => section.kind === "expanded-items");
assert.deepEqual(tabs?.items.map((item) => item.title), ['<span style="font-family: &quot;Segoe UI&quot;, sans-serif">Onglet 1</span>', "Onglet 2"]);

const situationalDialogueActivity = model.chapters[0].activities[5];
assert.equal(situationalDialogueActivity.sections.some((section) => section.kind === "visual"), false);
const situationalDialogue = situationalDialogueActivity.sections.find((section) => section.kind === "situational-dialogue");
assert.deepEqual(situationalDialogue?.nodes[0].assets.map((asset) => asset.ref), ["default-characters/Personnage/introduction.png"]);
assert.deepEqual(situationalDialogue?.nodes[1].assets, []);

const quoteActivity = model.chapters[0].activities.find((activity) => activity.id === "quote-1");
const quoteVisual = quoteActivity?.sections.find((section) => section.kind === "visual");
assert.deepEqual(quoteVisual?.assets.map((asset) => asset.ref), ["images/portrait.png"]);
assert.equal(quoteVisual?.layout, "image-right");
assert.equal(quoteVisual?.width, "large");
assert.equal(quoteActivity?.style.sectionBackgroundColor, null);
assert.equal(quoteActivity?.style.sectionBackgroundImageRef, null);

const mediaActivity = model.chapters[0].activities.find((activity) => activity.id === "media-1");
const mediaVisual = mediaActivity?.sections.find((section) => section.kind === "visual");
assert.deepEqual(mediaVisual?.assets.map((asset) => asset.ref), ["video/lesson.mp4"]);
assert.equal(mediaActivity?.style.sectionBackgroundColor, null);
assert.equal(mediaActivity?.style.sectionBackgroundImageRef, null);
assert.doesNotMatch(JSON.stringify(mediaActivity), /video-background\.jpg/);
assert.doesNotMatch(JSON.stringify(collectProjectPdfFileRefs(project)), /video-background\.jpg/);

const timelineDocument = JSON.stringify(renderLessonPdfDocument(model));
const notePdfActivity = model.chapters[1].activities.find((activity) => activity.id === "note-pdf");
assert.equal(notePdfActivity?.style.noteIcon, "warning-triangle");
assert.equal(notePdfActivity?.style.noteShowIcon, true);
assert.equal(notePdfActivity?.style.noteIconColor, "#cc3322");
assert.equal(notePdfActivity?.style.noteIconMatchesBorder, false);
assert.match(timelineDocument, /M12 3\.5 21 20H3L12 3\.5Z/);
assert.match(timelineDocument, /stroke=\\"#cc3322\\"/);
assert.match(timelineDocument, /"ellipse"/);
assert.match(timelineDocument, /#e53935/);
assert.doesNotMatch(timelineDocument, /technical-card-summary/);
assert.doesNotMatch(timelineDocument, /#f4f6f9/);
assert.doesNotMatch(timelineDocument, /#101010/);
assert.match(timelineDocument, /#abcdef/);
assert.match(timelineDocument, /"linkToDestination":"pdf-chapter-1"/);
assert.match(timelineDocument, /"id":"pdf-chapter-1"/);
assert.match(timelineDocument, /CHAPITRE 1/);
assert.match(timelineDocument, /rx=\\"11\\"/);
assert.match(timelineDocument, /"width":"26%"/);
assert.match(timelineDocument, /Transcription audio validée dans le PDF/);
assert.match(timelineDocument, /Transcription validée du point d’intérêt/);
assert.doesNotMatch(timelineDocument, /Cette transcription brouillon ne doit pas sortir/);

const englishModel = buildLessonPdfModel(project, { language: "en" });
const englishDocument = JSON.stringify(renderLessonPdfDocument(englishModel));
assert.equal(englishModel.chapters[0].activities[0].heading, "Activity 1 — Text — ID text-1");
assert.equal(englishModel.chapters[0].activities[4].heading, "Activity 5 — Tabs — ID tabs-1");
assert.equal(englishModel.chapters[1].activities[0].heading, "Activity 1 — Continue — ID continue-1");
assert.equal(
  englishModel.chapters[0].activities[1].sections.find((section) => section.kind === "quiz")?.assistantNotice,
  "The quiz disables the assistant during the assessment."
);
for (const expected of [
  "Review document",
  "Chapters",
  "CHAPTER 1",
  "Activity 1 — Text",
  "Correct answer",
  "Proposed answer",
  "General feedback",
  "Assistants and glossaries",
  "Related terms"
]) {
  assert.match(englishDocument, new RegExp(expected));
}
for (const forbidden of [
  "Document de relecture",
  "Chapitres",
  "CHAPITRE 1",
  "Activité 1",
  "Réponse correcte",
  "Réponse proposée",
  "Feedback général",
  "Assistants et glossaires",
  "Termes associés"
]) {
  assert.doesNotMatch(englishDocument, new RegExp(forbidden));
}

const dividerProject: PaideiaProject = {
  ...project,
  courseImageRef: null,
  glossaryAssistants: [],
  course: {
    ...project.course,
    modules: [{
      id: "divider-module",
      title: "Séparateurs",
      chapters: [{
        id: "divider-chapter",
        title: "Trait",
        pages: [{
          id: "divider-page",
          title: "Trait",
          blocks: [block("divider-1", "divider", {
            dividerColor: "#e53935",
            dividerWidth: "3px",
            dividerStyle: "dashed"
          })]
        }]
      }]
    }]
  }
};
const dividerModel = buildLessonPdfModel(dividerProject);
const dividerActivity = dividerModel.chapters[0].activities[0];
assert.equal(dividerActivity.renderMode, "divider");
assert.deepEqual(dividerActivity.sections, [{ kind: "divider" }]);
const dividerDocument = JSON.stringify(renderLessonPdfDocument(dividerModel));
assert.match(dividerDocument, /"type":"line"/);
assert.match(dividerDocument, /"lineColor":"#e53935"/);
assert.match(dividerDocument, /"dash":\{"length":6,"space":4\}/);
assert.doesNotMatch(dividerDocument, /rx=\\"11\\"/);

const sectionMarkerBlocks = [
  ...Array.from({ length: 28 }, (_, index) => block(`alpha-${index}`, "section-marker", { markerScheme: "alpha", dividerColor: "#e53935", markerTextColor: "#1e40af" })),
  block("roman-1", "section-marker", { markerScheme: "roman" }),
  block("arabic-1", "section-marker", { markerScheme: "arabic" })
];
const sectionMarkerProject: PaideiaProject = {
  ...dividerProject,
  course: { ...dividerProject.course, modules: [{ id: "marker-module", title: "Repères", chapters: [{ id: "marker-chapter", title: "Repères", pages: [{ id: "marker-page", title: "Repères", blocks: sectionMarkerBlocks }] }] }] }
};
const sectionMarkerModel = buildLessonPdfModel(sectionMarkerProject);
assert.equal(sectionMarkerModel.chapters[0].activities[26].sections[0].kind, "section-marker");
assert.deepEqual(sectionMarkerModel.chapters[0].activities[26].sections[0], { kind: "section-marker", label: "AA", scheme: "alpha" });
assert.deepEqual(sectionMarkerModel.chapters[0].activities[28].sections[0], { kind: "section-marker", label: "I", scheme: "roman" });
assert.deepEqual(sectionMarkerModel.chapters[0].activities[29].sections[0], { kind: "section-marker", label: "1", scheme: "arabic" });
const sectionMarkerDocument = JSON.stringify(renderLessonPdfDocument(sectionMarkerModel));
assert.match(sectionMarkerDocument, /stroke=\\"#e53935\\"/);
assert.match(sectionMarkerDocument, /fill=\\"#1e40af\\"/);

assert.equal(model.assistantAppendices[0].name, "Assistant métier");
assert.equal(model.assistantAppendices[0].entries[0].term, "Terme");
assert.deepEqual(model.assistantAppendices[0].entries[0].aliases, ["Alias"]);

const libraryActivityTypes = ACTIVITY_LIBRARY_SECTIONS.flatMap((section) => section.items);
for (const activityType of libraryActivityTypes) {
  assert.ok(PDF_ACTIVITY_MATRIX[activityType], `Matrice PDF absente pour ${activityType}`);
}

const placeholderAuditProject: PaideiaProject = {
  ...project,
  courseImageRef: null,
  glossaryAssistants: [],
  course: {
    ...project.course,
    modules: [{
      id: "placeholder-module",
      title: "Audit",
      chapters: [{
        id: "placeholder-chapter",
        title: "Audit des fonds",
        pages: [{
          id: "placeholder-page",
          title: "Audit",
          blocks: libraryActivityTypes.map((activityType, index) => block(
            `placeholder-${index}`,
            activityType,
            activityType === "note"
              ? { sectionBackgroundColor: "#f4f6f9" }
              : {
                  sectionBackgroundColor: "#f4f6f9",
                  panelBackgroundColor: ["#edf4ff", "#f8f9fb", "#E5E7EB"][index % 3],
                  panelBorderColor: "#123a7a"
                }
          ))
        }]
      }]
    }]
  }
};
const placeholderAuditDocument = JSON.stringify(renderLessonPdfDocument(buildLessonPdfModel(placeholderAuditProject)));
assert.doesNotMatch(placeholderAuditDocument, /#f4f6f9/);
assert.doesNotMatch(placeholderAuditDocument, /#edf4ff/);
assert.doesNotMatch(placeholderAuditDocument, /#f8f9fb/);
assert.doesNotMatch(placeholderAuditDocument, /#e5e7eb/i);

const richContent = richHtmlToPdf("<h2>Titre</h2><p>Texte <strong>important</strong>.</p><script>interdit()</script><ul><li>Un</li><li>Deux</li></ul>");
const richContentJson = JSON.stringify(richContent);
assert.match(richContentJson, /Titre/);
assert.match(richContentJson, /important/);
assert.doesNotMatch(richContentJson, /interdit/);

const authoredListMarkers = JSON.stringify(richHtmlToPdf(
  '<ul data-paideia-list-marker="check"><li>Validé</li></ul><ol data-paideia-list-marker="upper-roman"><li>Premier</li></ol>'
));
assert.match(authoredListMarkers, /✓/);
assert.match(authoredListMarkers, /"type":"upper-roman"/);

const richTextV1 = JSON.stringify(richHtmlToPdf(
  '<div data-paideia-rich-field-fill="#fff4cc" style="background-color:#fff4cc"><p>Texte <span style="background-color:#ffe066">surligne</span> <span data-paideia-reference-id="reference-1" data-paideia-bookmark-target="bookmark-1" data-paideia-bookmark-label="Source" data-paideia-bookmark-preview="contenu source">renvoi</span></p></div>'
));
assert.match(richTextV1, /"fillColor":"#fff4cc"/);
assert.match(richTextV1, /"background":"#ffe066"/);
assert.match(richTextV1, /Renvoi/);
assert.match(richTextV1, /contenu source/);
const textActivityWithoutFieldBackground = JSON.stringify(richHtmlToPdf(
  '<div class="paideia-rich-field-fill" data-paideia-rich-field-fill="#121419" style="background-color:#121419"><p>Texte <span style="background-color:#ffe066">surligne</span></p></div>',
  { ignoreFieldBackgrounds: true }
));
assert.doesNotMatch(textActivityWithoutFieldBackground, /"fillColor":"#121419"/);
assert.match(textActivityWithoutFieldBackground, /"background":"#ffe066"/);
const legacyRiseTextWithoutFieldBackground = JSON.stringify(richHtmlToPdf(
  '<div class="rise-native-content" style="background:#121419"><p>Ancien texte Rise</p></div>',
  { ignoreFieldBackgrounds: true }
));
assert.doesNotMatch(legacyRiseTextWithoutFieldBackground, /#121419/);
const richTextEnglishReference = JSON.stringify(richHtmlToPdf(
  '<p><span data-paideia-reference-id="reference-1" data-paideia-bookmark-target="bookmark-1" data-paideia-bookmark-preview="source content">reference</span></p>',
  { referenceLabel: "Reference", bookmarkFallback: "bookmark" }
));
assert.match(richTextEnglishReference, /Reference/);
assert.match(richTextEnglishReference, /bookmark/);
assert.doesNotMatch(richTextEnglishReference, /Renvoi|balise/);

const coloredSpans = JSON.stringify(richHtmlToPdf('<span style="color: rgb(229, 57, 53)">A</span><span style="color: rgb(31, 151, 174)">B</span>'));
assert.equal((coloredSpans.match(/"margin"/g) ?? []).length, 1);
assert.match(coloredSpans, /#e53935/);
assert.match(coloredSpans, /#1f97ae/);

const unicodeMarkers = JSON.stringify(richHtmlToPdf('<p>\u{1F534} Critique \u{1F7E0} Important \u{1F6E1}\uFE0F</p>'));
assert.match(unicodeMarkers, /#d3473c/);
assert.match(unicodeMarkers, /#f57926/);
assert.match(unicodeMarkers, /\u2022/);
assert.doesNotMatch(unicodeMarkers, /\u{1F6E1}/u);

const richTable = JSON.stringify(richHtmlToPdf('<table><thead><tr><th>Canal</th><th>Coordonnées</th></tr></thead><tbody><tr><td><strong>Email</strong></td><td style="text-align:center;color:rgb(29,78,216)">support@example.fr</td></tr></tbody></table>'));
assert.match(richTable, /"table"/);
assert.match(richTable, /Canal/);
assert.match(richTable, /support@example\.fr/);
assert.match(richTable, /#1d4ed8/);

const multilingualEntities = JSON.stringify(richHtmlToPdf('<p>Mise &agrave; jour — &Eacute;cole &amp; 東京 &#x1F600; &#169;</p>'));
assert.match(multilingualEntities, /Mise à jour/);
assert.match(multilingualEntities, /École & 東京/);
assert.doesNotMatch(multilingualEntities, /&agrave;|&Eacute;|&#x/i);
const decodedEntities = decodeHtmlEntities('&agrave; &Eacute; &amp; 東京 &#x1F600; &#169;');
assert.equal(decodedEntities, 'à É & 東京 😀 ©');

const centeredTable = JSON.stringify(richHtmlToPdf('<center><br><table><colgroup><col width="144"><col width="428"></colgroup><tr><th><p align="left">Canal</p></th><td><font color="#102752">Email</font></td></tr></table></center>'));
assert.match(centeredTable, /"table"/);
assert.equal((centeredTable.match(/Canal/g) ?? []).length, 1);
assert.match(centeredTable, /25\.17%/);
assert.match(centeredTable, /#102752/);

const wideColoredTable = JSON.stringify(richHtmlToPdf('<table style="width:100%"><tr><td style="width:18.8675%"><strong>NIVEAU</strong></td><td style="width:12.2495%"><strong>CVSS</strong></td><td style="width:28.7545%"><strong>DESCRIPTION</strong></td><td style="width:15.5167%"><strong>DÉLAI</strong></td><td><strong>EXEMPLES</strong></td></tr><tr><td style="background-color:rgb(211,71,60)"><span style="font-size:18px">CRITIQUE</span></td><td>9.0-10.0</td><td>Menace</td><td>72 heures</td><td>Exemple</td></tr></table>'));
assert.match(wideColoredTable, /18\.87%/);
assert.match(wideColoredTable, /24\.61%/);
assert.match(wideColoredTable, /#d3473c/);
assert.match(wideColoredTable, /"fontSize":8\.5/);
assert.match(wideColoredTable, /"headerRows":1/);

const malformedRiseTable = JSON.stringify(richHtmlToPdf('<table><tbody><tr><td colspan="3" rowspan="2">Commande</td></tr><tr></tr></tbody></table>'));
assert.match(malformedRiseTable, /"colSpan":3/);
assert.match(malformedRiseTable, /"rowSpan":2/);
assert.equal((malformedRiseTable.match(/\{\}/g) ?? []).length, 5);

const documentDefinition = renderLessonPdfDocument(model);
const documentJson = JSON.stringify(documentDefinition);
assert.match(documentJson, /Leçon de contrôle/);
assert.match(documentJson, /Activité 2 — Quiz — ID quiz-1/);
assert.match(documentJson, /Assistants et glossaires/);
assert.doesNotMatch(documentJson, /<span style/);
assert.equal((documentJson.match(/Bonjour/g) ?? []).length, 1);
const coverDocumentJson = JSON.stringify(renderLessonPdfDocument(model, {
  "images/cover.png": "data:image/png;base64,AA=="
}));
assert.match(coverDocumentJson, /data:image\/png;base64,AA==/);
assert.doesNotMatch(documentJson, /Page technique invisible/);
assert.equal(typeof documentDefinition.footer, "function");
const pageNumberFooter = (documentDefinition.footer as (currentPage: number, pageCount: number) => unknown)(2, 7);
assert.match(JSON.stringify(pageNumberFooter), /2 \/ 7/);
assert.equal(
  lessonPdfFileName("Leçon d'été", new Date(2026, 6, 16, 14, 5)),
  "lecon-d-ete_16072026_1405.pdf"
);

console.log("Contrat du modèle PDF validé.");
