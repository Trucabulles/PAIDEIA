import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const localeRoot = path.join(root, "src", "locales");
const referenceLocale = "fr";
// A locale is listed here only once every UI and PDF key has been translated.
// Partial working dictionaries may exist on disk, but must never pass as complete.
const completeLocales = ["fr", "en", "de", "bg", "hr", "da", "es", "it", "et", "fi", "cs", "nl", "ro", "el", "ga", "hu", "mt", "pl", "pt", "sv", "lt", "sl", "lv", "sk", "br", "eu", "sc", "co", "cy", "tr"];
const sourceRoots = [path.join(root, "src"), path.join(root, "scripts")];
const sourceExtensions = new Set([".ts", ".tsx", ".mjs"]);
const ignoredDirectories = new Set(["dist", "node_modules", "target", "locales"]);
// L'assistant concepteur est une fonctionnalité expérimentale volontairement
// limitée au français. Ses libellés doivent exister dans le dictionnaire de
// référence, sans imposer de traductions inutilisées aux autres locales.
const frenchOnlyPrefixes = ["designerActions."];
const mojibakePattern = /(?:Ã.|Â.|â(?:€|™|œ|ž|†|‡|€¦|€“|€”|†|€¢)|ï¿½|\uFFFD|R\?le|m\?tier|apr\?s|s\?curit|r\?ponse|S\?quence)/u;
const htmlEntityPattern = /&(?:[a-zA-Z][a-zA-Z0-9]+|#\d+|#x[0-9a-fA-F]+);/u;

function placeholders(value) {
  return Array.from(String(value).matchAll(/\{([a-zA-Z0-9_]+)\}/g))
    .map((match) => match[1])
    .sort();
}

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listSourceFiles(fullPath));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function isFrenchOnlyKey(key) {
  return frenchOnlyPrefixes.some((prefix) => key.startsWith(prefix));
}

async function readDictionary(locale) {
  const filePath = path.join(localeRoot, `${locale}.json`);
  const raw = await readFile(filePath, "utf8");
  try {
    return { raw, dictionary: JSON.parse(raw) };
  } catch (error) {
    fail(`Locale ${locale} invalide : ${error.message}`);
    return { raw, dictionary: {} };
  }
}

const { raw: rawReference, dictionary: reference } = await readDictionary(referenceLocale);
const referenceKeys = Object.keys(reference);
const referenceKeySet = new Set(referenceKeys);

for (const sentinel of ["é", "è", "ê", "à", "ç"]) {
  if (!rawReference.includes(sentinel)) {
    fail(`Locale fr : caractère sentinelle manquant (${sentinel}). Vérifier l'encodage UTF-8.`);
  }
}

for (const locale of completeLocales) {
  const { raw, dictionary } = locale === referenceLocale
    ? { raw: rawReference, dictionary: reference }
    : await readDictionary(locale);
  const keys = Object.keys(dictionary);
  const keySet = new Set(keys);

  for (const key of referenceKeys) {
    if (locale !== referenceLocale && isFrenchOnlyKey(key)) continue;
    if (!keySet.has(key)) fail(`Locale ${locale} : clé manquante (${key}).`);
  }
  for (const key of keys) {
    if (!referenceKeySet.has(key)) fail(`Locale ${locale} : clé étrangère au dictionnaire FR (${key}).`);
  }

  for (const [key, value] of Object.entries(dictionary)) {
    if (typeof value !== "string" || !value.trim()) {
      fail(`Locale ${locale}, clé ${key} : valeur vide ou non textuelle.`);
      continue;
    }
    if (mojibakePattern.test(value)) {
      fail(`Locale ${locale}, clé ${key} : séquence corrompue détectée (${value}).`);
    }
    if (htmlEntityPattern.test(value)) {
      fail(`Locale ${locale}, clé ${key} : entité HTML interdite dans un libellé (${value}).`);
    }
    const tokens = placeholders(value);
    if (new Set(tokens).size !== tokens.length) {
      fail(`Locale ${locale}, clé ${key} : placeholder dupliqué.`);
    }
    const expectedTokens = placeholders(reference[key] ?? "");
    if (tokens.join("\0") !== expectedTokens.join("\0")) {
      fail(`Locale ${locale}, clé ${key} : placeholders incompatibles (attendus : ${expectedTokens.join(", ") || "aucun"}).`);
    }
  }

  if (!raw.endsWith("\n")) fail(`Locale ${locale} : fin de ligne finale manquante.`);
}

const usedKeys = new Set();
for (const sourceRoot of sourceRoots) {
  for (const filePath of await listSourceFiles(sourceRoot)) {
    const content = await readFile(filePath, "utf8");
    const relativePath = path.relative(root, filePath).replace(/\\/g, "/");
    const isVerifier = path.basename(filePath) === "verify-locales.mjs";
    const mojibakeMatch = isVerifier ? null : content.match(mojibakePattern);
    if (mojibakeMatch) fail(`${relativePath} : séquence corrompue détectée (${mojibakeMatch[0]}).`);
    for (const match of content.matchAll(/\b(?:t|translateActive)\(\s*["']([^"']+)["']/g)) usedKeys.add(match[1]);
  }
}

for (const key of [...usedKeys].sort()) {
  if (!(key in reference)) fail(`Locale fr : clé appelée mais absente (${key}).`);
}

if (!process.exitCode) {
  console.log(`Locales complètes validées (${completeLocales.join(", ")}) : ${referenceKeys.length} clés, ${usedKeys.size} clés statiques appelées, parité, placeholders, UTF-8, entités HTML et mojibake contrôlés.`);
}
