import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost/" });
for (const name of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "MouseEvent", "CustomEvent", "MutationObserver", "localStorage"]) {
  Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import("react");
const { createRoot } = await import("react-dom/client");
const jsx = await import("react/jsx-runtime");
const { act } = React;
const t = key => key;
let loadedBank;
let loadGate;
const modules = new Map();
function sourceModule(file) {
  if (modules.has(file)) return modules.get(file);
  const result = {};
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("exports", "require", code)(result, name => {
    if (name === "react") return React;
    if (name === "react/jsx-runtime") return jsx;
    if (name.endsWith(".module.css")) return { default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (name.endsWith(".css")) return {};
    if (name.includes("i18n")) return { useI18n: () => ({ t }), translateActive: t };
    if (name.includes("resourceBankApi")) return { loadResourceBank: async () => { if (loadGate) await loadGate; return { ...loadedBank, contentLoaded: true }; } };
    if (name.includes("useIndividualBank")) return sourceModule("src/components/resources/useIndividualBank.tsx");
    if (name.includes("ResourceCatalogControls")) return sourceModule("src/components/resources/ResourceCatalogControls.tsx");
    if (name.includes("resourceCatalog")) return sourceModule("src/components/resources/resourceCatalog.ts");
    if (name.includes("useEscapeNavigation")) return { useEscapeNavigation() {} };
    if (name.includes("useResourceBankTransfer")) return { useResourceBankTransfer: () => ({ checkbox: () => null }) };
    if (name.includes("CreateResourceButton")) return { CreateResourceButton: props => React.createElement("button", { onClick: props.onClick }, props.label) };
    if (name.includes("questionBankFilters")) return sourceModule("src/lib/questionBankFilters.ts");
    if (name.includes("assessmentEngine")) return sourceModule("src/assessment/assessmentEngine.ts");
    // File transfers are outside this render regression test.
    if (/resourceWorkbook|resourceBankPackage|moodleQuestionBank/.test(name)) return {};
    throw new Error(`Unexpected dependency: ${name}`);
  });
  modules.set(file, result);
  return result;
}

for (const family of ["questions", "assistants"]) {
  let richFields = 0;
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  const items = Array.from({ length: 151 }, (_, index) => family === "questions"
    ? { id: `q${index}`, mode: "single", points: 1, questionHtml: `<p>Question ${index}</p>`, answers: [{ id: `a${index}`, textHtml: "<p>Answer</p>", correct: true }] }
    : { id: `e${index}`, term: `Term ${index}`, aliases: [], related: [], contentHtml: "<p>Definition</p>" });
  loadedBank = { id: "bank", name: "Large bank", [family === "questions" ? "questions" : "entries"]: items,
    projectPaths: [], collectionIds: [], lessonIds: [], fallbackResponses: [], fuzzyThreshold: 2, position: "bottom-right", shortcut: "" };
  const summary = { ...loadedBank, contentLoaded: false, contentCount: items.length, [family === "questions" ? "questions" : "entries"]: [] };
  const Component = family === "questions"
    ? sourceModule("src/components/resources/QuestionBank/QuestionBankManager.tsx").QuestionBankManager
    : sourceModule("src/components/resources/AssistantResource/AssistantResourceManager.tsx").AssistantResourceManager;
  const renderRich = () => { richFields++; return React.createElement("div", { className: "test-rich-field" }); };
  function Harness() {
    const [banks, setBanks] = React.useState([summary]);
    return React.createElement(Component, { banks, assistants: banks, onBanksChange: setBanks, onAssistantsChange: setBanks,
      collections: [], lessonProjects: [], resolveTileImageSrc: () => null, resolveAvatarSrc: () => null,
      renderRichTextField: renderRich, renderDefinitionField: renderRich, onSave: async () => {} });
  }
  await act(async () => root.render(React.createElement(Harness)));
  const button = container.querySelector(".resource-portal-open"); assert.ok(button);
  await act(async () => { button.dispatchEvent(new MouseEvent("click", { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 0)); });
  assert.equal(container.querySelectorAll("article").length, 151);
  assert.equal(richFields, 0, `${family}: no transient rich form is constructed at first opening`);
  assert.equal(container.querySelectorAll('[role="status"]').length, 0, "no loading text displaces tiles");
  await act(async () => container.querySelector('[aria-expanded="false"]').dispatchEvent(new MouseEvent("click", { bubbles: true })));
  assert.ok(richFields > 0, `${family}: expanding one row still creates its editor`);
  await act(async () => root.unmount()); container.remove();
  console.log(`OK ${family}: 151 rows open collapsed on the first render; individual expansion preserved.`);
}
const container = document.createElement("div"); document.body.append(container);
const root = createRoot(container);
let release;
loadGate = new Promise(resolve => { release = resolve; });
loadedBank = { id: "slow", name: "Slow bank", entries: [] };
const { useIndividualBank } = sourceModule("src/components/resources/useIndividualBank.tsx");
function SlowHarness() {
  const loader = useIndividualBank("references", [{ ...loadedBank, contentLoaded: false }], () => {});
  return React.createElement("div", null, loader.notice, React.createElement("button", { onClick: () => loader.open({ ...loadedBank, contentLoaded: false }, () => {}) }, "Open"), React.createElement("div", { className: "resource-portal-grid" }, "Tiles"));
}
await act(async () => root.render(React.createElement(SlowHarness)));
await act(async () => container.querySelector("button").dispatchEvent(new MouseEvent("click", { bubbles: true })));
assert.equal(container.querySelector('[role="dialog"]'), null, "short waits do not flash a modal");
await act(async () => new Promise(resolve => setTimeout(resolve, 400)));
assert.ok(container.querySelector('.import-blocking-backdrop [role="dialog"]'), "long waits use the standard modal");
assert.equal(container.querySelectorAll('[role="status"]').length, 0);
assert.equal(container.querySelector(".resource-portal-grid").textContent, "Tiles");
await act(async () => { release(); await new Promise(resolve => setTimeout(resolve, 0)); });
assert.equal(container.querySelector('[role="dialog"]'), null, "modal closes when the load completes");
await act(async () => root.unmount()); container.remove();
console.log("OK: delayed loading uses the standard modal without moving the tile list.");
await window.happyDOM.close();
