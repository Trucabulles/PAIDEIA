import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/app/mediaAssets.ts", import.meta.url), "utf8");
let importMessage = "Veuillez choisir une image au format GIF, JPG, JPEG, PNG ou WebP.";
const context = vm.createContext({ exports: {}, Uint8Array,
  require: () => ({ translateActive: () => importMessage }) });
vm.runInContext(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText, context);
const { validateActivityImageFile } = context.exports;
const file = (name, bytes) => ({ name, slice: (start, end) => new Blob([new Uint8Array(bytes)]).slice(start, end) });
const png = [137, 80, 78, 71, 13, 10, 26, 10];
const jpg = [255, 216, 255, 224];
const gif = [...Buffer.from("GIF89a")];
const webp = [...Buffer.from("RIFF0000WEBP")];
for (const [name, bytes] of [["image.png", png], ["image.JPG", jpg], ["image.jpeg", jpg], ["image.gif", gif], ["image.webp", webp]]) {
  await validateActivityImageFile(file(name, bytes));
}
for (const name of ["image.svg", "image.bmp", "image.avif", "document.pdf", "video.mp4", "texte.txt", "image.png.exe", "sans-extension"]) {
  await assert.rejects(validateActivityImageFile(file(name, png)), /GIF, JPG, JPEG, PNG ou WebP/);
}
for (const [name, bytes] of [["fake.png", [...Buffer.from("%PDF-document")]], ["wrong.png", jpg], ["empty.jpg", []], ["short.webp", [...Buffer.from("RIFF")]]]) {
  await assert.rejects(validateActivityImageFile(file(name, bytes)));
}
const localeRoot = new URL("../src/locales/", import.meta.url);
for (const name of (await readdir(localeRoot)).filter((name) => name.endsWith(".json"))) {
  const dictionary = JSON.parse(await readFile(new URL(name, localeRoot), "utf8"));
  importMessage = dictionary["image.importAllowedFormats"];
  assert.ok(importMessage);
  await assert.rejects(validateActivityImageFile(file("wrong.pdf", png)), (error) => error.message === importMessage);
}
console.log("Image import: allowed formats, signatures and localized rejection in all dictionaries OK.");
