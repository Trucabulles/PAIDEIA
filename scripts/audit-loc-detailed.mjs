// Read-only inventory. Does not modify dictionaries, application or projects.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";

const walk = (dir, extensions) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  if (["node_modules", "target", "dist", "locales"].includes(entry.name)) return [];
  const file = `${dir}/${entry.name}`;
  return entry.isDirectory() ? walk(file, extensions) : extensions.includes(path.extname(file)) ? [file] : [];
});
const read = (file) => fs.readFileSync(file, "utf8");
const locFiles = fs.readdirSync("src/locales").filter((name) => name.endsWith(".json"));
const dictionaries = Object.fromEntries(locFiles.map((name) => [name.slice(0, -5), JSON.parse(read(`src/locales/${name}`))]));
const fr = dictionaries.fr;
const section = process.argv[2] || "dictionaries";
const result = {};
if (section === "dictionaries") {
  const duplicates = [], sameAsFrench = [], sameAsFrenchShort = [], counts = [], blanks = [], missing = [], placeholderMismatch = [];
  for (const name of locFiles) {
    const locale = name.slice(0, -5), dictionary = dictionaries[locale];
    const file = `src/locales/${name}`, source = ts.parseJsonText(file, read(file));
    const seen = new Map();
    for (const property of source.statements[0].expression.properties) {
      const key = property.name.text;
      const line = source.getLineAndCharacterOfPosition(property.getStart(source)).line + 1;
      if (seen.has(key)) duplicates.push({ file, key, line, previousLine: seen.get(key) });
      seen.set(key, line);
    }
    const tokenSet = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    for (const [key, value] of Object.entries(fr)) {
      if (!(key in dictionary) && !key.startsWith("designerActions.")) missing.push({ locale, key });
      if (key in dictionary && (!dictionary[key]?.trim())) blanks.push({ locale, key });
      if (key in dictionary && tokenSet(value) !== tokenSet(dictionary[key])) placeholderMismatch.push({ locale, key });
      if (locale !== "fr" && !key.startsWith("designerActions.") && dictionary[key] === value
        && (value.match(/\p{L}+/gu) || []).length >= 4) sameAsFrench.push({ locale, key, text: value, line: seen.get(key) });
      if (locale !== "fr" && !key.startsWith("designerActions.") && dictionary[key] === value
        && (value.match(/\p{L}+/gu) || []).length < 4) sameAsFrenchShort.push({ locale, key, text: value, line: seen.get(key) });
    }
    counts.push({ locale, keys: Object.keys(dictionary).length,
      identicalFrenchLongValues: sameAsFrench.filter((entry) => entry.locale === locale).length });
  }
  Object.assign(result, { counts, duplicates, missing, blanks, placeholderMismatch, sameAsFrench, sameAsFrenchShort });
}
if (section === "calls") {
  const missing = [], dynamic = [], missingParams = [], translatedCalls = [];
  const sources = walk("src", [".ts", ".tsx"]);
  for (const file of sources) {
    const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
    const location = (node) => ({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
    const literalKeys = (node) => {
      if (!node) return null;
      if (ts.isStringLiteralLike(node)) return [node.text];
      if (ts.isConditionalExpression(node)) {
        const a = literalKeys(node.whenTrue), b = literalKeys(node.whenFalse);
        return a && b ? [...a, ...b] : null;
      }
      return null;
    };
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression.getText(source);
        if (["t", "translate", "translateActive", "props.t", "helpers.t"].includes(callee)) {
          const index = callee === "translate" ? 1 : 0;
          const keys = literalKeys(node.arguments[index]);
          if (!keys) dynamic.push({ ...location(node), callee, expression: node.arguments[index]?.getText(source) });
          else for (const key of keys) {
            translatedCalls.push({ ...location(node), callee, key });
            if (!(key in fr)) missing.push({ ...location(node), callee, key });
            else {
              const required = [...fr[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
              const arg = node.arguments[index + 1];
              if (required.length && (!arg || (ts.isIdentifier(arg) && arg.text === "undefined") || ts.isObjectLiteralExpression(arg))) {
                const names = arg && ts.isObjectLiteralExpression(arg) ? arg.properties.map((p) => p.name?.getText(source).replace(/^["\x27]|["\x27]$/g, "")) : [];
                if (!arg || !ts.isObjectLiteralExpression(arg) || !arg.properties.some(ts.isSpreadAssignment)) {
                  const absent = required.filter((token) => !names.includes(token));
                  if (absent.length) missingParams.push({ ...location(node), key, absent });
                }
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  Object.assign(result, { files: sources.length, translatedCallCount: translatedCalls.length, missing, dynamic, missingParams });
}
if (section === "baseline") {
  const run = spawnSync(process.execPath, ["scripts/audit-localization.mjs"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  const entries = []; let file;
  for (const line of run.stderr.split(/\r?\n/)) {
    if (line.startsWith("src/")) file = line;
    const match = line.match(/^  L(\d+) \[([^\]]+)\] (.*)$/);
    if (match) entries.push({ file, line: Number(match[1]), kind: match[2], text: match[3] });
  }
  Object.assign(result, { exitCode: run.status, entries });
}
if (section === "rust") {
  const entries = [], mojibake = [];
  for (const file of walk("src-tauri/src", [".rs"])) {
    const all = read(file), production = all.split("#[cfg(test)]")[0];
    production.split(/\r?\n/).forEach((text, index) => {
      if (/(?:\u00C3.|\u00C2.|\u00E2\u20AC|\uFFFD)/u.test(text)) mojibake.push({ file, line: index + 1, text: text.trim() });
    });
    // Candidate literals in error expressions; not a complete Rust parser.
    const pattern = /(?:Err\(|ok_or_else\(\|\||map_err\([^\n]*?=>)[\s\S]{0,80}?"((?:\\.|[^"\\])*)"/g;
    for (const match of production.matchAll(pattern)) {
      if (!/[A-Za-zÀ-ÿ]/u.test(match[1]) || !/\s/.test(match[1])) continue;
      entries.push({ file, line: production.slice(0, match.index).split("\n").length, text: match[1] });
    }
  }
  Object.assign(result, { entries, mojibake });
}
console.log(JSON.stringify(result));
