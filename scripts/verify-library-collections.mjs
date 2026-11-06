import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const screen = await readFile(new URL("../src/components/project-library/ProjectLibraryScreen.tsx", import.meta.url), "utf8");
const api = await readFile(new URL("../src/lib/projectApi.ts", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

assert.match(app, /assignedLibraryCollectionNames[\s\S]{0,500}allLibraryProjects\.some\(\(entry\) => entry\.collection === collection\)/);
assert.match(app, /displayedLibraryCollectionLabels = collectionNames/);
assert.doesNotMatch(app, /newLibraryCollectionsThisSession/);
assert.match(app, /setCustomLibraryCollections\(\(current\) => current\.filter\(\(item\) => item !== collection\)\)/);
assert.match(app, /collectionCount=\{assignedLibraryCollectionNames\.length\}/);
assert.match(screen, /label: t\("library\.collections"\), count: collectionCount/);
assert.match(api, /libraryCollectionOverrides: Record<string, string>/);
assert.match(app, /LIBRARY_NATIVE_PREFERENCES_MIGRATED_KEY/);
assert.match(styles, /\.library-card-menu button:not\(:disabled\):hover/);
assert.match(styles, /\.library-card-menu button:focus-visible/);
assert.match(styles, /\.library-card-menu button\.danger:not\(:disabled\):hover/);

console.log("Collections: assigned collections and reusable label catalogue are separate.");

// Exercise the actual drop and click callbacks together: a completed drop must
// assign the label without adding a search criterion or opening the filters.
function callback(source, predicate, dependencies) {
  const ast = ts.createSourceFile("test.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) {
    if (predicate(node)) found = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found);
  const js = ts.transpileModule(`const callback = ${found.getText(ast).replace(/^export\s+/, "")};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }
  }).outputText;
  return new Function(...Object.keys(dependencies), `${js}; return callback;`)(...Object.values(dependencies));
}
// Evaluate the actual catalogue and collection derivations across assignment, removal and reload.
let projects = [];
let catalogue = ["Reusable"];
let images = { Reusable: "cover.webp" };
let hidden = ["Reusable"];
let selected = "Reusable";
let colors = { Reusable: "#123456" };
function derive(name, dependencies) {
  return callback(app, node => ts.isArrowFunction(node) && ts.isCallExpression(node.parent)
    && ts.isVariableDeclaration(node.parent.parent) && node.parent.parent.name.getText() === name, dependencies)();
}
function catalogueLabels() {
  return derive("collectionNames", { allLibraryProjects: projects, customLibraryCollections: catalogue,
    isReservedLibraryCollection: () => false, libraryCollectionSortDirection: "asc" });
}
function collections() {
  return derive("assignedLibraryCollectionNames", { collectionNames: catalogueLabels(), allLibraryProjects: projects });
}
function retainDiscoveredLabels() {
  callback(app, node => ts.isArrowFunction(node) && node.getText().includes("const missing = collectionNames.filter")
    && ts.isCallExpression(node.parent) && node.parent.expression.getText() === "useEffect", {
      userPreferencesLoadedRef: { current: true }, collectionNames: catalogueLabels(),
      setCustomLibraryCollections: update => { catalogue = update(catalogue); }
    })();
}
function cleanup(ready = true) {
  callback(app, node => ts.isArrowFunction(node) && node.getText().includes("const assigned = new Set(assignedLibraryCollectionNames)")
    && ts.isCallExpression(node.parent) && node.parent.expression.getText() === "useEffect", {
      userPreferencesLoadedRef: { current: true }, libraryProjectsLoadedRoot: ready ? "root" : null,
      importDestinationRoot: "root", collaborationFeatureState: { enabled: false },
      collaborationLibraryVisible: false, collaborationCatalogueReady: false,
      assignedLibraryCollectionNames: collections(),
      setLibraryCollectionImages: update => { images = update(images); },
      setHiddenLibraryCollectionTiles: update => { hidden = update(hidden); },
      setSelectedLibraryCollection: update => { selected = update(selected); }
    })();
}
assert.deepEqual(catalogueLabels(), ["Reusable"]);
assert.deepEqual(collections(), []);
cleanup(false);
assert.deepEqual(images, { Reusable: "cover.webp" }, "Loading is not an empty library");
projects = [{ collection: "Reusable" }, { collection: "From lesson" }];
retainDiscoveredLabels();
assert.deepEqual(collections(), ["From lesson", "Reusable"]);
projects = [];
cleanup();
assert.deepEqual(collections(), []);
assert.deepEqual(images, {}, "No collection cover remains after the last assignment disappears");
assert.deepEqual(hidden, []);
assert.equal(selected, null);
assert.deepEqual(colors, { Reusable: "#123456" });
const saved = JSON.stringify({ catalogue, colors });
catalogue = JSON.parse(saved).catalogue;
assert.deepEqual(catalogueLabels(), ["From lesson", "Reusable"], "Orphan labels survive reopening");
projects = [{ collection: "Reusable" }];
assert.deepEqual(collections(), ["Reusable"], "Reassignment creates only the nonempty collection");
const removeCollection = callback(app, node => ts.isFunctionDeclaration(node) && node.name?.text === "removeLibraryCollection", {
  window: { confirm: () => true }, t: () => "Confirm", allLibraryProjects: projects,
  libraryProjectPreferenceKey: entry => entry.archivePath,
  setLibraryCollectionOverrides: update => update({}),
  setCustomLibraryCollections: update => { catalogue = update(catalogue); },
  setHiddenLibraryCollectionTiles: update => { hidden = update(hidden); },
  setLibraryCollectionImages: update => { images = update(images); },
  setSelectedLibraryCollection: update => { selected = update(selected); },
  setLibraryActionMenu: () => {}
});
removeCollection("Reusable");
assert.ok(catalogue.includes("Reusable"), "Removing a collection must not delete its reusable label");
assert.equal(colors.Reusable, "#123456");
const deleteLabel = callback(app, node => ts.isFunctionDeclaration(node) && node.name?.text === "deleteLibraryCollectionLabel", {
  allLibraryProjects: [], libraryProjectPreferenceKey: entry => entry.archivePath,
  setCustomLibraryCollections: update => { catalogue = update(catalogue); },
  setLibraryCollectionOverrides: update => update({}),
  setLibraryCollectionImages: update => { images = update(images); },
  setLibraryCollectionColors: update => { colors = update(colors); },
  setHiddenLibraryCollectionTiles: update => { hidden = update(hidden); },
  setSelectedLibraryCollection: update => { selected = update(selected); }
});
deleteLabel("Reusable");
projects = [];
assert.deepEqual(catalogueLabels(), ["From lesson"], "Explicit label deletion remains available");
console.log("Labels: retained at zero lessons and after reload; empty collections leave no cover, hidden entry or selection.");

const suppression = { current: false };
const dragged = { current: "Label" };
const timers = [];
const assignments = [];
const noop = () => {};
const drop = callback(app, node => ts.isArrowFunction(node)
  && ts.isVariableDeclaration(node.parent) && node.parent.name.getText() === "finishCollectionDrop", {
  clearHold: noop, setKeywordDragGhost: noop, pendingLibraryCollectionDrag: { keyword: false },
  draggedLibraryCollectionRef: dragged,
  suppressLibraryCollectionClickRef: suppression,
  updateHoveredProject: () => "projects/lesson",
  window: { setTimeout: fn => timers.push(fn) },
  assignLibraryCollection: (...args) => assignments.push(args),
  setDraggedLibraryCollection: noop, setPendingLibraryCollectionDrag: noop, setHoveredLibraryDropArchive: noop
});
let opened = 0;
let labels = [];
const click = callback(screen, node => ts.isArrowFunction(node)
  && ts.isJsxExpression(node.parent) && ts.isJsxAttribute(node.parent.parent)
  && node.parent.parent.name.getText() === "onClick" && node.getText().includes("if (!isManagingCollections)"), {
  shouldSuppressCollectionClick: () => suppression.current,
  isManagingCollections: false, collection: "Label",
  labelFilter: [], selectedCollection: null,
  onSearchApply: filters => { labels = filters.labels; }, setFiltersOpen: value => { if (value) opened++; }
});
assert.match(app, /shouldSuppressCollectionClick=\{\(\) => suppressLibraryCollectionClickRef\.current\}/);
drop({ clientX: 100, clientY: 100 });
click({ preventDefault: noop, stopPropagation: noop });
assert.deepEqual(assignments, [["projects/lesson", "Label"]]);
assert.equal(opened, 0);
assert.deepEqual(labels, []);
timers.forEach(fn => fn());
click({ preventDefault: noop, stopPropagation: noop });
assert.equal(opened, 0);
assert.deepEqual(labels, ["Label"]);
console.log("Collections: drop assigns without opening filters; a subsequent simple click filters directly.");

const config = await readFile(new URL("../src/app/libraryConfig.ts", import.meta.url), "utf8");
const emptyMessageKey = callback(config, node => ts.isFunctionDeclaration(node) && node.name?.text === "libraryFilterEmptyMessageKey", {});
assert.equal(emptyMessageKey(["Unused"], [], ""), "library.noLessonForLabel");
assert.equal(emptyMessageKey([], ["Unused"], ""), "library.noLessonForKeyword");
assert.equal(emptyMessageKey(["A"], ["B"], ""), "library.noLessonForFilters");
assert.equal(emptyMessageKey(["A", "B"], [], ""), "library.noLessonForFilters");
assert.equal(emptyMessageKey([], ["A", "B"], ""), "library.noLessonForFilters");
assert.equal(emptyMessageKey(["A"], [], "text"), "library.noLessonForFilters");
assert.equal(emptyMessageKey([], [], "text"), "library.noLessonForFilters");
assert.equal(emptyMessageKey([], [], "  "), null);
console.log("Empty filtered results: label, keyword, combined criteria, text search and reset verified.");
