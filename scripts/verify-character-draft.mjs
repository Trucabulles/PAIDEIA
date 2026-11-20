import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const tree = ts.createSourceFile("App.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function handler(name, environment) {
  let declaration;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(declaration, name);
  const code = ts.transpileModule(declaration.getText(tree), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }
  }).outputText;
  return new Function(...Object.keys(environment), code + "\nreturn " + name)(...Object.values(environment));
}

function fixture() {
  const events = [];
  const state = {
    draft: { id: "", name: "Personnage", role: "", description: "" },
    pending: [],
    selected: "__draft__",
    saving: { current: false },
    feedback: "idle",
    error: "",
    failFile: ""
  };
  const environment = () => ({
    resourceCharacterDraft: state.draft,
    pendingCharacterPoses: state.pending,
    selectedResourceCharacterId: state.selected,
    resourceCharacterSavingRef: state.saving,
    resourceCharacterSaveFeedbackTimeoutRef: { current: null },
    setResourceCharacterSaveError: (error) => { state.error = error; },
    setResourceCharacterSaveFeedbackState: (feedback) => { state.feedback = feedback; },
    setResourceCharacterDraft: (draft) => { state.draft = draft; },
    setSelectedResourceCharacterId: (id) => { state.selected = id; },
    setPendingCharacterPoses: (update) => { state.pending = update(state.pending); },
    setUsersituationalDialogueCharacters: () => {},
    refreshUserSituationalDialogueCharacterBank: async () => { events.push("refresh"); },
    window: { clearTimeout() {}, setTimeout() { return 1; } },
    saveUserSituationalDialogueCharacter: async (draft) => {
      events.push(["save", draft.id]);
      return { ...draft, id: draft.id || "personnage" };
    },
    uploadUserSituationalDialogueCharacterPose: async (id, poseState, file, makeDefault) => {
      assert.equal(id, "personnage");
      events.push(["upload", file.name, poseState, makeDefault]);
      if (file.name === state.failFile) { state.failFile = ""; throw new Error("Upload failed"); }
      return [];
    }
  });
  return { state, events, call: (name, ...args) => handler(name, environment())(...args) };
}

const test = fixture();
for (const [name, poseState, makeDefault] of [
  ["intro.png", "introduction", true],
  ["question.png", "question", true],
  ["alternative.png", "question", false]
]) {
  await test.call("handleUploadUserCharacterPose", poseState, new File(["image"], name), makeDefault);
}
assert.equal(test.events.length, 0, "Preparing a new character must not upload to a temporary ID");
assert.equal(test.state.pending.length, 3);
test.state.failFile = "question.png";
const firstSave = test.call("handleSaveResourceCharacter");
await test.call("handleSaveResourceCharacter");
await assert.rejects(firstSave, /Upload failed/);
assert.equal(test.events.filter((event) => event[0] === "save").length, 1, "Repeated save is blocked while saving");
assert.equal(test.state.draft.id, "personnage", "Keep the created ID after a partial upload failure");
assert.equal(test.state.error, "Upload failed");
assert.equal(test.state.feedback, "error");
assert.equal(test.state.saving.current, false);
assert.deepEqual(test.state.pending.map((pose) => pose.file.name), ["question.png", "alternative.png"]);
const pendingUrls = test.state.pending.map((pose) => pose.url);
await test.call("handleSaveResourceCharacter");
assert.deepEqual(test.events.filter((event) => event[0] === "save").map((event) => event[1]), [null, "personnage"]);
assert.equal(test.events.filter((event) => event[0] === "upload" && event[1] === "intro.png").length, 1, "Retry must not reupload a completed pose");
assert.equal(test.state.pending.length, 0);
assert.equal(test.state.feedback, "saved");
assert.equal(test.state.error, "");
pendingUrls.forEach((url) => URL.revokeObjectURL(url));
console.log("Character draft: deferred images, single save, failure recovery and retry passed.");
