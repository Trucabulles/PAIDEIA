import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const sourceExtensions = new Set([".ts", ".tsx"]);
const ignoredSegments = new Set(["node_modules", "dist", "target", "locales"]);

// Valeurs techniques ou symboles dont l'affichage ne dépend pas de la langue.
const technicalVisibleValues = new Set([
  "A-Z", "Z-A", "ALT", "CSV", "HTML", "IMG", "LMS", "PDF", "SCORM", "SVG", "URL",
  "H1", "H2", "H3", "H4", "H5", "B", "i", "S", "X", "MAJ", "min", "Abc", "abc",
  "A", "ab", "x", "+", "-", "−", "×", "↑", "↓", "‹", "›", "⌄", "⌕", "…", "⋯", "...", "·", "?",
  "★", "✓", "“", "”", "px", "OK", "QCM", "QCU", "UTF-8", "<ALT>", "&lt;ALT&gt;",
  "completed", "passed", "incomplete", "failed", "Lorem ipsum dolor sit amet",
  "Lorem ipsum dolor sit amet ·", "Tauri command failed", "Cyril Grégoire", "paideia.trucabulles.fr",
  "text", "images", "interactions", "assessments", "situational-dialogues", "multimedia", "navigation"
]);

const visibleAttributeNames = new Set([
  "alt", "aria-label", "aria-description", "data-tooltip", "label", "placeholder", "title"
]);

const visibleObjectKeys = new Set([
  "closeLabel", "doneTitle", "emptyLabel", "label", "message", "placeholder", "title"
]);

function relative(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function normalize(value) {
  return value.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function isTechnical(value) {
  const text = normalize(value);
  if (!/\p{L}/u.test(text.replace(/\{value\}/g, ""))) return true;
  if (!text || technicalVisibleValues.has(text)) return true;
  if (/^[\d\s.,:%+\-–—/()<>]+$/.test(text)) return true;
  if (/^(?:#[0-9a-f]{3,8}|rgba?\(|hsla?\(|https?:|data:|[\w.-]+\.(?:png|jpe?g|gif|webp|mp[34]|wav|m4a|vtt|csv|json))/.test(text)) return true;
  if (/^(?:[\w.-]+\/)+[\w.-]+\.(?:png|jpe?g|gif|webp|mp[34]|wav|m4a|vtt|csv|json)$/.test(text)) return true;
  if (/^[A-Z][A-Z0-9 _./+-]{1,12}$/.test(text) && !/[À-ÿ]/.test(text)) return true;
  return false;
}

function isLocalizedExpression(node) {
  return ts.isCallExpression(node)
    && ts.isIdentifier(node.expression)
    && ["t", "translate", "translateActive", "formatMessage"].includes(node.expression.text);
}

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredSegments.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listSourceFiles(fullPath));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

const findings = [];

function register(sourceFile, file, node, kind, rawValue) {
  const value = normalize(rawValue);
  if (!value || isTechnical(value)) return;
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  findings.push({ file, line: line + 1, kind, text: value });
}

// Explicit files also allow regression fixtures without scanning the application.
const files = process.argv.slice(2).length
  ? process.argv.slice(2).map((file) => path.resolve(root, file))
  : await listSourceFiles(srcRoot);
for (const filePath of files) {
  const content = await readFile(filePath, "utf8");
  const file = relative(filePath);
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    path.extname(filePath) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  function visibleExpression(node, kind) {
    if (isLocalizedExpression(node)) return;
    if (ts.isStringLiteralLike(node)) register(sourceFile, file, node, kind, node.text);
    else if (ts.isConditionalExpression(node)) {
      visibleExpression(node.whenTrue, kind);
      visibleExpression(node.whenFalse, kind);
    } else if (ts.isParenthesizedExpression(node)) visibleExpression(node.expression, kind);
    else if (ts.isTemplateExpression(node)) {
      const value = node.head.text + node.templateSpans.map((span) => `{value}${span.literal.text}`).join("");
      register(sourceFile, file, node, kind, value);
    } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      visibleExpression(node.left, kind);
      visibleExpression(node.right, kind);
    } else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken,
      ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) {
      visibleExpression(node.right, kind);
    }
  }

  function visit(node) {
    if (ts.isJsxText(node)) {
      register(sourceFile, file, node, "texte JSX", node.text);
    } else if (ts.isJsxAttribute(node) && visibleAttributeNames.has(node.name.text)) {
      if (node.initializer && ts.isStringLiteral(node.initializer)) {
        register(sourceFile, file, node, `attribut ${node.name.text}`, node.initializer.text);
      } else if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        visibleExpression(node.initializer.expression, `attribut ${node.name.text}`);
      }
    } else if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      visibleExpression(node.expression, "expression JSX");
    } else if (ts.isPropertyAssignment(node)) {
      const key = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : "";
      if (visibleObjectKeys.has(key)) visibleExpression(node.initializer, `propriété ${key}`);
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
      && visibleObjectKeys.has(node.name.text) && node.initializer) {
      visibleExpression(node.initializer, `variable ${node.name.text}`);
    } else if (ts.isNewExpression(node) && node.expression.getText(sourceFile) === "Error" && node.arguments?.[0]) {
      visibleExpression(node.arguments[0], "erreur potentiellement visible");
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(sourceFile);
      if (["alert", "confirm", "window.alert", "window.confirm"].includes(callee)) {
        const first = node.arguments[0];
        if (first && ts.isStringLiteralLike(first)) register(sourceFile, file, node, callee, first.text);
      }
    }

    // Une expression déjà passée par le traducteur est volontairement terminale.
    if (!isLocalizedExpression(node)) ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

const unique = [...new Map(findings.map((finding) => [
  `${finding.file}:${finding.line}:${finding.kind}:${finding.text}`,
  finding
])).values()];

if (!unique.length) {
  console.log("Audit localisation : aucun texte visible non localisé détecté.");
  process.exit(0);
}

console.error("Audit localisation : textes visibles non localisés détectés.\n");
let currentFile = "";
for (const finding of unique) {
  if (finding.file !== currentFile) {
    currentFile = finding.file;
    console.error(currentFile);
  }
  console.error(`  L${finding.line} [${finding.kind}] ${finding.text}`);
}
console.error(`\nTotal : ${unique.length} occurrence(s).`);
process.exit(1);
