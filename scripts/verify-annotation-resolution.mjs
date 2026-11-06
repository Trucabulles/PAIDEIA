import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const base = new URL("../src/components/authoring/image-annotation/", import.meta.url);
const policySource = await readFile(new URL("annotationResolution.ts", base), "utf8");
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: "h" }
}).outputText;
const policyContext = vm.createContext({ exports: {} });
vm.runInContext(compile(policySource), policyContext);
const { annotationResolutionAccess, annotationWorkspaceMaxWidth } = policyContext.exports;

for (const [width, height, expected] of [
  [1, 1, "blocked"], [99, 99, "blocked"], [99, 100, "warning"], [100, 99, "warning"],
  [100, 100, "warning"], [800, 80, "warning"], [80, 800, "warning"], [399, 400, "warning"],
  [400, 399, "warning"], [400, 400, "ready"], [800, 400, "ready"], [500, 500, "ready"]
]) assert.equal(annotationResolutionAccess({ width, height }), expected, `${width} x ${height}`);
assert.throws(() => annotationResolutionAccess({ width: 0, height: 100 }));

for (const source of [{ width: 100, height: 100 }, { width: 800, height: 80 }, { width: 400, height: 800 }, { width: 4000, height: 2000 }]) {
  for (const availableWidth of [250, 600, 1600]) {
    const displayWidth = Math.min(availableWidth, annotationWorkspaceMaxWidth(source));
    const displayHeight = displayWidth * source.height / source.width;
    assert.ok(displayHeight <= 700.000001);
    assert.ok(displayWidth <= availableWidth);
    assert.ok(Math.abs(displayWidth / displayHeight - source.width / source.height) < 1e-8);
  }
}
assert.equal(annotationWorkspaceMaxWidth({ width: 100, height: 100 }), 700, "small images may grow for editing");

async function functionSource(file, name) {
  const source = await readFile(new URL(file, base), "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const node = ast.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
  assert.ok(node, name);
  return node.getText(ast).replace(/^export /, "");
}

// Run the access component with a controllable image load and hook state:
// no editor (and therefore no document mutation) exists before approval.
const accessCode = compile(await functionSource("NativeImageAnnotationTool.tsx", "NativeImageAnnotationAccess"));
function accessFixture() {
  const states = [], effects = [], loadedImages = [];
  let cursor = 0, closed = 0, changed = 0;
  const context = vm.createContext({
    useI18n: () => ({ t: (key) => key }),
    annotationResolutionAccess,
    Image: class { constructor() { loadedImages.push(this); } },
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useEffect(callback) {
      const index = cursor++;
      if (!(index in states)) { states[index] = true; effects.push(callback); }
    },
    h: (type, props) => ({ type, props }),
    NativeImageAnnotationEditor: "editor",
    AnnotationResolutionDialog: "dialog"
  });
  vm.runInContext(accessCode, context);
  const props = { imageSrc: "test-source", onCancel: () => { closed++; }, onChange: () => { changed++; } };
  const render = () => {
    cursor = 0;
    const result = context.NativeImageAnnotationAccess(props);
    while (effects.length) effects.shift()();
    return result;
  };
  render();
  return {
    render,
    load(width, height) { Object.assign(loadedImages[0], { naturalWidth: width, naturalHeight: height }); loadedImages[0].onload(); },
    fail() { loadedImages[0].onerror(); },
    get closed() { return closed; }, get changed() { return changed; }
  };
}
{
  const f = accessFixture(); f.load(99, 99);
  const dialog = f.render(); assert.equal(dialog.type, "dialog"); assert.equal(dialog.props.status, "blocked");
  dialog.props.onContinue(); assert.equal(f.render().type, "dialog", "blocked images cannot be accepted");
  dialog.props.onClose(); assert.equal(f.render(), null); assert.equal(f.closed, 1); assert.equal(f.changed, 0);
}
{
  const f = accessFixture(); f.load(800, 80);
  const dialog = f.render(); assert.equal(dialog.props.status, "warning");
  dialog.props.onContinue(); const editor = f.render(); assert.equal(editor.type, "editor");
  assert.equal(editor.props.sourceDimensions.width, 800); assert.equal(editor.props.sourceDimensions.height, 80);
  assert.equal(f.render().type, "editor", "ordinary rerenders must not ask again"); assert.equal(f.changed, 0);
}
{
  const f = accessFixture(); f.load(100, 100); f.render().props.onClose();
  assert.equal(f.render(), null); assert.equal(f.changed, 0);
  const reopened = accessFixture(); reopened.load(100, 100); assert.equal(reopened.render().props.status, "warning");
}
{
  const f = accessFixture(); f.load(800, 400); assert.equal(f.render().type, "editor");
  const failed = accessFixture(); failed.fail(); assert.equal(failed.render().props.status, "error");
}

// Exercise the real rasterization entry point with a magnified DOM image.
const rasterCode = compile(await functionSource("nativeRasterize.ts", "flattenNativeImageAnnotationsToDataUrl"));
const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL: () => "data:image/png;base64,test" };
const rasterContext = vm.createContext({ window: { document: { createElement: () => canvas } } });
vm.runInContext(rasterCode, rasterContext);
await rasterContext.flattenNativeImageAnnotationsToDataUrl({
  document: { version: 1, annotations: [] }, imageSrc: null,
  imageElement: { naturalWidth: 120, naturalHeight: 80, width: 900, height: 600, getBoundingClientRect: () => ({ width: 900, height: 600 }) }
});
assert.equal(canvas.width, 120); assert.equal(canvas.height, 80);
console.log("Annotation: resolution thresholds, approval/cancel, ratio, 700px bound and native export dimensions OK.");
