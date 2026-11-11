import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

const vite = await createServer({ appType: "custom", configFile: false, logLevel: "error", root: process.cwd(), server: { middlewareMode: true } });
const engine = await vite.ssrLoadModule("/src/features/designer-actions/designerActionEngine.ts");
const { DESIGNER_CAPABILITIES } = await vite.ssrLoadModule("/src/features/designer-actions/designerCapabilityRegistry.ts");
const { DESIGNER_INTENT_RESOLVERS } = await vite.ssrLoadModule("/src/features/designer-actions/designerIntentRegistry.ts");
const { DESIGNER_SLOT_REGISTRY } = await vite.ssrLoadModule("/src/features/designer-actions/designerSlotRegistry.ts");
const { PAIDEIA_ACTIVITY_CATALOG } = await vite.ssrLoadModule("/src/features/designer-actions/designerKnowledgeCatalog.ts");
const { normalizeDesignerText } = await vite.ssrLoadModule("/src/features/designer-actions/designerLanguage.ts");
const { extractAppearanceActivityTarget } = await vite.ssrLoadModule("/src/features/designer-actions/designerValueExtractors.ts");
const {
  DESIGNER_SOCIAL_REGISTRY,
  isAllowedDesignerSocialMediaEffect,
  resolveDesignerSocialResponse,
  resolveDesignerSocialTurn
} = await vite.ssrLoadModule("/src/features/designer-actions/designerSocialRegistry.ts");
const {
  DESIGNER_UNKNOWN_RESPONSES,
  resolveDesignerUnknownResponse
} = await vite.ssrLoadModule("/src/features/designer-actions/designerUnknownResponses.ts");
const {
  DESIGNER_HELP_INTENT_REGISTRY,
  DESIGNER_HELP_SUGGESTION_TEMPLATES,
  DESIGNER_HELP_TEXT_TEMPLATES,
  matchDesignerHelpIntents
} = await vite.ssrLoadModule("/src/features/designer-actions/designerHelpRegistry.ts");
const { DESIGNER_DOCUMENTATION_REGISTRY } = await vite.ssrLoadModule("/src/features/designer-actions/designerDocumentationRegistry.ts");
const { resolveDesignerHelp, resolveDesignerHelpSubject, suggestDesignerHelp } = await vite.ssrLoadModule("/src/features/designer-actions/designerHelpEngine.ts");
const {
  ACTIVITY_BACKGROUND_BLOCK_TYPES,
  supportsActivityBackgroundProperty
} = await vite.ssrLoadModule("/src/app/activityAppearanceCapabilities.ts");
const destructive = await vite.ssrLoadModule("/src/features/designer-actions/designerDestructiveActions.ts");

const rustCommands = readFileSync("src-tauri/src/commands.rs", "utf8");
const frenchLocale = JSON.parse(readFileSync("src/locales/fr.json", "utf8"));
const rustBackgroundTypes = [...(rustCommands.match(/const ACTIVITY_BACKGROUND_BLOCK_TYPES:[\s\S]*?\];/)?.[0] ?? "").matchAll(/"([^"]+)"/g)]
  .map((match) => match[1]);
assert.deepEqual(rustBackgroundTypes, [...ACTIVITY_BACKGROUND_BLOCK_TYPES], "Le backend et l’interface doivent déclarer les mêmes activités compatibles avec le fond commun");
for (const property of [
  "matchingLabelBackgroundColor", "matchingLabelRounded", "findElementsImageRounded", "findElementsImageShadow",
  "slidesActivityBackgroundColor", "slidesActivityRounded", "slidesActivityShadow", "cardSortCardRounded", "headerTextColor"
]) {
  assert.ok((rustCommands.match(new RegExp(`\\"${property}\\"`, "g")) ?? []).length >= 4, `${property} doit être validée, capturée pour Undo et appliquée par le backend`);
}

function expectReady(phrase, operationKinds) {
  const result = engine.parseDesignerConversationTurn(phrase);
  assert.equal(result.status, "ready", phrase);
  assert.deepEqual(result.intent.operations.map((operation) => operation.kind), operationKinds, phrase);
  return result;
}

for (const phrase of [
  "annule", "annules", "annulez", "annuler", "laisse tomber", "laissez tomber", "laisser tomber",
  "ne fais rien", "ne faites rien", "ne fais plus rien", "ne faites plus rien", "ne rien faire",
  "abandonne", "abandonnez", "abandonner", "stop", "stoppez", "arrête", "arrêtez", "arrêter",
  "oublie ça", "oubliez cela", "j’ai changé d’avis", "finalement non", "on arrête",
  "aucun", "aucune", "rien", "ARRÊTE !", "ARRETEZ", "J’AI CHANGÉ D’AVIS", "j'ai change d'avis"
]) {
  assert.equal(engine.isDesignerCancellationRequest(phrase), true, phrase);
}
for (const phrase of ["sans ombre", "aucun contour", "arrête la vidéo", "ne fais rien dépasser"]) {
  assert.equal(engine.isDesignerCancellationRequest(phrase), false, phrase);
}

expectReady(
  "Mets la hauteur d’apparence de toutes les activités vidéo sur minimale",
  ["set-activity-background-height"]
);

for (const [phrase, expected] of [
  ["hauteur d’apparence des activités vidéo sur minimale", "minimum"],
  ["met la hauteur d’apparence des activités vidéo sur moyenne", "medium"],
  ["change la hauteur d’apparence des activités vidéo sur grande", "large"]
]) {
  const result = expectReady(phrase, ["set-activity-background-height"]);
  assert.equal(result.intent.operations[0].height, expected, phrase);
  assert.equal(result.intent.operations[0].target, "type", phrase);
  assert.equal(result.intent.operations[0].activityType, "media", phrase);
}

const missingColor = engine.parseDesignerConversationTurn(
  "Peux-tu changer la couleur des sous-titres de toutes les vidéos ?"
);
assert.equal(missingColor.status, "incomplete");
assert.equal(missingColor.question, "video-caption-color");
assert.equal(missingColor.control, "color");
const completedColor = engine.parseDesignerConversationTurn("rouge", missingColor.draft);
assert.equal(completedColor.status, "ready");
assert.equal(completedColor.intent.operations[0].color, "#E53935");

const project = {
  course: {
    modules: [{
      chapters: [
        { id: "chapter-a", title: "A", pages: [{ id: "page-a", title: "Page A", blocks: [{ id: "video-a", type: "media", title: "Vidéo A", sectionBackgroundColor: "#123456", sectionBackgroundImageRef: "images/old.webp", sectionBackgroundBlur: 10, videoCaptionColor: "#E53935", videoCaptionBackgroundEnabled: false, videoCaptionOutline: "thick", videoAllowFullscreen: true, sectionBackgroundHeight: "minimum" }, { id: "text-a", type: "rich-text", title: "Texte A", contentHtml: "<p>Texte A</p>" }, { id: "note-a", type: "note", title: "Note A", contentHtml: "<p>Note</p>", panelBackgroundColor: "#FFFFFF", panelBorderColor: "#123A7A", panelBorderWidth: "1px", panelBorderStyle: "solid", panelRounded: true, panelShadow: false }, { id: "audio-a", type: "audio", title: "Audio A", panelBackgroundColor: "#FFFFFF", panelBorderColor: "#123A7A", panelBorderWidth: "1px", panelBorderStyle: "solid", panelRounded: true, panelShadow: false, buttonTextColor: "#123A7A" }, { id: "continue-a", type: "continue", title: "Continuer", summary: "Continuer", buttonBackgroundColor: "#123a7a", buttonTextColor: "#ffffff" }] }] },
        { id: "chapter-b", title: "1", pages: [{ id: "page-b", title: "Page B", blocks: [{ id: "video-b", type: "media", title: "Vidéo B" }, { id: "text-b", type: "rich-text", title: "Texte B", contentHtml: "<p><strong>Texte B</strong></p>" }] }] }
      ]
    }]
  },
  activitySpacingPx: 30
};

const semanticTypographyProject = structuredClone(project);
semanticTypographyProject.course.modules[0].chapters[0].pages[0].blocks.find((block) => block.id === "text-a").contentHtml = '<h2 style="font-size:30px;color:#E53935">Titre</h2><p style="font-size:14px;color:#1D7DDC"><strong>Texte courant</strong></p>';
const semanticTypographyIntent = expectReady("Passe la taille de la police de toutes les activités Texte à 18 px", ["set-text-activity-font-size"]);
const dialogueProject = structuredClone(project);
const dialogueBlocks = dialogueProject.course.modules[0].chapters[0].pages[0].blocks;
dialogueBlocks.push({ id: "scenario-a", type: "situational-dialogue", title: "Scénario A" });
for (const [phrase, kind, property, expected] of [
  ["Change la couleur du bandeau des mises en situation en rouge", "set-situational-dialogue-color", "situationalDialogueBannerColor", "#E53935"],
  ["Change la couleur des boutons Continuer des mises en situation en rouge", "set-situational-dialogue-color", "situationalDialogueButtonsColor", "#E53935"],
  ["Active l’ombre portée des mises en situation", "set-activity-frame-shadow", "sectionBackgroundShadow", "true"]
]) {
  const { intent } = expectReady(phrase, [kind]);
  const { targets } = engine.previewDesignerAction(dialogueProject, intent);
  assert.deepEqual(targets.map(({ blockId, property, previousUnset, value }) => [blockId, property, previousUnset, value]), [["scenario-a", property, true, expected]]);
}
const dialogueColorQuestion = engine.parseDesignerConversationTurn("Change la couleur du bandeau des mises en situation");
assert.equal(dialogueColorQuestion.question, "situational-dialogue-color");
const dialogueColorAnswer = engine.parseDesignerConversationTurn("rouge", dialogueColorQuestion.draft);
assert.equal(dialogueColorAnswer.intent.operations[0].part, "banner");

const semanticTypographyTarget = engine.previewDesignerAction(semanticTypographyProject, semanticTypographyIntent.intent).targets.find((target) => target.blockId === "text-a");
assert.match(semanticTypographyTarget.value, /<h2 style="font-size:30px;color:#E53935">Titre<\/h2>/u, "La taille et la couleur des titres doivent être conservées");
assert.match(semanticTypographyTarget.value, /<p style="color:#1D7DDC;font-size:18px">/u, "Seule la taille du texte courant doit être normalisée");
assert.match(semanticTypographyTarget.value, /<strong style="font-size:18px">Texte courant<\/strong>/u, "La mise en forme du texte courant doit être conservée");

const noteBorder = expectReady("Mets un trait bleu épais sur toutes les activités Note", ["set-activity-frame-border-color", "set-activity-frame-border-width"]);
const noteBorderPreview = engine.previewDesignerAction(project, noteBorder.intent);
assert.deepEqual(noteBorderPreview.targets.map((target) => [target.blockId, target.property, target.value]), [
  ["note-a", "panelBorderColor", "#1D7DDC"],
  ["note-a", "panelBorderWidth", "4px"]
]);
const chainedFrameTypes = expectReady("Mets un trait bleu épais sur les activités Note, Audio", ["set-activity-frame-border-color", "set-activity-frame-border-width"]);
assert.deepEqual(engine.previewDesignerAction(project, chainedFrameTypes.intent).targets.map((target) => target.blockId), ["note-a", "audio-a", "note-a", "audio-a"]);
const excludedFrameType = expectReady("Mets un trait bleu épais sur toutes les activités sauf Audio", ["set-activity-frame-border-color", "set-activity-frame-border-width"]);
assert.ok(engine.previewDesignerAction(project, excludedFrameType.intent).targets.some((target) => target.blockId === "note-a"));
assert.ok(engine.previewDesignerAction(project, excludedFrameType.intent).targets.every((target) => target.blockId !== "audio-a"));
assert.notEqual(engine.parseDesignerConversationTurn("Mets un trait bleu sur toutes les activités sauf Bidule").status, "ready");
const noteShadow = expectReady("Active l’ombre de toutes les activités Note", ["set-activity-frame-shadow"]);
assert.deepEqual(engine.previewDesignerAction(project, noteShadow.intent).targets.map((target) => target.property), ["panelShadow"]);
const audioFrameBackground = expectReady("Mets le fond de l’apparence de toutes les activités Audio en jaune", ["set-activity-frame-background-color"]);
assert.equal(engine.previewDesignerAction(project, audioFrameBackground.intent).targets[0].property, "panelBackgroundColor");
const audioAccent = expectReady("Applique un accent bleu à toutes les activités Audio", ["set-activity-frame-accent-color"]);
assert.deepEqual(engine.previewDesignerAction(project, audioAccent.intent).targets.map((target) => [target.property, target.value]), [["activityAccentColor", "#1D7DDC"]]);

const dividerProject = structuredClone(project);
dividerProject.course.modules[0].chapters[1].pages[0].blocks.push(
  { id: "divider-b", type: "divider", title: "Séparateur B", dividerColor: "#123A7A", dividerWidth: "2px", dividerStyle: "solid" },
  { id: "marker-b", type: "section-marker", title: "Repère B", dividerColor: "#123A7A", dividerWidth: "2px", dividerStyle: "solid", markerScheme: "arabic", markerType: "outline", markerTextColor: "#123A7A" }
);
for (const phrase of ["Passe tous les séparateurs repérés en lettres", "PASSE TOUS LES SEPARATEURS REPERES EN LETTRES"]) {
  const markerLetters = expectReady(phrase, ["set-section-marker-scheme"]);
  assert.deepEqual(engine.previewDesignerAction(dividerProject, markerLetters.intent).targets.map((target) => [target.blockId, target.property, target.value]), [["marker-b", "markerScheme", "alpha"]]);
}
const romanMarkers = expectReady("Numérote les séparateurs repérés du chapitre 2 en chiffres romains", ["set-section-marker-scheme"]);
assert.equal(romanMarkers.intent.scope, "chapter");
assert.equal(romanMarkers.intent.chapterReference, "2");
assert.deepEqual(engine.previewDesignerAction(dividerProject, romanMarkers.intent).targets.map((target) => [target.blockId, target.value]), [["marker-b", "roman"]]);
const dividerAppearance = expectReady("Mets un trait bleu épais sur tous les séparateurs", ["set-divider-color", "set-divider-width"]);
assert.deepEqual(engine.previewDesignerAction(dividerProject, dividerAppearance.intent).targets.map((target) => [target.blockId, target.property, target.value]), [
  ["divider-b", "dividerColor", "#1D7DDC"],
  ["divider-b", "dividerWidth", "4px"]
]);

const headerProject = structuredClone(project);
headerProject.course.modules[0].chapters[0].pages[0].blocks.push({ id: "header-a", type: "header", title: "En-tête A", headerBackgroundColor: "#D7EEF0", headerTextColor: "#102752", sectionBackgroundBlur: 0, sectionBackgroundOpacity: 1, sectionBackgroundOverlayDark: true, contentAlign: "left", headerTextOutline: "none", headerTextOutlineColor: "light" });
for (const phrase of ["Mets le fond de tous les en-têtes en bleu", "METS LE FOND DE TOUS LES EN TETES EN BLEU"]) {
  const headerColor = expectReady(phrase, ["set-header-background-color"]);
  assert.deepEqual(engine.previewDesignerAction(headerProject, headerColor.intent).targets.map((target) => [target.blockId, target.property, target.value]), [["header-a", "headerBackgroundColor", "#1D7DDC"]]);
}
const headerTextColor = expectReady("Mets la couleur du texte de tous les en-têtes en rouge", ["set-header-text-color"]);
assert.deepEqual(engine.previewDesignerAction(headerProject, headerTextColor.intent).targets.map((target) => [target.blockId, target.property, target.value]), [["header-a", "headerTextColor", "#E53935"]]);
const headerVisuals = expectReady("Applique un voile sombre fort et un flou léger à tous les en-têtes", ["set-header-background-blur", "set-header-background-overlay", "set-header-background-overlay-dark"]);
assert.deepEqual(engine.previewDesignerAction(headerProject, headerVisuals.intent).targets.map((target) => target.property), ["sectionBackgroundBlur", "sectionBackgroundOpacity"]);
const headerAlignment = expectReady("Place le bloc texte de tous les bandeaux à droite", ["set-header-content-align"]);
assert.deepEqual(engine.previewDesignerAction(headerProject, headerAlignment.intent).targets.map((target) => [target.property, target.value]), [["contentAlign", "right"]]);

const navigationStyleProject = structuredClone(project);
navigationStyleProject.course.modules[0].chapters[0].pages[0].blocks.push({ id: "exit-a", type: "course-exit", title: "Sortir", buttonBackgroundColor: "#E53935", buttonTextColor: "#111111" });
navigationStyleProject.course.modules[0].chapters[1].pages[0].blocks.push({ id: "continue-b", type: "continue", title: "Continuer B", buttonBackgroundColor: "#123a7a", buttonTextColor: "#ffffff" });
const styleCopy = expectReady("Utilise les mêmes couleurs que les boutons Continuer sur le bouton Sortir de la leçon", ["copy-continue-button-style-to-course-exit"]);
assert.deepEqual(engine.previewDesignerAction(navigationStyleProject, styleCopy.intent).targets.map((target) => [target.blockId, target.property, target.value]), [
  ["exit-a", "continueButtonBackgroundColor", "#123A7A"],
  ["exit-a", "continueButtonTextColor", "#FFFFFF"]
]);
const reverseStyleCopy = expectReady("Harmonise le style du bouton Sortir de la leçon avec les boutons Continuer", ["copy-course-exit-button-style-to-continue"]);
assert.deepEqual(engine.previewDesignerAction(navigationStyleProject, reverseStyleCopy.intent).targets.map((target) => [target.blockId, target.property, target.value]), [
  ["continue-a", "continueButtonBackgroundColor", "#E53935"],
  ["continue-a", "continueButtonTextColor", "#111111"],
  ["continue-b", "continueButtonBackgroundColor", "#E53935"],
  ["continue-b", "continueButtonTextColor", "#111111"]
]);
navigationStyleProject.course.modules[0].chapters[1].pages[0].blocks.find((block) => block.id === "continue-b").buttonBackgroundColor = "#E53935";
assert.equal(engine.previewDesignerAction(navigationStyleProject, styleCopy.intent).blockedReason, "continue-styles-differ");

const specializedAppearanceProject = structuredClone(project);
specializedAppearanceProject.course.modules[0].chapters[0].pages[0].blocks.push(
  { id: "matching-a", type: "matching", title: "Relier A", matching: { pairs: [], maxAttempts: 3, successThreshold: 80, showAttemptFeedback: true, successFeedbackHtml: "", failureFeedbackHtml: "", labelAppearance: { backgroundColor: "#FFFFFF", borderColor: "#244585", borderWidth: "1px", borderStyle: "solid", rounded: true } } },
  { id: "find-a", type: "find-elements", title: "Chercher A", findElements: { imageAppearance: { borderColor: "#123A7A", borderStyle: "solid", borderWidth: "0px", rounded: true, shadow: false }, maxAttempts: 3, successThreshold: 80, labels: { description: "", risk: "", correction: "" }, zones: [] } },
  { id: "slides-a", type: "slides", title: "Diaporama A", slidesActivityBackgroundColor: "#FFFFFF", slidesActivityRounded: true, slidesActivityShadow: true },
  { id: "sort-a", type: "card-sort", title: "Tri A", cardSort: { categories: [], maxAttempts: 3, successThreshold: 80, gateChapterUntilPassed: false, interactionMode: "direct", successFeedbackHtml: "", failureFeedbackHtml: "", cardAppearance: { backgroundColor: "#FFFFFF", borderColor: "#244585", borderWidth: "1px", borderStyle: "solid", rounded: true } } }
);
const matchingLabelsColor = expectReady("Mets le fond des étiquettes de toutes les activités Association en bleu", ["set-activity-frame-background-color"]);
assert.deepEqual(engine.previewDesignerAction(specializedAppearanceProject, matchingLabelsColor.intent).targets.map((target) => [target.blockId, target.property, target.value]), [["matching-a", "matchingLabelBackgroundColor", "#1D7DDC"]]);
const matchingLabelsRounded = expectReady("Désactive les coins arrondis des étiquettes de toutes les activités Relier", ["set-activity-frame-rounded"]);
assert.deepEqual(engine.previewDesignerAction(specializedAppearanceProject, matchingLabelsRounded.intent).targets.map((target) => [target.blockId, target.property, target.value]), [["matching-a", "matchingLabelRounded", "false"]]);
const findImageRounded = expectReady("Désactive les coins arrondis de l’image des activités Chercher dans l’image", ["set-activity-frame-rounded"]);
assert.deepEqual(engine.previewDesignerAction(specializedAppearanceProject, findImageRounded.intent).targets.map((target) => [target.blockId, target.property, target.value]), [["find-a", "findElementsImageRounded", "false"]]);
const findImageShadow = expectReady("Active l’ombre de l’image des activités Chercher dans l’image", ["set-activity-frame-shadow"]);
assert.deepEqual(engine.previewDesignerAction(specializedAppearanceProject, findImageShadow.intent).targets.map((target) => [target.blockId, target.property, target.value]), [["find-a", "findElementsImageShadow", "true"]]);
const slidesBackground = expectReady("Mets le fond de tous les diaporamas en bleu", ["set-activity-frame-background-color"]);
assert.deepEqual(engine.previewDesignerAction(specializedAppearanceProject, slidesBackground.intent).targets.map((target) => [target.blockId, target.property, target.value]), [["slides-a", "slidesActivityBackgroundColor", "#1D7DDC"]]);
const slidesRounded = expectReady("Désactive les coins arrondis de tous les diaporamas", ["set-activity-frame-rounded"]);
assert.deepEqual(engine.previewDesignerAction(specializedAppearanceProject, slidesRounded.intent).targets.map((target) => [target.blockId, target.property, target.value]), [["slides-a", "slidesActivityRounded", "false"]]);
const slidesShadow = expectReady("Désactive l’ombre de tous les diaporamas", ["set-activity-frame-shadow"]);
assert.deepEqual(engine.previewDesignerAction(specializedAppearanceProject, slidesShadow.intent).targets.map((target) => [target.blockId, target.property, target.value]), [["slides-a", "slidesActivityShadow", "false"]]);
const cardSortRounded = expectReady("Désactive les coins arrondis des cartes de toutes les activités Classement de cartes", ["set-activity-frame-rounded"]);
assert.deepEqual(engine.previewDesignerAction(specializedAppearanceProject, cardSortRounded.intent).targets.map((target) => [target.blockId, target.property, target.value]), [["sort-a", "cardSortCardRounded", "false"]]);

const fontOptions = [
  { value: "PaideiaRichFont-rich-bundled-inter", label: "Inter" },
  { value: "PaideiaRichFont-rich-bundled-cormorant-garamond", label: "Cormorant Garamond" },
  { value: "PaideiaRichFont-rich-bundled-spectral", label: "Spectral" }
];
const partialFont = engine.resolveDesignerFontSelection(
  engine.parseDesignerConversationTurn("Mets toutes les polices de toutes les activités Texte en Spect"),
  fontOptions
);
assert.equal(partialFont.status, "ready");
assert.equal(partialFont.intent.operations[0].fontFamily, "PaideiaRichFont-rich-bundled-spectral");
assert.equal(partialFont.intent.operations[0].target, "type");
assert.equal(partialFont.intent.operations[0].activityType, "rich-text");
const partialFontPreview = engine.previewDesignerAction(project, partialFont.intent);
assert.deepEqual(partialFontPreview.targets.map((target) => target.blockId), ["text-a", "text-b"]);
assert.ok(partialFontPreview.targets.every((target) => target.property === "activityRichTextBlockJson"));
assert.ok(partialFontPreview.targets.every((target) => target.value.includes("font-family")));

const namedFontRequest = engine.resolveDesignerFontSelection(
  engine.parseDesignerConversationTurn("Change la police de l’activité nommée Texte A en Inter"),
  fontOptions
);
assert.equal(namedFontRequest.status, "incomplete");
assert.equal(namedFontRequest.question, "activity-font-target");
const typedFont = engine.resolveDesignerFontSelection(engine.parseDesignerConversationTurn("Toutes les activités Texte", namedFontRequest.draft), fontOptions);
assert.equal(typedFont.status, "ready");
assert.deepEqual(engine.previewDesignerAction(project, typedFont.intent).targets.map((target) => target.blockId), ["text-a", "text-b"]);

const defaultFont = engine.resolveDesignerFontSelection(
  engine.parseDesignerConversationTurn("Mets la police par défaut de toutes les activités Texte"),
  fontOptions
);
assert.equal(defaultFont.status, "ready");
assert.equal(defaultFont.intent.operations[0].fontFamily, "__default__");

const missingFont = engine.resolveDesignerFontSelection(
  engine.parseDesignerConversationTurn("Change la police de toutes les activités Texte"),
  fontOptions
);
assert.equal(missingFont.status, "incomplete");
assert.equal(missingFont.question, "activity-font-family");
assert.equal(missingFont.control, "font");

const chapterOneColor = engine.disambiguateDesignerChapter(project, engine.parseDesignerConversationTurn(
  "Modifie la couleur des sous-titres dans le chapitre 1"
));
assert.equal(chapterOneColor.status, "incomplete");
assert.equal(chapterOneColor.question, "chapter-reference-choice");
assert.equal(chapterOneColor.draft.scope, "chapter");
assert.equal(chapterOneColor.draft.chapterReference, "1");
const namedChapterChoice = engine.parseDesignerConversationTurn("Le chapitre dont le nom est 1", chapterOneColor.draft);
assert.equal(namedChapterChoice.status, "incomplete");
assert.equal(namedChapterChoice.question, "video-caption-color");
assert.equal(namedChapterChoice.draft.chapterResolution, "title");
assert.equal(namedChapterChoice.control, "color");
const completedChapterOneColor = engine.parseDesignerConversationTurn("#E53935", namedChapterChoice.draft);
assert.equal(completedChapterOneColor.status, "ready");
assert.equal(completedChapterOneColor.intent.chapterReference, "1");
assert.equal(completedChapterOneColor.intent.chapterResolution, "title");
const chapterOnePreview = engine.previewDesignerAction(project, completedChapterOneColor.intent);
assert.deepEqual(chapterOnePreview.targets.map((target) => target.pageId), ["page-b"]);

const ordinalChapterChoice = engine.parseDesignerConversationTurn("Le premier chapitre", chapterOneColor.draft);
assert.equal(ordinalChapterChoice.status, "incomplete");
assert.equal(ordinalChapterChoice.question, "video-caption-color");
assert.equal(ordinalChapterChoice.draft.chapterResolution, "ordinal");

const chained = expectReady(
  "Pour toutes les vidéos, sous-titres couleur jaune, fond non, contour fin",
  ["set-video-caption-color", "set-video-caption-background", "set-video-caption-outline"]
);
assert.equal(chained.intent.operations[1].enabled, false);
assert.equal(chained.intent.operations[2].outline, "thin");

const chapter = expectReady(
  "Dans ce chapitre, mets la hauteur d’apparence des vidéos sur grande et désactive le plein écran",
  ["set-activity-background-height", "set-video-fullscreen"]
);
assert.equal(chapter.intent.scope, "chapter");
const chapterWithDe = expectReady(
  "Mets le fond des activités texte en rouge du chapitre 1",
  ["set-activity-background-color"]
);
assert.equal(chapterWithDe.intent.scope, "chapter");
assert.equal(chapterWithDe.intent.chapterReference, "1");
const multiChapterColor = expectReady(
  "Mets le fond de toutes les activités texte en rouge dans les chapitres A et 2",
  ["set-activity-background-color"]
);
assert.equal(multiChapterColor.intent.scope, "chapter");
assert.equal(multiChapterColor.intent.chapterReference, "a et 2");
const multiChapterSelection = engine.resolveDesignerChapters(project, multiChapterColor.intent.chapterReference);
assert.equal(multiChapterSelection.status, "resolved");
assert.deepEqual(multiChapterSelection.chapters.map((chapter) => chapter.id), ["chapter-a", "chapter-b"]);
multiChapterColor.intent.resolvedChapterIds = multiChapterSelection.chapters.map((chapter) => chapter.id);
multiChapterColor.intent.resolvedChapterTitles = multiChapterSelection.chapters.map((chapter) => chapter.title);
const multiChapterPreview = engine.previewDesignerAction(project, multiChapterColor.intent);
assert.deepEqual([...new Set(multiChapterPreview.targets.map((target) => target.chapterTitle))], ["A", "1"]);
const titledChapterProject = {
  course: { modules: [{ chapters: [
    { id: "intro", title: "Introduction", pages: [] },
    { id: "security", title: "Hygiène et sécurité", pages: [] },
    { id: "summary", title: "Conclusion", pages: [] }
  ] }] }
};
const titledSelection = engine.resolveDesignerChapters(titledChapterProject, "Introduction et Hygiène et sécurité");
assert.equal(titledSelection.status, "resolved");
assert.deepEqual(titledSelection.chapters.map((chapter) => chapter.id), ["intro", "security"]);
assert.equal(engine.resolveDesignerChapters(titledChapterProject, "Introduction et chapitre absent").status, "missing");

const impreciseMedium = engine.parseDesignerConversationTurn("Mets toutes les vidéos en medium");
assert.equal(impreciseMedium.status, "incomplete");
assert.equal(impreciseMedium.question, "video-property");

const captionProperty = engine.parseDesignerConversationTurn("Modifie les sous-titres de toutes les vidéos");
assert.equal(captionProperty.status, "incomplete");
assert.equal(captionProperty.question, "video-caption-property");

assert.equal(
  engine.parseDesignerConversationTurn("Mets la hauteur des vidéos sur minimale et grande").status,
  "ambiguous"
);

const missingVideoActivityHeight = engine.parseDesignerConversationTurn("Change la hauteur d’apparence de toutes les activités vidéo");
assert.equal(missingVideoActivityHeight.status, "incomplete");
assert.equal(missingVideoActivityHeight.question, "activity-background-height");
const completedMinimumVideoActivityHeight = engine.parseDesignerConversationTurn("Minimale", missingVideoActivityHeight.draft);
assert.equal(completedMinimumVideoActivityHeight.status, "ready");
assert.equal(completedMinimumVideoActivityHeight.intent.operations[0].height, "minimum");
const minimumVideoActivityHeightPreview = engine.previewDesignerAction(project, completedMinimumVideoActivityHeight.intent);
assert.deepEqual(minimumVideoActivityHeightPreview.targets.map((target) => target.blockId), ["video-b"]);
assert.equal(minimumVideoActivityHeightPreview.targets[0].property, "sectionBackgroundHeight");
assert.equal(minimumVideoActivityHeightPreview.targets[0].value, "minimum");
assert.deepEqual(minimumVideoActivityHeightPreview.unchanged.map((target) => target.blockId), ["video-a"]);

const bareHeightRequest = engine.parseDesignerConversationTurn("hauteur");
assert.equal(bareHeightRequest.status, "incomplete");
assert.equal(bareHeightRequest.question, "activity-background-target");
assert.deepEqual(engine.designerMassTargetSuggestions(project, bareHeightRequest.draft), [
  "Oui — toutes les activités compatibles",
  "Toutes les activités Texte",
  "Toutes les activités Note",
  "Toutes les activités Vidéo",
  "Toutes les activités Audio",
  "Toutes les activités Continuer",
  "Aucune"
]);
assert.deepEqual(engine.parseDesignerConversationTurn("aucune", bareHeightRequest.draft), { status: "cancelled" });
const allHeightTarget = engine.parseDesignerConversationTurn("oui", bareHeightRequest.draft);
assert.equal(allHeightTarget.status, "incomplete");
assert.equal(allHeightTarget.question, "activity-background-height");
assert.equal(allHeightTarget.draft.operations[0].target, "all");
const bareVideoTarget = engine.parseDesignerConversationTurn("vidéo", bareHeightRequest.draft);
assert.equal(bareVideoTarget.status, "incomplete");
assert.equal(bareVideoTarget.question, "activity-background-height");
assert.equal(bareVideoTarget.draft.operations[0].target, "type");
assert.equal(bareVideoTarget.draft.operations[0].activityType, "media");
const bareMinimumHeight = engine.parseDesignerConversationTurn("minimale", bareVideoTarget.draft);
assert.equal(bareMinimumHeight.status, "ready");
assert.equal(bareMinimumHeight.intent.operations[0].height, "minimum");

for (const [phrase, question] of [
  ["largeur", "activity-background-target"],
  ["large", "activity-background-target"],
  ["flou", "activity-background-target"],
  ["voile", "activity-background-target"],
  ["coins", "activity-background-target"],
  ["espacement", "activity-spacing-target"],
  ["police", "font-property"],
  ["sous-titres", "video-caption-property"],
  ["plein écran", "video-fullscreen"],
  ["bouton Continuer", "continue-button-property"],
  ["couleur", "color-property"],
  ["apparence", "appearance-property"],
  ["image de fond", "activity-background-target"]
]) {
  const result = engine.parseDesignerConversationTurn(phrase);
  assert.equal(result.status, "incomplete", phrase);
  assert.equal(result.question, question, phrase);
  assert.ok(engine.suggestDesignerConversationStarters(phrase).every(item => item.id.startsWith('documentation:')), phrase);
}
const bareColor = engine.parseDesignerConversationTurn("couleur");
const captionColorChoice = engine.parseDesignerConversationTurn("La couleur des sous-titres", bareColor.draft);
assert.equal(captionColorChoice.status, "incomplete");
assert.equal(captionColorChoice.question, "video-caption-color");
const bareContinue = engine.parseDesignerConversationTurn("bouton Continuer");
const continueTextChoice = engine.parseDesignerConversationTurn("La couleur du texte", bareContinue.draft);
assert.equal(continueTextChoice.status, "incomplete");
assert.equal(continueTextChoice.question, "continue-button-text-color");
assert.equal(
  engine.parseDesignerConversationTurn("Supprime toutes les activités vidéo").status,
  "forbidden"
);
assert.deepEqual(destructive.parseDesignerActivityDeletionRequest("Supprime toutes les activités"), {
  activityLabel: "activités",
  originalCommand: "Supprime toutes les activités",
  chapterReference: undefined,
  chapterResolution: undefined
});
assert.equal(destructive.parseDesignerActivityDeletionRequest("Supprime toutes les activités vidéo").activityType, "media");
assert.equal(destructive.parseDesignerActivityDeletionRequest("Supprime les activités vidéo").activityType, "media");
assert.equal(destructive.parseDesignerActivityDeletionRequest("Supprime les activités vidéos").activityType, "media");
assert.equal(destructive.parseDesignerActivityDeletionRequest("Supprime les activités textes").activityType, "rich-text");
assert.equal(destructive.parseDesignerActivityDeletionRequest("Supprime vidéo").activityType, "media");
assert.equal(destructive.parseDesignerActivityDeletionRequest("Supprime les vidéos").activityType, "media");
assert.equal(destructive.parseDesignerActivityDeletionRequest("Supprime toutes les vidéos").activityType, "media");
assert.equal(destructive.parseDesignerActivityDeletionRequest("Peux-tu supprimer les vidéos ?").activityType, "media");
assert.equal(destructive.parseDesignerActivityDeletionRequest("Veuillez retirer l’activité vidéo").activityType, "media");
assert.equal(destructive.parseDesignerActivityDeletionRequest("Effacez les activités vidéo").activityType, "media");
assert.equal(destructive.parseDesignerActivityDeletionRequest("Supprime les activités"), null);
assert.equal(destructive.parseDesignerActivityDeletionRequest("Supprimer toutes activités").activityType, undefined);
for (const incompleteDeletion of ["Supprime activités", "Supprimer activités", "Suppression activités", "Supprime les activités"]) {
  const clarification = destructive.parseDesignerActivityDeletionClarification(incompleteDeletion);
  assert.equal(clarification.originalCommand, incompleteDeletion, incompleteDeletion);
  assert.equal(destructive.parseDesignerActivityDeletionRequest(incompleteDeletion), null, incompleteDeletion);
}
const deletionClarification = destructive.parseDesignerActivityDeletionClarification("Supprimer activités dans le chapitre 1");
assert.equal(deletionClarification.chapterReference, "1");
assert.equal(destructive.completeDesignerActivityDeletionClarification(deletionClarification, "toutes").activityLabel, "activités");
assert.deepEqual(
  destructive.completeDesignerActivityDeletionClarification(deletionClarification, "les activités Vidéo et Audio").activityTypes,
  ["media", "audio"]
);
assert.deepEqual(
  destructive.completeDesignerActivityDeletionClarification(deletionClarification, "toutes sauf Vidéo, Audio").excludedActivityTypes,
  ["media", "audio"]
);
assert.deepEqual(
  destructive.parseDesignerActivityDeletionRequest("Supprime toutes les activités vidéo dans le chapitre numéro 3"),
  {
    activityType: "media",
    activityTypes: ["media"],
    activityLabels: ["Vidéo"],
    activityLabel: "activités Vidéo",
    originalCommand: "Supprime toutes les activités vidéo dans le chapitre numéro 3",
    chapterReference: "3",
    chapterResolution: "ordinal"
  }
);
const exclusionDeletion = destructive.parseDesignerActivityDeletionRequest("Supprime toutes les activités sauf Vidéo, Audio et En-tête");
assert.deepEqual(exclusionDeletion.excludedActivityTypes, ["media", "audio", "header"]);
assert.deepEqual(exclusionDeletion.excludedActivityLabels, ["Vidéo", "Audio", "En-tête"]);
assert.deepEqual(
  destructive.parseDesignerActivityDeletionRequest("Supprime toutes les activités sauf Vidéo Audio").excludedActivityTypes,
  ["media", "audio"]
);
assert.deepEqual(
  destructive.parseDesignerActivityDeletionRequest("Supprime les activités Vidéo, Audio et Note").activityTypes,
  ["media", "audio", "note"]
);
assert.deepEqual(
  destructive.parseDesignerActivityDeletionRequest("Supprime toutes les activités Image et texte").activityTypes,
  ["image-text"],
  "Le nom exact d’une activité composée doit primer sur une liste implicite"
);
assert.equal(destructive.parseDesignerActivityDeletionRequest("Supprime toutes les activités sauf Vidéo chose inconnue"), null);
assert.equal(
  destructive.parseDesignerActivityDeletionRequest("Dans le chapitre nommé Introduction, supprime toutes les activités vidéo").chapterResolution,
  "title"
);
for (const chapterPhrase of [
  "Supprime les activités sur chapitre 1",
  "Supprime les activités du chapitre 1",
  "Supprime les activités dans le chapitre 1",
  "Supprime les activités pour le chapitre 1"
]) {
  assert.equal(destructive.parseDesignerActivityDeletionClarification(chapterPhrase).chapterReference, "1", chapterPhrase);
}
for (const singularTypedChapterPhrase of [
  "Supprime activité vidéo chapitre 1",
  "Supprime l’activité vidéo du chapitre 1",
  "Supprimer une activité vidéo dans le chapitre 1"
]) {
  const request = destructive.parseDesignerActivityDeletionRequest(singularTypedChapterPhrase);
  assert.equal(request.activityType, "media", singularTypedChapterPhrase);
  assert.equal(request.chapterReference, "1", singularTypedChapterPhrase);
}
const multiChapterDeletion = destructive.parseDesignerActivityDeletionRequest(
  "Supprime toutes les activités vidéo dans les chapitres A et 2"
);
assert.equal(multiChapterDeletion.chapterReference, "a et 2");
const resolvedDeletionChapters = engine.resolveDesignerChapters(project, multiChapterDeletion.chapterReference);
assert.equal(resolvedDeletionChapters.status, "resolved");
const deletionTargets = destructive.collectDesignerActivityDeletionTargets(project, {
  ...multiChapterDeletion,
  resolvedChapterIds: resolvedDeletionChapters.chapters.map((chapter) => chapter.id)
});
assert.deepEqual(deletionTargets.map((target) => target.blockId), ["video-a", "video-b"]);
assert.deepEqual(project.course.modules[0].chapters[0].pages[0].blocks.map((block) => block.id), ["video-a", "text-a", "note-a", "audio-a", "continue-a"], "Target collection must not reorder activities");
for (const unsafeDeletion of [
  "Supprime toutes les activités et mets le fond rouge",
  "Supprime toutes les activités vid",
  "Supprime l’image de fond de toutes les activités vidéo"
]) {
  assert.equal(destructive.parseDesignerActivityDeletionRequest(unsafeDeletion), null, unsafeDeletion);
}
assert.ok(destructive.parseDesignerActivityDeletionClarification("Supprime toutes les activités vid"));
assert.equal(destructive.parseDesignerActivityDeletionClarification("Supprime le chapitre 1"), null);
assert.equal(destructive.parseDesignerActivityDeletionClarification("Supprime la leçon"), null);
assert.equal(engine.parseDesignerConversationTurn("Supprime toutes les vidéos").status, "forbidden");
expectReady(
  "Pour toutes les vidéos, mets les sous-titres en jaune et sans fond",
  ["set-video-caption-color", "set-video-caption-background"]
);
assert.equal(engine.suggestDesignerActions("").length, 0);
for (const genericActivityRequest of ["activité", "activités", "aide activité", "aide activités"]) {
  const result = engine.parseDesignerConversationTurn(genericActivityRequest, null, "lesson", undefined, "help");
  assert.equal(result.status, "incomplete", `${genericActivityRequest} must request an activity`);
  assert.equal(result.question, "help-activity", `${genericActivityRequest} must not select an arbitrary activity`);
  assert.ok(result.draft.candidateCommands.length > 30, `${genericActivityRequest} must offer the documented activities`);
  assert.equal(result.draft.candidateCommands.length, result.draft.candidateSubjectIds.length);
  assert.ok(result.draft.candidateCommands.some((command) => command === "Aide : Vidéo"), `${genericActivityRequest} must include video`);
}
for (const ambiguousHelpRequest of ["configuration", "conseils", "utilisation"]) {
  const result = engine.parseDesignerConversationTurn(ambiguousHelpRequest, null, "lesson", undefined, "help");
  assert.equal(result.status, "incomplete", `${ambiguousHelpRequest} must request a precise help topic`);
  assert.equal(result.question, "help-choice", `${ambiguousHelpRequest} must not select the first indexed document`);
  assert.ok(result.draft.candidateCommands.length > 1, `${ambiguousHelpRequest} must expose the tied topics`);
  assert.equal(result.draft.candidateCommands.length, result.draft.candidateSubjectIds.length);
}
for (const broadHelpRequest of ["chapitre", "projet", "leçon", "ressources", "image", "texte", "sous-titres"]) {
  const result = engine.parseDesignerConversationTurn(broadHelpRequest, null, "lesson", undefined, "help");
  assert.equal(result.status, "incomplete", `${broadHelpRequest} must request a precise help topic`);
  assert.equal(result.question, "help-choice", `${broadHelpRequest} must not select one narrow document`);
  assert.ok(result.draft.candidateCommands.length > 0, `${broadHelpRequest} must expose relevant topics`);
}
for (const meaninglessQuery of ["AA", "az", "bn", "xqz"]) {
  assert.deepEqual(engine.suggestDesignerActions(meaninglessQuery), [], `${meaninglessQuery} must not suggest an action`);
  assert.deepEqual(engine.suggestDesignerConversationStarters(meaninglessQuery), [], `${meaninglessQuery} must not suggest a conversation starter`);
  assert.deepEqual(suggestDesignerHelp(meaninglessQuery), [], `${meaninglessQuery} must not suggest a help topic`);
}
for (const middleOfWordFragment of ["ctivite", "ouleur", "deo", "diteur", "uleur"]) {
  assert.deepEqual(engine.suggestDesignerActions(middleOfWordFragment), [], `${middleOfWordFragment} must not match inside a word`);
  assert.deepEqual(engine.suggestDesignerConversationStarters(middleOfWordFragment), [], `${middleOfWordFragment} must not suggest a conversation starter`);
  assert.deepEqual(suggestDesignerHelp(middleOfWordFragment), [], `${middleOfWordFragment} must not match inside a help word`);
}
assert.deepEqual(engine.suggestDesignerConversationStarters("hauteur"), []);
assert.ok(engine.suggestDesignerConversationStarters("hauteu").some((item) => item.id === "activity-background-height"));
assert.deepEqual(engine.suggestDesignerActions("couleur sous titres").map((item) => item.id), ["video-caption-color"]);
assert.deepEqual(engine.parseDesignerConversationTurn("putain modifie la couleur du fond"), { status: "social", response: "politeness" }, "Explicit profanity must keep its social response");
assert.equal(engine.parseDesignerConversationTurn("comment peux tu m aider a modifier la couleur du fond").status, "incomplete", "An explanatory request must remain in the help flow");
const explicitReplacementFromHelp = engine.parseDesignerConversationTurn(
  "Remplace le libellé de tous les boutons Continuer",
  null,
  "lesson",
  undefined,
  "help"
);
assert.equal(explicitReplacementFromHelp.status, "incomplete", "An explicit replacement command must leave help mode");
assert.equal(explicitReplacementFromHelp.question, "continue-button-label", "The replacement command must ask only for the missing label");
for (const cancellation of ["annule", "annuler", "ne fais rien", "aucun", "aucune", "rien", "laisse tomber"]) {
  assert.deepEqual(
    engine.parseDesignerConversationTurn(cancellation, explicitReplacementFromHelp.draft),
    { status: "cancelled" },
    `${cancellation} must abandon the pending label request`
  );
}
const missingOutline = engine.parseDesignerConversationTurn("Change le contour des sous-titres de toutes les vidéos");
assert.equal(missingOutline.status, "incomplete");
const noOutline = engine.parseDesignerConversationTurn("aucun", missingOutline.draft);
assert.equal(noOutline.status, "ready", "Aucun remains a valid value when the pending setting accepts it");
assert.equal(noOutline.intent.operations[0].outline, "none");
assert.equal(engine.parseDesignerConversationTurn("fais le fond rouge", null, "lesson", undefined, "actions").status, "incomplete", "A natural background-color formulation must be understood");
assert.equal(engine.parseDesignerConversationTurn("fond rouge", null, "lesson", undefined, "actions").status, "incomplete", "A telegraphic background-color formulation must be understood in action mode");
assert.deepEqual(engine.suggestDesignerActions("couleur du fond activité").map((item) => item.id), ["activity-background-color"]);
assert.ok(engine.suggestDesignerActions("hauteur activité").some((item) => item.id === "activity-background-height" && /toutes les activités/.test(item.command)));
assert.deepEqual(engine.suggestDesignerActions("taille police activités texte").map((item) => item.id), ["text-activity-font-size"]);
assert.deepEqual(engine.suggestDesignerActions("image de fond activités").map((item) => item.id), ["activity-background-image"]);
assert.deepEqual(engine.suggestDesignerActions("fem").map((item) => item.id), ["assistant-feminine-session", "assistant-feminine-remember"]);
assert.deepEqual(engine.suggestDesignerActions("féminise").map((item) => item.id), ["assistant-feminine-session"]);
assert.deepEqual(engine.suggestDesignerActions("féminin").map((item) => item.id), ["assistant-feminine-session", "assistant-feminine-remember"]);
assert.deepEqual(engine.suggestDesignerActions("n'utilise plus le féminin").map((item) => item.id), ["assistant-address-form-forget"]);
assert.deepEqual(engine.suggestDesignerActions("apparence").map((item) => item.id), [
  "video-height-minimum",
  "activity-background-image",
  "activity-background-color",
  "activity-background-overlay",
  "activity-background-blur",
  "activity-background-wide-enable",
  "activity-background-wide-disable",
  "activity-background-rounded-enable",
  "activity-background-rounded-disable",
  "activity-background-height",
  "activity-frame-background"
]);
assert.deepEqual(engine.suggestDesignerActions("hauteur").map((item) => item.id), ["video-height-minimum", "activity-background-height"]);
assert.equal(engine.suggestDesignerActions("hauteur apparence activités vidéo minimale")[0]?.id, "video-height-minimum");
assert.deepEqual(engine.suggestDesignerActions("image").map((item) => item.id), ["activity-background-image"]);
assert.deepEqual(engine.suggestDesignerActions("voile").map((item) => item.id), ["activity-background-overlay", "header-background-overlay"]);
assert.deepEqual(engine.suggestDesignerActions("voile sombre").map((item) => item.id), ["activity-background-overlay-dark-enable", "header-background-overlay"]);
assert.deepEqual(engine.suggestDesignerActions("voile clair").map((item) => item.id), ["activity-background-overlay-dark-disable", "header-background-overlay"]);
expectReady("Utilise un voile sombre pour toutes les activités", ["set-activity-background-overlay-dark"]);
expectReady("Utilise un voile clair pour toutes les activités", ["set-activity-background-overlay-dark"]);
assert.deepEqual(engine.suggestDesignerActions("flou").map((item) => item.id), ["activity-background-blur", "header-background-blur"]);
assert.deepEqual(engine.suggestDesignerActions("coins").map((item) => item.id), ["activity-background-rounded-enable", "activity-background-rounded-disable", "activity-frame-rounded-enable", "activity-frame-rounded-disable"]);
assert.deepEqual(engine.suggestDesignerActions("espacement").map((item) => item.id), ["activity-spacing"]);
assert.deepEqual(engine.suggestDesignerActions("plein écran").map((item) => item.id), ["video-fullscreen-enable", "video-fullscreen-disable"]);
assert.deepEqual(engine.suggestDesignerActions("sous-titres").map((item) => item.id), ["video-caption-color", "video-caption-background-enable", "video-caption-background-disable", "video-caption-outline"]);
const videoActivitySuggestions = engine.suggestDesignerActions("activités vidéo");
assert.ok(videoActivitySuggestions.some((item) => item.id === "activity-spacing" && /activités Vidéo/.test(item.command)));
assert.ok(videoActivitySuggestions.some((item) => item.id === "activity-spacing-all" && /toutes les activités$/.test(item.command)));
assert.deepEqual(engine.suggestDesignerActions("mets").map((item) => item.id), []);
assert.deepEqual(engine.suggestDesignerActions("mets le voile").map((item) => item.id), ["activity-background-overlay", "header-background-overlay"]);
assert.deepEqual(engine.suggestDesignerActions("change l'apparence").map((item) => item.id), engine.suggestDesignerActions("apparence").map((item) => item.id));
for (const editAlias of ["changer", "éditer", "édition", "modifier", "modification"]) {
  const suggestions = engine.suggestDesignerConversationStarters(editAlias);
  assert.ok(suggestions.length > 0, `${editAlias} must suggest editing actions`);
  assert.ok(suggestions.every((item) => !item.id.startsWith("documentation:")), `${editAlias} must prioritize actions over documentation`);
}
assert.deepEqual(engine.suggestDesignerActions("supprime l'image de fond").map((item) => item.id), ["activity-background-remove-image"]);
assert.deepEqual(engine.suggestDesignerActions("réinitialise l'apparence").map((item) => item.id), ["divider-reset", "section-marker-reset", "header-reset", "activity-background-reset"]);
assert.deepEqual(engine.suggestDesignerActions("réinitialise paramètres apparence").map((item) => item.id), ["activity-background-reset"]);
assert.deepEqual(engine.suggestDesignerActions("réinitialise parametres aparence").map((item) => item.id), ["activity-background-reset"]);
assert.deepEqual(engine.suggestDesignerActions("boutons continuer couleur").map((item) => item.id), ["continue-button-background", "copy-continue-style-to-course-exit", "copy-course-exit-style-to-continue"]);
assert.deepEqual(engine.suggestDesignerActions("libellé boutons continuer").map((item) => item.id), ["continue-button-label"]);
assert.deepEqual(engine.suggestDesignerActions("réinitialise boutons continuer").map((item) => item.id), ["continue-button-reset"]);
assert.equal(engine.suggestDesignerActions("accordéon")[0]?.id, "documentation:activite-accordeon-1");
assert.equal(engine.suggestDesignerActions("à quoi sert chercher dans l'image")[0]?.id, "documentation:activite-chercher-dans-l-image-1");
assert.deepEqual(engine.suggestDesignerActions("réinitialise paramètres apparence"), engine.suggestDesignerActions("réinitialise paramètres apparence"));
for (const suggestion of engine.DESIGNER_CAPABILITIES) {
  const result = engine.parseDesignerConversationTurn(engine.suggestionInputValue(suggestion));
  assert.notEqual(result.status, "unsupported", suggestion.id);
  assert.notEqual(result.status, "forbidden", suggestion.id);
}
assert.equal(
  engine.suggestionInputValue(engine.suggestDesignerActions("taille police activités texte")[0]),
  "Normalise la taille du texte courant de toutes les activités"
);
assert.deepEqual(engine.parseDesignerConversationTurn("Bonjour,"), { status: "social", response: "greeting" });
assert.deepEqual(engine.parseDesignerConversationTurn("Que sais-tu faire ?"), { status: "social", response: "help" });
assert.deepEqual(engine.parseDesignerConversationTurn("Qui es-tu ?"), { status: "social", response: "identity" });
assert.deepEqual(engine.parseDesignerConversationTurn("Rien"), { status: "social", response: "done" });
assert.deepEqual(engine.parseDesignerConversationTurn("Comment t'appelles-tu ?"), { status: "social", response: "identity" });
assert.deepEqual(engine.parseDesignerConversationTurn("Putain, tu fais chier"), { status: "social", response: "politeness" });
assert.deepEqual(engine.parseDesignerConversationTurn("Au revoir"), { status: "social", response: "farewell" });
assert.deepEqual(engine.parseDesignerConversationTurn("Merci"), { status: "social", response: "thanks" });
assert.equal(DESIGNER_UNKNOWN_RESPONSES.length, 7, "Arion must provide seven formulations for an unknown request");
const firstUnknownResponse = resolveDesignerUnknownResponse(undefined, () => 0);
assert.equal(firstUnknownResponse, DESIGNER_UNKNOWN_RESPONSES[0]);
assert.notEqual(
  resolveDesignerUnknownResponse(firstUnknownResponse, () => 0),
  firstUnknownResponse,
  "Unknown-request formulations must not repeat immediately"
);
for (const [query, expectedId] of [
  ["installer Whisper", "documentation:installer-et-configurer-ffmpeg-et-whisper-1"],
  ["où télécharger FFmpeg", "documentation:installer-et-configurer-ffmpeg-et-whisper-2"],
  ["sauvegarde incrémentielle", "documentation:sauvegarde-incrementielle-automatique-1"],
  ["numéro de version sous-version", "documentation:zone-informations-de-paideia-2"]
]) {
  assert.ok(
    suggestDesignerHelp(query, 6).some((suggestion) => suggestion.id === expectedId),
    `Arion help must retrieve ${expectedId} for: ${query}`
  );
}
const characterHelp = resolveDesignerHelp("Aide personnages");
assert.ok(characterHelp?.relatedTopics?.length, "Character help must offer genuinely related follow-up topics");
assert.ok(
  characterHelp.relatedTopics.every((topic) => topic.id.includes("mise-en-situation") || topic.id === "documentation:ressources-banques-et-glossaire-2"),
  "Character help follow-ups must stay within character resources and the associated activity"
);
assert.ok(
  characterHelp.relatedTopics.every((topic) => !/ffmpeg|whisper|questions|glossaire/iu.test(topic.title)),
  "Character help must exclude unrelated modules and resource banks"
);
assert.deepEqual(
  suggestDesignerHelp("Aide problème personnages", 6).map((topic) => topic.id),
  [
    "documentation:activite-mise-en-situation-3",
    "documentation:activite-mise-en-situation-7",
    "documentation:ressources-banques-et-glossaire-2"
  ],
  "Generic help vocabulary must not pull unrelated troubleshooting sections into character results"
);
assert.deepEqual(
  suggestDesignerHelp("Aide FFmpeg personnages", 6),
  [],
  "Documentation search must not merge unrelated topics that only match separate documents"
);
const ffmpegHelp = resolveDesignerHelp("Aide FFmpeg");
assert.ok(
  ffmpegHelp?.relatedTopics?.every((topic) => topic.id.startsWith("documentation:installer-et-configurer-ffmpeg-et-whisper-")),
  "FFmpeg follow-ups must remain within the media-tool topic"
);
const favoritesHelp = resolveDesignerHelp("Aide favoris");
assert.ok(
  favoritesHelp?.relatedTopics?.every((topic) => /(?:favoris|menu-sandwich-et-parametres)/u.test(topic.id)),
  "Favorites follow-ups must remain about favorite shortcuts and their settings"
);
const socialInterruptionDraft = engine.parseDesignerConversationTurn("Change la hauteur des vidéos");
assert.equal(socialInterruptionDraft.status, "incomplete");
assert.deepEqual(
  engine.parseDesignerConversationTurn("Merci", socialInterruptionDraft.draft),
  { status: "social", response: "thanks" },
  "A social turn must be recognized inside an unfinished action"
);
const resumedAfterSocialTurn = engine.parseDesignerConversationTurn("Minimale", socialInterruptionDraft.draft);
assert.equal(resumedAfterSocialTurn.status, "ready", "The action draft must remain resumable after a social turn");
for (const [response, definition] of Object.entries(DESIGNER_SOCIAL_REGISTRY)) {
  assert.ok(definition.examples.length > 0, `L’intention sociale ${response} doit fournir des exemples de contrat`);
  assert.ok(definition.responses.length > 0, `L’intention sociale ${response} doit fournir au moins une réponse`);
  if (definition.selection === "fixed") assert.equal(definition.responses.length, 1, `Une réponse sociale fixe ne doit pas déclarer de variantes : ${response}`);
  for (const example of definition.examples) {
    assert.deepEqual(engine.parseDesignerConversationTurn(example), { status: "social", response }, `Exemple social non reconnu : ${example}`);
  }
  for (const variant of definition.responses) {
    assert.equal(typeof frenchLocale[variant.key], "string", `Clé sociale française absente : ${variant.key}`);
  }
  if (definition.effect) assert.ok(isAllowedDesignerSocialMediaEffect(definition.effect), `Effet social local invalide : ${response}`);
  const translate = (key, _params, fallback) => frenchLocale[key] ?? fallback ?? key;
  assert.equal(resolveDesignerSocialResponse(response, translate, "neutral", () => 0), frenchLocale[definition.responses[0].key]);
  assert.equal(resolveDesignerSocialResponse(response, translate, "neutral", () => 0.999999), frenchLocale[definition.responses.at(-1).key]);
  assert.equal(resolveDesignerSocialTurn(response, translate, "neutral", () => 0).text, frenchLocale[definition.responses[0].key]);
  if (definition.selection === "random" && definition.responses.length > 1) {
    const firstKey = definition.responses[0].key;
    const nextTurn = resolveDesignerSocialTurn(response, translate, "neutral", () => 0, firstKey);
    assert.notEqual(nextTurn.responseKey, firstKey);
    assert.equal(
      resolveDesignerSocialResponse(response, translate, "neutral", () => 0, firstKey),
      frenchLocale[definition.responses[1].key]
    );
  }
}
assert.ok(isAllowedDesignerSocialMediaEffect({ kind: "audio", source: "/arion-easter-eggs/musique.mp3", volume: 0.5 }));
assert.equal(isAllowedDesignerSocialMediaEffect({ kind: "audio", source: "https://example.com/musique.mp3" }), false);
assert.equal(isAllowedDesignerSocialMediaEffect({ kind: "image", source: "/arion-easter-eggs/../secret.png" }), false);
assert.equal(isAllowedDesignerSocialMediaEffect({ kind: "video", source: "/arion-easter-eggs/video.mp4", volume: 2 }), false);
for (const [intent, definition] of Object.entries(DESIGNER_HELP_INTENT_REGISTRY)) {
  assert.ok(definition.examples.length > 0, `L’intention d’aide ${intent} doit fournir des exemples de contrat`);
  for (const example of definition.examples) {
    assert.ok(matchDesignerHelpIntents(normalizeDesignerText(example)).has(intent), `Exemple d’aide non reconnu pour ${intent} : ${example}`);
  }
}
for (const template of Object.values(DESIGNER_HELP_TEXT_TEMPLATES)) {
  assert.equal(typeof frenchLocale[template.key], "string", `Clé française du registre d’aide absente : ${template.key}`);
}
for (const template of DESIGNER_HELP_SUGGESTION_TEMPLATES) {
  assert.equal(typeof frenchLocale[template.command.key], "string", `Clé française de suggestion d’aide absente : ${template.command.key}`);
}
const translateHelp = (key, params, fallback) => {
  const source = frenchLocale[key] ?? fallback ?? key;
  return source.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => params?.[name] ?? match);
};
const localizedPurposeHelp = engine.parseDesignerConversationTurn("À quoi sert l’activité Texte ?", null, "lesson", translateHelp);
assert.equal(localizedPurposeHelp.status, "help");
assert.match(localizedPurposeHelp.response.text, /^Texte sert à /);
assert.deepEqual(engine.parseDesignerConversationTurn("Féminise les réponses"), { status: "preference", action: "use-feminine-session" });
assert.deepEqual(engine.parseDesignerConversationTurn("féminise"), { status: "preference", action: "use-feminine-session" });
assert.deepEqual(engine.parseDesignerConversationTurn("féminin"), { status: "preference", action: "use-feminine-session" });
assert.deepEqual(engine.parseDesignerConversationTurn("Je suis une femme"), { status: "preference", action: "use-feminine-session" });
const rememberFeminine = engine.parseDesignerConversationTurn("Mémorise que je souhaite des réponses au féminin");
assert.equal(rememberFeminine.status, "incomplete");
assert.equal(rememberFeminine.question, "assistant-address-form-persistence-confirmation");
assert.deepEqual(engine.parseDesignerConversationTurn("oui", rememberFeminine.draft), { status: "preference", action: "remember-feminine" });
assert.deepEqual(engine.parseDesignerConversationTurn("non", rememberFeminine.draft), { status: "cancelled" });
assert.deepEqual(engine.parseDesignerConversationTurn("Oublie cette préférence"), { status: "preference", action: "forget-address-form" });
assert.deepEqual(engine.parseDesignerConversationTurn("N'utilise plus le féminin"), { status: "preference", action: "forget-address-form" });
assert.deepEqual(engine.parseDesignerConversationTurn("N’utilise plus le féminin"), { status: "preference", action: "forget-address-form" });
assert.equal(engine.applyDesignerAddressForm("Êtes-vous sûr de vouloir continuer ?", "feminine"), "Êtes-vous sûre de vouloir continuer ?");
assert.equal(engine.applyDesignerAddressForm("Je suis prêt à vous aider.", "feminine"), "Je suis prêt à vous aider.");

const chapterPreview = engine.previewDesignerAction(project, chapter.intent, { activeChapterId: "chapter-a" });
assert.equal(chapterPreview.targets.length, 2);
assert.ok(chapterPreview.targets.every((target) => target.pageId === "page-a"));
assert.deepEqual(chapterPreview.targets.map((target) => target.property), ["sectionBackgroundHeight", "videoAllowFullscreen"]);
const chapterOneColorPreview = engine.previewDesignerAction(project, completedChapterOneColor.intent, { activeChapterId: "chapter-b" });
assert.equal(chapterOneColorPreview.targets.length, 1);
assert.equal(chapterOneColorPreview.targets[0].pageId, "page-b");
assert.equal(chapterOneColorPreview.targets[0].property, "videoCaptionColor");

const vagueFontSize = engine.parseDesignerConversationTurn("Change la taille de la police");
assert.equal(vagueFontSize.status, "incomplete");
assert.equal(vagueFontSize.question, "font-size-target");
assert.deepEqual(engine.parseDesignerConversationTurn("Change la taille de la police de la leçon"), { status: "unavailable", reason: "lesson-font-size" });
const missingTextFontSize = engine.parseDesignerConversationTurn("Change la taille de la police de toutes les activités texte");
assert.equal(missingTextFontSize.status, "incomplete");
assert.equal(missingTextFontSize.question, "text-activity-font-size");
const completedTextFontSize = engine.parseDesignerConversationTurn("25", missingTextFontSize.draft);
assert.equal(completedTextFontSize.status, "ready");
assert.equal(completedTextFontSize.intent.operations[0].sizePx, 25);
const textFontPreview = engine.previewDesignerAction(project, completedTextFontSize.intent);
assert.deepEqual(textFontPreview.targets.map((target) => target.blockId), ["text-a", "text-b"]);
assert.ok(textFontPreview.targets.every((target) => target.property === "textActivityContentHtml"));
assert.ok(textFontPreview.targets.every((target) => target.value.includes("font-size:25px")));
const singularTextFontSize = expectReady(
  "Change la taille de la police de toutes les activités Texte à 25",
  ["set-text-activity-font-size"]
);
assert.equal(engine.previewDesignerAction(project, singularTextFontSize.intent).targets.length, 2);

const minimumVideoSpacing = expectReady(
  "Change le padding de toutes les activités vidéo au minimum",
  ["set-activity-spacing"]
);
assert.equal(minimumVideoSpacing.intent.operations[0].spacing, "minimum");
const minimumVideoSpacingPreview = engine.previewDesignerAction(project, minimumVideoSpacing.intent);
assert.deepEqual(minimumVideoSpacingPreview.targets.map((target) => target.blockId), ["video-a", "video-b"]);
assert.ok(minimumVideoSpacingPreview.targets.every((target) => target.value === "-20"));
const missingSpacing = engine.parseDesignerConversationTurn("Change l’espacement de toutes les activités vidéo");
assert.equal(missingSpacing.status, "incomplete");
assert.equal(missingSpacing.question, "activity-spacing-value");
const mediumSpacing = engine.parseDesignerConversationTurn("milieu", missingSpacing.draft);
assert.equal(mediumSpacing.status, "ready");
assert.equal(mediumSpacing.intent.operations[0].spacing, "medium");
const videoGap = expectReady("Mets l’écart entre les activités vidéo au maximum", ["set-activity-spacing"]);
assert.equal(videoGap.intent.operations[0].target, "type");
assert.equal(videoGap.intent.operations[0].activityType, "media");
const namedSpacingRequest = engine.parseDesignerConversationTurn("Change l’espacement de l’activité Vidéo A au minimum");
assert.equal(namedSpacingRequest.status, "incomplete");
assert.equal(namedSpacingRequest.question, "activity-spacing-target");
const typedSpacing = engine.parseDesignerConversationTurn("Toutes les activités Vidéo", namedSpacingRequest.draft);
assert.equal(typedSpacing.status, "ready");
assert.equal(typedSpacing.intent.operations[0].spacing, "minimum");
assert.deepEqual(engine.previewDesignerAction(project, typedSpacing.intent).targets.map((target) => target.blockId), ["video-a", "video-b"]);

const backgroundImage = engine.parseDesignerConversationTurn("Mets une image de fond pour toutes les activités");
assert.equal(backgroundImage.status, "incomplete");
assert.equal(backgroundImage.question, "activity-background-image");
assert.equal(backgroundImage.control, "image");
const completedBackgroundImage = engine.completeDesignerBackgroundImageSelection(backgroundImage.draft, "pending:fond.webp");
assert.equal(completedBackgroundImage.status, "ready");
const backgroundImagePreview = engine.previewDesignerAction(project, completedBackgroundImage.intent);
assert.deepEqual(backgroundImagePreview.targets.map((target) => target.blockId), ["video-a", "text-a", "note-a", "audio-a", "continue-a", "video-b", "text-b"]);
assert.ok(backgroundImagePreview.targets.every((target) => target.property === "sectionBackgroundImageRef"));

const videoBackgroundImage = engine.parseDesignerConversationTurn("Mets une image de fond sur les activités vidéo");
assert.equal(videoBackgroundImage.status, "incomplete");
assert.equal(videoBackgroundImage.draft.operations[0].target, "type");
assert.equal(videoBackgroundImage.draft.operations[0].activityType, "media");
const completedVideoBackgroundImage = engine.completeDesignerBackgroundImageSelection(videoBackgroundImage.draft, "pending:video.webp");
assert.equal(completedVideoBackgroundImage.status, "ready");
assert.deepEqual(engine.previewDesignerAction(project, completedVideoBackgroundImage.intent).targets.map((target) => target.blockId), ["video-a", "video-b"]);

const textBackgroundColor = engine.parseDesignerConversationTurn("Mets la couleur de fond des activités Texte en bleu");
assert.equal(textBackgroundColor.status, "ready");
assert.equal(textBackgroundColor.intent.operations[0].target, "type");
assert.equal(textBackgroundColor.intent.operations[0].activityType, "rich-text");
assert.deepEqual(engine.previewDesignerAction(project, textBackgroundColor.intent).targets.map((target) => target.blockId), ["text-a", "text-b"]);

const imageTextType = expectReady("Mets la couleur de fond de l’activité Image et texte en bleu", ["set-activity-background-color"]);
assert.equal(imageTextType.intent.operations[0].target, "type");
assert.equal(imageTextType.intent.operations[0].activityType, "image-text");
const unclearImageText = engine.parseDesignerConversationTurn("Mets la couleur de fond de l’activité image texte en bleu");
assert.equal(unclearImageText.status, "incomplete");
assert.equal(unclearImageText.question, "activity-background-target");
assert.match(DESIGNER_SLOT_REGISTRY[unclearImageText.question].fallback, /Quelles activités/);
const imageType = expectReady("Mets la couleur de fond de l’activité Image en bleu", ["set-activity-background-color"]);
assert.equal(imageType.intent.operations[0].activityType, "image");
const plainImageProject = { course: { modules: [{ chapters: [{ id: "plain-image-chapter", title: "Image", pages: [{ id: "plain-image-page", title: "Image", blocks: [{ id: "plain-image", type: "image", title: "Image" }] }] }] }] } };
assert.deepEqual(engine.previewDesignerAction(plainImageProject, imageType.intent).targets.map((target) => target.blockId), ["plain-image"]);
assert.equal(supportsActivityBackgroundProperty("image", "image"), false);
assert.equal(supportsActivityBackgroundProperty("image", "overlay"), false);
assert.equal(supportsActivityBackgroundProperty("image", "blur"), false);
const textType = expectReady("Mets la couleur de fond de l’activité Texte en bleu", ["set-activity-background-color"]);
assert.equal(textType.intent.operations[0].activityType, "rich-text");

for (const activity of PAIDEIA_ACTIVITY_CATALOG) {
  for (const wording of [`activité ${activity.name}`, `activités ${activity.name}`]) {
    const target = extractAppearanceActivityTarget(normalizeDesignerText(wording));
    assert.deepEqual(target, { target: "type", activityType: activity.blockType }, `${wording} doit cibler le type ${activity.blockType}`);
  }
  for (const alias of activity.aliases) {
    const wording = /^(?:activité|activités|bloc|blocs)\b/i.test(alias) ? alias : `activité ${alias}`;
    const target = extractAppearanceActivityTarget(normalizeDesignerText(wording));
    assert.deepEqual(target, { target: "type", activityType: activity.blockType }, `${wording} doit cibler le type ${activity.blockType}`);
  }
}

const appearanceMatrixProject = {
  course: { modules: [{ chapters: [{ id: "appearance-chapter", title: "Apparence", pages: [{ id: "appearance-page", title: "Apparence", blocks:
    ACTIVITY_BACKGROUND_BLOCK_TYPES.map((type) => ({ id: `appearance-${type}`, type, title: `Test ${type}` }))
  }] }] }] }
};
for (const blockType of ACTIVITY_BACKGROUND_BLOCK_TYPES) {
  const activity = PAIDEIA_ACTIVITY_CATALOG.find((entry) => entry.blockType === blockType);
  assert.ok(activity, `Le type ${blockType} doit exister dans le catalogue`);
  const expectedBlockId = `appearance-${blockType}`;
  const appearanceOperations = [
    [`Mets la couleur de fond des activités ${activity.name} en bleu`, blockType === "slides" ? "set-activity-frame-background-color" : "set-activity-background-color"],
    [`Mets le voile de fond des activités ${activity.name} sur léger`, "set-activity-background-overlay"],
    [`Mets le flou de fond des activités ${activity.name} sur léger`, "set-activity-background-blur"],
    [`Active le fond large des activités ${activity.name}`, "set-activity-background-wide"],
    [`Désactive les coins arrondis des activités ${activity.name}`, blockType === "slides" ? "set-activity-frame-rounded" : "set-activity-background-rounded"]
  ].filter(() => !["continue", "course-exit"].includes(blockType));
  for (const [phrase, operationKind] of appearanceOperations) {
    const result = expectReady(phrase, [operationKind]);
    assert.equal(result.intent.operations[0].target, "type", phrase);
    assert.equal(result.intent.operations[0].activityType, blockType, phrase);
    const preview = engine.previewDesignerAction(appearanceMatrixProject, result.intent);
    assert.deepEqual([...preview.targets, ...preview.unchanged].map((target) => target.blockId), [expectedBlockId], phrase);
  }
  if (supportsActivityBackgroundProperty(blockType, "height") && !["continue", "course-exit"].includes(blockType)) {
    const phrase = `Mets la hauteur d’apparence des activités ${activity.name} sur minimale`;
    const result = expectReady(phrase, ["set-activity-background-height"]);
    const preview = engine.previewDesignerAction(appearanceMatrixProject, result.intent);
    assert.deepEqual([...preview.targets, ...preview.unchanged].map((target) => target.blockId), [expectedBlockId], phrase);
  }
  if (supportsActivityBackgroundProperty(blockType, "image") && !["continue", "course-exit"].includes(blockType)) {
    const imagePhrase = `Mets une image de fond sur les activités ${activity.name}`;
    const imageResult = engine.parseDesignerConversationTurn(imagePhrase);
    assert.equal(imageResult.status, "incomplete", imagePhrase);
    assert.equal(imageResult.draft.operations[0].activityType, blockType, imagePhrase);
    const completedImage = engine.completeDesignerBackgroundImageSelection(imageResult.draft, "pending:matrix.webp");
    assert.equal(completedImage.status, "ready", imagePhrase);
    assert.deepEqual(engine.previewDesignerAction(appearanceMatrixProject, completedImage.intent).targets.map((target) => target.blockId), [expectedBlockId], imagePhrase);

    const removePhrase = `Supprime l’image de fond des activités ${activity.name}`;
    const removeResult = engine.parseDesignerConversationTurn(removePhrase);
    assert.equal(removeResult.status, "incomplete", removePhrase);
    assert.equal(removeResult.question, "reset-confirmation", removePhrase);
    assert.equal(removeResult.draft.operations[0].activityType, blockType, removePhrase);
    const confirmedRemoval = engine.parseDesignerConversationTurn("oui", removeResult.draft);
    assert.equal(confirmedRemoval.status, "ready", removePhrase);
    assert.deepEqual(
      [...engine.previewDesignerAction(appearanceMatrixProject, confirmedRemoval.intent).targets, ...engine.previewDesignerAction(appearanceMatrixProject, confirmedRemoval.intent).unchanged].map((target) => target.blockId),
      [expectedBlockId],
      removePhrase
    );
  }

  if (!["continue", "course-exit"].includes(blockType)) {
    const resetPhrase = `Réinitialise les paramètres d’apparence des activités ${activity.name}`;
    const resetResult = engine.parseDesignerConversationTurn(resetPhrase);
    assert.equal(resetResult.status, "incomplete", resetPhrase);
    assert.equal(resetResult.question, "reset-confirmation", resetPhrase);
    assert.equal(resetResult.draft.operations[0].activityType, blockType, resetPhrase);
    const confirmedResetForType = engine.parseDesignerConversationTurn("oui", resetResult.draft);
    assert.equal(confirmedResetForType.status, "ready", resetPhrase);
    const resetForTypePreview = engine.previewDesignerAction(appearanceMatrixProject, confirmedResetForType.intent);
    assert.ok([...resetForTypePreview.targets, ...resetForTypePreview.unchanged].every((target) => target.blockId === expectedBlockId), resetPhrase);
  }

  if (supportsActivityBackgroundProperty(blockType, "blur") && !["continue", "course-exit"].includes(blockType)) {
    const suggestions = engine.suggestDesignerActions(`flou activités ${activity.name}`, 5);
    assert.ok(suggestions.some((suggestion) => suggestion.command.includes(`activités ${activity.name}`)), `Les suggestions doivent cibler ${activity.name}`);
  }
}

const allCatalogTypesProject = {
  activitySpacingPx: 30,
  course: { modules: [{ chapters: [{ id: "spacing-chapter", title: "Espacement", pages: [{ id: "spacing-page", title: "Espacement", blocks:
    PAIDEIA_ACTIVITY_CATALOG.map((activity) => ({ id: `spacing-${activity.blockType}`, type: activity.blockType, title: `Test ${activity.blockType}` }))
  }] }] }] }
};
for (const activity of PAIDEIA_ACTIVITY_CATALOG) {
  const phrase = `Change l’espacement des activités ${activity.name} au maximum`;
  const result = expectReady(phrase, ["set-activity-spacing"]);
  assert.equal(result.intent.operations[0].activityType, activity.blockType, phrase);
  assert.deepEqual(engine.previewDesignerAction(allCatalogTypesProject, result.intent).targets.map((target) => target.blockId), [`spacing-${activity.blockType}`], phrase);
}
assert.ok(!engine.suggestDesignerActions("hauteur d’apparence activité Mise en situation", 8).some((suggestion) => suggestion.id === "activity-background-height"));
const imageTextSuggestions = engine.suggestDesignerActions("couleur fond activité Image et texte", 6);
assert.ok(imageTextSuggestions.some((suggestion) => suggestion.command === "Change la couleur du fond de toutes les activités Image et texte"));
assert.ok(imageTextSuggestions.every((suggestion) => !/\bde une activité\b/.test(suggestion.command)));

const catalogTargetProject = {
  course: { modules: [{ chapters: [{ id: "chapter-types", title: "Types", pages: [{ id: "page-types", title: "Types", blocks: [
    { id: "tabs-a", type: "tabs", title: "Onglets A" },
    { id: "accordion-a", type: "accordion", title: "Accordéon A" },
    { id: "video-c", type: "media", title: "Vidéo C" }
  ] }] }] }] }
};
const tabsBlur = expectReady("Mets le flou de fond de toutes les activités Onglets sur léger", ["set-activity-background-blur"]);
assert.equal(tabsBlur.intent.operations[0].target, "type");
assert.equal(tabsBlur.intent.operations[0].activityType, "tabs");
assert.deepEqual(engine.previewDesignerAction(catalogTargetProject, tabsBlur.intent).targets.map((target) => target.blockId), ["tabs-a"]);
const accordionSpacing = expectReady("Change l’espacement de toutes les activités Accordéon au maximum", ["set-activity-spacing"]);
assert.deepEqual(engine.previewDesignerAction(catalogTargetProject, accordionSpacing.intent).targets.map((target) => target.blockId), ["accordion-a"]);

const namedBackgroundImage = engine.parseDesignerConversationTurn("Mets une photo de fond pour l’activité Vidéo A");
assert.equal(namedBackgroundImage.status, "incomplete");
assert.equal(namedBackgroundImage.question, "activity-background-target");
const typedBackgroundImage = engine.parseDesignerConversationTurn("Toutes les activités Vidéo", namedBackgroundImage.draft);
const completedNamedBackgroundImage = engine.completeDesignerBackgroundImageSelection(typedBackgroundImage.draft, "pending:photo.png");
assert.equal(completedNamedBackgroundImage.status, "ready");
assert.deepEqual(engine.previewDesignerAction(project, completedNamedBackgroundImage.intent).targets.map((target) => target.blockId), ["video-a", "video-b"]);

const resetBackgrounds = engine.parseDesignerConversationTurn("Réinitialise tous les fonds d’activité");
assert.equal(resetBackgrounds.status, "incomplete");
assert.equal(resetBackgrounds.question, "reset-confirmation");
assert.equal(engine.parseDesignerConversationTurn("peut-être", resetBackgrounds.draft).question, "reset-confirmation");
assert.deepEqual(engine.parseDesignerConversationTurn("non", resetBackgrounds.draft), { status: "cancelled" });
const confirmedReset = engine.parseDesignerConversationTurn("oui", resetBackgrounds.draft);
assert.equal(confirmedReset.status, "ready");
const resetPreview = engine.previewDesignerAction(project, confirmedReset.intent);
assert.ok(resetPreview.targets.some((target) => target.blockId === "video-a" && target.property === "sectionBackgroundImageRef"));
assert.ok(resetPreview.targets.some((target) => target.blockId === "video-a" && target.property === "sectionBackgroundColor"));

const resetAppearance = engine.parseDesignerConversationTurn("Réinitialise les paramètres d'apparence de toutes les activités");
assert.equal(resetAppearance.status, "incomplete");
assert.equal(resetAppearance.question, "reset-confirmation");
assert.equal(resetAppearance.draft.operations[0].kind, "reset-activity-background");
assert.equal(engine.parseDesignerConversationTurn("je suis sûr", resetAppearance.draft).status, "ready");
assert.equal(engine.parseDesignerConversationTurn("fais-le", resetAppearance.draft).status, "ready");
assert.deepEqual(engine.parseDesignerConversationTurn("non", resetAppearance.draft), { status: "cancelled" });

const removeBackgroundImage = engine.parseDesignerConversationTurn("Supprime l'image de fond de toutes les activités");
assert.equal(removeBackgroundImage.status, "incomplete");
assert.equal(removeBackgroundImage.question, "reset-confirmation");
const confirmedImageRemoval = engine.parseDesignerConversationTurn("oui", removeBackgroundImage.draft);
assert.equal(confirmedImageRemoval.status, "ready");
assert.ok(engine.previewDesignerAction(project, confirmedImageRemoval.intent).targets.every((target) => target.property === "sectionBackgroundImageRef" && target.value === ""));

const namedAppearanceReset = engine.parseDesignerConversationTurn("Réinitialise les paramètres d'apparence de l'activité Vidéo A");
assert.equal(namedAppearanceReset.status, "incomplete");
assert.equal(namedAppearanceReset.question, "activity-background-target");
const typedAppearanceReset = engine.parseDesignerConversationTurn("Toutes les activités Vidéo", namedAppearanceReset.draft);
const confirmedNamedAppearanceReset = engine.parseDesignerConversationTurn("faites-le", typedAppearanceReset.draft);
assert.equal(confirmedNamedAppearanceReset.status, "ready");
assert.ok(engine.previewDesignerAction(project, confirmedNamedAppearanceReset.intent).targets.every((target) => ["video-a", "video-b"].includes(target.blockId)));

assert.equal(engine.parseDesignerConversationTurn("Supprime toutes les activités").status, "forbidden");
assert.equal(engine.parseDesignerConversationTurn("Supprime la leçon").status, "forbidden");
assert.equal(engine.parseDesignerConversationTurn("Supprime le chapitre 1").status, "forbidden");

const namedReset = engine.parseDesignerConversationTurn("Réinitialise le fond de l’activité Vidéo A");
assert.equal(namedReset.status, "incomplete");
assert.equal(namedReset.question, "activity-background-target");
const typedReset = engine.parseDesignerConversationTurn("Toutes les activités Vidéo", namedReset.draft);
const confirmedNamedReset = engine.parseDesignerConversationTurn("oui", typedReset.draft);
assert.equal(confirmedNamedReset.status, "ready");
assert.ok(engine.previewDesignerAction(project, confirmedNamedReset.intent).targets.every((target) => ["video-a", "video-b"].includes(target.blockId)));

const missingActivityColor = engine.parseDesignerConversationTurn("Change la couleur du fond de toutes les activités");
assert.equal(missingActivityColor.status, "incomplete");
assert.equal(missingActivityColor.question, "activity-background-color");
assert.equal(missingActivityColor.control, "color");
const completedActivityColor = engine.parseDesignerConversationTurn("rgb(229, 57, 53)", missingActivityColor.draft);
assert.equal(completedActivityColor.status, "ready");
assert.equal(completedActivityColor.intent.operations[0].color, "#E53935");
const transparentActivityColor = engine.parseDesignerConversationTurn("transparent", missingActivityColor.draft);
assert.equal(transparentActivityColor.status, "ready");
assert.equal(transparentActivityColor.intent.operations[0].color, "transparent");
const emptyActivityColor = engine.parseDesignerConversationTurn("vide", missingActivityColor.draft);
assert.equal(emptyActivityColor.status, "ready");
assert.equal(emptyActivityColor.intent.operations[0].color, "transparent");
const noActivityColor = engine.parseDesignerConversationTurn("sans", missingActivityColor.draft);
assert.equal(noActivityColor.status, "ready");
assert.equal(noActivityColor.intent.operations[0].color, "transparent");
const directTransparentActivityColor = engine.parseDesignerConversationTurn("Mets la couleur de fond de toutes les activités en transparent");
assert.equal(directTransparentActivityColor.status, "ready");
assert.equal(directTransparentActivityColor.intent.operations[0].color, "transparent");
const transparentActivityPreview = engine.previewDesignerAction(project, directTransparentActivityColor.intent);
assert.ok(transparentActivityPreview.targets.every((target) => target.property === "sectionBackgroundColor" && target.value === "" && target.unset === true && target.displayValue === "Sans"));
const activityColorPreview = engine.previewDesignerAction(project, completedActivityColor.intent);
assert.equal(activityColorPreview.targets.length, 7);
assert.ok(activityColorPreview.targets.every((target) => target.property === "sectionBackgroundColor"));

const overlay = expectReady("Mets le voile de fond de toutes les activités sur moyen", ["set-activity-background-overlay"]);
assert.ok(engine.previewDesignerAction(project, overlay.intent).targets.every((target) => target.value === "0.5"));
const blur = expectReady("Mets le flou de fond de toutes les activités sur fort", ["set-activity-background-blur"]);
assert.ok(engine.previewDesignerAction(project, blur.intent).targets.every((target) => target.value === "12"));
const wide = expectReady("Active le fond large de toutes les activités", ["set-activity-background-wide"]);
assert.ok(engine.previewDesignerAction(project, wide.intent).targets.every((target) => target.value === "true"));
assert.ok(engine.previewDesignerAction(project, wide.intent).targets.every((target) => !/true|false/.test(`${target.previousDisplayValue} ${target.displayValue}`)));
const rounded = expectReady("Désactive les coins arrondis de toutes les activités", ["set-activity-background-rounded"]);
assert.ok(engine.previewDesignerAction(project, rounded.intent).targets.every((target) => target.value === "false"));
const appearanceHeight = expectReady("Mets la hauteur d’apparence de toutes les activités sur grande", ["set-activity-background-height"]);
assert.ok(engine.previewDesignerAction(project, appearanceHeight.intent).targets.every((target) => target.value === "large"));
const encodedLabelProject = {
  course: { modules: [{ chapters: [{ id: "encoded-chapter", title: "P&Eacute;DAGOGIE", pages: [{ id: "encoded-page", title: "Pr&eacute;sentation", blocks: [{ id: "encoded-video", type: "media", title: "MODULARIT&Eacute;" }] }] }] }] }
};
const encodedLabelPreview = engine.previewDesignerAction(encodedLabelProject, appearanceHeight.intent);
assert.equal(encodedLabelPreview.targets[0]?.blockTitle, "MODULARITÉ · Hauteur");
assert.equal(encodedLabelPreview.targets[0]?.chapterTitle, "PÉDAGOGIE");
assert.equal(encodedLabelPreview.targets[0]?.pageTitle, "Présentation");

const namedAppearance = engine.parseDesignerConversationTurn("Mets le flou de fond de l’activité Vidéo A sur léger");
assert.equal(namedAppearance.status, "incomplete");
assert.equal(namedAppearance.question, "activity-background-target");
assert.deepEqual(engine.parseDesignerConversationTurn("non", namedAppearance.draft), { status: "cancelled" });

const chainedAppearance = expectReady(
  "Pour toutes les activités, couleur du fond rouge, voile moyen, flou léger, active le fond large, désactive les coins arrondis, hauteur grande",
  ["set-activity-background-color", "set-activity-background-overlay", "set-activity-background-blur", "set-activity-background-wide", "set-activity-background-rounded", "set-activity-background-height"]
);
assert.equal(chainedAppearance.intent.operations.length, 6);

const situationalProject = {
  course: { modules: [{ chapters: [{ id: "chapter-s", title: "S", pages: [{ id: "page-s", title: "Page S", blocks: [{ id: "dialogue-s", type: "situational-dialogue", title: "Dialogue", panelRounded: false }] }] }] }] }
};
const situationalRoundedPreview = engine.previewDesignerAction(situationalProject, rounded.intent);
assert.equal(situationalRoundedPreview.unchanged[0].property, "panelRounded");
assert.equal(engine.previewDesignerAction(situationalProject, appearanceHeight.intent).targets.length, 0);
assert.deepEqual(
  engine.unsupportedDesignerAppearanceOperations(situationalProject, appearanceHeight.intent).map((operation) => operation.kind),
  ["set-activity-background-height"]
);
assert.equal(engine.unsupportedDesignerAppearanceOperations(situationalProject, rounded.intent).length, 0);

const missingAppearanceTarget = engine.parseDesignerConversationTurn("Change la couleur du fond en bleu");
assert.equal(missingAppearanceTarget.status, "incomplete");
assert.equal(missingAppearanceTarget.question, "activity-background-target");
const completedAppearanceTarget = engine.parseDesignerConversationTurn("toutes les activités", missingAppearanceTarget.draft);
assert.equal(completedAppearanceTarget.status, "ready");
assert.equal(completedAppearanceTarget.intent.operations[0].target, "all");

const continueBackground = expectReady("Mets tous les boutons Continuer en bleu", ["set-continue-button-background"]);
assert.equal(continueBackground.intent.operations[0].color, "#1D7DDC");
const continueTextColor = expectReady("Change la couleur de la police de tous les boutons Continuer en blanc", ["set-continue-button-text-color"]);
assert.equal(continueTextColor.intent.operations[0].color, "#FFFFFF");
const continueLabel = expectReady("Remplace le texte de tous les boutons Continuer par « Suivant »", ["set-continue-button-label"]);
assert.equal(continueLabel.intent.operations[0].label, "Suivant");
const chainedContinue = expectReady(
  "Dans ce chapitre, mets les boutons Continuer en #46619D, leur texte en blanc et remplace leur libellé par « Suivant »",
  ["set-continue-button-background", "set-continue-button-text-color", "set-continue-button-label"]
);
assert.equal(chainedContinue.intent.scope, "chapter");
const continuePreview = engine.previewDesignerAction(project, continueLabel.intent);
assert.deepEqual(continuePreview.targets.map((target) => target.property), ["continueButtonLabel"]);
const continueReset = engine.parseDesignerConversationTurn("Réinitialise l’apparence et le libellé de tous les boutons Continuer");
assert.equal(continueReset.status, "incomplete");
assert.equal(continueReset.question, "reset-confirmation");
assert.equal(engine.parseDesignerConversationTurn("fais-le", continueReset.draft).status, "ready");
assert.equal(engine.parseDesignerConversationTurn("non", continueReset.draft).status, "cancelled");
const removeContinueTextColor = engine.parseDesignerConversationTurn("Supprime la couleur du texte de tous les boutons Continuer");
assert.equal(removeContinueTextColor.status, "incomplete");
assert.equal(removeContinueTextColor.draft.operations[0].property, "text-color");
assert.equal(engine.parseDesignerConversationTurn("Supprime tous les boutons Continuer").status, "forbidden");

const resetVideoCaptions = engine.parseDesignerConversationTurn("Réinitialise les sous-titres de toutes les vidéos");
assert.equal(resetVideoCaptions.status, "incomplete");
assert.equal(resetVideoCaptions.question, "reset-confirmation");
const confirmedVideoCaptions = engine.parseDesignerConversationTurn("oui", resetVideoCaptions.draft);
assert.equal(confirmedVideoCaptions.status, "ready");
assert.deepEqual(confirmedVideoCaptions.intent.operations.map((operation) => operation.kind), ["reset-video-caption-color", "reset-video-caption-background", "reset-video-caption-outline"]);
const resetVideoCaptionPreview = engine.previewDesignerAction(project, confirmedVideoCaptions.intent);
assert.ok(resetVideoCaptionPreview.targets.every((target) => target.blockId === "video-a" || target.blockId === "video-b"));
assert.ok(resetVideoCaptionPreview.targets.every((target) => target.unset === true));
assert.ok(engine.inverseDesignerChanges(resetVideoCaptionPreview).every((change) => change.unset === false));
const resetTextSize = engine.parseDesignerConversationTurn("Réinitialise la taille de police de toutes les activités Texte");
assert.equal(resetTextSize.status, "incomplete");
const confirmedTextSize = engine.parseDesignerConversationTurn("fais-le", resetTextSize.draft);
assert.equal(confirmedTextSize.status, "ready");
assert.ok(engine.previewDesignerAction(project, confirmedTextSize.intent).targets.every((target) => target.property === "textActivityContentHtml"));
const resetSpacing = engine.parseDesignerConversationTurn("Réinitialise l’espacement de toutes les activités vidéo");
assert.equal(resetSpacing.status, "incomplete");
const confirmedSpacing = engine.parseDesignerConversationTurn("oui", resetSpacing.draft);
assert.equal(confirmedSpacing.status, "ready");
assert.ok(engine.previewDesignerAction(project, confirmedSpacing.intent).targets.every((target) => target.property === "paddingOffset"));
assert.ok(engine.previewDesignerAction(project, confirmedSpacing.intent).targets.every((target) => target.unset === true));

const purposeHelp = engine.parseDesignerConversationTurn("À quoi sert l’activité Chercher dans l’image ?");
assert.equal(purposeHelp.status, "help");
const contextualHelp = engine.parseDesignerConversationTurn("activité Texte", null, "lesson", undefined, "help");
assert.equal(contextualHelp.status, "help");
const contextualMassAction = engine.parseDesignerConversationTurn("couleur du fond de toutes les activités", null, "lesson", undefined, "actions");
assert.equal(contextualMassAction.status, "incomplete");
assert.equal(contextualMassAction.draft.context, "activity-background");
for (const activity of PAIDEIA_ACTIVITY_CATALOG) {
  const neutralActivity = engine.parseDesignerConversationTurn(activity.name, null, "lesson", undefined, "auto");
  assert.equal(neutralActivity.status, "incomplete", `${activity.name} doit demander Aide ou Modifier en contexte neutre`);
  assert.equal(neutralActivity.question, "activity-intent-choice");
  assert.deepEqual(neutralActivity.draft.candidateCommands, [
    `Aide sur l’activité ${activity.name}`,
    `Modifier les activités ${activity.name}`
  ]);
  const actionActivity = engine.parseDesignerConversationTurn(activity.name, null, "lesson", undefined, "actions");
  assert.equal(actionActivity.status, "incomplete", `${activity.name} doit demander le réglage en contexte Modifier`);
  assert.equal(actionActivity.question, "activity-property");
}
for (const simpleModifyRequest of ["Modifie activité vidéo", "Change l’activité vidéo", "Édite la vidéo", "Réglage vidéo"]) {
  const result = engine.parseDesignerConversationTurn(simpleModifyRequest, null, "lesson", undefined, "actions");
  assert.equal(result.status, "incomplete", simpleModifyRequest);
  assert.equal(result.question, "activity-property", simpleModifyRequest);
  assert.equal(result.draft.activityType, "media", simpleModifyRequest);
}
const neutralHeader = engine.parseDesignerConversationTurn("en tête", null, "lesson", undefined, "auto");
const headerHelpChoice = engine.parseDesignerConversationTurn("Aide sur l’activité En-tête", neutralHeader.draft);
assert.equal(headerHelpChoice.status, "help");
assert.equal(headerHelpChoice.response.subjectId, "activite-en-tete-1");
assert.ok(headerHelpChoice.response.relatedTopics.some((topic) => topic.command.startsWith("Rubrique suivante")));
assert.ok(headerHelpChoice.response.relatedTopics.some((topic) => topic.command === "Toutes les rubriques de cette aide"));
assert.deepEqual(suggestDesignerHelp("en tête").map((item) => item.id), ["documentation:activite-en-tete-1"]);
assert.ok(!suggestDesignerHelp("garder en tête").some((item) => item.id === "documentation:estimation-de-duree-d-une-lecon-8"));
assert.ok(suggestDesignerHelp("estimation durée limites à garder en tête").some((item) => item.id === "documentation:estimation-de-duree-d-une-lecon-8"));
const allHeaderTopics = engine.parseDesignerConversationTurn("Toutes les rubriques de cette aide", {
  context: "help",
  scope: "lesson",
  operations: [],
  pendingSlots: ["help-related"],
  candidateCommands: headerHelpChoice.response.relatedTopics.map((topic) => topic.command),
  candidateSubjectIds: headerHelpChoice.response.relatedTopics.map((topic) => topic.id)
});
assert.equal(allHeaderTopics.status, "incomplete");
assert.equal(allHeaderTopics.question, "help-choice");
assert.ok(allHeaderTopics.draft.candidateCommands.length > 1);
const headerGroupId = DESIGNER_DOCUMENTATION_REGISTRY.find((entry) => entry.id === "activite-en-tete-1")?.groupId;
const headerGroup = DESIGNER_DOCUMENTATION_REGISTRY.filter((entry) => entry.groupId === headerGroupId);
const finalHeaderHelp = resolveDesignerHelpSubject(headerGroup.at(-1).id);
assert.match(finalHeaderHelp.text, /dernière rubrique de cette aide/i);
assert.ok(finalHeaderHelp.relatedTopics.some((topic) => topic.command.startsWith("Rubrique précédente")));
assert.ok(!finalHeaderHelp.relatedTopics.some((topic) => topic.command.startsWith("Rubrique suivante")));
assert.ok(finalHeaderHelp.relatedTopics.some((topic) => topic.command === "Toutes les rubriques de cette aide"));
assert.equal(purposeHelp.response.subjectId, "activity.find-elements");
assert.match(purposeHelp.response.text, /observation/i);
const detailsHelp = engine.parseDesignerConversationTurn("Dis-m’en plus sur les Points d’intérêt");
assert.equal(detailsHelp.status, "help");
assert.equal(detailsHelp.response.subjectId, "activite-points-d-interet-1");
const howToHelp = engine.parseDesignerConversationTurn("Comment générer les sous-titres avec Whisper ?");
assert.equal(howToHelp.status, "help");
assert.equal(howToHelp.response.subjectId, "procedure.video-captions");
assert.ok(DESIGNER_DOCUMENTATION_REGISTRY.every((entry) => !/docs[\\/]/i.test(JSON.stringify(entry))), "L’index embarqué ne doit exposer aucun chemin documentaire source");
const diagnostic = engine.diagnoseDesignerConversation("Change la couleur des sous-titres en rouge");
assert.equal(diagnostic.mode, "action");
assert.deepEqual(diagnostic.operations, ["set-video-caption-color"]);
assert.ok(diagnostic.candidates.some((candidate) => candidate.id === "video-caption-color"));
assert.equal(diagnostic.resolverId, "video");
assert.ok(diagnostic.resolverCapabilityIds.includes("video-caption-color"));
assert.equal(new Set(DESIGNER_CAPABILITIES.map((capability) => capability.id)).size, DESIGNER_CAPABILITIES.length);
const resolvedCapabilityIds = DESIGNER_INTENT_RESOLVERS.flatMap((resolver) => resolver.capabilityIds);
assert.equal(new Set(resolvedCapabilityIds).size, resolvedCapabilityIds.length);
for (const capability of DESIGNER_CAPABILITIES.filter((entry) => entry.operationKinds.length)) {
  assert.ok(resolvedCapabilityIds.includes(capability.id), `${capability.id} must have one intent resolver`);
}
assert.equal(new Set(PAIDEIA_ACTIVITY_CATALOG.map((entry) => entry.id)).size, PAIDEIA_ACTIVITY_CATALOG.length);
assert.equal(new Set(PAIDEIA_ACTIVITY_CATALOG.map((entry) => entry.blockType)).size, PAIDEIA_ACTIVITY_CATALOG.length);
for (const capability of DESIGNER_CAPABILITIES.filter((entry) => entry.operationKinds.some((kind) => kind.startsWith("set-")))) {
  assert.ok(capability.resetAction, `${capability.id} must declare a reset action`);
  assert.ok(DESIGNER_CAPABILITIES.some((candidate) => candidate.id === capability.resetAction), `${capability.id} reset action must exist`);
}

const panelSource = readFileSync(new URL("../src/features/designer-actions/DesignerActionsPanel.tsx", import.meta.url), "utf8");
assert.doesNotMatch(panelSource, /command\.trim\(\) \? 0 : null/u, "Arion must not preselect the first suggestion");
assert.match(panelSource, /event\.key === "Tab"[\s\S]{0,500}setActiveSuggestionIndex/u, "Tab must explicitly select a suggestion before Enter can execute it");
assert.match(panelSource, /actionsAvailable && !question/u, "The action catalog must be hidden when no lesson is open");
assert.match(panelSource, /actionsAvailable \? <details className="designer-actions-frequent">/u, "Frequent actions must be hidden when no lesson is open");
assert.doesNotMatch(panelSource, /setHistory\(\[\]\);?\s*\}, \[labels\.scope\]/u, "Navigation must preserve Arion's conversation history");
assert.match(panelSource, /allowTransparent=\{questionSlot === "activity-background-color"[\s\S]{0,180}"header-background-color"\}/u, "Arion must expose the transparent choice for activity and header backgrounds");
assert.doesNotMatch(panelSource, /designer-actions-mode-switch/u, "Arion context selection must remain conversational, without a physical selector");
assert.match(panelSource, /requestsHelpMode/u, "Written help requests must select Arion's help context");
assert.match(panelSource, /actionModePrefix/u, "Written mass-action requests must select Arion's action context");
assert.match(panelSource, /actionVerbPattern\s*=\s*\/\^\(\?:modifier\|modifie\|changer\|change/u, "Action verbs must select Arion's mass-action context");
assert.match(panelSource, /suggestDesignerActions\(command, 6, translate\)/u, "Mass-actions mode must prioritize executable suggestions");
assert.match(panelSource, /if \(questionSlot \|\| !command\.trim\(\)\) return \[\]/u, "Suggestions must stay hidden for an empty command and during guided questions");
assert.match(panelSource, /setInputFocused\(false\);[\s\S]{0,100}\}, 1500\)/u, "Inactive suggestions must close after 1.5 seconds");
assert.match(panelSource, /onScroll=\{\(\) => setSuggestionsInteractionVersion/u, "Scrolling suggestions must count as interaction");

const stylesSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
assert.match(stylesSource, /\.designer-actions-suggestions\s*\{[\s\S]{0,180}top:\s*auto[\s\S]{0,120}bottom:\s*calc\(100% \+ 6px\)/u, "Suggestions must open above the command field");
assert.match(stylesSource, /\.designer-actions-suggestions\s*\{[\s\S]{0,320}max-height:\s*174px[\s\S]{0,100}overflow-y:\s*auto/u, "Suggestions must remain short and independently scrollable");

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
assert.match(appSource, /const isArionAvailable = !isPreviewMode && appLanguage === "fr"/u, "Arion must be available on every internal French screen except LMS preview");
assert.match(appSource, /\{isArionAvailable \? \([\s\S]{0,500}designer-actions-trigger/u, "The global Arion launcher must use the application-level availability contract");
assert.match(appSource, /actionsAvailable: areDesignerActionsAvailable/u, "The panel must distinguish global assistance from lesson actions");
assert.match(appSource, /if \(!activeDraft && !designerActionPreview\)[\s\S]{0,260}setDesignerActionCommand/u, "A social interjection must preserve an active request or preview");
assert.match(appSource, /preview: designerSocialTurnActive \? null : designerActionPreview/u, "A social turn must temporarily hide a pending action preview");
assert.match(appSource, /questionSlot: designerSocialTurnActive \? null : designerActionQuestion/u, "A social turn must not display stale functional choices beneath its response");
assert.doesNotMatch(panelSource, /resolveDesignerHelp\(next, translate\) !== null/u, "The panel must not duplicate documentation choices already returned by the conversation engine");
assert.match(panelSource, /former local lookup here duplicated choices[\s\S]{0,100}setDocumentationChoices\(\[\]\)/u, "Legacy local documentation choices must be cleared");
assert.doesNotMatch(appSource, /async function analyzeDesignerCommand\(command: string\) \{\s*if \(!project\) return/u, "Social and help routing must work without an active project");
assert.match(appSource, /event\.altKey\s*&&\s*!event\.ctrlKey\s*&&\s*!event\.metaKey\s*&&\s*!event\.shiftKey[\s\S]{0,120}===\s*"a"/u, "Alt+A alone must toggle Arion");
assert.doesNotMatch(appSource, /event\.ctrlKey\s*&&\s*event\.altKey[\s\S]{0,120}===\s*"a"/u, "Ctrl+Alt+A must no longer be the Arion shortcut");

console.log("Assistant concepteur : corpus conversationnel valide.");
await vite.close();
