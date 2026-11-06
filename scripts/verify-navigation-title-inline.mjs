import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("src/components/activities/EditableNavigationTitle.tsx", "utf8");
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX
} }).outputText;
let editing = false;
let focuses = 0;
const effects = [];
const exports = {};
const jsx = (type, props) => ({ type, props });
vm.runInNewContext(code, { exports, require: (name) => {
  if (name === "../../i18n/react") return { useI18n: () => ({ t: () => "Double cliquer pour éditer" }) };
  if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
  if (name === "react") return {
    useState: () => [editing, (next) => { editing = next; }],
    useRef: () => ({ current: { querySelector: () => ({ focus: () => { focuses++; } }) } }),
    useLayoutEffect: (effect) => effects.push(effect)
  };
  throw new Error(name);
} });
const render = (props) => {
  const result = exports.EditableNavigationTitle(props);
  effects.splice(0).forEach((effect) => effect());
  return result;
};
const event = (detail) => ({ detail, preventDefault() {}, stopPropagation() {} });

for (const initialOpen of [false, true]) {
  editing = false;
  let open = initialOpen;
  let navigations = 0;
  let finish;
  const props = {
    onClick: () => { open = !open; navigations++; },
    onBeginEditing: () => { open = !open; },
    renderEditor: (close) => { finish = close; return "editor"; },
    children: "label"
  };
  let tree = render(props);
  assert.equal(tree.props.title, "Double cliquer pour éditer");
  tree.props.onClick(event(1));
  assert.equal(open, !initialOpen, "single click navigates immediately");
  tree = render(props);
  tree.props.onClick(event(2));
  tree.props.onDoubleClick(event(2));
  assert.equal(open, initialOpen, "double click preserves initial accordion state");
  tree = render(props);
  assert.equal(tree.type, "div", "editable content is not nested in a button");
  assert.equal(tree.props.title, undefined, "editing does not retain the entry tooltip");
  tree.props.onClick(event(1));
  tree.props.onDoubleClick(event(2));
  tree.props.onKeyDown(event(0));
  assert.equal(navigations, 1, "editing gestures never navigate");
  finish();
  assert.equal(render(props).type, "button", "finish restores navigation");
}
assert.ok(focuses >= 2, "entry focuses the rich text field");
editing = false;
let clicks = 0;
const readonly = render({ onClick: () => clicks++, children: "learner title" });
assert.equal(readonly.props.onDoubleClick, undefined);
assert.equal(readonly.props.title, undefined, "no authoring tooltip in learner mode");
readonly.props.onClick(event(1));
readonly.props.onClick(event(2));
assert.equal(clicks, 2, "learner navigation unchanged");
console.log("Navigation titles: immediate click, double-click entry, accordion state, focus, finish and learner mode OK.");
