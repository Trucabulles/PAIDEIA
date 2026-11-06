import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const htmlSandbox = await read("public/html-sandbox.html");

const [app, commands, styles, richTableCss, previewViewport, pointOfInterest, imageActivity, customHtmlPreview, tabsCss, tabsActivity, blockRender, image360Css, dialogueCss, navigationCss, navigationEditor, navigationButtonLabel] = await Promise.all([
  read("src/App.tsx"),
  read("src-tauri/src/commands.rs"),
  read("src/styles.css"),
  read("src/components/rich-text-table/RichTextTable.css"),
  read("src/components/resources/preview/PreviewViewport.tsx"),
  read("src/components/activities/PointOfInterestActivity/PointOfInterestActivity.tsx"),
  read("src/components/activities/ImageActivity/ImageActivity.tsx"),
  read("src/components/app/CustomHtmlPreview.tsx"),
  read("src/components/activities/TabsActivity/TabsActivity.module.css"),
  read("src/components/activities/TabsActivity/TabsActivity.tsx"),
  read("src/components/lesson-editor/BlockRender.tsx"),
  read("src/components/activities/Image360Activity/Image360Activity.module.css"),
  read("src/components/activities/SituationalDialogueActivity/SituationalDialogueActivity.module.css"),
  read("src/components/activities/LessonNavigationActivity/LessonNavigationActivity.module.css"),
  read("src/components/activities/LessonNavigationActivity/LessonNavigationActivityEditor.tsx"),
  read("src/components/activities/LessonNavigationActivity/NavigationButtonLabel.tsx")
]);

assert.match(commands, /class=\"tabs-tabbar-wrap\">\{\}<div aria-label=\"Onglets\"/);
assert.match(tabsCss, /--tabs-content-text, var\(--activity-content-text/);
assert.match(tabsActivity, /"--tabs-content-text": contentTextColor/);
assert.match(blockRender, /contentTextColor=\{activityContentTextColor\}/);
assert.doesNotMatch(tabsActivity, /protectsInternalSurface/);
assert.doesNotMatch(commands, /protects_internal_surface/);
assert.match(commands, /--tabs-content-text:\{\};--tabs-radius/);
assert.match(commands, /var visibleCount = 4;/);
assert.match(commands, /button\.hidden = !!\(previous && next\)/);
assert.match(commands, /event\.key === \"ArrowLeft\"/);
assert.match(commands, /event\.key === \"End\"/);
assert.doesNotMatch(commands, /\.tabs-tab \{\{ flex:0 0 min\(33\.333%,132px\)/);

assert.match(commands, /requiredVisibleHeight = Math\.min\(targetHeight \* \.35/);
assert.match(app, /requiredVisibleHeight = Math\.min\(/);
assert.doesNotMatch(commands, /entry\.intersectionRatio < 0\.35/);
assert.doesNotMatch(app, /entry\.intersectionRatio < 0\.35/);

assert.match(commands, /setupResponsiveRichIndents\(document\)/);
assert.match(commands, /\(authoredPixels \+ nativeListInset\) \/ referenceWidth/);
assert.match(commands, /calc\(100% - 12ch\)/);
assert.match(commands, /listContainer = item\.matches\('ul, ol'\)[\s\S]*?paddingInlineStart/);
assert.match(commands, /window\.innerWidth <= 520[\s\S]*?setProperty\(indentProperty, '0px'\)[\s\S]*?else if \(window\.innerWidth <= 820\)/);
assert.match(commands, /querySelectorAll\('\.block\.rich ul, \.block\.rich ol, \.block\.rich li, \.rich-content ul, \.rich-content ol, \.rich-content li'\)/);
assert.match(commands, /\.block\.rich, \.rich-content \{\{ container-type:inline-size; \}\}/);
assert.match(app, /\(authoredPixels \+ nativeListInset\) \/ referenceWidth/);
assert.match(app, /listContainer = item\.matches\("ul, ol"\)[\s\S]*?paddingInlineStart/);
assert.match(app, /previewWindow\.innerWidth <= 520[\s\S]*?setProperty\(indentProperty, "0px"\)[\s\S]*?else if \(previewWindow\.innerWidth <= 820\)/);
assert.match(app, /\.linear-block\.block-type-rich-text ul, \.linear-block\.block-type-rich-text ol,[\s\S]*?\.rich-content ul, \.rich-content ol, \.rich-content li/);
assert.match(commands, /--paideia-list-marker-color', computed\.color/);
assert.match(commands, /--paideia-list-marker-weight', computed\.fontWeight/);
assert.match(commands, /\.block,\.block \*,\.course-intro,\.course-intro \*\{\{overflow-wrap:normal!important;word-break:normal!important;hyphens:none!important\}\}/);
assert.match(commands, /setupAuthoredTextBreakOpportunities\(document\)/);
assert.match(commands, /setupRichTextLineLeading\(document\)/);
assert.doesNotMatch(commands, /effective\s*=\s*Math\.max\(1,\s*ratio\)/);
assert.match(commands, /var effective\s*=\s*ratio/);
assert.match(styles, /@media \(max-width: 1024px\)[\s\S]*?data-paideia-line-leading="true"[\s\S]*?top: var\(--paideia-line-leading-responsive-offset, 0\);[\s\S]*?--paideia-line-leading-responsive-rendered/);
assert.match(commands, /@media\s*\(max-width:1024px\)[\s\S]*?top:var\(--paideia-line-leading-responsive-offset,0\);[\s\S]*?--paideia-line-leading-responsive-rendered/);
assert.match(commands, /referenceFontSize/);

assert.match(commands, /data-header-fit-viewport/);
assert.match(commands, /setupHeaderTextFits\(\)/);
assert.doesNotMatch(styles, /\.header-banner \.rich-content \{\s*font-size: 15px;/);

for (const source of [tabsCss, image360Css, dialogueCss]) {
  assert.doesNotMatch(source, /:global\(\.preview-responsive-document\)/);
}

// The iframe only supplies a real constrained viewport. Activity width modes
// (centered, inset and full bleed) must remain owned by the shared layout rules.
assert.doesNotMatch(
  styles,
  /\.preview-responsive-document[^,{]*(?:\.linear-block|\.header-block|\.full-width-image-block-shell|\.centered-image-text-block-shell)/
);
assert.match(styles, /\.preview-mode \.linear-block-content \{[\s\S]*?margin: 0 auto;/);
assert.match(styles, /@media \(max-width: 820px\) \{\s*:root \{\s*--activity-content-width: min\(100%, calc\(100vw - 28px\)\);/);
assert.match(styles, /@media \(max-width: 520px\) \{\s*:root \{\s*--activity-content-width: min\(100%, calc\(100vw - 20px\)\);/);
assert.doesNotMatch(styles, /\.preview-responsive-document \{\s*--activity-content-width:/);
assert.match(styles, /\.linear-block\.rich-text-content-inset > \.linear-block-content \{/);
assert.match(styles, /\.header-block \{\s*width: 100vw;\s*margin: 0 calc\(50% - 50vw\);\s*\}/);
assert.doesNotMatch(styles, /\.preview-mode[^,{]*\.header-block/);
assert.doesNotMatch(styles, /@media[^}]+\{[\s\S]*?\.header-block \{\s*width: 100%;\s*margin: 0;/);
assert.match(styles, /\.linear-block,\s*\.linear-block \* \{\s*overflow-wrap: normal !important;\s*word-break: normal !important;\s*hyphens: none !important;/);
assert.match(richTableCss, /@container \(max-width: 720px\)[\s\S]*?\.paideia-responsive-table-scroll > table\[data-paideia-responsive-table="true"\] \{\s*width: max-content !important;\s*min-width: 100%;\s*max-width: none !important;\s*table-layout: auto;/);
assert.match(richTableCss, /\.paideia-responsive-table-scroll > table\[data-paideia-responsive-table="true"\] th,\s*\.paideia-responsive-table-scroll > table\[data-paideia-responsive-table="true"\] td \{\s*min-width: 9rem;/);
assert.match(commands, /@container \(max-width:720px\)[^\n]+\.paideia-responsive-table-scroll>table\[data-paideia-responsive-table="true"\] \{\{ width:max-content !important; min-width:100%; max-width:none !important; table-layout:auto; \}\}[^\n]+min-width:9rem;/);
assert.doesNotMatch(commands, /\.paideia-rich-table th[^\n]+min-width:110px/);
assert.doesNotMatch(styles, /\.preview-mode \.rich-content,\s*\n\.preview-mode \.export-block-copy/);
assert.match(previewViewport, /new MutationObserver\(scheduleHeadSync\)/);
assert.match(previewViewport, /headObserver\.observe\(document\.head/);
assert.match(app, /data-paideia-preview-source-style="true"/);
assert.match(app, /item\.style\.marginLeft \? "margin-left"/);
assert.match(app, /item\.closest\("\.note-activity"\)/);
assert.match(commands, /item\.style\.marginLeft \? 'margin-left'/);
assert.match(previewViewport, /style\[data-paideia-preview-source-style='true'\]/);
assert.match(pointOfInterest, /ownerDocument\.addEventListener\("pointerdown", handleOutsidePointerDown\)/);
assert.match(pointOfInterest, /target instanceof ownerWindow\.Node/);
assert.match(imageActivity, /standalone-image-activity image-layout/);
assert.match(styles, /\.standalone-image-activity\.image-center \{[\s\S]*?width: min\(100%, var\(--content-width, 100%\)\);/);
assert.match(styles, /\.linear-block\.full-width-image-block-shell[\s\S]*?\.standalone-image-activity:is\(\.image-full, \.page-width\) \{[\s\S]*?width: 100%;[\s\S]*?margin-inline: 0;/);
assert.match(styles, /\.standalone-image-activity\.image-full > \.preview-media,[\s\S]*?width: auto;[\s\S]*?max-width: 100%;/);
assert.match(styles, /\.standalone-image-activity\.page-width > \.preview-media,[\s\S]*?width: 100%;[\s\S]*?max-width: none;/);
assert.match(commands, /\.block\.image\.image-full \{\{[^\n]+box-sizing:border-box; min-width:0; width:100vw;/);
assert.match(commands, /\.block\.image\.page-width \{\{[^\n]+box-sizing:border-box; min-width:0; width:100vw;/);
assert.match(customHtmlPreview, /frameRef\.current\?\.ownerDocument\.defaultView \?\? window/);
assert.match(customHtmlPreview, /ownerWindow\.addEventListener\("message", handleSandboxMessage\)/);
assert.match(customHtmlPreview, /suspendedHeightRef = useRef\(680\)/);
assert.match(customHtmlPreview, /Math\.max\(bodyHeight, rootHeight, 680\)/);
assert.match(customHtmlPreview, /Math\.max\(680, Math\.ceil\(Number\(message\.height\) \|\| 0\)\)/);
assert.match(htmlSandbox, /#sandbox-frame\s*\{[^}]*min-height:\s*680px/s);
assert.match(htmlSandbox, /Math\.max\(bodyHeight, rootHeight, 680\)/);
assert.match(htmlSandbox, /postToHost\("resize", \{ height: 680 \}\)/);
assert.match(styles, /\.custom-html-frame\s*\{[^}]*min-height:\s*680px/s);
assert.match(commands, /\.custom-html-frame \{\{[^\n]*min-height:680px/);
assert.match(commands, /var nextHeight = Math\.max\(bodyHeight, rootHeight, 680\)/);
assert.match(app, /function returnPreviewToChapterMenu\(\)[\s\S]*?setIsPreviewStarted\(false\);[\s\S]*?resetPreviewViewportScroll\("auto"\)/);
assert.match(app, /className="preview-progress-home"[\s\S]*?onClick=\{returnPreviewToChapterMenu\}/);
assert.match(commands, /id="progress-home"/);
assert.match(commands, /history\.replaceState\(null, "", window\.location\.pathname \+ window\.location\.search\);[\s\S]*?updateCourseView\(\);/);
assert.match(commands, /function paideiaResizeCustomHtmlFrame\(frame\)[\s\S]*?frameWindow\.ResizeObserver[\s\S]*?observer\.observe\(frameDocument\.body\)/);
assert.match(commands, /frameWindow\.addEventListener\("resize", scheduleResize\);[\s\S]*?window\.addEventListener\("resize", scheduleResize\)/);
assert.match(commands, /frameDocument\.fonts\.ready\.then\(scheduleResize\)/);
assert.match(commands, /\.progress-nav \{\{[^\n]*display:flex; flex-direction:column;[^\n]*overflow:hidden;/);
assert.match(commands, /\.progress-list \{\{[^\n]*flex:1 1 auto; min-height:0; overflow-y:auto;/);
assert.match(styles, /\.preview-progress-nav \{[\s\S]*?display: flex;[\s\S]*?flex-direction: column;[\s\S]*?overflow: hidden;/);
assert.match(styles, /\.preview-progress-head \{[\s\S]*?flex: 0 0 auto;/);
assert.match(styles, /\.preview-progress-list \{[\s\S]*?flex: 1 1 auto;[\s\S]*?min-height: 0;[\s\S]*?overflow-y: auto;/);
assert.match(navigationCss, /@media \(max-width: 820px\)[\s\S]*?\.text-left-button-right,[\s\S]*?flex-direction: column/);
assert.match(navigationCss, /\.content \{[\s\S]*?min-width: 0;[\s\S]*?flex: 1 1 auto/);
assert.match(navigationCss, /\.row \{[\s\S]*?width: 100%;[\s\S]*?margin-inline: auto/);
assert.match(navigationCss, /\.course-exit \{[\s\S]*?width: min\(100%, 700px\);[\s\S]*?margin-inline: auto/);
assert.match(navigationCss, /\.button \{[\s\S]*?max-width: calc\(100% - 50px\);[\s\S]*?overflow: hidden/);
assert.match(navigationCss, /navigation-button-label[\s\S]*?overflow: hidden;[\s\S]*?white-space: nowrap/);
assert.match(navigationCss, /navigation-button-label[\s\S]*?text-overflow: ellipsis;[\s\S]*?white-space: nowrap/);
assert.match(navigationCss, /\.text-left-button-right \.button :global\(\.navigation-button-label\),[\s\S]*?\.text-top-button-bottom \.button :global\(\.navigation-button-label\) \{[\s\S]*?text-overflow: clip;[\s\S]*?white-space: normal;/);
assert.match(navigationButtonLabel, /baseFontSize \* \(availableWidth \/ naturalWidth\)/);
assert.match(navigationButtonLabel, /new ResizeObserver\(scheduleFit\)/);
assert.match(navigationEditor, /<input maxLength=\{80\}/);
assert.match(navigationEditor, /onLabelChange\(event\.target\.value\.slice\(0, 80\)\)/);
assert.match(app, /className="rich-content activity-item-rich-editor course-exit-rich-editor"/);
assert.match(styles, /\.course-exit-rich-editor \{[\s\S]*?--activity-content-text: #222222;[\s\S]*?background: #ffffff;[\s\S]*?color: #222222;/);
assert.match(commands, /normalize_scorm_course_exit_layout/);
assert.match(commands, /\.continue-block \{\{[^\n]+width:var\(--activity-content-width\); max-width:100%; margin:0 auto/);
assert.match(commands, /\.continue-block\.course-exit-block \{\{ width:min\(100%,700px\)/);
assert.match(commands, /\.continue-label \{\{[^\n]+overflow:hidden; text-overflow:ellipsis; white-space:nowrap/);
assert.match(commands, /\.continue-block\.course-exit-has-text \.continue-label \{\{[^\n]+text-overflow:clip; white-space:normal/);
assert.match(commands, /function fitNavigationButtonLabel\(label\)/);
assert.match(commands, /setupNavigationButtonLabels\(document\)/);
assert.match(commands, /\.continue-block\.course-exit-has-text[^\n]+flex-direction:column/);

console.log("Responsive contracts: width modes, tabs, tall-block completion, Rich Text containment, header fit, navigation scrolling and iframe single-source rules OK.");
