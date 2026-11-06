import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const localeRoot = path.join(root, "src", "locales");
const requested = process.argv.slice(2);
const prefixArgument = requested.find((argument) => argument.startsWith("--prefix="));
const prefixes = prefixArgument
  ? prefixArgument.slice("--prefix=".length).split(",").map((value) => value.trim()).filter(Boolean)
  : [];
const targets = requested.filter((argument) => !argument.startsWith("--prefix="));
const defaultTargets = ["en", "de", "bg", "hr", "da", "es", "it", "et", "fi", "cs", "nl", "ro", "el", "ga", "hu", "mt", "pl", "pt", "sv", "lt", "sl", "lv", "sk", "br", "eu", "sc", "co", "cy", "tr"];
const controlledFallbacks = { br: "fr", eu: "es", sc: "it", co: "it", cy: "en", tr: "en" };

const nativeNames = {
  bg: "Български", cs: "Čeština", da: "Dansk", de: "Deutsch", el: "Ελληνικά",
  en: "English", es: "Español", et: "Eesti", fi: "Suomi", fr: "Français",
  ga: "Gaeilge", hr: "Hrvatski", hu: "Magyar", it: "Italiano", lt: "Lietuvių",
  lv: "Latviešu", mt: "Malti", nl: "Nederlands", pl: "Polski", pt: "Português",
  ro: "Română", sk: "Slovenčina", sl: "Slovenščina", sv: "Svenska",
  br: "Brezhoneg", eu: "Euskara", sc: "Sardu", co: "Corsu", cy: "Cymraeg", tr: "Türkçe"
};

const source = JSON.parse(await readFile(path.join(localeRoot, "fr.json"), "utf8"));
const entries = Object.entries(source);

function protect(values) {
  const replacements = new Map();
  const protectedValues = values.map((value, valueIndex) => {
    let tokenIndex = 0;
    return value.replace(/\{[a-zA-Z0-9_]+\}|<ALT>|PAIDEIA|SCORM|LMS|HTML|PDF|CSV|URL|UTF-8/g, (token) => {
      const marker = `{${900000 + valueIndex * 100 + tokenIndex++}}`;
      replacements.set(marker, token);
      return marker;
    });
  });
  return { values: protectedValues, replacements };
}

async function requestTranslation(text, target, attempt = 1) {
  const body = new URLSearchParams({ client: "gtx", sl: "fr", tl: target, dt: "t", q: text });
  const response = await fetch("https://translate.googleapis.com/translate_a/single", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body
  });
  if (!response.ok) {
    if (attempt < 7) {
      const retryDelay = response.status === 429
        ? Math.min(120_000, 15_000 * (2 ** (attempt - 1)))
        : attempt * 2_000;
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      return requestTranslation(text, target, attempt + 1);
    }
    throw new Error(`HTTP ${response.status} pour ${target}`);
  }
  const payload = await response.json();
  return (payload[0] ?? []).map((segment) => segment?.[0] ?? "").join("");
}

async function translateValues(values, target) {
  const output = [];
  for (let offset = 0; offset < values.length;) {
    const batch = [];
    let length = 0;
    while (offset + batch.length < values.length && batch.length < 45) {
      const next = values[offset + batch.length];
      if (batch.length && length + next.length > 4500) break;
      batch.push(next);
      length += next.length + 40;
    }
    const protectedBatch = protect(batch);
    // Le symbole de contrôle visible reste stable dans la réponse, contrairement
    // aux marqueurs textuels que certains moteurs tentent parfois de traduire.
    const joined = protectedBatch.values.join("\n␞\n");
    const translated = await requestTranslation(joined, target);
    const parts = translated.split(/\s*␞\s*/u);
    if (parts.length !== batch.length) {
      throw new Error(`Découpage invalide pour ${target} à l'offset ${offset}: ${parts.length}/${batch.length}`);
    }
    for (const part of parts) {
      let restored = part.trim();
      restored = restored.replace(/\{(9[\d.,\s]+)\}/g, (marker, numericBody) => {
        const normalizedMarker = `{${numericBody.replace(/\D/g, "")}}`;
        return protectedBatch.replacements.get(normalizedMarker) ?? marker;
      });
      for (const [marker, original] of protectedBatch.replacements) {
        restored = restored.replaceAll(marker, original);
      }
      output.push(restored);
    }
    offset += batch.length;
    process.stdout.write(`\r${target}: ${offset}/${values.length}`);
    await new Promise((resolve) => setTimeout(resolve, 650));
  }
  process.stdout.write("\n");
  return output;
}

for (const target of (targets.length ? targets : defaultTargets)) {
  if (!nativeNames[target] || target === "fr") {
    throw new Error(`Locale cible non prise en charge : ${target}`);
  }
  const translatableEntries = entries.filter(([key]) => !key.startsWith("language.") && (!prefixes.length || prefixes.some((prefix) => key.startsWith(prefix))));
  const fallbackLocale = controlledFallbacks[target];
  const fallbackDictionary = fallbackLocale
    ? JSON.parse(await readFile(path.join(localeRoot, `${fallbackLocale}.json`), "utf8"))
    : null;
  const translatedValues = fallbackDictionary
    ? translatableEntries.map(([key, value]) => fallbackDictionary[key] ?? value)
    : await translateValues(translatableEntries.map(([, value]) => value), target);
  const translatedByKey = new Map(translatableEntries.map(([key], index) => [key, translatedValues[index]]));
  const current = JSON.parse(await readFile(path.join(localeRoot, `${target}.json`), "utf8"));
  const dictionary = { ...current };
  for (const [key, value] of entries) {
    dictionary[key] = translatedByKey.get(key) ?? current[key] ?? value;
  }
  for (const [key, sourceValue] of entries) {
    const translatedValue = dictionary[key];
    const expectedPlaceholders = Array.from(sourceValue.matchAll(/\{([a-zA-Z0-9_]+)\}/g), (match) => match[1]).sort();
    const actualPlaceholders = Array.from(translatedValue.matchAll(/\{([a-zA-Z0-9_]+)\}/g), (match) => match[1]).sort();
    if (expectedPlaceholders.join("\0") !== actualPlaceholders.join("\0")) {
      throw new Error(`Variables incompatibles pour ${target}, clé ${key}. Attendus=${expectedPlaceholders.join(",")} obtenus=${actualPlaceholders.join(",")} valeur=${translatedValue}`);
    }
    if (/[\uE000\uE001]/u.test(translatedValue) || /\{9\d{5,}\}/u.test(translatedValue) || translatedValue.includes("␞")) {
      throw new Error(`Marqueur interne non restauré pour ${target}, clé ${key}.`);
    }
  }
  await writeFile(path.join(localeRoot, `${target}.json`), `${JSON.stringify(dictionary, null, 2)}\n`, "utf8");
  console.log(`${target}: ${Object.keys(dictionary).length} clés écrites.`);
}
