import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

// Exercise the actual save/leave handlers with an asynchronous persistence
// boundary. No lesson on disk is loaded or changed by this regression check.
const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("App.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set([
  "tabsEditorFieldFallback", "tabsEditorFieldHasMeaningfulHtml", "normalizeTabsEditorFieldValue",
  "commitPanelInlineText", "finishPanelInlineEditing"
]);
const functions = [];
function visit(node) {
  if (ts.isFunctionDeclaration(node) && names.has(node.name?.text)) functions.push(node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(functions.length, names.size);
const compositionSource = await readFile(new URL("../src/components/activities/TabsActivity/composition.ts", import.meta.url), "utf8");
functions.unshift(compositionSource.replace(/^import .*;\r?\n/m, "").replace("export function", "function"));
const code = ts.transpileModule(functions.join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;

function fixture(blockType = "tabs") {
  const items = ["a", "b"].map((id) => ({
    id, title: `Tab ${id}`, contentTitle: "", contentHtml: "<p>Original</p>",
    assetRefs: [`assets/${id}.png`], imageCrop: { x: 10, y: 20, width: 60, height: 70 },
    mediaLayout: "image-right", imageSize: "small"
  }));
  const workspaceState = { project: { currentVersion: "test", pages: [{ id: "page", blocks: [
    { id: "tabs", type: blockType, title: "Panels", activityItems: items, panelRounded: true }
  ] }] } };
  const saves = [], snapshots = [], errors = [];
  const context = {
    currentProjectPath: "test-project",
    panelInlineWorkspaceRef: { current: { workspaceState, projectPath: "test-project" } },
    inlineRichTextCommitRef: { current: Promise.resolve() },
    inlineRichTextSessionRef: { current: null },
    richEditorRef: { current: null },
    richTextFieldKey: (...parts) => JSON.stringify(parts),
    pendingInlineText: { begin: () => ({}), settle: () => {}, get: () => undefined },
    getDefaultProjectPath: () => "default",
    flattenPages: (project) => project.pages,
    normalizeFrenchTypographyInHtml: (html) => html,
    normalizeHtmlForInlineCompare: (html) => html.trim(),
    stripHtmlForEditor: (html) => html.replace(/<[^>]*>/g, ""),
    cleanEditorHtmlForRichTextSession: (html) => html,
    t: (key) => key,
    localizedActivityLabel: (type) => type,
    saveCommittedInlineSnapshot: async (...snapshot) => { snapshots.push(snapshot); },
    logDevEvent: async (...args) => { errors.push(args); },
    setInlineRichTextSession: (session) => { context.inlineRichTextSessionRef.current = session; },
    persistBlockActivityItems: async ({ page, block }, activityItems) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      const next = structuredClone(context.panelInlineWorkspaceRef.current.workspaceState);
      const nextPage = next.project.pages.find((candidate) => candidate.id === page.id);
      nextPage.blocks = nextPage.blocks.map((candidate) => candidate.id === block.id ? { ...block, activityItems } : candidate);
      saves.push(next);
      context.panelInlineWorkspaceRef.current = { ...context.panelInlineWorkspaceRef.current, workspaceState: next };
      return next;
    }
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return { context, saves, snapshots, errors, items, currentItems: () => context.panelInlineWorkspaceRef.current.workspaceState.project.pages[0].blocks[0].activityItems };
}

{
  const f = fixture(), c = f.context;
  c.commitPanelInlineText("tabs", "a", "contentHtml", '<h3>Heading</h3><p><b>Bold</b> plain</p><table><tr><td>Cell</td></tr></table>');
  c.commitPanelInlineText("tabs", "b", "contentHtml", "<p>Second tab</p>");
  c.commitPanelInlineText("tabs", "b", "contentHtml", "<p>Second tab</p>");
  await c.inlineRichTextCommitRef.current;
  const [a, b] = f.currentItems();
  assert.equal(a.contentTitle, null);
  assert.match(a.contentHtml, /<h3>Heading<\/h3>/);
  assert.match(a.contentHtml, /<b>Bold<\/b> plain/);
  assert.match(a.contentHtml, /<td>Cell<\/td>/);
  assert.equal(b.contentHtml, "<p>Second tab</p>");
  assert.equal(f.saves.length, 2, "duplicate blur must not save twice");
  for (let i = 0; i < 2; i++) {
    for (const key of ["title", "assetRefs", "imageCrop", "mediaLayout", "imageSize"]) {
      assert.deepEqual(f.currentItems()[i][key], f.items[i][key], `${key} must be preserved`);
    }
  }
  assert.equal(f.errors.length, 0);
}

{
  const f = fixture(), c = f.context;
  let blurred = false;
  c.inlineRichTextSessionRef.current = { blockId: "tabs", itemId: "a", itemField: "contentHtml" };
  c.richEditorRef.current = { dataset: {}, innerHTML: "<p>Last keystroke</p>", blur: () => { blurred = true; } };
  c.finishPanelInlineEditing("tabs");
  assert.equal(blurred, true);
  assert.equal(c.inlineRichTextSessionRef.current, null, "leave must close the old toolbar");
  c.inlineRichTextSessionRef.current = { blockId: "tabs", itemId: "b", itemField: "contentHtml" };
  await c.inlineRichTextCommitRef.current;
  assert.equal(f.currentItems()[0].contentHtml, "<p>Last keystroke</p>");
  assert.equal(c.inlineRichTextSessionRef.current.itemId, "b", "an old save must not reactivate its toolbar");
}

{
  const f = fixture(), c = f.context;
  c.commitPanelInlineText("tabs", "a", "contentTitle", "<p></p>");
  c.commitPanelInlineText("tabs", "missing", "contentHtml", "<p>Removed tab</p>");
  await c.inlineRichTextCommitRef.current;
  assert.equal(f.saves.length, 0, "empty optional title and removed tab must not create content");
  c.commitPanelInlineText("tabs", "a", "contentHtml", "<table><tr><td><br></td></tr></table>");
  await c.inlineRichTextCommitRef.current;
  assert.match(f.currentItems()[0].contentHtml, /<table>/, "an empty table must survive saving");
  c.commitPanelInlineText("tabs", "b", "contentHtml", "<p>Wrong project</p>");
  c.panelInlineWorkspaceRef.current.projectPath = "another-project";
  await c.inlineRichTextCommitRef.current;
  assert.equal(f.saves.length, 1, "pending edits must not target another project");
}

{
  const f = fixture(), c = f.context;
  const item = f.currentItems()[0];
  item.contentTitle = '<strong style="color:blue">Legacy title</strong>';
  const composition = c.tabsCompositionHtml(item);
  assert.equal(composition, '<h3><strong style="color:blue">Legacy title</strong></h3><p>Original</p>');
  c.commitPanelInlineText("tabs", "a", "contentHtml", composition);
  await c.inlineRichTextCommitRef.current;
  assert.equal(f.saves.length, 0, "opening and leaving a legacy composition must not rewrite it");
  c.commitPanelInlineText("tabs", "a", "contentHtml", composition + "<p>Added</p>");
  await c.inlineRichTextCommitRef.current;
  assert.equal(f.currentItems()[0].contentTitle, null);
  assert.equal(c.tabsCompositionHtml(f.currentItems()[0]), composition + "<p>Added</p>", "legacy title must appear once after saving");
  c.commitPanelInlineText("tabs", "a", "contentHtml", "<p></p>");
  await c.inlineRichTextCommitRef.current;
  assert.equal(c.tabsCompositionHtml(f.currentItems()[0]), "", "clearing the whole composition must not resurrect the old title");
  assert.equal(c.tabsCompositionHtml({ contentTitle: "<p>&nbsp;</p>", contentHtml: "<p>Body</p>" }), "<p>Body</p>");
}

{
  const f = fixture("accordion"), c = f.context;
  let blurred = false;
  c.inlineRichTextSessionRef.current = { blockId: "tabs", itemId: "a", itemField: "contentHtml" };
  c.richEditorRef.current = {
    dataset: {},
    innerHTML: '<p><b>Panel text</b></p><table><tr><td>Cell</td></tr></table>',
    blur: () => { blurred = true; }
  };
  c.finishPanelInlineEditing("tabs");
  assert.equal(blurred, true, "closing an accordion panel must finish editing before unmount");
  assert.equal(c.inlineRichTextSessionRef.current, null);
  c.commitPanelInlineText("tabs", "b", "contentHtml", "<p>Another panel</p>");
  await c.inlineRichTextCommitRef.current;
  assert.equal(f.currentItems()[0].contentHtml, c.richEditorRef.current.innerHTML);
  assert.equal(f.currentItems()[1].contentHtml, "<p>Another panel</p>");
  for (let i = 0; i < 2; i++) {
    for (const key of ["title", "assetRefs", "imageCrop", "mediaLayout", "imageSize", "contentTitle"]) {
      assert.deepEqual(f.currentItems()[i][key], f.items[i][key], `accordion ${key} must be preserved`);
    }
  }
  c.commitPanelInlineText("tabs", "a", "contentHtml", "<p></p>");
  await c.inlineRichTextCommitRef.current;
  assert.equal(f.currentItems()[0].contentHtml, "", "an empty panel must remain editable after saving");
  assert.equal(f.errors.length, 0);
}

for (const type of ["tabs", "accordion"]) {
  const f = fixture(type), c = f.context;
  const original = structuredClone(f.currentItems()[0]);
  let blurred = false;
  c.inlineRichTextSessionRef.current = { blockId: "tabs", itemId: "a", itemField: "title" };
  c.richEditorRef.current = { dataset: {}, innerHTML: "<b>New label</b>", blur: () => { blurred = true; } };
  c.finishPanelInlineEditing("tabs");
  await c.inlineRichTextCommitRef.current;
  assert.equal(blurred, true);
  assert.equal(f.currentItems()[0].title, "<b>New label</b>");
  for (const key of ["contentHtml", "contentTitle", "assetRefs", "imageCrop"]) {
    assert.deepEqual(f.currentItems()[0][key], original[key], `${type} title edit preserves ${key}`);
  }
  assert.equal(f.errors.length, 0);
}

console.log("Tabs and accordion inline: composition, navigation titles, sequential saves, panel closing, images and project guard OK.");
