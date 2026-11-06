import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [app, panel, styles, projectTypes, projectApi, pdfModel, tauriCommands] = await Promise.all([
  read("src/App.tsx"),
  read("src/components/lesson-editor/LessonSettingsPanel.tsx"),
  read("src/styles.css"),
  read("src/types/project.ts"),
  read("src/lib/projectApi.ts"),
  read("src/export/pdf/buildLessonPdfModel.ts"),
  read("src-tauri/src/commands.rs")
]);

assert.match(projectTypes, /hideChapterTitleBanner\?: boolean/);
assert.match(projectApi, /hideChapterTitleBanner: input\.hideChapterTitleBanner \?\? null/);
assert.match(panel, /lessonSettings\.otherSettings/);
assert.match(panel, /lessonSettings\.hideChapterTitleBanner/);
assert.match(panel, /className="lesson-appearance-toggle"/);
assert.match(panel, /checked=\{project\?\.hideChapterTitleBanner === true\}/);
assert.match(app, /function previewChapterStartSelector/);
assert.match(app, /project\?\.hideChapterTitleBanner/);
assert.match(app, /chapter-title-banner-hidden/);
assert.match(app, /activePage\?\.blocks\[previewVisibleStartIndex\]\?\.type === "header"/);
assert.match(app, /preview-starts-with-header/);
assert.match(app, /tabIndex=\{isPreviewMode \? -1 : undefined\}/);
assert.match(styles, /\.preview-mode \.preview-chapter-header\.chapter-title-banner-hidden/);
assert.match(styles, /\.preview-mode \.authoring-stage\.preview-starts-with-header:not\(\.preview-viewport-active\)/);
assert.match(styles, /clip-path: inset\(50%\)/);
assert.match(styles, /\.linear-block\.block-type-header \.header-banner/);
assert.doesNotMatch(styles, /\.linear-block\.header-block \.header-banner/);
assert.match(tauriCommands, /if project\.hide_chapter_title_banner/);
assert.match(tauriCommands, /chapter-header chapter-header-visually-hidden/);
assert.match(tauriCommands, /\.scorm-export\.chapter-active \.shell \{\{ padding-top:0; \}\}/);
assert.match(tauriCommands, /\.block-spacing-shell-header \{\{ padding-block:0; \}\}/);
assert.match(tauriCommands, /chapterNode\.classList\.contains\("block-spacing-shell-header"\)/);
assert.match(tauriCommands, /return chapterNode/);
assert.doesNotMatch(pdfModel, /hideChapterTitleBanner/);

console.log("Option de bandeau de chapitre : opt-in, aperçu/SCORM et PDF inchangé vérifiés.");
