import type { AppLanguage, TranslationParams } from "../i18n";
import type { ImportRematchingEntry, ImportReport } from "../lib/projectApi";

type Translator = (key: string, params?: TranslationParams, fallback?: string) => string;

const CONTRACT_ACTIVITY_TYPES = new Set(["continue", "course-exit"]);

function isContractActivity(entry: ImportRematchingEntry) {
  return CONTRACT_ACTIVITY_TYPES.has(entry.mappedTo);
}

export function entryNeedsImportReview(entry: ImportRematchingEntry) {
  if (isContractActivity(entry)) {
    return false;
  }
  const status = entry.status.toLocaleLowerCase("en");
  return status === "partial" || entry.missingProperties.length > 0;
}

function cleanSourceValue(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\brise\b/gi, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[-–—:\s]+|[-–—:\s]+$/g, "")
    .trim();
}

export type ImportReportRow = {
  title: string;
  location: string;
  result: string;
  details: string[];
  level: "ok" | "warning" | "error";
};

function markdownValue(value: string | null | undefined) {
  return cleanSourceValue(value).replace(/([\\`*_{}\[\]<>#+!|])/g, "\\$1");
}

function sourceType(entry: ImportRematchingEntry, t: Translator) {
  return markdownValue(entry.sourceVariant || entry.sourceType || entry.sourceFamily)
    || t("importLog.unknownType", undefined, "Type non identifié");
}

function missingPropertyLabel(value: string, t: Translator) {
  const normalized = cleanSourceValue(value);
  let detail = normalized;
  if (normalized === "Styles de popup") detail = t("importLog.missing.popupStyles");
  else if (normalized === "Espacement et styles decoratifs exacts") detail = t("importLog.missing.decorativeSpacing");
  else if (normalized === "Composition visuelle par superposition de plusieurs blocs") detail = t("importLog.missing.layeredComposition");
  else if (normalized === "Proprietes non prises en charge") detail = t("importLog.missing.unsupportedProperties");
  else if (normalized === "Rendu graphique exact") detail = t("importLog.missing.exactGraphicRendering");
  else if (normalized === "Animation d'entrée") detail = t("importLog.missing.entryAnimation");
  return t(
    "importLog.missing.specific",
    { property: detail || t("importLog.unknownProperty", undefined, "Propriété non identifiée") },
    "Non repris à l’identique : {property}."
  );
}

function entryResult(
  entry: ImportRematchingEntry,
  targetLabel: (type: string) => string,
  t: Translator
) {
  const status = entry.status.toLocaleLowerCase("en");
  if (isContractActivity(entry)) {
    return {
      result: t("importLog.result.mapped", { activity: targetLabel(entry.mappedTo) }, "Rematché vers « {activity} »"),
      state: "OK",
      recommended: ""
    };
  }
  if (status === "injected") {
    return {
      result: t("importLog.result.generated", { activity: targetLabel(entry.mappedTo) }, "Activité « {activity} » ajoutée par PAIDEIA"),
      state: "OK",
      recommended: ""
    };
  }
  if (status === "unsupported") {
    return {
      result: t("importLog.result.unmapped", undefined, "Bloc non rematché"),
      state: t("importLog.state.review", undefined, "À vérifier"),
      recommended: t("importLog.action.recreate", undefined, "Recréer manuellement cette activité si nécessaire.")
    };
  }
  if (status === "fallback-html") {
    return {
      result: t("importLog.result.fallbackHtml", undefined, "Contenu conservé en HTML personnalisé"),
      state: t("importLog.state.review", undefined, "À vérifier"),
      recommended: ""
    };
  }
  if (status === "grouped") {
    return {
      result: t("importLog.result.grouped", { activity: targetLabel(entry.mappedTo) }, "Regroupé dans l’activité « {activity} »"),
      state: entry.missingProperties.length
        ? t("importLog.state.review", undefined, "À vérifier")
        : "OK",
      recommended: ""
    };
  }
  const review = entryNeedsImportReview(entry);
  return {
    result: t("importLog.result.mapped", { activity: targetLabel(entry.mappedTo) }, "Rematché vers « {activity} »"),
    state: review
      ? t("importLog.state.review", undefined, "À vérifier")
      : "OK",
    recommended: ""
  };
}

export function buildLocalizedImportLog(
  report: ImportReport,
  projectTitle: string,
  language: AppLanguage,
  t: Translator,
  targetLabel: (type: string) => string
) {
  const imported = report.summary.blocksMappedExactly + report.summary.blocksMappedApproximately;
  const review = report.rematching.filter(entryNeedsImportReview).length;
  const generatedAt = new Intl.DateTimeFormat(language, { dateStyle: "long", timeStyle: "short" }).format(new Date());
  const lines = [
    t(
      "importLog.externalWarning",
      undefined,
      "L’import de SCORM non générés par PAIDEIA est expérimental. Nous ne pouvons garantir un résultat parfait ; vous devrez peut-être procéder à des ajustements après cet import."
    ),
    "",
    `# ${t("importLog.title", undefined, "Journal d’importation")}`,
    "",
    `${markdownValue(projectTitle)} — ${markdownValue(generatedAt)}`,
    "",
    `- ${t("importLog.analyzed", { count: report.summary.blocksDetected }, "{count} blocs analysés")}`,
    `- ${t("importLog.mapped", { count: imported }, "{count} blocs rematchés")}`,
    `- ${t("importLog.review", { count: review }, "{count} blocs à vérifier")}`,
    `- ${t("importLog.unmapped", { count: report.summary.blocksUnsupported }, "{count} blocs non rematchés")}`,
    "",
    "---",
    ""
  ];

  const mediaErrors = report.issues.filter((issue) => issue.severity === "error" && issue.message.startsWith("Média manquant"));
  if (mediaErrors.length) {
    lines.push(`## Médias manquants (${mediaErrors.length})`, "");
    for (const issue of mediaErrors) {
      lines.push(`- ${markdownValue(issue.location)} — ${markdownValue(issue.message)}`);
    }
    lines.push("", "---", "");
  }

  report.rematching.forEach((entry, index) => {
    const result = entryResult(entry, targetLabel, t);
    const missing = isContractActivity(entry)
      ? []
      : Array.from(new Set(entry.missingProperties.map((value) => missingPropertyLabel(value, t))));
    lines.push(
      `### ${index + 1}. ${sourceType(entry, t)}`,
      "",
      `\`${markdownValue(entry.location) || "—"}\``,
      "",
      result.result,
      result.state === "OK" ? "✓ OK" : `⚠ ${result.state}`
    );
    if (missing.length) {
      lines.push("", ...missing.map((value) => `- ⚠ ${value}`));
    }
    if (result.recommended) {
      lines.push("", `→ ${result.recommended}`);
    }
    lines.push("");
  });

  if (!report.rematching.length) {
    lines.push(t("importLog.noDetails", undefined, "Aucun détail de rematching n’est disponible."), "");
  }
  return `${lines.join("\n").trim()}\n`;
}

export function buildLocalizedImportReportRows(
  report: ImportReport,
  t: Translator,
  targetLabel: (type: string) => string
): ImportReportRow[] {
  const rows = report.rematching.map((entry, index) => {
    const status = entry.status.toLocaleLowerCase("en");
    const result = entryResult(entry, targetLabel, t);
    const level: ImportReportRow["level"] = status === "unsupported"
      ? "error"
      : entryNeedsImportReview(entry)
        ? "warning"
        : "ok";
    return {
      title: `${index + 1}. ${cleanSourceValue(entry.sourceVariant || entry.sourceType || entry.sourceFamily) || t("importLog.unknownType", undefined, "Type non identifié")}`,
      location: cleanSourceValue(entry.location) || "—",
      result: result.result,
      details: isContractActivity(entry)
        ? []
        : Array.from(new Set(entry.missingProperties.map((value) => missingPropertyLabel(value, t)))),
      level
    };
  });
  for (const issue of report.issues.filter((issue) => issue.severity === "error" && issue.message.startsWith("Média manquant"))) {
    rows.push({
      title: "Média manquant",
      location: cleanSourceValue(issue.location) || "—",
      result: cleanSourceValue(issue.message),
      details: [],
      level: "error"
    });
  }
  return rows;
}

function rtfEscape(value: string) {
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const character = value[index];
    if (character === "\\" || character === "{" || character === "}") output += `\\${character}`;
    else if (code === 10) output += "\\par\n";
    else if (code >= 32 && code <= 126) output += character;
    else output += `\\u${code > 32767 ? code - 65536 : code}?`;
  }
  return output;
}

export function buildImportReportRtf(title: string, rows: ImportReportRow[]) {
  const colors = "{\\colortbl;\\red42\\green143\\blue79;\\red218\\green128\\blue23;\\red190\\green45\\blue45;}";
  const body = rows.map((row) => {
    const color = row.level === "ok" ? 1 : row.level === "warning" ? 2 : 3;
    const details = row.details.map((detail) => `\\par ${rtfEscape(detail)}`).join("");
    return `{\\cf${color}\\bullet}\\cf0\\tab {\\b ${rtfEscape(row.title)}}\\b0\\par ${rtfEscape(row.location)}\\par ${rtfEscape(row.result)}${details}\\par\\par `;
  }).join("");
  return `{\\rtf1\\ansi\\ansicpg1252\\uc1\\deff0{\\fonttbl{\\f0 Inter;}{\\f1 Arial;}}${colors}\\viewkind4\\lang1036\\f0\\fs36 {\\b ${rtfEscape(title)}}\\b0\\par\\par ${body}}`;
}
