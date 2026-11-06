import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(process.cwd() + "/package.json");
const ts = require("typescript");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const source = fs.readFileSync("src/App.tsx", "utf8");
const parsed = ts.createSourceFile("App.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ["fontCssFormat", "userFontCatalogFaceCss", "richTextFontCssFamily", "projectRichTextFontFaceCss", "customLessonFontFaceCss"];
const functions = parsed.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
assert.equal(functions.length, names.length);
const fixtures = path.resolve("src-tauri/test-fixtures/fonts");
const dataUrl = asset => `data:font/${path.extname(asset).slice(1)};base64,${fs.readFileSync(path.join(fixtures, path.basename(asset))).toString("base64")}`;
const js = ts.transpile(functions.map(node => node.getText(parsed)).join("\n"), { target: ts.ScriptTarget.ES2022 });
const helpers = new Function("isTauri", "convertFileSrc", "buildAssetUrl", `${js};return {userFontCatalogFaceCss,projectRichTextFontFaceCss,customLessonFontFaceCss};`)(() => true, dataUrl, (_project, asset) => dataUrl(asset));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const page = await browser.newPage();
  for (const name of ["truetype.ttf", "truetype.woff", "truetype.woff2", "cff.otf", "cff.woff", "cff.woff2"]) {
    const font = { id: "fixture", assetRef: name, faces: [{ assetRef: name, weight: 400, style: "normal" }] };
    const css = helpers.userFontCatalogFaceCss([font]) + helpers.projectRichTextFontFaceCss("test", [font]) + helpers.customLessonFontFaceCss("test", { customFont: font });
    await page.setContent(`<style>${css}</style>`);
    const loaded = await page.evaluate(async () => {
      const families = ["PaideiaUser-fixture", "PaideiaRichFont-fixture", "PaideiaCustomFont"];
      const result = [];
      for (const family of families) {
        const faces = await document.fonts.load(`40px "${family}"`, "A");
        const context = document.createElement("canvas").getContext("2d");
        context.font = `40px "${family}"`;
        result.push({ family, count: faces.length, loaded: faces.every(face => face.status === "loaded"), width: context.measureText("A").width });
      }
      return result;
    });
    for (const item of loaded) {
      assert.equal(item.count, 1, `${name}: ${item.family}`);
      assert.equal(item.loaded, true, `${name}: ${item.family}`);
      assert.ok(Math.abs(item.width - 24) < 0.01, `${name}: actual glyph advance, not fallback`);
    }
    console.log(`${name}: catalogue, rich text and lesson font loaded without fallback.`);
  }
} finally {
  await browser.close();
}
