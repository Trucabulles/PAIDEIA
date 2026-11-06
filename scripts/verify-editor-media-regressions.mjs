import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveCropOutputPlacement } from "../src/app/croppedImageOutput.ts";
import { sanitizePointOfInterestMarkerLabel } from "../src/components/activities/PointOfInterestActivity/markerLabel.ts";
import { imageGridImageShouldContain } from "../src/components/activities/ImageGridActivity/imagePresentation.ts";
import { resolveContinueNavigationAction } from "../src/components/lesson-editor/continueNavigation.ts";

assert.equal(resolveContinueNavigationAction({
  hasNextBlock: false,
  hasNextChapter: false,
  isLastChapter: true,
  isPreviewMode: false
}), "none", "a terminal Continue must never close the authoring window");
assert.equal(resolveContinueNavigationAction({
  hasNextBlock: false,
  hasNextChapter: true,
  isLastChapter: false,
  isPreviewMode: false
}), "next-chapter", "the terminal Continue may open the next chapter while authoring");
assert.equal(resolveContinueNavigationAction({
  hasNextBlock: true,
  hasNextChapter: true,
  isLastChapter: false,
  isPreviewMode: false
}), "none", "an intermediate Continue stays inert while authoring");
assert.equal(resolveContinueNavigationAction({
  hasNextBlock: true,
  hasNextChapter: false,
  isLastChapter: true,
  isPreviewMode: true
}), "reveal-next-block", "learner preview still reveals the next block");
assert.equal(resolveContinueNavigationAction({
  hasNextBlock: false,
  hasNextChapter: false,
  isLastChapter: true,
  isPreviewMode: true
}), "complete-preview", "the final learner Continue stays visible without exiting the course");

assert.deepEqual(resolveCropOutputPlacement(800, 400, true), {
  canvasHeight: 800,
  canvasWidth: 800,
  drawX: 0,
  drawY: 200
}, "a landscape crop must be entirely contained in a square transparent canvas");
assert.deepEqual(resolveCropOutputPlacement(300, 600, true), {
  canvasHeight: 600,
  canvasWidth: 600,
  drawX: 150,
  drawY: 0
}, "a portrait crop must be entirely contained in a square transparent canvas");
assert.deepEqual(resolveCropOutputPlacement(800, 400, false), {
  canvasHeight: 400,
  canvasWidth: 800,
  drawX: 0,
  drawY: 0
}, "other activities must keep their current crop geometry");
assert.equal(imageGridImageShouldContain("photo_cropped_1789059630123.png"), true);
assert.equal(imageGridImageShouldContain("photo.png"), false);

assert.equal(sanitizePointOfInterestMarkerLabel("!?"), "!?");
assert.equal(sanitizePointOfInterestMarkerLabel("10"), "10");
assert.equal(sanitizePointOfInterestMarkerLabel("😀"), "");
assert.equal(sanitizePointOfInterestMarkerLabel("☺️"), "");
assert.equal(sanitizePointOfInterestMarkerLabel("👨‍👩‍👧‍👦"), "");
assert.equal(sanitizePointOfInterestMarkerLabel("🇫🇷"), "");
assert.equal(sanitizePointOfInterestMarkerLabel("1️⃣"), "");
assert.equal(sanitizePointOfInterestMarkerLabel("A😀B"), "AB");

const pointOfInterestEditorSource = readFileSync(new URL("../src/components/activities/PointOfInterestActivity/PointOfInterestActivityEditorPanel.tsx", import.meta.url), "utf8");
assert.match(
  pointOfInterestEditorSource,
  /if \(allLabelsAreAutomatic\) \{\s*return firstLabel;/u,
  "the automatic point-of-interest sequence must keep 1 visible and editable"
);

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const appChromeSource = readFileSync(new URL("../src/components/app/AppChrome.tsx", import.meta.url), "utf8");
const projectLibraryCardsSource = readFileSync(new URL("../src/components/project-library/ProjectLibraryCards.tsx", import.meta.url), "utf8");
const richTableStyles = readFileSync(new URL("../src/components/rich-text-table/RichTextTable.css", import.meta.url), "utf8");
assert.match(
  richTableStyles,
  /body\.rich-text-dialog-open \.rich-table-menu-launcher,[\s\S]{0,180}visibility: hidden;[\s\S]{0,80}pointer-events: none;/u,
  "table controls portaled above the editor must be hidden while a rich-text modal is open"
);
assert.match(
  projectLibraryCardsSource,
  /className="library-rail-add-button"[\s\S]{0,180}<svg[^>]+viewBox="0 0 24 24"[\s\S]{0,100}M12 6v12M6 12h12/u,
  "the create-lesson control must use a geometrically centered SVG plus instead of a font glyph"
);
assert.match(appSource, /"restore-snapshot",\s*"create-snapshot"/u, "read-only projects must reject snapshot creation and restoration");
assert.match(appSource, /canEditProject=\{!workspaceState\?\.readOnly\}/u, "the application chrome must receive the effective project edit capability");
assert.match(appChromeSource, /isProjectWorkspaceActive && canEditProject/u, "authoring controls must stay hidden in a read-only LMS preview");
const blockRenderSource = readFileSync(new URL("../src/components/lesson-editor/BlockRender.tsx", import.meta.url), "utf8");
const completeActivitySource = readFileSync(new URL("../src/components/activities/CompleteActivity/CompleteActivity.tsx", import.meta.url), "utf8");
const completeActivityStyles = readFileSync(new URL("../src/components/activities/CompleteActivity/CompleteActivity.module.css", import.meta.url), "utf8");
const tauriCommandsSource = readFileSync(new URL("../src-tauri/src/commands.rs", import.meta.url), "utf8");
const quizEditorSource = readFileSync(new URL("../src/components/activities/QuizActivity/QuizActivityEditor.tsx", import.meta.url), "utf8");
const noteActivitySource = readFileSync(new URL("../src/components/activities/NoteActivity/NoteActivity.tsx", import.meta.url), "utf8");
const noteEditorSource = readFileSync(new URL("../src/components/activities/NoteActivity/NoteActivityEditor.tsx", import.meta.url), "utf8");
const noteIconSource = readFileSync(new URL("../src/components/activities/NoteActivity/noteIcons.tsx", import.meta.url), "utf8");
const noteStylesSource = readFileSync(new URL("../src/components/activities/NoteActivity/NoteActivity.module.css", import.meta.url), "utf8");
const riseImporterSource = readFileSync(new URL("../src-tauri/src/importer.rs", import.meta.url), "utf8");
assert.match(
  quizEditorSource,
  /function editableTextFromHtml[\s\S]{0,400}container\.textContent[\s\S]{0,120}replace\(\/\\u00a0\/g, " "\)/u,
  "the controlled quiz title must preserve the trailing space being typed between words"
);
assert.match(noteIconSource, /NOTE_ICON_IDS[\s\S]{0,500}"info-circle"[\s\S]{0,500}"warning-triangle"[\s\S]{0,500}"check"/u, "Note must expose the seven agreed inline SVG pictograms");
assert.match(noteEditorSource, /role="radiogroup"[\s\S]{0,1800}type="radio"/u, "Note pictograms must use an accessible radio selection grid");
assert.match(noteEditorSource, /Afficher le pictogramme/u, "Note must allow its pictogram to be hidden");
assert.match(noteEditorSource, /Couleur de bordure[\s\S]{0,1200}Couleur du pictogramme[\s\S]{0,1200}Identique à la bordure/u, "Note must expose separate border and pictogram colors with an explicit linkage option");
assert.match(noteEditorSource, /disabled=\{!showIcon \|\| iconMatchesBorder\}/u, "the Note pictogram color picker must be disabled while hidden or linked to the border");
assert.match(noteActivitySource, /showIcon \? <NoteIconSvg[\s\S]{0,180}: null/u, "a hidden Note pictogram must not leave an icon node behind");
assert.match(noteStylesSource, /\.withoutIcon\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/u, "a hidden Note pictogram must not reserve an empty column");
assert.match(riseImporterSource, /note_icon:\s*\(native_type == "note"\)\.then\(\|\| "info-circle"\.to_string\(\)\)[\s\S]{0,100}note_show_icon:\s*\(native_type == "note"\)\.then_some\(true\)/u, "Rise Note rematching must retain the historical visible information pictogram by default");
assert.match(
  quizEditorSource,
  /const editableQuizTitle = editableTextFromHtml\(quiz\.titleHtml\);[\s\S]{0,180}quiz\.titleMode === "custom" && storedQuizTitle \? editableQuizTitle : automaticTitle/u,
  "the quiz title input must render its editable value instead of the normalized display label"
);
assert.match(completeActivitySource, /style=\{\{ width: "max-content" \}\}/u, "complete dropdown triggers must fit their rendered selected response naturally");
assert.match(completeActivitySource, /longestTextWidth[\s\S]{0,300}setMenuWidth\(Math\.max\(96, Math\.min\(440/u, "complete dropdown menus must size from their longest rendered option");
assert.match(completeActivitySource, /createPortal\([\s\S]{0,1600}role="option"/u, "complete dropdowns must use the styled PAIDEIA listbox instead of a native popup");
assert.match(completeActivityStyles, /\.blankSelectOption\s*\{[\s\S]{0,180}padding:6px 24px 6px 10px/u, "complete dropdown options must preserve right-side breathing room");
assert.doesNotMatch(completeActivitySource, /styles\.blankSelect[\s\S]{0,240}width:\s*`\$\{width\}ch`/u, "complete dropdowns must not use inaccurate ch widths");
assert.match(completeActivityStyles, /\.cover\s*\{[\s\S]{0,260}grid-template-rows:auto minmax\(0,1fr\) auto/u, "the complete cover title row must grow with the chosen font size");
assert.match(tauriCommandsSource, /function fitSelectWidth\(field\)[\s\S]{0,800}measureText\(label\)/u, "SCORM complete dropdowns must use the same proportional-font sizing rule");
assert.match(
  richTableStyles,
  /@container \(max-width: 720px\)[\s\S]{0,900}data-paideia-responsive-table="true"[\s\S]{0,160}width: max-content !important;[\s\S]{0,180}max-width: none !important;[\s\S]{0,260}min-width: 9rem;/u,
  "mobile PAIDEIA tables must preserve readable columns inside their own horizontal scroller"
);
assert.doesNotMatch(
  richTableStyles,
  /@(?:media|container) \(max-width: 720px\)[\s\S]{0,900}\.paideia-rich-table td \{ min-width: 0;/u,
  "mobile PAIDEIA tables must never squeeze cells until their text overlaps"
);
assert.match(
  tauriCommandsSource,
  /@container \(max-width:720px\)[^\n]+data-paideia-responsive-table="true"[^\n]+width:max-content !important; min-width:100%; max-width:none !important; table-layout:auto;[^\n]+min-width:9rem;/u,
  "SCORM must carry the same readable mobile table contract as the PAIDEIA preview"
);
assert.match(
  tauriCommandsSource,
  /function setupResponsiveRichTables\(root\)[\s\S]{0,1200}data-paideia-layout[\s\S]{0,1200}paideia-responsive-table-scroll/u,
  "SCORM must wrap pasted tables at render time without converting their stored Rich Text"
);
const exitCourseSource = appSource.slice(
  appSource.indexOf("  function exitCourse()"),
  appSource.indexOf("  function addActivityItem()")
);
assert.ok(exitCourseSource.includes("scrollToLessonMenu();"), "course exit must return the authoring interface to its chapter menu");
assert.ok(!exitCourseSource.includes("window.close();"), "course exit must not close the authoring window");
assert.doesNotMatch(
  blockRenderSource,
  /block\.type === "course-exit"[\s\S]{0,160}authoringMode[\s\S]{0,40}\? undefined/u,
  "course exit must remain interactive while authoring"
);
assert.match(
  blockRenderSource,
  /filter\(\(assetRef\) => assetRef !== block\.sectionBackgroundImageRef\)/u,
  "an activity background reference must never be rendered as Rich Text content media"
);
assert.match(
  blockRenderSource,
  /block\.type === "rich-text" && block\.sourceFormat === "rise-scorm"[\s\S]{0,160}filter\(\(assetRef\) => !isSupportedImageAsset\(assetRef\)\)/u,
  "only Rise text blocks must hide collected images from Rich Text content media"
);

console.log("Editor navigation, quiz title spacing, image-grid crop output and point-of-interest labels: OK.");

await import("./verify-complete-final-review.mjs");
