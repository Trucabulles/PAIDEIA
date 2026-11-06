import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile("src/App.tsx", "utf8");
const ast = ts.createSourceFile("App.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function handler(name, dependencies) {
  let declaration;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(declaration, name);
  const js = ts.transpileModule(declaration.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(dependencies), `${js}; return ${name};`)(...Object.values(dependencies));
}

let refreshes = 0;
const dialogs = [];
const dependencies = {
  setImportDialog: value => dialogs.push(value),
  refreshLibraryProjects: async () => { refreshes++; },
  showPaideiaArchiveImportError: error => dialogs.push({ status: "error", error })
};
let sharedBankImports = 0;
let acceptSharedBanks = true;
const importArchive = handler("handleImportPaideiaArchive", {
  archiveImportQueueRef: { current: Promise.resolve() },
  performPaideiaArchiveImport: handler("performPaideiaArchiveImport", {
    ...dependencies,
    hasPaideiaSharedBanks: async (path) => path === "projects/with-banks",
    confirm: async () => acceptSharedBanks,
    importPaideiaSharedBanks: async (path) => {
      assert.equal(path, "projects/with-banks");
      sharedBankImports++;
    },
    refreshUserQuestionBank: async () => {},
    refreshUserReferenceBank: async () => {},
    refreshUserGlossaryAssistantBank: async () => {},
    message: async (error) => assert.fail(error),
    t: key => key
  })
});
let active = 0;
await Promise.all(Array.from({ length: 50 }, (_, index) => importArchive(async () => {
  assert.equal(++active, 1, "archive imports must be serial");
  await Promise.resolve();
  active--;
  return `projects/import-${index}`;
})));
assert.equal(refreshes, 50);
assert.equal(dialogs.at(-1).status, "done");
await importArchive(async () => { throw new Error("Invalid archive"); });
assert.equal(refreshes, 50);
assert.equal(dialogs.at(-1).status, "error");

const openPath = handler("handleOpenLessonPath", {
  handleImportPaideiaArchive: importArchive,
  openPaideiaArchivePath: async (path, root) => { assert.equal(path, "lesson.PAIDEIA"); assert.equal(root, "library"); return "projects/imported"; },
  importDestinationRoot: "library"
});
await openPath("lesson.PAIDEIA");
assert.equal(dialogs.at(-1).status, "done");

for (const roundtrip of [true, false]) {
  let reports = 0;
  const importScorm = handler("handleImportScorm", {
    ...dependencies,
    runAction: async (_, action) => action(),
    importDestinationRoot: "library",
    importScorm: async () => ({ projectPath: "projects/imported", isPaideiaRoundtrip: roundtrip }),
    loadWorkspaceStateForProject: async () => ({ project: { title: "Imported", questionBanks: [] } }),
    readImportReport: async () => ({ summary: { blocksMappedExactly: 1, blocksMappedApproximately: 0 }, rematching: [], issues: [] }),
    buildLocalizedImportLog: () => "Import report",
    writeImportLog: async () => { reports++; return "report.txt"; },
    buildLocalizedImportReportRows: () => [],
    entryNeedsImportReview: () => false,
    appLanguage: "fr", t: key => key
  });
  await importScorm("lesson.zip");
  assert.equal(dialogs.at(-1).status, "done");
  assert.equal(reports, roundtrip ? 0 : 1);
}
// No editor/navigation setters are injected: any attempt to open an imported
// lesson makes these real application handlers fail instead of silently passing.
assert.equal(refreshes, 53);
assert.equal(sharedBankImports, 0);
await importArchive(async () => "projects/with-banks");
assert.equal(refreshes, 54);
assert.equal(sharedBankImports, 1);
acceptSharedBanks = false;
await importArchive(async () => "projects/with-banks");
assert.equal(refreshes, 55);
assert.equal(sharedBankImports, 1, "declining still imports the lesson alone");
console.log("OK: 50 imports, failure, archive path, SCORM and roundtrip preserve the current editor; SCORM report retained.");
