import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const args = process.argv.slice(2);

function argumentValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

let version = args.find((value) => !value.startsWith("--"));
if (!version) {
  const prompt = createInterface({ input, output });
  version = (await prompt.question("Nouvelle version PAIDEIA (ex. 1.0.26195) : ")).trim();
  prompt.close();
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
  throw new Error(`Version invalide : ${version || "valeur vide"}. Format SemVer attendu.`);
}

const monthNames = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre"
];

function validDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? { year, month, day }
    : null;
}

function parseReleaseDate(value) {
  if (!value) {
    return null;
  }
  let match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (match) {
    return validDate(Number(match[3]), Number(match[2]), Number(match[1]));
  }
  match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    return validDate(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  throw new Error(`Date invalide : ${value}. Formats acceptes : JJ/MM/AAAA ou AAAA-MM-JJ.`);
}

function dateFromVersion(value) {
  const match = /(\d{2})(\d{2})(\d{2})$/.exec(value);
  return match ? validDate(2000 + Number(match[3]), Number(match[2]), Number(match[1])) : null;
}

function dateFromMsiPatch(value) {
  const match = /^\d+\.\d+\.(\d{2})(\d{3})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = 2000 + Number(match[1]);
  const ordinalDay = Number(match[2]);
  const date = new Date(Date.UTC(year, 0, ordinalDay));
  return date.getUTCFullYear() === year
    ? validDate(year, date.getUTCMonth() + 1, date.getUTCDate())
    : null;
}

const today = new Date();
const releaseDate =
  parseReleaseDate(argumentValue("--date")) ??
  dateFromVersion(version) ??
  dateFromMsiPatch(version) ??
  validDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
const releaseDateLabel = `${releaseDate.day} ${monthNames[releaseDate.month - 1]} ${releaseDate.year}`;

function dayOfYear({ year, month, day }) {
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, month - 1, day);
  return Math.floor((current - start) / 86_400_000) + 1;
}

function deriveTechnicalVersion(productVersion) {
  const explicitTechnicalVersion = argumentValue("--technical");
  if (explicitTechnicalVersion) {
    return explicitTechnicalVersion;
  }

  const [major, minor, patchWithSuffix] = productVersion.split(".");
  const numericPatch = Number(/^\d+/.exec(patchWithSuffix)?.[0] ?? Number.NaN);
  if (numericPatch <= 65_535) {
    return productVersion;
  }

  const encodedDate = dateFromVersion(productVersion);
  if (!encodedDate) {
    throw new Error(
      "Le patch depasse 65535 et aucune date JJMMAA ne permet de calculer une version technique MSI. Utiliser --technical."
    );
  }
  const technicalPatch = Number(String(encodedDate.year % 100).padStart(2, "0") + String(dayOfYear(encodedDate)).padStart(3, "0"));
  return `${major}.${minor}.${technicalPatch}`;
}

const technicalVersion = deriveTechnicalVersion(version);
const technicalParts = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(technicalVersion);
if (!technicalParts) {
  throw new Error(`Version technique invalide : ${technicalVersion}.`);
}
if (Number(technicalParts[1]) > 255 || Number(technicalParts[2]) > 255 || Number(technicalParts[3]) > 65_535) {
  throw new Error(
    `Version technique incompatible MSI : ${technicalVersion}. Limites : major/minor <= 255, patch <= 65535.`
  );
}

const changedFiles = [];

async function updateFile(relativePath, transform) {
  const path = resolve(rootDir, relativePath);
  const source = await readFile(path, "utf8");
  const updated = transform(source);
  if (updated === source) {
    return;
  }
  await writeFile(path, updated, "utf8");
  changedFiles.push(relativePath);
}

async function updateOptionalFile(relativePath, transform) {
  try {
    await updateFile(relativePath, transform);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

function replaceRequired(source, pattern, replacement, label) {
  if (typeof pattern === "string") {
    if (!source.includes(pattern)) {
      throw new Error(`Valeur introuvable : ${label}`);
    }
    return source.replace(pattern, replacement);
  }
  if (!pattern.test(source)) {
    throw new Error(`Valeur introuvable : ${label}`);
  }
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
}

function replaceFirstMatches(source, pattern, count, replacement, label) {
  let replaced = 0;
  const updated = source.replace(pattern, (...match) => {
    if (replaced >= count) {
      return match[0];
    }
    replaced += 1;
    return typeof replacement === "function" ? replacement(...match) : replacement;
  });
  if (replaced !== count) {
    throw new Error(`Nombre de valeurs inattendu pour ${label} : ${replaced}/${count}`);
  }
  return updated;
}

await updateFile("package.json", (source) =>
  replaceRequired(source, /(\"version\"\s*:\s*\")[^\"]+(\")/, `$1${technicalVersion}$2`, "package.json")
);

await updateFile("package-lock.json", (source) =>
  replaceFirstMatches(
    source,
    /(\"version\"\s*:\s*\")[^\"]+(\")/g,
    2,
    (_match, prefix, suffix) => `${prefix}${technicalVersion}${suffix}`,
    "package-lock.json"
  )
);

await updateFile("src-tauri/tauri.conf.json", (source) =>
  replaceRequired(source, /(\"version\"\s*:\s*\")[^\"]+(\")/, `$1${technicalVersion}$2`, "tauri.conf.json")
);

await updateFile("src-tauri/Cargo.toml", (source) =>
  replaceRequired(source, /(\[package\][\s\S]*?\nversion\s*=\s*\")[^\"]+(\")/, `$1${technicalVersion}$2`, "Cargo.toml [package]")
);

await updateFile("src-tauri/Cargo.lock", (source) =>
  replaceRequired(
    source,
    /(\[\[package\]\]\r?\nname = \"paideia\"\r?\nversion = \")[^\"]+(\")/,
    `$1${technicalVersion}$2`,
    "Cargo.lock paideia"
  )
);

await updateFile("src/app/appConfig.ts", (source) => {
  return replaceRequired(
    source,
    /(export const APP_VERSION = \")[^\"]+(\";)/,
    `$1${version}$2`,
    "APP_VERSION"
  );
});

await updateFile("src/App.tsx", (source) =>
  replaceRequired(source, /(const snapshotVersion = \"v)[^\"]+(\";)/, `$1${version}$2`, "snapshotVersion")
);

await updateFile("src-tauri/src/commands.rs", (source) => {
  let updated = replaceRequired(
    source,
    /(\"generator_version\"\s*:\s*\")[^\"]+(\")/,
    `$1${version}$2`,
    "SCORM generator_version"
  );
  updated = replaceRequired(
    updated,
    /(\"generatorVersion\"\s*:\s*\")[^\"]+(\")/,
    `$1${version}$2`,
    "SCORM generatorVersion"
  );
  return updated;
});

await updateOptionalFile("README.md", (source) =>
  replaceRequired(source, /(Product version:\s*`)[^`]+(`\.)/, `$1${version}$2`, "README product version")
);

await updateOptionalFile("paideia.md", (source) =>
  replaceRequired(
    source,
    /(La version produit actuelle est `)[^`]+(`)/,
    `$1${version}$2`,
    "paideia.md current product version"
  )
);

await updateFile("version.md", (source) => {
  const heading = `## Version ${version}`;
  if (source.includes(heading)) {
    const sectionPattern = new RegExp(`(${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?Date de mise (?:à|a) jour : )[^.]+(\\.)`);
    let updated = replaceRequired(source, sectionPattern, `$1${releaseDateLabel}$2`, "version.md release date");
    const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const versionLinesPattern = new RegExp(
      `(${escapedHeading}[\\s\\S]*?)(- Version produit[^\\r\\n]*\\r?\\n- Version technique[^\\r\\n]*)`
    );
    if (versionLinesPattern.test(updated)) {
      return updated.replace(
        versionLinesPattern,
        `$1- Version produit, interface et générateur SCORM : \`${version}\`.\n- Version technique npm, Tauri, Cargo et MSI : \`${technicalVersion}\`.`
      );
    }
    updated = replaceRequired(
      updated,
      /- Version produit, interface, packaging et générateur SCORM synchronisés sur `[^`]+`\./,
      `- Version produit, interface et générateur SCORM : \`${version}\`.\n- Version technique npm, Tauri, Cargo et MSI : \`${technicalVersion}\`.`,
      "version.md technical version"
    );
    return updated;
  }
  const introduction = "Ce fichier consigne les versions produit de PAIDEIA, les dates de mise à jour et les changements principaux.";
  const section = `\n\n${heading}\n\nDate de mise à jour : ${releaseDateLabel}.\n\n- Version produit, interface et générateur SCORM : \`${version}\`.\n- Version technique npm, Tauri, Cargo et MSI : \`${technicalVersion}\`.\n`;
  return replaceRequired(source, introduction, `${introduction}${section}`, "version.md introduction");
});

await updateFile("CHANGELOG.md", (source) => {
  const heading = `## ${version} - ${releaseDateLabel}`;
  if (source.includes(heading)) {
    return source;
  }
  if (/^## (?:Travail en cours|Non publié)[^\r\n]*$/m.test(source)) {
    return source.replace(/^## (?:Travail en cours|Non publié)[^\r\n]*$/m, heading);
  }
  return replaceRequired(source, "# Changelog PAIDEIA", `# Changelog PAIDEIA\n\n${heading}`, "CHANGELOG heading");
});

console.log(`PAIDEIA produit : ${version} - ${releaseDateLabel}`);
console.log(`PAIDEIA technique npm/Tauri/Cargo/MSI : ${technicalVersion}`);
if (changedFiles.length === 0) {
  console.log("Tous les fichiers sont deja a jour.");
} else {
  console.log("Fichiers mis a jour :");
  changedFiles.forEach((file) => console.log(`- ${file}`));
}
