import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { Window } from "happy-dom";

const source = fs.readFileSync("src/components/resources/ReferenceBankResourceManager.tsx", "utf8");
const css = fs.readFileSync("src/components/resources/QuestionBank/QuestionBankManager.module.css", "utf8");
const assistantCss = fs.readFileSync("src/components/resources/AssistantResource/AssistantResourceManager.css", "utf8");
// Excel rich-text runs use spans: field-label styling must never style their text.
const styleWindow = new Window();
styleWindow.document.body.innerHTML = `<style>${assistantCss}</style>
  <div class="assistant-resource-form-grid">
    <label><span id="term-label">Mot</span><input></label>
    <div><span class="assistant-resource-eyebrow">Définition</span>
      <div class="rich-toolbar"><label class="toolbar-line-height"><select id="definition-line-height" class="toolbar-select"><option>1,5</option></select></label><select id="definition-font-size" class="toolbar-select"><option>18px</option></select></div>
      <div class="inline-rich-text-field"><p><span id="plain-run" style="font-size:14.6667px">La </span><span><strong>Direction générale</strong></span><span><u>Rôles et missions</u></span></p></div>
    </div>
  </div>`;
const plainRunStyle = styleWindow.getComputedStyle(styleWindow.document.getElementById("plain-run"));
assert.notEqual(plainRunStyle.fontWeight, "800", "normal Excel text must not become a bold field label");
assert.notEqual(plainRunStyle.textTransform, "uppercase", "Excel text must retain its original case");
assert.equal(styleWindow.getComputedStyle(styleWindow.document.getElementById("term-label")).fontWeight, "800");
assert.notEqual(styleWindow.getComputedStyle(styleWindow.document.getElementById("definition-line-height")).minHeight, "50px");
assert.notEqual(styleWindow.getComputedStyle(styleWindow.document.getElementById("definition-font-size")).minHeight, "50px");
const code = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX
} }).outputText;
const exports = {};
const slots = [];
let slot = 0;
const jsx = (type, props) => ({ type, props });
const classes = new Proxy({}, { get: (_, key) => String(key) });
vm.runInNewContext(code, { exports, window: {}, Element: class {}, require: (name) => {
  if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
  if (name === "react") return {
    useState: (initial) => {
      const index = slot++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
    },
    useRef: (initial) => {
      const index = slot++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo: (compute) => compute(), useEffect() {}
  };
  if (name.endsWith("i18n/react")) return { useI18n: () => ({ t: (key) => key }) };
  if (name.endsWith(".module.css")) return { default: classes };
  if (name.endsWith(".css")) return {};
  if (name.endsWith("QuestionBankManager")) return new Proxy({}, { get: () => () => null });
  if (name.endsWith("CreateResourceButton")) return { CreateResourceButton: () => null };
  if (name.endsWith("resourceBankPackage")) return {};
  if (name.endsWith("useIndividualBank")) return { useIndividualBank: () => ({ load: async bank => bank, open: (bank, select) => { Promise.resolve(bank).then(select); }, report: error => { throw error; }, notice: null }) };
  if (name.endsWith("useResourceBankTransfer")) return { useResourceBankTransfer: () => ({ selectAll: null, actions: null, error: null, checkbox: () => null }) };
  if (name.endsWith("ResourceCatalogControls")) return { useResourceTiles: banks => [...banks].sort((a,b) => a.name.localeCompare(b.name)), ResourceSortControl: () => null, ResourceNoResults: () => null };
  if (name.endsWith("resourceWorkbook")) return { richHtmlToPlainText: (html) => html, plainTextToRichHtml: (text) => text };
  throw new Error(name);
} });
let saves = 0;
let deletes = 0;
const props = {
  banks: [{ id: "bank", name: "Test", revision: 1, entries: [{ id: "entry", term: "DNS", definitionHtml: "<p>Définition</p>" }], projectPaths: [], collectionIds: [], tileImageRef: "tile.webp" }],
  collections: ["SSI"], lessonProjects: [{ archivePath: "lesson", title: "Leçon", collection: "SSI" }],
  onBanksChange: (banks) => { props.banks = banks; },
  onDelete: async () => { deletes++; }, onSave: async () => { saves++; },
  onTileImageUpload: async () => {}, resolveTileImageSrc: () => "tile.webp", saveFeedbackState: "idle"
};
function render() { slot = 0; return exports.ReferenceBankResourceManager(props); }
function all(node) {
  if (Array.isArray(node)) return node.flatMap(all);
  if (!node || typeof node !== "object") return [];
  return [node, ...all(node.props?.children)];
}
const find = (tree, predicate) => { const node = all(tree).find(predicate); assert.ok(node, "expected UI element"); return node; };
const hasClass = (value) => (node) => node.props?.className?.split(" ").includes(value);
let tree = render();
assert.equal(all(tree).filter(hasClass("resource-portal-subtitle")).length, 1);
find(tree, hasClass("reference-bank-menu-toggle")).props.onClick();
tree = render();
let fileClicks = 0;
find(tree, (node) => node.type === "input" && node.props.type === "file").props.ref.current = { click() { fileClicks++; } };
find(tree, (node) => node.type === "button" && node.props.children === "editor.chooseImage").props.onClick();
assert.equal(fileClicks, 1);
assert.ok(all(render()).some(hasClass("resource-portal-grid")), "choosing an image does not open the bank editor");
find(tree, (node) => node.type === "button" && node.props.className?.startsWith("danger ")).props.onClick();
tree = render();
assert.equal(deletes, 0, "tile deletion requires confirmation");
find(tree, (node) => node.type === "button" && node.props.children === "common.cancel").props.onClick();
assert.equal(deletes, 0, "cancel never deletes");
tree = render();
find(tree, hasClass("resource-portal-open")).props.onClick();
await Promise.resolve();
await Promise.resolve();
tree = render();
find(tree, hasClass("backButton"));
find(tree, hasClass("saveButton"));
const sections = all(tree).filter((node) => node.type === "section");
assert.ok(sections.findIndex(hasClass("assistant-resource-associations-card")) < sections.findIndex(hasClass("assistant-resource-glossary-card")), "associations precede definitions, like the other resources");
assert.equal(all(tree).filter((node) => node.type === "fieldset").length, 0);
assert.equal(all(tree).filter(hasClass("assistant-resource-selection-list")).length, 2);
assert.equal(all(tree).filter(hasClass("assistant-resource-option-control")).length, 2);
const lesson = find(tree, (node) => node.type === "input" && node.props.type === "checkbox");
lesson.props.onChange({ target: { checked: true } });
assert.equal(props.banks[0].projectPaths[0], "lesson");
assert.equal(props.banks[0].entries[0].definitionHtml, "<p>Définition</p>", "associations do not mutate definition HTML");
find(render(), hasClass("saveButton")).props.onClick();
assert.equal(saves, 1);
props.canAssignLesson = () => false;
const deniedTree = render();
const deniedLesson = find(deniedTree, (node) => node.type === "input" && node.props.type === "checkbox");
assert.equal(deniedLesson.props.disabled, true);
assert.ok(all(deniedTree).some(hasClass("reference-bank-assignment-unavailable")));
deniedLesson.props.onChange({ target: { checked: false } });
assert.deepEqual(Array.from(props.banks[0].projectPaths), ["lesson"], "even direct event dispatch cannot change a forbidden assignment");
props.banks[0].projectPaths = [];
const collectionCheckbox = all(render()).filter((node) => node.type === "input" && node.props.type === "checkbox")[1];
collectionCheckbox.props.onChange({ target: { checked: true } });
assert.equal(props.banks[0].projectPaths.length, 0, "collections cannot assign a bank to a forbidden lesson");
delete props.canAssignLesson;
for (const state of ["saving", "saved", "error"]) {
  props.saveFeedbackState = state;
  const button = find(render(), hasClass("saveButton"));
  assert.ok(button.props.className.includes(`saveButton_${state}`));
  assert.equal(button.props.disabled, state === "saving");
}
for (const name of ["backButton", "saveButton", "bankOverview", "bankCount", "tileMenu", "tileMenuToggle"]) assert.ok(css.includes(`.${name}`));
assert.match(assistantCss, /\.assistant-resource-selection-list\s*\{[^}]*max-height:\s*228px;[^}]*overflow:\s*auto;/);
assert.match(assistantCss, /\.assistant-resource-option-control\[type="checkbox"\][\s\S]{0,500}max-width:\s*20px/);
assert.match(assistantCss, /\.assistant-resource-glossary-card:has\(\.inline-rich-text-wrapper\.active\)[\s\S]{0,180}overflow:\s*visible/);
assert.match(assistantCss, /\.assistant-resource-entry:has\(\.inline-rich-text-wrapper\.active\)[\s\S]{0,400}z-index:\s*2/);
console.log("Reference bank UI: existing resource styles, tile image isolation, deletion confirmation, associations and save feedback OK.");
const app = fs.readFileSync("src/App.tsx", "utf8");
const commitStart = app.indexOf("function commitReferenceDefinition(");
const commitSource = app.slice(commitStart, app.indexOf("function renderReferenceDefinition(", commitStart));
const imageHtml = '<p>Définition <img class="rich-inline-image" src="data:image/png;base64,iVBORw0KGgo="></p>';
const bankState = { current: [{ id: "bank", revision: 1, entries: [{ id: "entry", definitionHtml: "<p>Définition</p>" }] }] };
const commitContext = vm.createContext({
  normalizeFrenchTypographyInHtml: (html) => html,
  userReferenceBanksRef: bankState,
  setUserReferenceBanks: () => {}
});
vm.runInContext(ts.transpileModule(commitSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, commitContext);
commitContext.commitReferenceDefinition("bank", "entry", imageHtml);
assert.equal(bankState.current[0].entries[0].definitionHtml, imageHtml, "inserted resource images commit to the latest bank state");
commitContext.commitReferenceDefinition("bank", "entry", imageHtml);
assert.equal(bankState.current[0].revision, 2, "repeated blur does not create a second revision");
const dialog = fs.readFileSync("src/components/rich-text-toolbar/RichTextBookmarkDialog.tsx", "utf8");
const commands = fs.readFileSync("src-tauri/src/commands.rs", "utf8");
const insertion = app.slice(app.indexOf("function openInsertRichTextReference()"), app.indexOf("function availableRichTextBookmarks()"));
assert.doesNotMatch(insertion, /availableRichTextBookmarks\(\)\.filter/);
assert.match(insertion, /matchingIndex/);
assert.match(app, /inline-rich-text-wrapper reference-definition-rich-wrapper/);
assert.match(dialog, /className="rich-reference-select-options"[\s\S]{0,120}role="listbox"/);
assert.match(dialog, /className="rich-reference-select-group"[\s\S]{0,80}role="group"/);
assert.match(dialog, /data-bookmark-id=\{bookmark.id\}/);
assert.match(dialog, /aria-selected=\{bookmark.id === bookmarkId\}/);
const save = app.slice(app.indexOf("async function handleSaveReferenceBankResources(bankId:"), app.indexOf("async function handleSaveGlossaryAssistantResources("));
assert.match(save, /saveUserReferenceBanks\(\[/);
assert.match(save, /previousBanks\.filter\(\(bank\) => bank\.id !== bankId\)/);
assert.match(save, /await applyUserReferenceBanks\(entry\.archivePath, entry\.archivePath\)/);
assert.match(save, /\.filter\(\(bank\) => bank\.id === bankId\)/);
assert.match(commands, /create_snapshot\(project_path.clone\(\)[\s\S]{0,180}sync_reference_banks_to_projects/);
console.log("Reference assignment: independent local save, snapshot and free entry selection OK.");
