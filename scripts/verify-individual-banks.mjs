import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

globalThis.window = new EventTarget();
const store = new Map();
const calls = [];
const diagnostics = [];
window.addEventListener("paideia-bank-errors", event => diagnostics.push(event.detail));
const copy = value => structuredClone(value);
async function invoke(command, args) {
  calls.push({ command, ...args });
  const content = args.family === "questions" ? "questions" : "entries";
  const bankKey = id => `${args.family}:${id}`;
  if (command === "resource_bank_catalog") return {
    banks: [...store.entries()].filter(([key]) => key.startsWith(`${args.family}:`)).map(([, bank]) => ({ ...copy(bank), [content]: [], contentCount: bank[content].length, contentLoaded: false })),
    errors: []
  };
  if (command === "resource_bank_load") {
    if (args.bankId === "broken") throw new Error("Bank is corrupt");
    return { ...copy(store.get(bankKey(args.bankId))), contentLoaded: true };
  }
  if (command === "resource_bank_save") {
    const original = store.get(bankKey(args.bank.id));
    const saved = args.bank.contentLoaded === false ? { ...original, ...args.bank, [content]: original[content] } : args.bank;
    store.set(bankKey(saved.id), copy(saved));
    return { ...copy(saved), contentLoaded: true };
  }
  if (command === "resource_bank_delete") { store.delete(bankKey(args.bankId)); return; }
  throw new Error(command);
}
const exports = {};
const code = ts.transpileModule(await readFile("src/lib/resourceBankApi.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
new Function("exports", "require", code)(exports, () => ({ invokeCommand: invoke }));
for (const family of ["questions", "references", "assistants"]) {
  const content = family === "questions" ? "questions" : "entries";
  for (let index = 0; index < 40; index++) store.set(`${family}:${index}`, { id: `${index}`, name: `Bank ${index}`, tileImageRef: "tile.png", [content]: [{ id: "entry", definitionHtml: "<p><img src='data:image/png;base64,AAAA'></p>" }], ...(family === "assistants" ? { fallbackResponses: [] } : {}) });
  calls.length = 0;
  const catalog = await exports.listResourceBanks(family);
  assert.equal(catalog.length, 40);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, "resource_bank_catalog");
  assert.ok(catalog.every(bank => bank[content].length === 0 && bank.contentCount === 1 && bank.tileImageRef));
  const loaded = await exports.loadResourceBank(family, catalog[0]);
  assert.equal(loaded[content].length, 1);
  assert.equal(calls.filter(call => call.command === "resource_bank_load").length, 1);
  const mixed = [loaded, ...catalog.slice(1)];
  calls.length = 0;
  await exports.saveResourceBanks(family, mixed);
  assert.equal(calls.length, 0, "opening then saving unchanged content must not rewrite banks");
  loaded.resourceModifiedAt = 12345;
  await exports.saveResourceBanks(family, mixed);
  assert.equal(calls.length, 0, "a catalogue date alone must not cause a bank save");
  loaded.name = "Renamed";
  await exports.saveResourceBanks(family, mixed);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].bank.id, "0");
  calls.length = 0;
  const untouched = await exports.listResourceBanks(family);
  untouched[2].name = "Rename without opening";
  await exports.saveResourceBanks(family, untouched);
  assert.equal(calls.filter(call => call.command === "resource_bank_save").length, 1);
  assert.equal(store.get(`${family}:2`)[content].length, 1, "metadata save must retain unloaded entries");
  await assert.rejects(exports.loadResourceBank(family, { id: "broken", name: "Broken", contentLoaded: false }), /corrupt/);
  calls.length = 0;
  await exports.deleteResourceBank(family, "1");
  assert.equal(calls.filter(call => call.command === "resource_bank_load").length, 0);
  console.log(`OK ${family}: lightweight tiles, individual load/save, unloaded rename, isolated failure and individual deletion`);
}

// Exercise the actual application save handler with dirty drafts in two banks.
const app = await readFile("src/App.tsx", "utf8");
const ast = ts.createSourceFile("App.tsx", app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let declaration;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "handleSaveQuestionBankResources") declaration = node;
  ts.forEachChild(node, visit);
}
visit(ast);
const state = { current: [{ id: "a", name: "A draft", questions: ["A"] }, { id: "b", name: "B draft", questions: ["B"] }] };
const savedIds = [];
const dependencies = {
  resourceQuestionBankSaveFeedbackTimeoutRef: { current: null },
  userQuestionBanksRef: state,
  setResourceQuestionBankSaveFeedbackState() {}, setUserQuestionBanks() {},
  runAction: async (_, action) => action(),
  window: { setTimeout: () => 0 },
  saveUserQuestionBanks: async banks => { savedIds.push(...banks.map(bank => bank.id)); return banks; }
};
const handler = ts.transpileModule(declaration.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const save = new Function(...Object.keys(dependencies), `${handler}; return handleSaveQuestionBankResources;`)(...Object.values(dependencies));
await save(["a"]);
assert.deepEqual(savedIds, ["a"]);
assert.deepEqual(state.current[1].questions, ["B"]);
console.log("OK: saving the open question bank preserves another bank's unsaved draft.");

// Exercise the real loader with reversed completion order and a metadata edit
// made while the first bank is still loading.
const hooks = [];
let slot = 0;
const pending = new Map();
const hookExports = {};
const hookCode = ts.transpileModule(await readFile("src/components/resources/useIndividualBank.tsx", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
new Function("exports", "require", hookCode)(hookExports, name => {
  if (name === "react") return {
    useEffect: () => {},
    useRef: value => { const index = slot++; return hooks[index] ??= { current: value }; },
    useState: value => { const index = slot++; hooks[index] ??= value; return [hooks[index], next => { hooks[index] = typeof next === "function" ? next(hooks[index]) : next; }]; }
  };
  if (name === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null };
  if (name.includes("i18n")) return { useI18n: () => ({ t: key => key }) };
  if (name.includes("resourceBankApi")) return { loadResourceBank: (_, bank) => new Promise(resolve => pending.set(bank.id, resolve)) };
  throw new Error(name);
});
let drafts = [{ id: "a", name: "A", entries: [], contentLoaded: false }, { id: "b", name: "B", entries: [], contentLoaded: false }];
function renderLoader() { slot = 0; return hookExports.useIndividualBank("references", drafts, next => { drafts = next; }); }
let loader = renderLoader();
let selected;
loader.open(drafts[0], bank => { selected = bank.id; });
loader.open(drafts[1], bank => { selected = bank.id; });
pending.get("b")({ id: "b", name: "B", entries: [{ id: "b-entry" }], contentLoaded: true });
await Promise.resolve(); await Promise.resolve();
drafts = drafts.map(bank => bank.id === "a" ? { ...bank, name: "A edited while loading" } : bank);
renderLoader();
pending.get("a")({ id: "a", name: "A", entries: [{ id: "a-entry" }], contentLoaded: true });
await Promise.resolve(); await Promise.resolve();
assert.equal(selected, "b", "a late opening reply must not select the wrong bank");
assert.equal(drafts.find(bank => bank.id === "a").name, "A edited while loading");
assert.equal(drafts.find(bank => bank.id === "b").entries[0].id, "b-entry");
console.log("OK: late bank loads preserve newer selection, metadata edits and other loaded banks.");
