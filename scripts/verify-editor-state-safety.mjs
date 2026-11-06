import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost/" });
for (const key of ["window", "document", "Node", "Element", "HTMLElement", "CustomEvent", "Event", "MutationObserver", "navigator"]) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === "window" ? window : window[key] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = React;
const app = await readFile("src/App.tsx", "utf8");
const ast = ts.createSourceFile("App.tsx", app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const helperText = await readFile("src/app/editorStateSafety.ts", "utf8");
const helpers = {};
new Function("exports", ts.transpileModule(helperText, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(helpers);
const { rebaseEditorDraft, mergeInlineBlockSave, mergeChapterTitleSave, richTextFieldKey } = helpers;
const pendingModule = {};
new Function("exports", "require", ts.transpileModule(await readFile("src/app/pendingInlineText.ts", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText)(pendingModule, name => {
  assert.equal(name, "./editorStateSafety"); return helpers;
});
const { pendingInlineText, blockWithPendingInlineText } = pendingModule;
function applicationFunction(name, dependencies = {}) {
  let declaration;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(declaration, name);
  const js = ts.transpileModule(declaration.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  return new Function(...Object.keys(dependencies), `${js}; return ${name};`)(...Object.values(dependencies));
}
let passed = 0;
async function test(name, run) {
  await run();
  console.log(`OK  ${name}`);
  passed++;
}
const compare = applicationFunction("normalizeHtmlForInlineCompare");
const field = applicationFunction("InlineRichTextField", {
  React, useEffect: React.useEffect, useLayoutEffect: React.useLayoutEffect, useRef: React.useRef, useState: React.useState,
  useSyncExternalStore: React.useSyncExternalStore, pendingInlineText,
  stripHtmlForEditor: value => value.replace(/<[^>]*>/g, ""),
  normalizeHtmlForInlineCompare: compare,
  normalizeFrenchTypographyInHtml: value => value,
  cleanEditorHtmlForRichTextSession: value => value,
  normalizeAuthoredTextBreakOpportunities: () => {},
  normalizeRichTextLineLeading: () => {},
  observeRichTextFieldBounds: () => () => {},
  copyRichTextSelectionWithoutContainerAppearance: () => {}
});

function workspace(blocks) {
  return { project: { id: "lesson", updatedAt: "2026-01-01", course: { modules: [{ id: "module", chapters: [{ id: "chapter", pages: [{ id: "page", blocks }] }] }] } }, auditEvents: [], snapshots: [] };
}
const blocks = state => state.project.course.modules[0].chapters[0].pages[0].blocks;

await test("draft refresh preserves simple fields, rich text, nested edits and unrelated new media", () => {
  const base = { title: "Title", contentHtml: "Old", items: [{ id: "a", text: "A", image: "old.png" }, { id: "b", text: "B" }] };
  const draft = structuredClone(base); draft.title = "Typed title"; draft.contentHtml = "Typed"; draft.items[0].text = "A edited";
  const incoming = structuredClone(base); incoming.items[0].image = "new.png"; incoming.items[1].text = "B saved";
  assert.deepEqual(rebaseEditorDraft(base, draft, incoming), { title: "Typed title", contentHtml: "Typed", items: [{ id: "a", text: "A edited", image: "new.png" }, { id: "b", text: "B saved" }] });
  assert.deepEqual(rebaseEditorDraft(base, base, incoming), incoming);
  assert.deepEqual(rebaseEditorDraft([{ id: "a" }], [], [{ id: "a" }, { id: "b" }]), [{ id: "b" }]);
});

await test("late text reply cannot hide new blocks, restore deleted blocks, or undo another field", () => {
  const before = { id: "a", type: "rich-text", contentHtml: "A0", title: "Original" };
  const old = workspace([before, { id: "b", contentHtml: "B0" }]);
  const current = workspace([{ ...before, title: "New title" }, { id: "c", contentHtml: "New block" }]);
  const reply = structuredClone(old); blocks(reply)[0].contentHtml = "A1";
  const merged = mergeInlineBlockSave(current, reply, before);
  assert.deepEqual(blocks(merged).map(block => block.id), ["a", "c"]);
  assert.equal(blocks(merged)[0].contentHtml, "A1");
  assert.equal(blocks(merged)[0].title, "New title");
  const deleted = workspace([{ id: "c" }]);
  assert.deepEqual(blocks(mergeInlineBlockSave(deleted, reply, before)), [{ id: "c" }]);
  const other = structuredClone(current); other.project.id = "other";
  assert.equal(mergeInlineBlockSave(other, reply, before), other);
});

await test("late form callbacks are rejected after switching lesson or block", () => {
  let state = { title: "B", quoteAuthorHtml: "B author" };
  const ref = { current: state };
  const owner = richTextFieldKey("p", "a");
  const active = { current: richTextFieldKey("p", "b") };
  const isCurrentBlockForm = applicationFunction("isCurrentBlockForm", { blockFormOwner: owner, activeBlockFormOwnerRef: active, blockFormOwnerRef: { current: owner }, richTextFieldKey, currentProjectPath: "p" });
  const setBlockForm = applicationFunction("setBlockForm", { isCurrentBlockForm, blockFormRef: ref, setBlockFormState: next => { state = next; } });
  setBlockForm(current => ({ ...current, title: "Wrong A" }));
  assert.equal(state.title, "B");
  active.current = richTextFieldKey("other-project", "a");
  setBlockForm({ title: "Wrong project" });
  assert.equal(state.title, "B");
  active.current = owner;
  assert.equal(isCurrentBlockForm("foreign-block"), false);
  setBlockForm(current => ({ ...current, title: "Valid" }));
  assert.equal(state.title, "Valid");
  assert.equal(ref.current, state);
});

await test("100 queued Note/Text edits with delayed saves preserve every block and the final stored text", async () => {
  let disk = workspace(["note", "text", "other-text"].map(id => ({ id, type: id === "note" ? "note" : "rich-text", title: id, contentHtml: `<p>${id}</p>` })));
  const ref = { current: { projectPath: "p", workspaceState: structuredClone(disk) } };
  const queue = { current: Promise.resolve() };
  const findBlockContext = applicationFunction("findBlockContext", { panelInlineWorkspaceRef: ref, currentProjectPath: "p", flattenPages: project => project.course.modules.flatMap(module => module.chapters).flatMap(chapter => chapter.pages) });
  const applyInlineBlockSave = applicationFunction("applyInlineBlockSave", { panelInlineWorkspaceRef: ref, currentProjectPath: "p", mergeInlineBlockSave, setWorkspaceState: state => { ref.current.workspaceState = state; } });
  const failures = [];
  const writes = [];
  const commit = applicationFunction("commitInlineRichText", {
    findBlockContext, currentProjectPath: "p", getDefaultProjectPath: () => "", normalizeHtmlForInlineCompare: compare,
    normalizeImportedRiseFieldHtml: (_block, html) => html, normalizeFrenchTypographyInHtml: html => html,
    inlineRichTextSessionRef: { current: null }, applyInlineBlockSave, markProjectDirty: () => {},
    saveCommittedInlineSnapshot: async () => {},
    updateBlock: async input => {
      await new Promise(resolve => setTimeout(resolve, writes.length % 4));
      const target = blocks(disk).find(block => block.id === input.blockId);
      target.contentHtml = input.contentHtml;
      writes.push([input.blockId, input.contentHtml]);
      return structuredClone(disk);
    }
  });
  const enqueue = applicationFunction("queueInlineRichTextCommit", { clearInlineRichTextDebounce: () => {}, inlineRichTextCommitRef: queue, commitInlineRichText: commit, logDevEvent: (...args) => failures.push(args) });
  const expected = new Map();
  for (let i = 0; i < 100; i++) {
    const id = i % 2 ? "text" : "note";
    const html = `<p>${id} ${i}</p>`;
    expected.set(id, html);
    enqueue(id, html, "immediate");
  }
  await queue.current;
  assert.deepEqual(failures, []);
  assert.equal(writes.length, 100);
  for (const state of [disk, ref.current.workspaceState]) {
    for (const [id, html] of expected) assert.equal(blocks(state).find(block => block.id === id).contentHtml, html);
    assert.equal(blocks(state).find(block => block.id === "other-text").contentHtml, "<p>other-text</p>");
    assert.equal(blocks(state).length, 3);
  }
});

for (const [name, normalize, fallback] of [
  ["commitTimelineInlineText", "normalizeTimelineInlineValue", "timelineFieldFallback"],
  ["commitSlidesInlineText", "normalizeSlidesInlineValue", "slidesFieldFallback"]
]) {
  await test(`${name}: queued saves read the latest items before each write`, async () => {
    const initial = workspace([{ id: "block", type: "timeline", activityItems: [{ id: "a", contentHtml: "A0" }, { id: "b", contentHtml: "B0" }] }]);
    const ref = { current: { projectPath: "p", workspaceState: initial } };
    const findBlockContext = applicationFunction("findBlockContext", {
      panelInlineWorkspaceRef: ref, currentProjectPath: "p",
      flattenPages: project => project.course.modules.flatMap(module => module.chapters).flatMap(chapter => chapter.pages)
    });
    const commit = applicationFunction(name, {
      findBlockContext, currentProjectPath: "p", getDefaultProjectPath: () => "",
      [normalize]: (_field, html) => html, [fallback]: () => "", normalizeHtmlForInlineCompare: compare,
      inlineRichTextSessionRef: { current: null },
      persistBlockActivityItems: async (_context, items) => {
        await new Promise(resolve => setTimeout(resolve, 5));
        ref.current.workspaceState = workspace([{ id: "block", activityItems: items }]);
        return null;
      }
    });
    // Both closures exist before the first save completes, as in rapid editing.
    const pending = Promise.resolve().then(() => commit("block", "a", "contentHtml", "A1"))
      .then(() => commit("block", "b", "contentHtml", "B1"));
    await pending;
    assert.deepEqual(blocks(ref.current.workspaceState)[0].activityItems, [{ id: "a", contentHtml: "A1" }, { id: "b", contentHtml: "B1" }]);
    ref.current.projectPath = "another-lesson";
    assert.equal(findBlockContext("block"), null);
  });
}

await test("Note and Text stay independent; old props cannot flash over a pending commit", async () => {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const commits = [];
  const completions = [];
  let active = "note", note = "<p>Note initiale</p>", text = "<p>Texte initial</p>";
  const draw = () => root.render(React.createElement(React.Fragment, {}, ...["note", "text"].map(id => {
    const key = richTextFieldKey("lesson", id);
    return React.createElement("div", { className: "inline-rich-text-wrapper", key }, React.createElement(field, {
      key, editorKey: key, html: id === "note" ? note : text, isActive: active === id,
      commitOnInput: false, onActivate: () => {}, onInput: () => {}, onCommit: html => { commits.push([id, html]); return new Promise(resolve => completions.push(resolve)); }
    }));
  })));
  await act(async () => draw());
  const [noteEditor, textEditor] = host.querySelectorAll("[contenteditable]");
  await act(async () => {
    noteEditor.innerHTML = "<p>Note saisie</p>";
    noteEditor.dispatchEvent(new window.Event("input", { bubbles: true }));
    textEditor.dispatchEvent(new window.PointerEvent("pointerdown", { bubbles: true }));
  });
  assert.deepEqual(commits, [["note", "<p>Note saisie</p>"]]);
  assert.equal(textEditor.innerHTML, "<p>Texte initial</p>");
  active = "text"; note = "<p>Ancienne réponse intermédiaire</p>";
  await act(async () => draw());
  assert.equal(noteEditor.innerHTML, "<p>Note saisie</p>");
  await act(async () => {
    textEditor.innerHTML = "<p>Texte saisi</p>";
    textEditor.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  text = "<p>Texte ancien reçu en retard</p>";
  await act(async () => draw());
  assert.equal(textEditor.innerHTML, "<p>Texte saisi</p>");
  note = '<p class="normalized">Note saisie</p>';
  await act(async () => { draw(); completions[0](); });
  assert.equal(noteEditor.innerHTML, note, "successful save releases the fence even when canonical HTML differs");
  await act(async () => root.unmount()); host.remove();
});

await test("a reused visual slot gets a new editor for a different field or project", async () => {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host); const committed = [];
  const render = (project, block, html) => {
    const key = richTextFieldKey(project, block);
    root.render(React.createElement(field, { key, editorKey: key, html, isActive: false, onActivate: () => {}, onInput: () => {}, onCommit: value => committed.push(value) }));
  };
  await act(async () => render("p", "a", "<p>A</p>"));
  const old = host.firstChild;
  await act(async () => render("p", "b", "<p>B</p>"));
  assert.notEqual(host.firstChild, old);
  await act(async () => render("other", "b", "<p>Other B</p>"));
  assert.equal(host.textContent, "Other B");
  assert.deepEqual(committed, []);
  await act(async () => root.unmount()); host.remove();
});

await test("a failed save retains the visible draft and allows the same text to be retried", async () => {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host); const commits = []; const completions = [];
  const key = richTextFieldKey("p", "text");
  const draw = html => root.render(React.createElement(field, {
    key, editorKey: key, html, isActive: true, commitOnInput: false,
    onActivate: () => {}, onInput: () => {},
    onCommit: value => { commits.push(value); return new Promise((resolve, reject) => completions.push({ resolve, reject })); }
  }));
  await act(async () => draw("<p>Saved</p>"));
  const editor = host.firstChild;
  await act(async () => {
    editor.innerHTML = "<p>Keep this draft</p>";
    editor.dispatchEvent(new window.Event("input", { bubbles: true }));
    document.body.dispatchEvent(new window.PointerEvent("pointerdown", { bubbles: true }));
  });
  await act(async () => completions[0].reject(new Error("Simulated failure")));
  assert.equal(editor.dataset.paideiaRichTextDirty, "true");
  await act(async () => draw("<p>Old reply</p>"));
  assert.equal(editor.innerHTML, "<p>Keep this draft</p>");
  await act(async () => document.body.dispatchEvent(new window.PointerEvent("pointerdown", { bubbles: true })));
  assert.deepEqual(commits, ["<p>Keep this draft</p>", "<p>Keep this draft</p>"]);
  await act(async () => { draw("<p>Keep this draft</p>"); completions[1].resolve(); });
  await act(async () => root.unmount()); host.remove();
});

await test("a delayed toolbar session update cannot claim another field", () => {
  const state = { current: { blockId: "b", itemId: null, itemField: null } };
  const before = state.current;
  const update = applicationFunction("setInlineRichTextSession", {
    richEditorRef: { current: { dataset: { richTextFieldKey: richTextFieldKey("p", "b") } } },
    currentProjectPath: "p", richTextFieldKey, inlineRichTextSessionRef: state
  });
  update({ blockId: "a", itemId: null, itemField: null });
  assert.equal(state.current, before);
  update({ blockId: "b", itemId: "other-item", itemField: "contentHtml" });
  assert.equal(state.current, before);
});

await test("every inline field has project/block/field identity; no inspector-to-shared-DOM sync remains", () => {
  let count = 0;
  function visit(node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(ast) === "InlineRichTextField") {
      const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
      for (const name of ["key", "editorKey"]) assert.ok(attributes.some(attribute => attribute.name.getText(ast) === name), `${name} at ${node.pos}`);
      count++;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(count >= 20);
  assert.doesNotMatch(app, /richEditorRef\.current\.innerHTML\s*=\s*blockForm\.contentHtml/);
});
await test("chapter title remains visible while saving; late replies preserve other edits, newest title and current lesson", async () => {
  let current = workspace([{ id: "text", contentHtml: "Original" }]);
  const chapter = current.project.course.modules[0].chapters[0]; chapter.title = "Before";
  const ref = { current: { projectPath: "project", workspaceState: current } };
  let pendingTitles = {};
  const queued = []; const failures = [];
  let finishRich;
  const chain = { current: new Promise(resolve => { finishRich = resolve; }) };
  const sequences = { current: new Map() };
  const entry = { module: { id: "module" }, chapter };
  const owner = richTextFieldKey("project", "chapter", null, "chapter-title");
  const handler = applicationFunction("handleUpdateChapterTitle", {
    t: key => key, currentProjectPath: "project", workspaceState: current,
    richTextFieldKey, chapterTitleSequences: sequences,
    chapterTitleForDisplay: chapter => pendingTitles[owner] ?? chapter.title,
    setPendingChapterTitles: update => { pendingTitles = update(pendingTitles); },
    inlineRichTextCommitRef: chain, panelInlineWorkspaceRef: ref,
    runAction: async (_, work) => work(),
    updateChapter: input => new Promise((resolve, reject) => queued.push({ input, resolve, reject })),
    mergeChapterTitleSave,
    setWorkspaceState: value => { current = value; },
    setImportDialog: value => failures.push(value)
  });
  const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  function reply(title) { const state = workspace([{ id: "text", contentHtml: "Original" }]); state.project.course.modules[0].chapters[0].title = title; return state; }
  const first = handler(entry, "After");
  assert.equal(pendingTitles[owner], "After", "submitted title is displayed immediately");
  await tick(); assert.equal(queued.length, 0, "rename waits for previous rich-text commit");
  finishRich(); await tick();
  assert.equal(queued[0].input.title, "After");
  blocks(ref.current.workspaceState).push({ id: "new", contentHtml: "New block" });
  queued[0].resolve(reply("After")); await first;
  assert.equal(current.project.course.modules[0].chapters[0].title, "After");
  assert.equal(pendingTitles[owner], undefined);
  assert.equal(blocks(current)[1].id, "new", "title reply cannot remove a new block");
  const second = handler(entry, "Second"); await tick();
  const newest = handler(entry, "Newest");
  queued[1].resolve(reply("Second")); await second; await tick();
  assert.equal(pendingTitles[owner], "Newest", "older acknowledgement does not clear newer draft");
  queued[2].resolve(reply("Newest")); await newest;
  assert.equal(current.project.course.modules[0].chapters[0].title, "Newest");
  const confirmed = handler(entry, "Confirmed before failure"); await tick();
  const failedLatest = handler(entry, "Failed latest");
  queued[3].resolve(reply("Confirmed before failure")); await confirmed; await tick();
  assert.equal(pendingTitles[owner], "Failed latest");
  queued[4].reject(new Error("Latest title failed")); await failedLatest;
  assert.equal(current.project.course.modules[0].chapters[0].title, "Confirmed before failure", "a failed newer request leaves the preceding successful commit visible");
  const failed = handler(entry, "Rejected"); await tick(); queued[5].reject(new Error("Disk unavailable")); await failed;
  assert.equal(current.project.course.modules[0].chapters[0].title, "Confirmed before failure");
  assert.equal(pendingTitles[owner], undefined);
  assert.equal(failures[1].message, "Disk unavailable");
  const moved = handler(entry, "Previous lesson pending"); await tick();
  const other = workspace([{ id: "other" }]); other.project.id = "other-lesson";
  ref.current = { projectPath: "other-project", workspaceState: other };
  queued[6].resolve(reply("Previous lesson pending")); await moved;
  assert.equal(ref.current.workspaceState, other, "a late reply cannot replace the new lesson");
});

await test("pending values are isolated by project and field; old success or failure cannot clear a newer commit", () => {
  const store = pendingModule.createPendingInlineTextStore();
  const key = richTextFieldKey("p", "block", "tab", "title");
  const old = store.begin(key, "First");
  const latest = store.begin(key, "Latest");
  store.settle(old, true); store.settle(old, false);
  assert.equal(store.get(key).html, "Latest");
  store.settle(latest, false);
  assert.equal(store.get(key).failed, true);
  assert.equal(store.get(richTextFieldKey("other", "block", "tab", "title")), undefined);
  assert.equal(store.get(richTextFieldKey("p", "block", "tab", "contentHtml")), undefined);
  const retry = store.begin(key, "Latest"); store.settle(retry, true);
  assert.equal(store.getSnapshot().size, 0);
});

const navigationModule = {};
new Function("exports", "require", "React", ts.transpileModule(await readFile("src/components/activities/EditableNavigationTitle.tsx", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React }
}).outputText)(navigationModule, name => {
  if (name === "react") return React;
  if (name === "../../i18n/react") return { useI18n: () => ({ t: () => "Edit" }) };
  throw new Error(name);
}, React);

for (const type of ["tabs", "accordion"]) {
  await test(`${type}: closing and reopening the real title editor preserves latest text across delayed replies`, async () => {
    const host = document.createElement("div"); document.body.append(host);
    const root = createRoot(host), writes = [];
    const key = richTextFieldKey(`title-${type}`, "block", "a", "title");
    const persisted = { id: "block", type, activityItems: [{ id: "a", title: "Old", contentHtml: "Body" }] };
    let refresh;
    function Harness() {
      const [, redraw] = React.useState(0); refresh = () => redraw(value => value + 1);
      const pending = React.useSyncExternalStore(pendingInlineText.subscribe, pendingInlineText.getSnapshot);
      const visible = blockWithPendingInlineText(persisted, `title-${type}`, pending);
      return React.createElement(navigationModule.EditableNavigationTitle, {
        renderEditor: finish => React.createElement("div", { className: "inline-rich-text-wrapper" }, React.createElement(field, {
          key, editorKey: key, html: visible.activityItems[0].title, isActive: true, commitOnInput: false, commitOnUnmount: true,
          onActivate: () => {}, onInput: () => {}, onCommit: html => {
            finish(); return new Promise((resolve, reject) => writes.push({ html, resolve, reject }));
          }
        })),
        children: React.createElement("span", { dangerouslySetInnerHTML: { __html: visible.activityItems[0].title } })
      });
    }
    await act(async () => root.render(React.createElement(Harness)));
    const edit = async text => {
      await act(async () => host.querySelector("button").dispatchEvent(new window.MouseEvent("dblclick", { bubbles: true, detail: 2 })));
      const editor = host.querySelector("[contenteditable]");
      await act(async () => {
        editor.innerHTML = text;
        editor.dispatchEvent(new window.Event("input", { bubbles: true }));
        document.body.dispatchEvent(new window.PointerEvent("pointerdown", { bubbles: true }));
      });
    };
    await edit("<b>First</b>");
    assert.equal(host.textContent, "First", "navigation label keeps the submitted title before disk replies");
    assert.equal(persisted.activityItems[0].title, "Old", "presentation must not turn the draft into persisted state");
    await act(async () => host.querySelector("button").dispatchEvent(new window.MouseEvent("dblclick", { bubbles: true, detail: 2 })));
    assert.equal(host.querySelector("[contenteditable]").innerHTML, "<b>First</b>");
    const editor = host.querySelector("[contenteditable]");
    await act(async () => {
      editor.innerHTML = "<i>Latest</i>"; editor.dispatchEvent(new window.Event("input", { bubbles: true }));
      document.body.dispatchEvent(new window.PointerEvent("pointerdown", { bubbles: true }));
    });
    await act(async () => { persisted.activityItems[0].title = "<b>First</b>"; refresh(); writes[0].resolve(); });
    assert.equal(host.textContent, "Latest", "old acknowledgement must not flash over latest label");
    await act(async () => writes[1].reject(new Error("Disk unavailable")));
    assert.equal(host.textContent, "Latest", "failed title remains recoverable after the editor has closed");
    await act(async () => host.querySelector("button").dispatchEvent(new window.MouseEvent("dblclick", { bubbles: true, detail: 2 })));
    assert.equal(host.querySelector("[contenteditable]").dataset.paideiaRichTextDirty, "true");
    await act(async () => document.body.dispatchEvent(new window.PointerEvent("pointerdown", { bubbles: true })));
    assert.equal(writes[2].html, "<i>Latest</i>");
    await act(async () => { persisted.activityItems[0].title = writes[2].html; refresh(); writes[2].resolve(); });
    assert.equal(pendingInlineText.get(key), undefined);
    assert.equal(host.textContent, "Latest");
    await act(async () => root.unmount()); host.remove();
  });
}

for (const family of ["tabs", "accordion", "slides", "timeline", "rich-text"]) {
  await test(`${family}: navigation before deferred blur preserves and saves a removed field exactly once`, async () => {
    const host = document.createElement("div"); document.body.append(host);
    const root = createRoot(host), writes = [];
    let item = "a", saved = "<p>Old</p>";
    const key = () => richTextFieldKey(`leave-${family}`, "block", item, "contentHtml");
    const draw = () => root.render(React.createElement(field, {
      key: key(), editorKey: key(), html: item === "a" ? saved : "<p>Other</p>", isActive: true,
      commitOnInput: false, commitOnUnmount: true, onActivate: () => {}, onInput: () => {},
      onCommit: html => new Promise(resolve => writes.push({ html, resolve }))
    }));
    await act(async () => draw());
    const editor = host.firstChild;
    await act(async () => { editor.innerHTML = "<p>Last keystroke</p>"; editor.dispatchEvent(new window.Event("input", { bubbles: true })); });
    await act(async () => { item = "b"; draw(); });
    assert.equal(writes.length, 1); assert.equal(writes[0].html, "<p>Last keystroke</p>");
    assert.equal(host.textContent, "Other");
    await act(async () => { item = "a"; draw(); });
    assert.equal(host.textContent, "Last keystroke", "reopened field must not read the old saved value");
    await act(async () => { saved = writes[0].html; draw(); writes[0].resolve(); });
    await act(async () => root.unmount()); host.remove();
    assert.equal(writes.length, 1, "unmodified reopening is not a second save");
  });
}

await test("cancelling a local activity form does not submit its unfinished field on unmount", async () => {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host); const writes = [];
  await act(async () => root.render(React.createElement(field, {
    editorKey: "local-form", html: "Old", isActive: true, commitOnInput: false,
    onActivate: () => {}, onInput: () => {}, onCommit: html => writes.push(html)
  })));
  await act(async () => { host.firstChild.innerHTML = "Cancelled"; host.firstChild.dispatchEvent(new window.Event("input", { bubbles: true })); });
  await act(async () => root.unmount()); host.remove();
  assert.deepEqual(writes, []);
});

await test("compact snapshot replies update only history and preserve newer edits or another project", async () => {
  const ref = { current: { projectPath: "p", workspaceState: workspace([{ id: "a", contentHtml: "Newer" }]) } };
  let resolve; const snapshots = [{ id: "snapshot", label: "Text", versionTag: "v1" }];
  const save = applicationFunction("saveCommittedInlineSnapshot", {
    createInlineSnapshot: () => new Promise(done => { resolve = done; }), panelInlineWorkspaceRef: ref,
    setWorkspaceState: state => { ref.current.workspaceState = state; }, setImportDialog: () => { throw new Error("unexpected failure"); }
  });
  const pending = save("p", "Text", "v1");
  const project = ref.current.workspaceState.project;
  resolve(snapshots); await pending;
  assert.equal(ref.current.workspaceState.project, project);
  assert.equal(ref.current.workspaceState.snapshots, snapshots);
  const moved = save("p", "Text", "v1");
  const other = workspace([{ id: "b", contentHtml: "Other" }]); ref.current = { projectPath: "other", workspaceState: other };
  resolve(snapshots); await moved; assert.equal(ref.current.workspaceState, other);
});

await window.happyDOM.close();
console.log(`${passed} editor state safety checks passed.`);
