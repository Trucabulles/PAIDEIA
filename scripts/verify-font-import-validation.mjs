import fs from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import ts from "typescript";
import { unzipSync } from "fflate";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const source = fs.readFileSync("src/lib/projectApi.ts", "utf8");
const ast = ts.createSourceFile("api.ts", source, ts.ScriptTarget.Latest, true);
const names = ["validateUploadedFont", "uploadUserFont", "uploadProjectFont"];
const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
assert.equal(functions.length, 3);
const code = ts.transpile(functions.map(node => node.getText(ast).replace(/^export /, "")).join("\n"), { target: ts.ScriptTarget.ES2022 });
const cases = ["truetype.ttf", "truetype.woff", "truetype.woff2", "cff.otf", "cff.woff", "cff.woff2"]
  .map(name => ({ name, bytes: [...fs.readFileSync(`src-tauri/test-fixtures/fonts/${name}`)], valid: true }));
cases.push({ name: "invalid.otf", bytes: [...Buffer.from("OTTOinvalid")], valid: false });
if (process.env.PAIDEIA_FONT_ARCHIVE) {
  for (const [name, bytes] of Object.entries(unzipSync(fs.readFileSync(process.env.PAIDEIA_FONT_ARCHIVE)))) {
    if (/\.otf$/i.test(name)) cases.push({ name, bytes: [...bytes], valid: false });
  }
}
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const page = await browser.newPage();
  for (const sample of cases) {
    const results = await page.evaluate(async ({ code, sample }) => {
      const calls = [];
      const invokeCommand = async command => {
        calls.push(command);
        return command === "prepare_uploaded_font" ? [{ file_name: sample.name, bytes: sample.bytes, weight: 400, style: "normal" }] : [];
      };
      const api = new Function("invokeCommand", code + "; return {uploadUserFont, uploadProjectFont};")(invokeCommand);
      const file = new File([new Uint8Array(sample.bytes)], sample.name);
      const results = [];
      for (const action of [() => api.uploadUserFont(file), () => api.uploadProjectFont("project", file)]) {
        calls.length = 0;
        let error = "";
        try { await action(); } catch (failure) { error = String(failure); }
        results.push({ calls: [...calls], error });
      }
      return results;
    }, { code, sample });
    for (const result of results) {
      assert.equal(result.calls[0], "prepare_uploaded_font");
      assert.equal(result.calls.length, sample.valid ? 2 : 1, sample.name);
      if (sample.valid) assert.equal(result.error, "", sample.name);
      else assert.match(result.error, /Aucune police n’a été importée/);
    }
    console.log(`${sample.name}: ${sample.valid ? "validated before import" : "rejected before any write"} (catalogue and project).`);
  }
} finally {
  await browser.close();
}
