import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Window } from "happy-dom";
import { createServer } from "vite";
import ts from "typescript";

const root = process.cwd();
const window = new Window({ url: "http://localhost/" });

for (const key of [
  "Node",
  "NodeFilter",
  "Element",
  "HTMLElement",
  "HTMLAnchorElement",
  "HTMLBRElement",
  "HTMLTableElement",
  "HTMLTableCellElement",
  "HTMLTableRowElement",
  "HTMLTableSectionElement",
  "Text",
  "DocumentFragment",
  "MutationObserver",
  "Range",
]) {
  globalThis[key] = window[key];
}
globalThis.window = window;
globalThis.document = window.document;
globalThis.DOMParser = window.DOMParser;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);

// happy-dom does not currently expose HTMLTableSectionElement.rows although
// WebView2 does. Keep this compatibility shim confined to the test process.
Object.defineProperty(window.HTMLTableSectionElement.prototype, "rows", {
  configurable: true,
  get() {
    return this.querySelectorAll(":scope > tr");
  },
});

const vite = await createServer({
  appType: "custom",
  configFile: false,
  logLevel: "error",
  root,
  server: { middlewareMode: true },
});

let passed = 0;

async function test(name, callback) {
  const filter = process.argv.find((arg) => arg.startsWith("--filter="))?.slice(9);
  if (filter && !new RegExp(filter).test(name)) return;
  try {
    await callback();
    passed += 1;
    console.log(`OK  ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function freshEditor() {
  const editor = document.createElement("div");
  editor.setAttribute("contenteditable", "true");
  document.body.replaceChildren(editor);
  return editor;
}

try {
  await test("reference cleanup covers partial, overflowing and whole-editor selections without touching targets", async () => {
    const markers = await vite.ssrLoadModule("/src/components/rich-text-toolbar/richTextBookmarks.ts");
    const editor = freshEditor();
    editor.innerHTML = '<p>Avant <span data-paideia-reference-id="a" data-paideia-bookmark-target="local"><strong>DNS</strong></span> après <span data-paideia-reference-id="b" data-paideia-bookmark-target="reference-bank:bank:entry"><em>SSO</em></span>.</p><p><span data-paideia-bookmark-id="local">Cible</span></p>';
    const refs = [...editor.querySelectorAll('[data-paideia-reference-id]')];
    const range = document.createRange();
    range.setStart(refs[0].querySelector('strong').firstChild, 1);
    range.setEnd(refs[0].querySelector('strong').firstChild, 2);
    assert.deepEqual(markers.richTextReferencesInRange(editor, range), [refs[0]]);
    range.selectNode(refs[0]);
    assert.deepEqual(markers.richTextReferencesInRange(editor, range), [refs[0]]);
    range.setStart(editor.querySelector('p').firstChild, 0);
    range.setEnd(refs[1].querySelector('em').firstChild, 1);
    assert.equal(markers.richTextReferencesInRange(editor, range).length, 2);
    range.setStartAfter(refs[0]);
    range.setEndBefore(refs[1]);
    assert.equal(markers.richTextReferencesInRange(editor, range).length, 0, 'boundary-adjacent references are untouched');
    range.collapse(true);
    assert.equal(markers.richTextReferencesInRange(editor, range).length, 0);
    const text = editor.textContent;
    range.selectNodeContents(editor);
    markers.richTextReferencesInRange(editor, range).forEach(markers.unwrapRichTextMarker);
    assert.equal(editor.querySelectorAll('[data-paideia-reference-id]').length, 0);
    assert.equal(editor.textContent, text);
    assert.equal(editor.querySelector('strong').textContent, 'DNS');
    assert.equal(editor.querySelector('em').textContent, 'SSO');
    assert.equal(editor.querySelector('[data-paideia-bookmark-id]').textContent, 'Cible');
  });
  await test("embedded reference banks resolve exact terms and autonomous definitions", async () => {
    const bookmarks = await vite.ssrLoadModule("/src/components/rich-text-toolbar/richTextBookmarks.ts");
    const project = {
      course: { modules: [] },
      referenceBanks: [{ id: "bank_network", name: "Réseau", entries: [{ id: "entry_dns", term: "DNS", definitionHtml: "<p>Nom de domaine.</p>" }] }]
    };
    const options = bookmarks.collectRichTextBookmarks(project);
    assert.equal(options.length, 1);
    assert.equal(options[0].id, "reference-bank:bank_network:entry_dns");
    assert.equal(options[0].sourceType, "reference-bank");
    assert.equal(bookmarks.normalizeReferenceTerm("  DÑS "), "dns");
    assert.equal(bookmarks.normalizeReferenceTerm("D.G.P.N"), "dgpn");
    assert.equal(bookmarks.normalizeReferenceTerm("D.G.P.N."), "dgpn");
    assert.equal(bookmarks.normalizeReferenceTerm(" d.g.p.n. "), "dgpn");
    assert.equal(bookmarks.normalizeReferenceTerm("phrase."), "phrase.");
    assert.equal(bookmarks.normalizeReferenceTerm("d.g.p.n"), "dgpn");
    assert.equal(bookmarks.normalizeReferenceTerm("dgpn"), "dgpn");
    assert.equal(bookmarks.normalizeReferenceTerm("3.14"), "3.14");
    const editor = freshEditor();
    editor.innerHTML = "<p>DNS</p>";
    const text = editor.querySelector("p").firstChild;
    const range = document.createRange();
    range.selectNodeContents(text);
    const node = bookmarks.insertRichTextReference(editor, range, options[0].id, options[0].label, options[0].excerpt, {
      bankId: options[0].bankId, entryId: options[0].entryId, definitionHtml: options[0].definitionHtml
    });
    assert.equal(node.getAttribute("data-paideia-reference-bank-id"), "bank_network");
    assert.equal(node.getAttribute("data-paideia-reference-entry-id"), "entry_dns");
    assert.equal(node.getAttribute("data-paideia-reference-definition"), "<p>Nom de domaine.</p>");
  });

  await test("inline RichBars stay out of activity layout regardless of CSS load order", async () => {
    const appCss = await readFile(path.join(root, "src/styles.css"), "utf8");
    const toolbarCss = await readFile(path.join(root, "src/components/rich-text-toolbar/RichTextToolbar.css"), "utf8");
    assert.match(toolbarCss, /\.rich-select-chevron\s*\{[^}]*width:\s*12px;[^}]*height:\s*8px/s);
    assert.match(toolbarCss, /\.rich-toolbar \.rich-paragraph-picker > summary \.rich-select-chevron\s*\{[^}]*right:\s*12px/s);
    assert.doesNotMatch(toolbarCss, /\.rich-paragraph-picker > summary::after\s*\{[^}]*content:\s*"⌄"/s);
    const appPlacement = appCss.match(/\.inline-rich-toolbar\s*\{[^}]*\}/)?.[0];
    const basePlacement = toolbarCss.match(/\.rich-toolbar\s*\{[^}]*\}/)?.[0];
    const floatingPlacement = toolbarCss.match(/\.rich-toolbar\.inline-rich-toolbar\s*\{[^}]*\}/)?.[0];
    assert.ok(appPlacement);
    assert.ok(basePlacement);
    assert.ok(floatingPlacement);
    const toolbarPlacement = `${basePlacement}\n${floatingPlacement}`;
    for (const [first, second] of [[appPlacement, toolbarPlacement], [toolbarPlacement, appPlacement]]) {
      const firstStyle = document.createElement("style");
      const secondStyle = document.createElement("style");
      firstStyle.textContent = first;
      secondStyle.textContent = second;
      document.head.append(firstStyle, secondStyle);
      try {
        const floating = document.createElement("div");
        floating.className = "rich-toolbar inline-rich-toolbar";
        const ordinary = document.createElement("div");
        ordinary.className = "rich-toolbar";
        document.body.replaceChildren(floating, ordinary);
        assert.equal(getComputedStyle(floating).position, "absolute");
        floating.classList.add("below");
        assert.equal(getComputedStyle(floating).position, "absolute");
        assert.equal(getComputedStyle(ordinary).position, "relative");
      } finally {
        firstStyle.remove();
        secondStyle.remove();
      }
    }
  });
  await test("paragraph picker closes outside and on Escape without consuming another command", async () => {
    const source = await readFile(path.join(root, "src/components/rich-text-toolbar/RichTextToolbar.tsx"), "utf8");
    const start = source.indexOf("useEffect(() => {\n    const closeOutside");
    assert(start >= 0);
    const effect = source.slice(start, source.indexOf("}, []);", start) + 7);
    const code = ts.transpileModule(effect, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const picker = document.createElement("details");
    picker.innerHTML = "<summary>Paragraphe</summary><button>H1</button>";
    const other = document.createElement("button");
    document.body.replaceChildren(picker, other);
    let cleanup;
    new Function("useEffect", "paragraphPickerRef", code)((callback) => { cleanup = callback(); }, { current: picker });
    try {
      picker.open = true;
      picker.querySelector("button").dispatchEvent(new window.PointerEvent("pointerdown", { bubbles: true }));
      assert.equal(picker.open, true);
      const outside = new window.PointerEvent("pointerdown", { bubbles: true, cancelable: true });
      other.dispatchEvent(outside);
      assert.equal(picker.open, false);
      assert.equal(outside.defaultPrevented, false);
      picker.open = true;
      const escape = new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      picker.querySelector("button").dispatchEvent(escape);
      assert.equal(picker.open, false);
      assert.equal(document.activeElement, picker.querySelector("summary"));
      assert.equal(escape.defaultPrevented, true);
    } finally { cleanup(); }
    picker.open = true;
    other.dispatchEvent(new window.PointerEvent("pointerdown", { bubbles: true }));
    assert.equal(picker.open, true, "Unmounting must remove document listeners");
  });

  const tableDom = await vite.ssrLoadModule("/src/components/rich-text-table/tableDom.ts");
  const { anchoredTableResize } = await vite.ssrLoadModule("/src/components/rich-text-table/tableResize.ts");
  await test("outer table resizing changes only its edge column and retains its position", () => {
    for (const side of ["table-left", "table-right"]) {
      const direction = side === "table-left" ? -1 : 1;
      for (const delta of [-50, 40]) {
        const resized = anchoredTableResize(side, delta * direction, 600, 200, 800);
        assert.equal(resized.edgeWidth, 200 + delta);
        assert.equal(resized.tableWidth, 600 + delta);
        assert.equal(side === "table-left" ? resized.offset + resized.tableWidth : resized.offset, side === "table-left" ? 700 : 100);
        assert.equal(resized.tableWidth - resized.edgeWidth, 400);
      }
      assert.equal(anchoredTableResize(side, 1000 * direction, 600, 200, 800).tableWidth, 700);
      const dragged = anchoredTableResize(side, 40 * direction, 600, 200, 800);
      assert.equal(side === "table-left" ? dragged.offset + dragged.tableWidth : dragged.offset, side === "table-left" ? 700 : 100);
      assert.equal(anchoredTableResize(side, -1000 * direction, 600, 200, 800).edgeWidth, 72);
    }
  });
  const appText = await readFile(path.join(root, "src/App.tsx"), "utf8");
  const appAst = ts.createSourceFile("App.tsx", appText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  await test("inline Rich Text ignores stale blur state and flushes before project navigation", () => {
    assert.match(appText, /dataset\.paideiaRichTextDirty = "true"/);
    assert.match(appText, /const syncAfterListEdit = \(\) => \{\s*markEditorDirty\(event\.currentTarget\)/s);
    assert.match(appText, /if \(consumeEditorDirtyState\(editorRef\.current\)\)\s*\{\s*commitHtml\(nextHtml\)/s);
    assert.match(appText, /if \(consumeEditorDirtyState\(editor\)\)\s*\{\s*commitHtml\(nextHtml\)/s);
    assert.match(appText, /async function flushActiveInlineRichTextCommit\(\)[\s\S]*await new Promise<void>[\s\S]*await inlineRichTextCommitRef\.current/);
    assert.match(appText, /async function flushPendingLessonEdits\(\)\s*\{\s*await flushActiveInlineRichTextCommit\(\)/s);
    assert.match(appText, /if \(currentProjectPath && tab\.path !== currentProjectPath\)\s*\{\s*await flushPendingLessonEdits\(\)/s);
    assert.match(appText, /useRef\(new Map<string, number>\(\)\)/);
    assert.doesNotMatch(appText, /const inlineRichTextDebounceRef = useRef<number/);
  });

  await test("activity structural mutations secure active Rich Text without relying on pointer blur", () => {
    assert.match(
      appText,
      /function startPointerDrag\([\s\S]*beginStructuralInlineRichTextFlush\("pointer-drag"\);\s*event\.preventDefault\(\);\s*event\.stopPropagation\(\)/
    );
    assert.match(
      appText,
      /async function secureInlineRichTextBeforeStructuralMutation\(\)[\s\S]*await primedFlush;[\s\S]*await flushActiveInlineRichTextCommit\(\);\s*setInlineRichTextSession\(null\)/
    );
    for (const action of ["create-block", "reorder-block", "duplicate-block", "paste-activity-block", "save-block", "delete-block"]) {
      const actionStart = appText.indexOf(`runAction("${action}"`);
      assert.ok(actionStart >= 0, `${action} action`);
      const actionBody = appText.slice(actionStart, actionStart + 240);
      assert.match(actionBody, /await secureInlineRichTextBeforeStructuralMutation\(\)/, `${action} secures Rich Text first`);
    }
  });

  function applicationFunction(name, dependencies) {
    if (name === "applyEditorFontFamily") dependencies = { richFontRequestRef: { current: 0 }, ...dependencies };
    let declaration;
    function visit(node) {
      if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node;
      ts.forEachChild(node, visit);
    }
    visit(appAst);
    assert.ok(declaration, name);
    const js = ts.transpileModule(declaration.getText(appAst), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    return new Function(...Object.keys(dependencies), `${js}; return ${name};`)(...Object.values(dependencies));
  }

  await test("header keeps the paragraph format explicitly selected by the author", () => {
    const normalizeHeaderInlineHtml = applicationFunction("normalizeHeaderInlineHtml", {
      decorateRichTextSeparatorsInHtml: (value) => value,
      normalizeFrenchTypographyInHtml: (value) => value,
      stripHtmlForEditor: (value) => {
        const container = document.createElement("div");
        container.innerHTML = value;
        return container.textContent ?? "";
      },
    });
    assert.equal(normalizeHeaderInlineHtml(""), "");
    assert.equal(normalizeHeaderInlineHtml("Titre brut"), "<h1>Titre brut</h1>");
    assert.equal(normalizeHeaderInlineHtml("<h1>Titre</h1>"), "<h1>Titre</h1>");
    assert.equal(normalizeHeaderInlineHtml("<h3>Sous-titre choisi</h3>"), "<h3>Sous-titre choisi</h3>");
    assert.equal(normalizeHeaderInlineHtml("<p>Paragraphe choisi</p>"), "<p>Paragraphe choisi</p>");
    assert.equal(normalizeHeaderInlineHtml("<div><h2>Titre Rise</h2></div>"), "<h2>Titre Rise</h2>");
  });
  await test("header sanitizer preserves the first-session heading level", async () => {
    const rustSanitizer = await readFile(new URL("../src-tauri/src/rich_text_sanitizer.rs", import.meta.url), "utf8");
    assert.match(rustSanitizer, /\(\?P<tag>h\[1-6\]\)/);
    assert.match(rustSanitizer, /format!\("<\{tag\}\{attributes\}\{styles\}>\{body\}<\/\{tag\}>"\)/);
    assert.doesNotMatch(rustSanitizer, /format!\("<h1\{attributes\}\{styles\}>\{body\}<\/h1>"\)/);
  });

  await test("native TR selections route actual font-size command through cells", () => {
    const editor = freshEditor();
    const { wrapper, table } = tableDom.createPaideiaTable(2, 3);
    editor.append(wrapper);
    Array.from(table.querySelectorAll("td")).forEach((cell) => { cell.innerHTML = '<p>abc</p>'; });
    const range = document.createRange();
    range.selectNodeContents(table.rows[0]);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    const selectedRichEditorTableCells = applicationFunction("selectedRichEditorTableCells", {
      tableCellsInRange: tableDom.tableCellsInRange, savedRangeRef: { current: null }
    });
    assert.equal(selectedRichEditorTableCells(editor).length, 3);
    let transactions = 0;
    const apply = applicationFunction("applyEditorFontSize", {
      richEditorRef: { current: editor }, selectedRichEditorTableCells,
      updatePendingInlineStyle() {}, setRichToolbarFontSize() {},
      runSelectedRichTableCellFormatting(root, cells, operation) {
        transactions++;
        assert.equal(tableDom.runTableFormattingTransaction(root, operation), true);
      }
    });
    apply("32px");
    assert.equal(transactions, 1);
    assert.equal(table.rows.length, 2);
    assert.equal(table.rows[0].cells.length, 3);
    assert.equal(table.rows[1].cells[0].style.fontSize, "");
    assert.equal(table.rows[0].cells[2].style.fontSize, "32px");
    assert.equal(editor.querySelector("span > table, tr > span, tbody > span"), null);
    const caret = document.createRange();
    caret.setStart(table.rows[0].cells[0].querySelector("p").firstChild, 1);
    caret.collapse(true);
    assert.equal(tableDom.tableCellsInRange(editor, caret).length, 1);
  });
  const { normalizePastedRichTextHtml, sanitizeRichTextHtml } = await vite.ssrLoadModule("/src/app/richTextSanitizer.ts");
  const richTextAlignment = await vite.ssrLoadModule("/src/app/richTextAlignment.ts");
  const listFormatting = await vite.ssrLoadModule("/src/app/richTextListFormatting.ts");
  await test("external clipboard HTML becomes stable paragraphs without vendor editor classes", () => {
    const pasted = '<span style="color:rgb(51, 78, 130)"><strong>Introduction</strong></span><p dir="auto" class="PDq2pG_selectionAnchorContainer">Première phrase.</p><p dir="auto" class="PDq2pG_selectionAnchorContainer"><br></p><p dir="auto">Deuxième phrase.</p>';
    const normalized = normalizePastedRichTextHtml(pasted);
    const root = document.createElement("div");
    root.innerHTML = normalized;
    assert.equal(root.children.length, 4);
    assert.ok([...root.children].every((child) => child.tagName === "P"));
    assert.equal(root.querySelector("[class], [dir='auto']"), null);
    assert.equal(root.children[0].textContent, "Introduction");
    assert.equal(root.children[1].textContent, "Première phrase.");
    assert.equal(root.children[3].textContent, "Deuxième phrase.");
  });
  await test("pasted alignment has one block owner and remains changeable", () => {
    const normalized = normalizePastedRichTextHtml(
      '<div style="text-align:right"><p><span style="color:red;text-align:justify"><strong style="text-align:center">Première</strong></span></p><p style="text-align:justify">Deuxième</p></div>',
    );
    const editor = freshEditor();
    editor.innerHTML = normalized;
    assert.equal(editor.querySelector("span").style.textAlign, "");
    assert.equal(editor.querySelector("strong").style.textAlign, "");
    assert.equal(editor.querySelector("span").style.color, "red");

    const paragraphs = [...editor.querySelectorAll("p")];
    const range = document.createRange();
    range.setStart(paragraphs[0].firstChild.firstChild.firstChild, 0);
    range.setEnd(paragraphs[1].firstChild, paragraphs[1].textContent.length);
    assert.equal(richTextAlignment.applyRichTextAlignment(editor, range, "center"), true);
    assert.deepEqual(paragraphs.map((paragraph) => paragraph.style.textAlign), ["center", "center"]);
    assert.ok(
      [...editor.querySelectorAll("span, strong")].every((element) => !element.style.textAlign),
    );

    const caret = document.createRange();
    caret.setStart(paragraphs[0].textContent ? paragraphs[0].querySelector("strong").firstChild : paragraphs[0], 2);
    caret.collapse(true);
    assert.equal(richTextAlignment.applyRichTextAlignment(editor, caret, "left"), true);
    assert.equal(paragraphs[0].style.textAlign, "left");
    assert.equal(paragraphs[1].style.textAlign, "center");
  });
  await test("multi-paragraph text color preserves every paragraph boundary", () => {
    const editor = freshEditor();
    editor.innerHTML = '<p><span>Première phrase.</span></p><p><br></p><p><span>Deuxième phrase.</span></p>';
    const paragraphs = [...editor.querySelectorAll("p")];
    const range = document.createRange();
    range.setStart(paragraphs[0].querySelector("span").firstChild, 0);
    range.setEnd(paragraphs[2].querySelector("span").firstChild, "Deuxième phrase.".length);
    assert.equal(listFormatting.formatRichTextSelection(editor, range, "color", "#335582"), true);
    assert.equal(editor.querySelectorAll("p").length, 3);
    assert.equal(editor.querySelectorAll("p")[0].textContent, "Première phrase.");
    assert.equal(editor.querySelectorAll("p")[1].innerHTML.toLowerCase(), "<br>");
    assert.equal(editor.querySelectorAll("p")[2].textContent, "Deuxième phrase.");
  });
  await test("removing a highlight clears only the selected text and keeps other formatting", () => {
    const editor = freshEditor();
    editor.innerHTML = '<p><span style="background-color:#f0c419"><strong>Avant milieu après</strong></span></p>';
    const text = editor.querySelector("strong").firstChild;
    const range = document.createRange();
    range.setStart(text, 6);
    range.setEnd(text, 12);
    assert.equal(listFormatting.formatRichTextSelection(editor, range, "background-color", "transparent"), true);
    assert.equal(editor.textContent, "Avant milieu après");
    assert.equal([...editor.querySelectorAll("strong")].map(element => element.textContent).join(""), editor.textContent);
    const parts = [...editor.querySelectorAll("strong")];
    assert.deepEqual(parts.map(element => element.textContent), ["Avant ", "milieu", " après"]);
    assert.equal(parts[0].closest("span").style.backgroundColor, "#f0c419");
    assert.equal(parts[1].closest("span").style.backgroundColor, "");
    assert.equal(parts[2].closest("span").style.backgroundColor, "#f0c419");
  });
  await test("removing a highlight also clears nested and mark highlights", () => {
    const editor = freshEditor();
    editor.innerHTML = '<p><mark style="background-color:yellow"><span style="background-color:red"><em>Texte</em></span></mark></p>';
    const range = document.createRange();
    range.selectNodeContents(editor.querySelector("em"));
    assert.equal(listFormatting.formatRichTextSelection(editor, range, "background-color", "transparent"), true);
    assert.equal(editor.textContent, "Texte");
    assert.equal(editor.querySelector("mark"), null);
    assert.equal(editor.querySelector("em").closest("span").style.backgroundColor, "");
  });
  for (const tag of ["ul", "ol"]) {
    await test(`${tag}: actual font and size commands preserve items and allow removing the list`, async () => {
      const editor = freshEditor();
      editor.innerHTML = `<${tag}><li>entrée 1</li><li><b>entrée 2</b></li><li>entrée 3</li><li>entrée 4</li></${tag}>`;
      const items = [...editor.querySelectorAll("li")];
      const selectText = () => {
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        const texts = [];
        while (walker.nextNode()) if (walker.currentNode.length) texts.push(walker.currentNode);
        const range = document.createRange();
        range.setStart(texts[0], 0);
        range.setEnd(texts.at(-1), texts.at(-1).length);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        return range;
      };
      const deps = {
        ...listFormatting,
        richEditorRef: { current: editor }, selectedRichEditorTableCells: () => [],
        saveRichEditorSelection() {}, savedSelectionBookmarkRef: { current: null },
        projectRichTextFonts: [{ id: "rich-bundled-test" }],
        restoreRichEditorSelection: selectText,
        captureRichEditorSelectionBookmark: () => ({}),
        restoreRichEditorSelectionFromBookmark: selectText,
        getNonCollapsedRichEditorCommandRange: () => window.getSelection().getRangeAt(0),
        richEditorRangeIsCellSafe: () => true,
        updatePendingInlineStyle() {}, setRichToolbarFontFamily() {}, setRichToolbarFontSize() {},
        syncRichToolbarContextFromSelection() {}, syncRichEditorHtml() {}, restoreRichEditorSelectionAfterToolbarTick() {},
        selectedRichTextListItems: () => [...editor.querySelectorAll("li")],
      };
      selectText();
      await applicationFunction("applyEditorFontFamily", deps)("PaideiaRichFont-rich-bundled-test");
      applicationFunction("applyEditorFontSize", deps)("32px");
      assert.deepEqual([...editor.querySelectorAll("li")], items);
      assert.equal(editor.querySelector("ul > span, ol > span, span > li"), null);
      assert.equal(editor.textContent, "entrée 1entrée 2entrée 3entrée 4");
      assert.equal(editor.querySelector("b").textContent, "entrée 2");
      assert.ok(items.every(item => item.style.getPropertyValue("--paideia-list-marker-size") === "32px"));
      const toggle = applicationFunction("applyStrictListToSelectedBlocks", {
        ...deps, HTMLLIElement: window.HTMLLIElement, HTMLUListElement: window.HTMLUListElement,
        HTMLOListElement: window.HTMLOListElement, savedRangeRef: { current: null },
        discardRichTextRangeBoundaryMarkers() {},
      });
      assert.equal(toggle(selectText(), tag === "ol" ? "insertOrderedList" : "insertUnorderedList"), true);
      assert.equal(editor.querySelector("ul, ol, li"), null);
      assert.equal(editor.textContent, "entrée 1entrée 2entrée 3entrée 4");
      // Simulate the old command's invalid wrapper after the user removed
      // its two accidental empty boundary entries, then exercise removal.
      editor.innerHTML = `<${tag}><span style="font-family:TestFont"><li><p>entrée 1</p></li><li>entrée 2</li></span></${tag}>`;
      assert.equal(toggle(selectText(), tag === "ol" ? "insertOrderedList" : "insertUnorderedList"), true);
      assert.equal(editor.querySelector("ul, ol, li"), null);
      assert.equal(editor.textContent, "entrée 1entrée 2");
    });
  }
  await test("partial list typography leaves text outside the selection untouched", () => {
    const editor = freshEditor();
    editor.innerHTML = '<ol><li>abcdef</li><li>ghijkl</li><li>mnop</li></ol>';
    const items = [...editor.querySelectorAll("li")];
    const range = document.createRange();
    range.setStart(items[0].firstChild, 2);
    range.setEnd(items[1].firstChild, 3);
    listFormatting.formatListSelection(editor, range, "font-size", "28px");
    assert.deepEqual([...editor.querySelectorAll("li")], items);
    assert.equal(items[0].querySelector("span").textContent, "cdef");
    assert.equal(items[1].querySelector("span").textContent, "ghi");
    assert.equal(items[2].innerHTML, "mnop");
    assert.equal(editor.textContent, "abcdefghijklmnop");
  });
  await test("list marker follows only the adjacent text, like office editors", () => {
    const editor = freshEditor();
    editor.innerHTML = '<ul><li><span style="color: rgb(18, 58, 122)">Texte adjacent</span> <strong style="color: rgb(211, 71, 60)">mot plus loin</strong></li><li><strong>Début gras</strong> <span style="color: rgb(211, 71, 60)">suite rouge</span></li><li>Début normal <strong>suite grasse</strong></li></ul>';
    const items = [...editor.querySelectorAll("li")];
    items.forEach(listFormatting.synchronizeListMarkerWithAdjacentText);
    assert.equal(items[0].style.getPropertyValue("--paideia-list-marker-color"), "rgb(18, 58, 122)");
    assert.equal(items[0].style.getPropertyValue("--paideia-list-marker-weight"), "");
    assert.equal(items[1].style.getPropertyValue("--paideia-list-marker-color"), "");
    assert.equal(items[1].style.getPropertyValue("--paideia-list-marker-weight"), "700");
    assert.equal(items[2].style.getPropertyValue("--paideia-list-marker-color"), "");
    assert.equal(items[2].style.getPropertyValue("--paideia-list-marker-weight"), "");
  });
  await test("changing a list marker preserves its items and inline formatting", () => {
    const editor = freshEditor();
    editor.innerHTML = '<ul><li>Premier <strong>important</strong></li><li>Deuxième</li></ul>';
    const items = [...editor.querySelectorAll("li")];
    const range = document.createRange();
    range.selectNodeContents(editor.querySelector("ul"));
    const applyMarker = applicationFunction("applyRichEditorListMarker", {
      richEditorRef: { current: editor },
      getRichEditorCommandRange: () => range,
      richEditorRangeIsCellSafe: () => true,
      captureRichEditorSelectionBookmark: () => ({}),
      selectedRichTextListItems: () => items,
      HTMLUListElement: window.HTMLUListElement,
      HTMLOListElement: window.HTMLOListElement,
      restoreRichEditorSelectionFromBookmark() {},
      clearPendingInlineStyle() {},
      normalizeEmptyRichTextListItems() {},
      syncRichToolbarContextFromSelection() {},
      syncRichEditorHtml() {},
      saveRichEditorSelection() {},
      restoreRichEditorSelectionAfterToolbarTick() {},
    });
    applyMarker("upper-alpha");
    assert.deepEqual([...editor.querySelectorAll("li")], items);
    assert.equal(editor.querySelector("ol")?.dataset.paideiaListMarker, "upper-alpha");
    assert.equal(editor.querySelector("ul"), null);
    assert.equal(editor.querySelector("strong")?.textContent, "important");
  });
  await test("legacy list wrappers are repaired without dropping text, empty items or font styles", () => {
    const editor = freshEditor();
    editor.innerHTML = '<ul><li></li><span style="font-family:TestFont"><span style="font-size:32px"><li>one</li><li>two</li></span></span><li></li></ul>';
    listFormatting.repairListInlineWrappers(editor);
    assert.equal(editor.querySelector("ul > span, span > li"), null);
    assert.equal(editor.querySelectorAll("ul > li").length, 4);
    assert.equal(editor.textContent, "onetwo");
    assert.equal(editor.querySelectorAll('li > span[style="font-family:TestFont"]').length, 2);
    const html = editor.innerHTML;
    listFormatting.repairListInlineWrappers(editor);
    assert.equal(editor.innerHTML, html);
  });
  await test("async font command retains native multi-cell target while font links", async () => {
    const editor = freshEditor();
    const { wrapper, table } = tableDom.createPaideiaTable(2, 3);
    editor.append(wrapper);
    table.querySelectorAll('td').forEach(cell => { cell.innerHTML = '<p>texte</p>'; });
    const range = document.createRange();
    range.selectNodeContents(table.rows[0]);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    const selectedRichEditorTableCells = applicationFunction('selectedRichEditorTableCells', {
      tableCellsInRange: tableDom.tableCellsInRange, savedRangeRef: { current: null }
    });
    let resolveFont;
    const pending = new Promise(resolve => { resolveFont = resolve; });
    const apply = applicationFunction('applyEditorFontFamily', {
      richEditorRef: { current: editor }, selectedRichEditorTableCells,
      saveRichEditorSelection() {}, savedSelectionBookmarkRef: { current: null },
      projectRichTextFonts: [], currentProjectPath: 'test',
      linkBundledRichTextFont: () => pending,
      updatePendingInlineStyle() {}, setRichToolbarFontFamily() {}, setProjectRichTextFonts() {},
      runSelectedRichTableCellFormatting(root, cells, operation) {
        assert.equal(cells.length, 3);
        assert.equal(tableDom.runTableFormattingTransaction(root, operation), true);
      }
    });
    const completion = apply('PaideiaRichFont-rich-bundled-marker');
    window.getSelection().removeAllRanges();
    resolveFont([]);
    await completion;
    assert.match(table.rows[0].cells[2].style.fontFamily, /marker/);
    assert.equal(table.rows[1].cells[0].style.fontFamily, '');
    assert.equal(table.rows.length, 2);
    assert.equal(table.rows[0].cells.length, 3);
  });
  await test("font change recognizes one structurally selected table cell and a saved selection", async () => {
    for (const toolbarFocused of [false, true]) {
      const editor = freshEditor();
      const { wrapper, table } = tableDom.createPaideiaTable(1, 2);
      editor.append(wrapper);
      const cell = table.rows[0].cells[0];
      cell.innerHTML = "<p>cellule</p>";
      table.rows[0].cells[1].innerHTML = "<p>voisin</p>";
      const range = document.createRange();
      range.selectNode(cell);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      if (toolbarFocused) {
        const outside = document.createElement("div");
        document.body.append(outside);
        const toolbarRange = document.createRange();
        toolbarRange.selectNodeContents(outside);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(toolbarRange);
      }
      const selectedRichEditorTableCells = applicationFunction("selectedRichEditorTableCells", {
        tableCellsInRange: tableDom.tableCellsInRange, savedRangeRef: { current: range }
      });
      const selected = selectedRichEditorTableCells(editor);
      assert.equal(selected.length, 1);
      assert(selected[0] === cell);
      await applicationFunction("applyEditorFontFamily", {
        richEditorRef: { current: editor }, selectedRichEditorTableCells,
        saveRichEditorSelection() {}, savedSelectionBookmarkRef: { current: null },
        projectRichTextFonts: [{ id: "rich-bundled-test" }],
        updatePendingInlineStyle() {}, setRichToolbarFontFamily() {},
        runSelectedRichTableCellFormatting(root, cells, operation) {
          assert.equal(tableDom.runTableFormattingTransaction(root, operation), true);
        }
      })("PaideiaRichFont-rich-bundled-test");
      assert.match(cell.style.fontFamily, /rich-bundled-test/);
      assert.equal(cell.textContent, "cellule");
      assert.equal(table.rows[0].cells[1].style.fontFamily, "");
      assert.equal(tableDom.tableGrid(table).columns, 2);
    }
  });

  await test("font changes inside one table cell affect only the selected text", async () => {
    const editor = freshEditor();
    const { wrapper, table } = tableDom.createPaideiaTable(1, 2);
    editor.append(wrapper);
    const cell = table.rows[0].cells[0];
    cell.innerHTML = "<p>avant cible après</p>";
    table.rows[0].cells[1].innerHTML = "<p>voisin</p>";
    const range = document.createRange();
    range.setStart(cell.querySelector("p").firstChild, 6);
    range.setEnd(cell.querySelector("p").firstChild, 11);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    const selectedRichEditorTableCells = applicationFunction("selectedRichEditorTableCells", {
      tableCellsInRange: tableDom.tableCellsInRange, savedRangeRef: { current: range }
    });
    assert.equal(selectedRichEditorTableCells(editor).length, 0);
    await applicationFunction("applyEditorFontFamily", {
      richEditorRef: { current: editor }, selectedRichEditorTableCells,
      saveRichEditorSelection() {}, savedSelectionBookmarkRef: { current: null },
      projectRichTextFonts: [{ id: "rich-bundled-test" }],
      restoreRichEditorSelection() {}, getNonCollapsedRichEditorCommandRange: () => range,
      richEditorRangeIsCellSafe: () => true, captureRichEditorSelectionBookmark: () => ({}),
      restoreRichEditorSelectionFromBookmark() {}, formatListSelection: () => false,
      updatePendingInlineStyle() {}, setRichToolbarFontFamily() {},
      syncRichToolbarContextFromSelection() {}, syncRichEditorHtml() {},
      restoreRichEditorSelectionAfterToolbarTick() {}
    })("PaideiaRichFont-rich-bundled-test");
    const formatted = cell.querySelector("span[data-paideia-font-id]");
    assert.equal(formatted?.textContent, "cible");
    assert.match(formatted.style.fontFamily, /rich-bundled-test/);
    assert.equal(cell.textContent, "avant cible après");
    assert.equal(table.rows[0].cells[1].innerHTML, "<p>voisin</p>");
  });

  await test("async font picker restores the captured text selection after focus moves", async () => {
    const editor = freshEditor();
    editor.innerHTML = "<p>avant cible après</p>";
    const selectOffsets = (start, end) => {
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      const pointAt = (offset) => {
        let consumed = 0;
        for (const node of nodes) {
          const length = node.nodeValue?.length ?? 0;
          if (offset <= consumed + length) return { node, offset: offset - consumed };
          consumed += length;
        }
        const last = nodes.at(-1);
        return { node: last, offset: last?.nodeValue?.length ?? 0 };
      };
      const startPoint = pointAt(start);
      const endPoint = pointAt(end);
      const range = document.createRange();
      range.setStart(startPoint.node, startPoint.offset);
      range.setEnd(endPoint.node, endPoint.offset);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      return range;
    };
    selectOffsets(6, 11);
    const bookmark = { anchorOffset: 6, focusOffset: 11 };
    let resolveFont;
    const pendingFont = new Promise(resolve => { resolveFont = resolve; });
    editor.focus = () => {
      const caret = document.createRange();
      caret.selectNodeContents(editor);
      caret.collapse(false);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(caret);
    };
    const completion = applicationFunction("applyEditorFontFamily", {
      richEditorRef: { current: editor },
      selectedRichEditorTableCells: () => [],
      saveRichEditorSelection() {},
      savedSelectionBookmarkRef: { current: bookmark },
      projectRichTextFonts: [], currentProjectPath: "test",
      linkBundledRichTextFont: () => pendingFont,
      restoreRichEditorSelectionFromBookmark() { selectOffsets(6, 11); return true; },
      restoreRichEditorSelection() {},
      getNonCollapsedRichEditorCommandRange() {
        const selection = window.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        return range && !range.collapsed ? range.cloneRange() : null;
      },
      updatePendingInlineStyle() {}, setRichToolbarFontFamily() {},
      richEditorRangeIsCellSafe: () => true,
      captureRichEditorSelectionBookmark: () => bookmark,
      formatListSelection: () => false,
      syncRichToolbarContextFromSelection() {}, syncRichEditorHtml() {},
      restoreRichEditorSelectionAfterToolbarTick() {}, ensurePendingStyleCaretCarrier() {},
      pendingInlineStyleRef: { current: {} }, setProjectRichTextFonts() {}
    })("PaideiaRichFont-rich-bundled-test");
    window.getSelection().removeAllRanges();
    resolveFont([]);
    await completion;
    const formatted = editor.querySelector("span[data-paideia-font-id]");
    assert.equal(formatted?.textContent, "cible");
    assert.equal(window.getSelection()?.toString(), "cible");
  });

  await test("latest font choice wins over an earlier delayed success or failure", async () => {
    for (const failFirst of [false, true]) {
      const editor = freshEditor();
      const { wrapper, table } = tableDom.createPaideiaTable(1, 1);
      editor.append(wrapper);
      const cell = table.rows[0].cells[0];
      let resolveFirst, rejectFirst;
      const first = new Promise((resolve, reject) => { resolveFirst = resolve; rejectFirst = reject; });
      const requestedFonts = [];
      let toolbarFont = "";
      const errors = [];
      const apply = applicationFunction("applyEditorFontFamily", {
        richEditorRef: { current: editor }, selectedRichEditorTableCells: () => [cell],
        saveRichEditorSelection() {}, savedSelectionBookmarkRef: { current: null },
        projectRichTextFonts: [], currentProjectPath: "test",
        linkBundledRichTextFont: (_projectPath, id) => { requestedFonts.push(id); return id === "first" ? first : Promise.resolve([]); },
        updatePendingInlineStyle() {}, setRichToolbarFontFamily: (font) => { toolbarFont = font; },
        setProjectRichTextFonts() {}, setFontOperationError: (error) => errors.push(error),
        runSelectedRichTableCellFormatting(root, cells, operation) { operation(); }
      });
      const pending = apply("PaideiaRichFont-rich-bundled-first");
      await apply("PaideiaRichFont-rich-bundled-second");
      assert.deepEqual(requestedFonts, ["first", "second"]);
      if (failFirst) rejectFirst(new Error("outdated failure"));
      else resolveFirst([]);
      await pending;
      assert.match(cell.style.fontFamily, /second/);
      assert.match(toolbarFont, /second/);
      assert.equal(errors.length, 0);
    }
  });

  await test("clear formatting retains table containers and saved custom dimensions", () => {
    const editor = freshEditor();
    editor.innerHTML = '<div class="layout" style="width:80%"><div class="paideia-rich-table-wrapper" style="width:90%"><table class="paideia-rich-table" data-paideia-table-custom-size="true" style="--paideia-table-custom-width:70%;--paideia-table-custom-offset:5%"><colgroup><col style="width:40%"><col style="width:60%"></colgroup><tbody><tr><td colspan="2" style="padding:12px;border:2px solid blue"><p style="font-size:32px"><b>texte</b></p></td></tr></tbody></table></div></div>';
    const structuralNodes = Array.from(editor.querySelectorAll('div,table,colgroup,col,tbody,tr,td'));
    const attributes = structuralNodes.map(node => node.outerHTML.split('>')[0]);
    const clear = applicationFunction('stripInlineFormattingFromNode', {
      restoreOriginalTextFromCaseTransforms() {}, clearRichTextOutlineMarkers() {},
      clearRichTextLineLeadingMetadata() {}, clearRichTextListItemTextFormatting() {}
    });
    const reset = applicationFunction('resetParagraphFormattingBlocks', {
      clearRichTextLineLeadingMetadata() {}, clearRichTextListItemTextFormatting() {}
    });
    reset(Array.from(editor.querySelectorAll('div,p')), editor);
    clear(editor);
    assert.deepEqual(structuralNodes.map(node => node.outerHTML.split('>')[0]), attributes);
    assert.equal(editor.querySelector('b'), null);
    assert.equal(editor.querySelector('p').style.fontSize, '');
    const persisted = sanitizeRichTextHtml(editor.innerHTML);
    assert.match(persisted, /--paideia-table-custom-width:\s*70%/);
    assert.match(persisted, /--paideia-table-custom-offset:\s*5%/);
  });
  const { decorateRichTextSeparatorsInHtml } = await vite.ssrLoadModule(
    "/src/components/rich-text-toolbar/richTextAutoformat.ts",
  );
  const richTextConfig = await vite.ssrLoadModule("/src/components/authoring/richTextConfig.ts");
  const richTextSelectionRange = await vite.ssrLoadModule("/src/app/richTextSelectionRange.ts");
  const richTextLineLeading = await vite.ssrLoadModule("/src/app/richTextLineLeading.ts");
  await test("emergency wrapping preserves real words and text, and stays idempotent", () => {
    const { isEmergencyWrapToken, normalizeEmergencyTextWrapping } = richTextLineLeading;
    for (const word of ['anticonstitutionnellement', 'Donaudampfschifffahrtsgesellschaft', 'interdisciplinarité', 'pneumonoultramicroscopicsilicovolcanoconiosis']) {
      assert.equal(isEmergencyWrapToken(word), false, word);
    }
    const tokens = ['a'.repeat(120), '1'.repeat(120), 'abcd'.repeat(30), '64sdf'.repeat(40), 'https://example.org/' + 'x'.repeat(100)];
    for (const token of tokens) assert.equal(isEmergencyWrapToken(token), true);
    const editor = document.createElement('div');
    editor.textContent = 'anticonstitutionnellement ' + tokens.join(' ') + ' fin';
    const before = editor.textContent;
    assert.equal(normalizeEmergencyTextWrapping(editor), true);
    assert.equal(editor.textContent, before);
    assert.equal(editor.querySelectorAll('[data-paideia-emergency-wrap]').length, tokens.length);
    const html = editor.innerHTML;
    assert.equal(normalizeEmergencyTextWrapping(editor), false);
    assert.equal(editor.innerHTML, html);
    assert.ok(sanitizeRichTextHtml(html).includes('data-paideia-emergency-wrap'));
    editor.querySelector('[data-paideia-emergency-wrap]').textContent = 'anticonstitutionnellement';
    normalizeEmergencyTextWrapping(editor);
    assert.equal(editor.querySelectorAll('[data-paideia-emergency-wrap]').length, tokens.length - 1);
  });

  await test("authored line leading remains a literal line multiplier", () => {
    assert.deepEqual(richTextLineLeading.resolveRichTextLineLeading(0.25, 1.5), {
      effectiveLineHeight: 0.25,
      offsetEm: 0.625,
      responsiveOffsetEm: 0.25,
      ratio: 0.25,
    });
    assert.equal(richTextLineLeading.resolveRichTextLineLeading(0.5, 1.5).effectiveLineHeight, 0.5);
    assert.equal(richTextLineLeading.resolveRichTextLineLeading(0.75, 1.5).effectiveLineHeight, 0.75);
    assert.equal(richTextLineLeading.resolveRichTextLineLeading(1, 1.5).effectiveLineHeight, 1);
    assert.equal(richTextLineLeading.resolveRichTextLineLeading(1.5, 1.5).effectiveLineHeight, 1.5);
    assert.equal(richTextLineLeading.resolveRichTextLineLeading(2, 1.5).effectiveLineHeight, 2);

    const editor = freshEditor();
    editor.innerHTML = '<p style="font-size:16px;line-height:0.25">Texte sur deux lignes</p>';
    richTextLineLeading.normalizeRichTextLineLeading(editor, window);
    const paragraph = editor.querySelector("p");
    assert.equal(paragraph.dataset.paideiaLineLeadingRatio, "0.25");
    assert.equal(paragraph.style.getPropertyValue("--paideia-line-leading-effective"), "0.25");
    assert.equal(paragraph.style.getPropertyValue("--paideia-line-leading-rendered"), "0.25em");
    assert.equal(paragraph.style.getPropertyValue("--paideia-line-leading-responsive-rendered"), "1em");
    assert.equal(paragraph.style.getPropertyValue("--paideia-line-leading-offset"), "0.625em");
    assert.equal(paragraph.style.getPropertyValue("--paideia-line-leading-responsive-offset"), "0.25em");
  });

  await test("line leading uses the largest font actually present in a block-line", () => {
    const editor = freshEditor();
    editor.innerHTML = `
      <div style="font-size:96px;line-height:1" data-paideia-line-leading-ratio="1">
        <span style="font-size:24px">456</span>
      </div>
    `;
    const line = editor.querySelector("div");
    richTextLineLeading.normalizeRichTextLineLeadingElement(line, window);
    assert.equal(window.getComputedStyle(line).fontSize, "96px");
    assert.equal(window.getComputedStyle(line.querySelector("span")).fontSize, "24px");
    assert.equal(line.style.getPropertyValue("--paideia-line-leading-rendered"), "0.25em");
    assert.equal(line.style.getPropertyValue("--paideia-line-leading-responsive-rendered"), "0.25em");
  });

  await test("imported non-breaking word separators become wrapping spaces", () => {
    const editor = freshEditor();
    editor.innerHTML = "<p>Coffee&nbsp;<span>Lake</span>&nbsp;Refresh&nbsp;: «&nbsp;Intel&nbsp;»</p>";
    assert.equal(richTextLineLeading.normalizeAuthoredTextBreakOpportunities(editor), true);
    const text = editor.textContent;
    assert.match(text, /^Coffee Lake Refresh/);
    assert.equal((text.match(/\u00a0/g) ?? []).length, 3);
    assert.match(text, /Refresh\u00a0: «\u00a0Intel\u00a0»/);
  });

  await test("list normalization preserves an exact selection separated by line breaks", () => {
    const editor = freshEditor();
    editor.innerHTML = "test de texte<br><br>123<br>345<br>456<br>789<br><br>texte final";
    const textNodes = [];
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    const selected = document.createRange();
    selected.setStart(textNodes[1], 0);
    selected.setEnd(textNodes[4], textNodes[4].nodeValue.length);
    const markers = richTextSelectionRange.markRichTextRangeBoundaries(selected);
    assert.ok(markers);

    const wrapper = document.createElement("div");
    while (editor.firstChild) wrapper.appendChild(editor.firstChild);
    editor.appendChild(wrapper);

    const restored = richTextSelectionRange.restoreRichTextRangeFromBoundaryMarkers(markers);
    assert.ok(restored);
    assert.equal(restored.toString(), "123345456789");
    assert.doesNotMatch(restored.toString(), /test de texte|texte final/);
    assert.equal(editor.textContent, "test de texte123345456789texte final");
  });

  await test("structural selection offsets distinguish consecutive line breaks", () => {
    const editor = freshEditor();
    editor.innerHTML = "avant<br><br>123<br>après";
    const textNodes = [];
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    const start = richTextSelectionRange.getRichTextLinearOffsetFromPoint(editor, textNodes[1], 0);
    assert.equal(start, "avant".length + 2);
    const restored = richTextSelectionRange.getRichTextPointFromLinearOffset(editor, start);
    const range = document.createRange();
    range.setStart(restored.node, restored.offset);
    range.setEnd(textNodes[1], textNodes[1].nodeValue.length);
    assert.equal(range.toString(), "123");
  });

  await test("table creation stays within the 8 x 8 contract", () => {
    const { wrapper, table } = tableDom.createPaideiaTable(12, 9);
    assert.equal(tableDom.tableGrid(table).rows, 8);
    assert.equal(tableDom.tableGrid(table).columns, 8);
    assert.equal(wrapper.dataset.paideiaRichTableWrapper, "true");
    assert.equal(table.dataset.paideiaTableWidth, "75");
  });

  await test("drag selection includes the final cell and expands as a rectangle", () => {
    const { table } = tableDom.createPaideiaTable(3, 3);
    const cells = tableDom.allTableCells(table);
    const selected = tableDom.expandedTableSelection(table, cells[0], cells[8]);
    assert.equal(selected.length, 9);
    assert.ok(selected.includes(cells[8]));
    assert.equal(tableDom.tableRowCells(table, cells[4]).length, 3);
    assert.equal(tableDom.tableColumnCells(table, cells[4]).length, 3);
  });

  await test("merge and split preserve a valid table grid", () => {
    const { table } = tableDom.createPaideiaTable(3, 3);
    const cells = tableDom.allTableCells(table);
    cells[0].innerHTML = "<p>A</p>";
    cells[1].innerHTML = "<p><strong>B</strong></p>";
    const selected = tableDom.expandedTableSelection(table, cells[0], cells[4]);
    assert.equal(selected.length, 4);
    assert.equal(tableDom.mergeTableCells(table, selected), true);
    assert.equal(cells[0].rowSpan, 2);
    assert.equal(cells[0].colSpan, 2);
    assert.match(cells[0].innerHTML, /<strong>B<\/strong>/);
    assert.equal(tableDom.splitTableCell(table, cells[0]), true);
    assert.equal(tableDom.tableGrid(table).anchors.length, 9);
  });

  await test("header row and column semantics remain reversible", () => {
    const { table } = tableDom.createPaideiaTable(3, 3);
    assert.equal(tableDom.setTableHeaderRow(table, true), true);
    const headerCells = Array.from(table.querySelectorAll("thead tr:first-child > th"));
    assert.equal(headerCells.length, 3);
    assert.ok(headerCells.every((cell) => cell.scope === "col"));
    assert.equal(tableDom.setTableHeaderColumn(table, true), true);
    assert.ok(tableDom.tableGrid(table).anchors.filter((slot) => slot.column === 0).every((slot) => slot.cell.tagName === "TH"));
    assert.equal(tableDom.setTableHeaderColumn(table, false), true);
    assert.equal(tableDom.setTableHeaderRow(table, false), true);
    assert.equal(table.querySelector("thead"), null);
  });

  await test("row and column operations respect their upper and lower bounds", () => {
    const { table } = tableDom.createPaideiaTable(2, 2);
    let reference = tableDom.allTableCells(table)[0];
    for (let i = 2; i < tableDom.PAIDEIA_TABLE_MAX_ROWS; i++) assert.equal(tableDom.addTableRow(table, reference, true), true);
    assert.equal(tableDom.addTableRow(table, reference, true), false);
    for (let i = 2; i < tableDom.PAIDEIA_TABLE_MAX_COLUMNS; i++) assert.equal(tableDom.addTableColumn(table, reference, true), true);
    assert.equal(tableDom.addTableColumn(table, reference, true), false);
    while (tableDom.tableGrid(table).rows > 1) {
      reference = tableDom.allTableCells(table)[0];
      assert.equal(tableDom.deleteTableRow(table, reference), true);
    }
    assert.equal(tableDom.deleteTableRow(table, tableDom.allTableCells(table)[0]), false);
    while (tableDom.tableGrid(table).columns > 1) {
      reference = tableDom.allTableCells(table)[0];
      assert.equal(tableDom.deleteTableColumn(table, reference), true);
    }
    assert.equal(tableDom.deleteTableColumn(table, tableDom.allTableCells(table)[0]), false);
  });

  await test("directional splits refine only the selected cell and preserve content and positioning", () => {
    for (const axis of ["horizontal", "vertical"]) {
      const { table } = tableDom.createPaideiaTable(8, 8);
      const cells = tableDom.allTableCells(table);
      cells.forEach((cell, i) => { cell.innerHTML = `<p>cell-${i}</p>`; });
      table.style.setProperty("--paideia-table-custom-offset", "13%");
      table.style.setProperty("--paideia-table-custom-width", "62%");
      const chosen = cells[27];
      assert.equal(tableDom.splitTableCellAlong(table, chosen, axis), true);
      let grid = tableDom.tableGrid(table);
      assert.equal(grid.rows, axis === "horizontal" ? 9 : 8);
      assert.equal(grid.columns, axis === "vertical" ? 9 : 8);
      assert.equal(grid.anchors.length, 65);
      assert.ok(cells.every((cell, i) => cell.textContent === `cell-${i}`));
      assert.equal(chosen.textContent, "cell-27");
      assert.equal(table.style.getPropertyValue("--paideia-table-custom-offset"), "13%");
      assert.equal(table.style.getPropertyValue("--paideia-table-custom-width"), "62%");
      for (const row of grid.slots) assert.equal(row.filter(Boolean).length, grid.columns);
      // A second split of a spanning neighbour reuses the existing track.
      const neighbour = axis === "horizontal" ? cells[26] : cells[19];
      assert.equal(tableDom.splitTableCellAlong(table, neighbour, axis), true);
      assert.equal(tableDom.tableGrid(table).anchors.length, 66);
      const restored = document.createElement("div"); restored.innerHTML = table.outerHTML;
      grid = tableDom.tableGrid(restored.querySelector("table"));
      assert.equal(grid.anchors.length, 66);
      for (const row of grid.slots) assert.equal(row.filter(Boolean).length, grid.columns);
    }
  });

  await test("directional and merged-cell splits apply to the complete cell selection", () => {
    for (const axis of ["horizontal", "vertical"]) {
      const { table } = tableDom.createPaideiaTable(2, 2);
      const cells = tableDom.allTableCells(table);
      cells.forEach((cell, index) => { cell.innerHTML = `<p>cell-${index}</p>`; });
      const results = tableDom.splitTableCellsAlong(table, cells, axis);
      const grid = tableDom.tableGrid(table);
      assert.equal(results.length, 8);
      assert.equal(grid.anchors.length, 8);
      assert.equal(grid.rows, axis === "horizontal" ? 4 : 2);
      assert.equal(grid.columns, axis === "vertical" ? 4 : 2);
      assert.ok(cells.every((cell, index) => cell.textContent === `cell-${index}`));
      for (const row of grid.slots) assert.equal(row.filter(Boolean).length, grid.columns);
    }

    const { table } = tableDom.createPaideiaTable(2, 2);
    const cells = tableDom.allTableCells(table);
    assert.equal(tableDom.mergeTableCells(table, [cells[0], cells[2]]), true);
    assert.equal(tableDom.mergeTableCells(table, [cells[1], cells[3]]), true);
    const results = tableDom.splitTableCells(table, [cells[0], cells[1]]);
    assert.equal(results.length, 4);
    assert.equal(tableDom.tableGrid(table).anchors.length, 4);
  });

  await test("selection track commands count each track once and insert one contiguous block", () => {
    for (const axis of ["row", "column"]) {
      for (const after of [false, true]) {
        const { table } = tableDom.createPaideiaTable(4, 4);
        const cells = tableDom.allTableCells(table);
        cells.forEach((cell, index) => { cell.innerHTML = `<p>${index}</p>`; });
        const selected = axis === "row" ? [cells[4], cells[5], cells[8], cells[9]] : [cells[1], cells[2], cells[5], cells[6]];
        assert.deepEqual(tableDom.selectedTableTracks(table, selected, axis), [1, 2]);
        assert.equal(tableDom.insertSelectedTableTracks(table, selected, axis, after), true);
        const grid = tableDom.tableGrid(table);
        assert.equal(axis === "row" ? grid.rows : grid.columns, 6);
        const boundary = after ? 3 : 1;
        for (let i = boundary; i < boundary + 2; i++) {
          const values = axis === "row" ? grid.slots[i] : grid.slots.map((row) => row[i]);
          assert(values.every((slot) => !slot.cell.textContent.trim()));
        }
        assert(cells.every((cell, index) => cell.textContent === String(index)));
        assert.equal(tableDom.deleteSelectedTableTracks(table, selected, axis), true);
        assert.equal(axis === "row" ? tableDom.tableGrid(table).rows : tableDom.tableGrid(table).columns, 4);
        for (const row of tableDom.tableGrid(table).slots) assert.equal(row.filter(Boolean).length, tableDom.tableGrid(table).columns);
      }
    }
  });

  await test("track insertion and multi-cell splitting reject the complete operation at limits", () => {
    for (const axis of ["horizontal", "vertical"]) {
      const { table } = tableDom.createPaideiaTable(axis === "horizontal" ? 32 : 1, axis === "vertical" ? 32 : 1);
      while ((axis === "horizontal" ? tableDom.tableGrid(table).rows : tableDom.tableGrid(table).columns) < 32) {
        const reference = tableDom.allTableCells(table)[0];
        if (axis === "horizontal") tableDom.addTableRow(table, reference, false);
        else tableDom.addTableColumn(table, reference, false);
      }
      const cells = tableDom.allTableCells(table);
      assert.equal(tableDom.mergeTableCells(table, [cells[0], cells[1]]), true);
      const before = table.outerHTML;
      assert.equal(tableDom.splitTableCellsAlong(table, [cells[0], cells[2]], axis).length, 0);
      assert.equal(table.outerHTML, before);
      const trackAxis = axis === "horizontal" ? "row" : "column";
      assert.equal(tableDom.insertSelectedTableTracks(table, [cells[0], cells[2]], trackAxis, true), false);
      assert.equal(table.outerHTML, before);
    }
  });

  await test("mixed cell properties reflect the selection and applying one property preserves others", async () => {
    const source = await readFile(path.join(root, "src/components/rich-text-table/RichTextTableController.tsx"), "utf8");
    const helper = source.slice(source.indexOf("const sharedValue ="), source.indexOf("const horizontalAlign ="));
    const code = ts.transpileModule(helper, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const { table } = tableDom.createPaideiaTable(1, 2);
    const cells = tableDom.allTableCells(table);
    cells[0].style.textAlign = "left";
    cells[1].style.textAlign = "right";
    cells[0].style.verticalAlign = "top";
    cells[1].style.verticalAlign = "bottom";
    const shared = new Function("allSelected", `${code}\nreturn sharedValue;`)(cells);
    assert.equal(shared((cell) => cell.style.textAlign), "mixed");
    cells.forEach((cell) => { cell.style.textAlign = "center"; });
    assert.equal(shared((cell) => cell.style.textAlign), "center");
    assert.equal(shared((cell) => cell.style.verticalAlign), "mixed");
    assert.equal(cells[0].style.verticalAlign, "top");
    assert.equal(cells[1].style.verticalAlign, "bottom");
  });

  await test("history restoration keeps the table menu and reconnects its cell selection", async () => {
    const source = await readFile(path.join(root, "src/components/rich-text-table/RichTextTableController.tsx"), "utf8");
    const restore = source.slice(source.indexOf("const restoreSnapshot ="), source.indexOf("const undo ="));
    const code = ts.transpileModule(restore, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const editor = document.createElement("div");
    const { wrapper, table } = tableDom.createPaideiaTable(2, 2);
    editor.append(wrapper);
    let cells = [table.rows[0].cells[0], table.rows[1].cells[1]];
    let menu = { table, cell: cells[0], x: 40, y: 80 };
    const original = editor.innerHTML;
    tableDom.insertSelectedTableTracks(table, [cells[0]], "row", false);
    const changed = editor.innerHTML;
    let submenu = "format";
    let notified = 0;
    for (const html of [original, changed]) {
      const previousTable = menu.table;
      const deps = {
        getEditor: () => editor, menu, selectedCells: cells,
        tableGrid: tableDom.tableGrid, currentSnapshotRef: { current: "" },
        clearSelection: () => { cells = []; }, selectCells: (next) => { cells = next; },
        anchorRef: { current: null }, lastActiveCellRef: { current: null },
        rememberActiveTableCell: () => {}, setMenu: (next) => { menu = next; },
        setActiveSubmenu: (next) => { submenu = next; }, setOperationError: () => {},
        onChange: () => { notified++; }
      };
      new Function(...Object.keys(deps), `${code}\nrestoreSnapshot(arguments[arguments.length - 1]);`)(...Object.values(deps), html);
      assert(menu && editor.contains(menu.table));
      assert.notEqual(menu.table, previousTable);
      assert(cells.every((cell) => menu.table.contains(cell)));
      assert.equal(submenu, "format");
    }
    assert.equal(notified, 2);
  });

  await test("deleting all selected tracks removes the table and its wrapper", () => {
    const { wrapper, table } = tableDom.createPaideiaTable(2, 2);
    const host = document.createElement("div");
    host.append(wrapper);
    assert.equal(tableDom.deleteSelectedTableTracks(table, tableDom.allTableCells(table), "row"), true);
    assert.equal(host.children.length, 0);
  });

  await test("split bounds do not block undoing merges at the editing limit", () => {
    for (const axis of ["horizontal", "vertical"]) {
      const { table } = tableDom.createPaideiaTable(1, 1);
      const first = tableDom.allTableCells(table)[0];
      for (let i = 1; i < 32; i++) assert.equal(tableDom.splitTableCellAlong(table, first, axis), true);
      const before = table.outerHTML;
      assert.equal(tableDom.splitTableCellAlong(table, first, axis), false);
      assert.equal(table.outerHTML, before);
      const cells = tableDom.allTableCells(table);
      assert.equal(tableDom.mergeTableCells(table, cells.slice(0, 2)), true);
      assert.equal(tableDom.splitTableCellAlong(table, first, axis), true);
      assert.equal(tableDom.mergeTableCells(table, tableDom.allTableCells(table)), true);
      assert.equal(tableDom.splitTableCell(table, first), true);
      assert.equal(tableDom.allTableCells(table).length, 32);
    }
  });

  await test("column insertions and unmerging preserve surrounding cell order", () => {
    const { table } = tableDom.createPaideiaTable(3, 3);
    const cells = tableDom.allTableCells(table);
    cells.forEach((cell, i) => { cell.textContent = String(i); });
    assert.equal(tableDom.addTableColumn(table, cells[1], false), true);
    assert.deepEqual(Array.from(table.rows[0].cells, c => c.textContent), ["0", "", "1", "2"]);
    assert.equal(tableDom.deleteTableColumn(table, table.rows[0].cells[1]), true);
    assert.equal(tableDom.mergeTableCells(table, [cells[0], cells[1], cells[3], cells[4]]), true);
    assert.equal(tableDom.splitTableCell(table, cells[0]), true);
    assert.equal(table.rows[0].cells[2].textContent, "2");
    assert.equal(table.rows[1].cells[2].textContent, "5");
  });

  await test("caret paragraphs are added around tables once only", () => {
    const editor = freshEditor();
    const { wrapper } = tableDom.createPaideiaTable(2, 2);
    editor.append(wrapper);
    assert.equal(tableDom.ensureTableCaretParagraphs(editor), true);
    assert.equal(editor.children.length, 3);
    assert.equal(editor.firstElementChild.tagName, "P");
    assert.equal(editor.lastElementChild.tagName, "P");
    assert.equal(tableDom.ensureTableCaretParagraphs(editor), false);
    assert.equal(editor.children.length, 3);
  });

  await test("multi-cell formatting is atomic and rejects table topology changes", () => {
    const editor = freshEditor();
    const { wrapper, table } = tableDom.createPaideiaTable(2, 2);
    editor.append(wrapper);
    const cells = tableDom.allTableCells(table);
    cells.slice(0, 2).forEach((cell) => cell.classList.add("paideia-rich-table-cell-selected"));
    let commits = 0;
    let rollbacks = 0;
    editor.addEventListener(tableDom.PAIDEIA_TABLE_FORMATTING_COMMIT_EVENT, () => { commits += 1; });
    editor.addEventListener(tableDom.PAIDEIA_TABLE_FORMATTING_ROLLBACK_EVENT, () => { rollbacks += 1; });

    assert.equal(tableDom.runTableFormattingTransaction(editor, () => {
      cells.slice(0, 2).forEach((cell) => { cell.style.fontSize = "24px"; });
    }), true);
    assert.equal(commits, 1);
    assert.equal(rollbacks, 0);
    assert.equal(tableDom.tableGrid(table).rows, 2);
    assert.equal(tableDom.tableGrid(table).columns, 2);
    assert.equal(cells[0].style.fontSize, "24px");

    assert.equal(tableDom.runTableFormattingTransaction(editor, () => {
      table.rows[0].append(document.createElement("td"));
    }), false);
    assert.equal(commits, 1);
    assert.equal(rollbacks, 1);
    const restoredTable = editor.querySelector("table");
    assert.equal(tableDom.tableGrid(restoredTable).rows, 2);
    assert.equal(tableDom.tableGrid(restoredTable).columns, 2);
    assert.equal(editor.querySelectorAll(".paideia-rich-table-cell-selected").length, 2);
  });

  await test("direct table-cell text receives a stable Rich Text block", () => {
    const { table } = tableDom.createPaideiaTable(1, 1);
    const cell = table.querySelector("td");
    cell.innerHTML = 'Texte direct <span style="font-size:22px">mixte</span>';
    assert.equal(tableDom.ensureTableCellTextBlocks(cell), true);
    assert.equal(tableDom.ensureTableCellTextBlocks(cell), false);
    assert.equal(cell.children.length, 1);
    assert.equal(cell.firstElementChild.tagName, "DIV");
    assert.match(cell.innerHTML, /font-size:\s*22px/);
  });

  await test("single-cell clipboard HTML remains text, not a table matrix", () => {
    const html = "<table><tbody><tr><td><strong>Texte</strong></td></tr></tbody></table>";
    assert.equal(tableDom.clipboardDataRepresentsTableMatrix(html, "Texte", false), false);
    assert.equal(tableDom.clipboardDataRepresentsTableMatrix(html, "Texte", true), true);
    assert.equal(tableDom.clipboardDataRepresentsTableMatrix(html, "A\tB", false), true);
  });

  await test("editor-only table state never leaks into persisted HTML", () => {
    const editor = freshEditor();
    const { wrapper, table } = tableDom.createPaideiaTable(2, 2);
    const cell = tableDom.allTableCells(table)[0];
    cell.classList.add("paideia-rich-table-cell-selected");
    const launcher = document.createElement("button");
    launcher.dataset.paideiaTableEditorOnly = "true";
    wrapper.append(launcher);
    editor.append(wrapper);
    tableDom.cleanRichTableEditorState(editor);
    assert.equal(editor.querySelector(".paideia-rich-table-cell-selected"), null);
    assert.equal(editor.querySelector("[data-paideia-table-editor-only]"), null);
  });

  await test("sanitizer keeps pedagogical Rich Text and removes executable content", () => {
    const html = sanitizeRichTextHtml(`
      <script>alert(1)</script>
      <table data-paideia-rich-table="true" onclick="bad()" style="border-collapse: collapse; position: fixed">
        <thead><tr><th scope="col" style="font-weight: 700; color: rgb(1, 2, 3)">Titre</th></tr></thead>
        <tbody><tr><td><p style="font-size: 18px; line-height: 0.25; --paideia-line-leading-effective: 1" data-paideia-line-leading="true" data-paideia-line-leading-ratio="0.25">Texte</p></td></tr></tbody>
      </table>
      <a href="javascript:alert(1)">Lien</a>
    `);
    assert.doesNotMatch(html, /script|onclick|javascript:|position\s*:/i);
    assert.match(html, /data-paideia-rich-table="true"/);
    assert.match(html, /scope="col"/);
    assert.match(html, /font-weight:\s*700/);
    assert.match(html, /font-size:\s*18px/);
    assert.match(html, /line-height:\s*0\.25/);
    assert.match(html, /--paideia-line-leading-effective:\s*1/);
    assert.match(html, /data-paideia-line-leading="true"/);
    assert.match(html, /data-paideia-line-leading-ratio="0\.25"/);
  });

  await test("sanitizer preserves persisted list marker formatting", () => {
    const html = sanitizeRichTextHtml(`
      <ol data-paideia-list-marker="upper-roman"><li style="--paideia-list-marker-color:#244585;--paideia-list-marker-size:20px;--paideia-list-marker-weight:700"><strong>Élément</strong></li></ol>
    `);
    assert.match(html, /data-paideia-list-marker="upper-roman"/);
    assert.match(html, /--paideia-list-marker-color:\s*#244585/);
    assert.match(html, /--paideia-list-marker-size:\s*20px/);
    assert.match(html, /--paideia-list-marker-weight:\s*700/);
  });

  await test("separator decoration is formatting-safe and idempotent", () => {
    const once = decorateRichTextSeparatorsInHtml("<p><strong>Avant ── après</strong></p>");
    const twice = decorateRichTextSeparatorsInHtml(once);
    assert.equal(twice, once);
    assert.match(once, /<strong>Avant <span data-paideia-rich-separator="true">──<\/span> après<\/strong>/);
  });

  await test("activity editor controls do not override nested authored fonts", async () => {
    const styles = await readFile(path.join(root, "src", "styles.css"), "utf8");
    const uiFontRule = styles.indexOf(".activity-editor-shell *,");
    const authoredFontBoundary = styles.indexOf(".activity-editor-shell .rich-editor,");
    assert.ok(uiFontRule >= 0);
    assert.ok(authoredFontBoundary > uiFontRule);
    assert.match(
      styles.slice(authoredFontBoundary, authoredFontBoundary + 320),
      /\.activity-editor-shell \.rich-editor \*,[\s\S]*\.activity-editor-shell \.inline-rich-text-field \*[\s\S]*font-family:\s*inherit/,
    );
  });

  await test("Rich Text availability remains explicit by activity type", () => {
    assert.equal(richTextConfig.hasRichTextEditor("rich-text"), true);
    assert.equal(richTextConfig.hasInlineRichTextEditor("image-text"), true);
    assert.equal(richTextConfig.hasInlineRichTextEditor("tabs"), false);
    assert.equal(richTextConfig.defaultRichTextContentHtml("header"), "");
    assert.equal(richTextConfig.richTextFallbackForField("quoteAuthorHtml"), "");
  });

  await test("a fresh activity cannot inherit the selected activity geometry", async () => {
    const appSource = await readFile(path.join(root, "src", "App.tsx"), "utf8");
    assert.match(appSource, /const usesFreshBlockDefaults = Boolean\(blockTypeOverride\)/);
    assert.match(
      appSource,
      /contentWidth: nextBlockType === "image-grid"\s*\? String\(IMAGE_GRID_BLOCK_DEFAULTS\.columns\)\s*:\s*usesFreshBlockDefaults \? "100" : blockForm\.contentWidth/,
    );
    assert.match(appSource, /mediaGap: usesFreshBlockDefaults \? "28px" : blockForm\.mediaGap/);
    assert.match(appSource, /verticalAlign: usesFreshBlockDefaults \? "center" : blockForm\.verticalAlign/);
  });

  await test("critical interaction contracts remain wired in the application", async () => {
    const appSource = await readFile(path.join(root, "src", "App.tsx"), "utf8");
    const toolbarSource = await readFile(path.join(root, "src", "components", "rich-text-toolbar", "RichTextToolbar.tsx"), "utf8");
    const toolbarStylesSource = await readFile(path.join(root, "src", "components", "rich-text-toolbar", "RichTextToolbar.css"), "utf8");
    const bookmarkDialogSource = await readFile(path.join(root, "src", "components", "rich-text-toolbar", "RichTextBookmarkDialog.tsx"), "utf8");
    const stylesSource = await readFile(path.join(root, "src", "styles.css"), "utf8");
    const tableControllerSource = await readFile(
      path.join(root, "src", "components", "rich-text-table", "RichTextTableController.tsx"),
      "utf8",
    );
    const tableStylesSource = await readFile(
      path.join(root, "src", "components", "rich-text-table", "RichTextTable.css"),
      "utf8",
    );

    assert.match(appSource, /savedRangeRef\.current = range\.cloneRange\(\)/);
    assert.match(appSource, /savedSelectionBookmarkRef\.current = captureRichEditorSelectionBookmark/);
    assert.match(appSource, /horizontalToolbarBounds[\s\S]{0,800}scrollViewport\.clientWidth - safeMargin/);
    assert.match(appSource, /positionedToolbarRect\.right > bounds\.right/);
    assert.match(appSource, /applyNativeCommandToSelectedRichTableCells\(editor, command, value\)/);
    assert.match(appSource, /applyStrictListToSelectedBlocks\(range, command\)/);
    assert.match(appSource, /List creation\/removal is exclusively handled by PAIDEIA/);
    assert.match(appSource, /selectionTouchesList/);
    assert.match(appSource, /Table layout is content structure, not text formatting/);
    assert.match(appSource, /selectionTouchesTable && !clearsWholeEditor/);
    assert.match(appSource, /runSelectedRichTableCellFormatting/);
    assert.match(appSource, /Never extract and reinsert a range crossing LI boundaries/);
    assert.match(appSource, /paragraph\.style\.removeProperty\("margin-inline-start"\)/);
    assert.match(appSource, /synchronizeListMarkerWithAdjacentText/);
    assert.match(appSource, /applyRichEditorListMarker/);
    assert.match(appSource, /data-paideia-list-marker/);
    assert.match(appSource, /--paideia-list-marker-color/);
    assert.match(appSource, /--paideia-list-marker-weight/);
    assert.match(toolbarSource, /kind: "unordered" as const,[\s\S]{0,520}kind: "ordered" as const/);
    assert.match(toolbarSource, /UNORDERED_LIST_MARKERS/);
    assert.match(toolbarSource, /ORDERED_LIST_MARKERS/);
    assert.match(toolbarSource, /const \[openListPicker, setOpenListPicker\]/);
    assert.match(toolbarSource, /data-rich-list-picker=\{listControl\.kind\}/);
    assert.match(toolbarSource, /document\.addEventListener\("pointerdown", handlePointerDown, true\)/);
    assert.match(toolbarSource, /onMouseDown=\{preserveSelection\}\s+onClick=\{\(\) => \{\s+onCommand\("setListMarker", marker\.value\);\s+\}\}/);
    assert.doesNotMatch(toolbarSource, /setOpenListPicker\(null\);\s+onCommand\("setListMarker", marker\.value\)/);
    assert.match(bookmarkDialogSource, /className="rich-reference-select-options"/);
    assert.match(toolbarStylesSource, /\.rich-reference-select-options \{[\s\S]{0,220}max-height: min\(462px, calc\(100vh - 320px\)\);[\s\S]{0,80}overflow-y: auto;/);
    assert.match(toolbarSource, /rememberedColorKey="rich-text-text-color"[\s\S]{0,80}splitApply/);
    assert.match(toolbarSource, /rememberedColorKey="rich-text-highlight-color"[\s\S]{0,80}splitApply/);
    assert.doesNotMatch(toolbarSource, /triggerVariant="field-fill"[\s\S]{0,160}splitApply/);
    assert.match(stylesSource, /data-paideia-list-marker="check"/);
    assert.match(stylesSource, /data-paideia-list-marker="upper-roman"/);
    assert.doesNotMatch(stylesSource, /li:has\([^)]*(?:strong|font-weight)/);
    assert.match(appSource, /data-paideia-line-leading-ratio/);
    assert.match(appSource, /normalizeAuthoredTextBreakOpportunities/);
    assert.match(appSource, /normalizeRichTextLineLeadingElement/);
    assert.match(appSource, /const \[lessonOpeningFontsPending, setLessonOpeningFontsPending\] = useState\(false\)/);
    assert.match(appSource, /importDialog=\{lessonOpeningFontsPending && lessonFontsLoading/);
    assert.doesNotMatch(appSource, /importDialog=\{lessonFontsLoading\s*\?/);
    assert.match(
      appSource,
      /displayMode=\{\["header", "quote", "note", "image-text", "course-exit"\]\.includes\(block\.type\) \? "expanded" : "collapsible"\}/,
    );
    assert.match(
      appSource,
      /inlineRichTextSessionRef\.current\?\.blockId === COURSE_COVER_TITLE_INLINE_ID[\s\S]{0,120}handleCourseCoverTitleInlineInput\(nextHtml\)/,
    );
    assert.match(
      appSource,
      /onLiveInput=\{\(editor, html\) => \{[\s\S]{0,320}handleCourseCoverTitleInlineInput\(/,
    );
    assert.match(
      appSource,
      /className="inline-rich-toolbar below course-cover-title-toolbar"[\s\S]{0,900}profile="full"[\s\S]{0,120}showListControls=\{false\}[\s\S]{0,120}showStrikethrough=\{false\}/,
    );
    assert.match(
      appSource,
      /course-intro-inline-wrapper[\s\S]{0,320}<RichTextToolbar[\s\S]{0,180}displayMode="expanded"/,
    );
    assert.match(tableControllerSource, /historyRef\.current\.length > 50/);
    assert.match(tableControllerSource, /PAIDEIA_TABLE_FORMATTING_COMMIT_EVENT/);
    assert.match(tableControllerSource, /caret\.collapse\(false\)/);
    assert.match(tableControllerSource, /onPointerDown=\{\(event\) => \{\s*event\.preventDefault\(\);\s*event\.stopPropagation\(\);/s);
    assert.match(tableControllerSource, /document\.addEventListener\("copy", handleCopy, true\)/);
    assert.match(tableControllerSource, /document\.addEventListener\("paste", handlePaste, true\)/);
    assert.match(tableControllerSource, /const transact = \(operation: \(\) => boolean \| void, keepMenuOpen = true\)/);
    assert.match(tableControllerSource, /if \(menu\?\.table === position\.table\)[\s\S]{0,180}setMenu\(null\)/);
    assert.match(tableControllerSource, /splitTableCellsAlong\(activeTable, allSelected, "horizontal"\)/);
    assert.match(tableControllerSource, /splitTableCellsAlong\(activeTable, allSelected, "vertical"\)/);
    assert.match(tableControllerSource, /splitTableCells\(activeTable, allSelected\)/);
    assert.match(tableStylesSource, /\.rich-table-menu-launcher \{[\s\S]{0,80}z-index: 5002;/);
  });

  console.log(`\n${passed} Rich Text non-regression checks passed.`);
} finally {
  await vite.close();
  await window.happyDOM.abort();
}
