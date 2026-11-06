import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { Window } from "happy-dom";
const window = new Window({ url: "http://localhost" });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "MouseEvent"])
  Object.defineProperty(globalThis, key, { configurable: true, value: key === "window" ? window : window[key] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import("react");
const jsx = await import("react/jsx-runtime");
const ReactDOM = await import("react-dom");
const { createRoot } = await import("react-dom/client");
const { act } = React;
const modules = new Map();
function sourceModule(file) {
  if (modules.has(file)) return modules.get(file);
  const exports = {};
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("exports", "require", code)(exports, name => {
    if (name === "react") return React;
    if (name === "react-dom") return ReactDOM;
    if (name === "react/jsx-runtime") return jsx;
    if (name.includes("i18n")) return { useI18n: () => ({ t: key => key }) };
    if (name.includes("ColorPickerPopover")) return { ColorPickerField: () => null };
    if (name.endsWith(".css")) return {};
    if (name.startsWith(".")) {
      const base = path.join(path.dirname(file), name);
      for (const suffix of [".ts", ".tsx"]) if (existsSync(base + suffix)) return sourceModule(base + suffix);
    }
    throw Error(name);
  });
  modules.set(file, exports);
  return exports;
}
const { sidebarKeywords, rememberKeywords } = sourceModule("src/app/keywords.ts");
const catalog = ["Zulu", "Alpha", "Ancré", ...Array.from({ length: 12 }, (_, i) => `Terme ${String(i).padStart(2, "0")}`)];
const recent = [...catalog.slice(3)].reverse();
assert.deepEqual(sidebarKeywords(catalog, ["Zulu", "ancré", "zulu"], recent, []), ["Ancré", "Zulu", ...catalog.slice(5)]);
assert.deepEqual(sidebarKeywords(catalog, ["Zulu"], ["absent", "alpha", "Zulu"], []), ["Zulu", "Alpha"]);
assert.deepEqual(sidebarKeywords(catalog, [], [], ["Zulu", "Alpha"]), ["Alpha", "Zulu"]);
assert.deepEqual(rememberKeywords(["Alpha", "Zulu"], ["zulu"]), ["zulu", "Alpha"]);
const { ProjectLibraryScreen } = sourceModule("src/components/project-library/ProjectLibraryScreen.tsx");
const { KeywordManager } = sourceModule("src/components/project-library/KeywordControls.tsx");
const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
let applied;
const props = { activeSection: "tous", collectionNames: [], collectionColors: {}, collectionCount: 0,
  favoriteCount: 0, collaborativeCount: 0, collaborationVisible: false, isManagingCollections: false,
  keywords: ["Alpha", "Zulu"], keywordCounts: { alpha: 1, zulu: 0 }, pinnedKeywords: ["Zulu"], recentKeywords: ["Alpha"], usedKeywordFallback: [],
  keywordFilter: [], keywordMode: "all", filterOperator: "or", labelFilter: [], searchValue: "", selectedCollection: null, totalCount: 1,
  onKeywordPointerDown() {}, shouldSuppressKeywordClick: () => false,
  onSearchApply: value => { applied = value; }, onOpenKeywordManager() {}, children: null };
await act(async () => root.render(React.createElement(ProjectLibraryScreen, props)));
const links = () => [...container.querySelectorAll(".project-library-keyword-link")];
assert.equal(links().length, 2);
assert.equal(links()[0].textContent, "Zulu0", "Unused pinned keyword remains visible");
await act(async () => links()[1].click());
assert.deepEqual(applied.keywords, ["Alpha"]);
assert.equal(document.querySelector('[role="dialog"]'), null, "Direct filter must not open modal");
await act(async () => root.render(React.createElement(ProjectLibraryScreen, { ...props, keywordFilter: ["Alpha"] })));
assert.equal(links()[1].getAttribute("aria-pressed"), "true");
await act(async () => links()[1].click());
assert.deepEqual(applied.keywords, [], "Second click removes filter");
applied = null;
await act(async () => root.render(React.createElement(ProjectLibraryScreen, { ...props, shouldSuppressKeywordClick: () => true })));
await act(async () => links()[0].click());
assert.equal(applied, null, "Finishing a drag must not activate the keyword filter");
let toggled;

await act(async () => root.render(React.createElement(KeywordManager, { catalog: ["Zulu"], counts: {}, pinnedKeywords: ["Zulu"], busy: false,
  onTogglePinned: keyword => { toggled = keyword; }, onAdd() {}, onRename() {}, onDelete() {}, onClose() {} })));
const star = container.querySelector(".keyword-pin-toggle");
assert.equal(star.textContent, "★");
assert.equal(star.getAttribute("aria-pressed"), "true");
await act(async () => star.click());
assert.equal(toggled, "Zulu");
// Exercise the actual queued assignment handler with a stale tile descriptor.
const app = readFileSync("src/App.tsx", "utf8").replace(/\r\n/g, "\n");
const start = app.indexOf("  function assignDroppedLibraryKeyword(");
const end = app.indexOf("  async function renameGlobalKeyword", start);
const handler = ts.transpileModule(app.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const stored = { keywords: [], updatedAt: "before" };
let writes = 0;
let readonly = false;
let errorNotice;
const queue = { current: Promise.resolve() };
const state = { entries: [{ archivePath: "lesson", keywords: [] }], recent: [] };
const env = {
  allLibraryProjects: state.entries, allLibraryKeywords: ["Alpha", "Zulu"], keywordDropQueueRef: queue,
  keywordKey: sourceModule("src/app/keywords.ts").keywordKey,
  uniqueKeywords: sourceModule("src/app/keywords.ts").uniqueKeywords, rememberKeywords,
  keywordDropWorkspaceRef: { current: { currentProjectPath: null, workspaceStateProjectPath: null, workspaceState: null } },
  flushPendingLessonEdits: async () => {},
  loadWorkspaceStateForProject: async () => ({ project: { ...stored, keywords: [...stored.keywords] } }),
  writeManagedProjectKeywords: async (entry, change) => {
    if (readonly) throw Error("read only");
    await new Promise(resolve => setTimeout(resolve, 5));
    writes++;
    stored.keywords = change(entry.keywords);
    stored.updatedAt = String(writes);
    return { ...stored };
  },
  setLibraryProjects: update => { state.entries = update(state.entries); }, setCollaborationProjects: update => update([]),
  setWorkspaceState: () => { throw Error("An inactive lesson must not overwrite the open lesson"); },
  openLessonSessions: { get: () => null },
  setLibraryRecentKeywords: update => { state.recent = update(state.recent); },
  setImportDialog: notice => { errorNotice = notice; }
};
const assign = new Function(...Object.keys(env), handler + "return assignDroppedLibraryKeyword;")(...Object.values(env));
assign("lesson", "Alpha");
assign("lesson", "Zulu");
assign("lesson", "alpha");
await queue.current;
assert.deepEqual(stored.keywords, ["Alpha", "Zulu"], "Rapid successive drops must preserve previous keywords");
assert.equal(writes, 2, "A duplicate must not write again");
assert.deepEqual(state.entries[0].keywords, ["Alpha", "Zulu"]);
assert.equal(errorNotice, undefined);
stored.keywords = [];
readonly = true;
assign("lesson", "Alpha");
await queue.current;
assert.deepEqual(stored.keywords, [], "Write failure must leave keywords unchanged");
assert.equal(errorNotice.status, "error");
readonly = false;
assign("lesson", "Zulu");
await queue.current;
assert.deepEqual(stored.keywords, ["Zulu"], "A failed drop must not block the next drop");
// Exercise the shared pointer gesture used by labels and keywords.
const gestureStart = app.indexOf('  useEffect(() => {\n    if (!pendingLibraryCollectionDrag)');
const gestureEnd = app.indexOf('  useEffect(() => {', gestureStart + 10);
assert.ok(gestureStart >= 0 && gestureEnd > gestureStart);
const gesture = ts.transpileModule(app.slice(gestureStart, gestureEnd), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
for (const [kind, cancel] of [[true, false], [false, false], [true, true]]) {
  const listeners = new Map();
  const drops = [];
  const dragged = { current: null };
  const suppressed = { current: false };
  let cleanup;
  let ghost = null;
  const ghostNode = { style: {} };
  const timers = new Map();
  let timerId = 0;
  const gestureEnv = {
    useEffect: callback => { cleanup = callback(); },
    pendingLibraryCollectionDrag: { collection: "Alpha", x: 0, y: 0, keyword: kind },
    window: { addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name), setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id) },
    document: { elementFromPoint: () => ({ closest: () => ({ dataset: { libraryArchivePath: "lesson" } }) }) },
    setKeywordDragGhost: value => { ghost = value; }, keywordDragGhostRef: { current: ghostNode },
    setHoveredLibraryDropArchive() {}, setDraggedLibraryCollection() {}, setPendingLibraryCollectionDrag() {},
    draggedLibraryCollectionRef: dragged, suppressLibraryCollectionClickRef: suppressed,
    assignDroppedLibraryKeyword: (...args) => drops.push(["keyword", ...args]),
    assignLibraryCollection: (...args) => drops.push(["label", ...args]), libraryCollectionOverrides: {}, libraryProjects: []
  };
  new Function(...Object.keys(gestureEnv), gesture)(...Object.values(gestureEnv));
  listeners.get("pointermove")({ clientX: 2, clientY: 0 });
  assert.equal(dragged.current, null, "A click is not a drag");
  assert.equal(ghost, null, "A short press keeps the word without a tag");
  if (kind) {
    [...timers.values()][0]();
    assert.equal(ghost.keyword, "Alpha", "A long press materializes the floating tag");
  }
  listeners.get("pointermove")({ clientX: 20, clientY: 0 });
  assert.equal(ghostNode.style.transform, "translate3d(32px, 12px, 0)");
  assert.equal(ghost.label, !kind, "Labels and keywords both remain visible during movement");
  if (cancel) listeners.get("pointercancel")({});
  listeners.get("pointerup")({ clientX: 20, clientY: 0 });
  assert.deepEqual(drops, cancel ? [] : [[kind ? "keyword" : "label", "lesson", "Alpha"]]);
  assert.equal(suppressed.current, !cancel);
  assert.equal(ghost, null, "The tag disappears on release or cancellation");
  assert.equal(timers.size, cancel ? 0 : 1);
  cleanup();
  assert.equal(listeners.size, 0);
}
await act(async () => root.render(React.createElement(KeywordManager, { catalog: Array.from({ length: 30 }, (_, i) => `Mot-clé ${i + 1}`), counts: {}, pinnedKeywords: ["Mot-clé 1"], busy: false, onTogglePinned() {}, onAdd() {}, onRename() {}, onDelete() {}, onClose() {} })));
mkdirSync("artifacts/keyword-ui-check", { recursive: true });
writeFileSync("artifacts/keyword-ui-check/manager.html", `<!doctype html><html><meta charset="utf-8"><style>${readFileSync("src/styles.css", "utf8")}\n${readFileSync("src/components/project-library/KeywordControls.css", "utf8")}</style><body>${container.innerHTML}</body></html>`);
for (const [action, filename] of [["Renommer", "rename"], ["Fusionner", "merge"]]) {
  const button = [...container.querySelectorAll(".keyword-manager-item button")].find(item => item.textContent === action);
  await act(async () => button.click());
  writeFileSync(`artifacts/keyword-ui-check/${filename}.html`, `<!doctype html><html><meta charset="utf-8"><style>${readFileSync("src/styles.css", "utf8")}\n${readFileSync("src/components/project-library/KeywordControls.css", "utf8")}</style><body>${container.innerHTML}</body></html>`);
  await act(async () => container.querySelector(".keyword-edit-actions button:last-child").click());
}
await act(async () => root.unmount());
await window.happyDOM.abort();
console.log("Keyword sidebar: pins, recency, alphabetical groups, direct filter, star and successive drops verified.");
