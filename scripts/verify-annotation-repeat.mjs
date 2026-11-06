import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const base = new URL("../src/components/authoring/image-annotation/", import.meta.url);
const helperSource = await readFile(new URL("annotationRepeatTemplate.ts", base), "utf8");
const compiled = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const context = vm.createContext({ exports: {} });
vm.runInContext(compiled, context);
const {
  centeredRepeatableGeometryRect,
  repeatableGeometryTemplateFromAnnotation,
  repeatableGeometryTemplatesFromDocument
} = context.exports;

const baseAnnotation = {
  blurAmount: 3,
  blurEnabled: true,
  createdAt: 1,
  fill: { color: "#112233", opacity: 45 },
  height: 18,
  id: "shape",
  stroke: { color: "#abcdef", opacity: 80, width: 7 },
  text: { backgroundColor: "#fff", backgroundOpacity: 0, color: "#000", fontSize: 20 },
  updatedAt: 10,
  width: 24,
  x: 2,
  y: 3
};
const rectangle = { ...baseAnnotation, kind: "rect" };
const ellipse = { ...baseAnnotation, id: "ellipse", kind: "ellipse", width: 31, updatedAt: 11 };
const star = { ...baseAnnotation, id: "star", kind: "icon", iconType: "star", iconRotation: 28, iconFlipX: true };
const arrow = { ...baseAnnotation, id: "arrow", kind: "icon", iconType: "arrow", width: 12, updatedAt: 12 };
const text = { ...baseAnnotation, id: "text", kind: "text", content: "texte" };

assert.equal(repeatableGeometryTemplateFromAnnotation(text), null, "text is not repeatable");
const starTemplate = repeatableGeometryTemplateFromAnnotation(star);
assert.equal(starTemplate.key, "icon:star");
assert.equal(starTemplate.width, 24);
assert.equal(starTemplate.height, 18);
assert.equal(starTemplate.iconRotation, 28);
assert.equal(starTemplate.iconFlipX, true);
assert.equal(JSON.stringify(starTemplate.stroke), JSON.stringify(star.stroke));

const templates = repeatableGeometryTemplatesFromDocument({
  version: 1,
  annotations: [rectangle, ellipse, star, arrow, { ...star, id: "new-star", width: 42, updatedAt: 20 }]
});
assert.equal(templates.rect.width, 24, "rectangle has its own size");
assert.equal(templates.ellipse.width, 31, "ellipse has its own size");
assert.equal(templates["icon:arrow"].width, 12, "arrow is independent from star");
assert.equal(templates["icon:star"].width, 42, "latest star wins");

assert.equal(
  JSON.stringify(centeredRepeatableGeometryRect({ x: 50, y: 50 }, { width: 24, height: 18 })),
  JSON.stringify({ x: 38, y: 41, width: 24, height: 18 })
);
assert.equal(
  JSON.stringify(centeredRepeatableGeometryRect({ x: 98, y: 3 }, { width: 24, height: 18 })),
  JSON.stringify({ x: 76, y: 0, width: 24, height: 18 }),
  "placement shifts at the edge without resizing"
);

const editorSource = await readFile(new URL("NativeImageAnnotationTool.tsx", base), "utf8");
assert.match(editorSource, /`icon:\$\{activeIconType\}`/, "icon templates are keyed by icon geometry");
assert.match(editorSource, /centeredRepeatableGeometryRect\(point, repeatTemplate\)/, "repeat uses stored dimensions");
assert.match(editorSource, /repeatTemplate\?\.stroke/, "repeat uses stored style");
assert.match(editorSource, /rememberRepeatableAnnotation\(finalAnnotation\)/, "resize and rotation refresh the template");

console.log("Annotation repeat: rectangle, ellipse and per-icon templates, style, dimensions and edge placement OK.");
