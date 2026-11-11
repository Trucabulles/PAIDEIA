import type {
  ActivityFrameBorderStyle, ActivityFrameBorderWidth, ActivityHeight, ActivitySpacing, AppearanceActivityTarget, BackgroundIntensity, CaptionOutline, HeaderContentAlign, HeaderTextOutline, HeaderTextOutlineColor, SectionMarkerScheme, SectionMarkerType
} from "./designerActionModel";
import { PAIDEIA_ACTIVITY_CATALOG } from "./designerKnowledgeCatalog";
import { normalizeDesignerText } from "./designerLanguage";

const PAIDEIA_COLOR_BASES: Record<string, string> = {
  blanc: "#FFFFFF", white: "#FFFFFF", neutre: "#FFFFFF", neutral: "#FFFFFF",
  gris: "#374151", gray: "#374151", grey: "#374151", ardoise: "#374151", slate: "#374151",
  noir: "#111111", black: "#111111", marron: "#7B6157", brown: "#7B6157",
  cyan: "#1F97AE", bleu: "#1D7DDC", blue: "#1D7DDC", violet: "#5E46D9", purple: "#5E46D9",
  magenta: "#9B3AB9", rose: "#D61F63", pink: "#D61F63", vert: "#35A443", green: "#35A443",
  emeraude: "#059669", emerald: "#059669", jaune: "#F0C419", yellow: "#F0C419",
  orange: "#F08C00", rouge: "#E53935", red: "#E53935"
};

export function normalizeDesignerColor(value: string, allowTransparent = false): string | null {
  const compact = value.trim().toLowerCase().replace(/\s+/g, "");
  if (allowTransparent && /^(transparent|sans|aucun|aucune|vide|none)$/.test(compact)) {
    return "transparent";
  }
  const hex = compact.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].split("").map((digit) => digit + digit).join("") : hex[1];
    return `#${digits.toUpperCase()}`;
  }
  const rgb = compact.match(/^rgb\((\d{1,3}),(\d{1,3}),(\d{1,3})\)$/i);
  if (rgb && rgb.slice(1).every((channel) => Number(channel) <= 255)) {
    return `#${rgb.slice(1).map((channel) => Number(channel).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  }
  return PAIDEIA_COLOR_BASES[compact] ?? null;
}

export function extractSingleColor(
  command: string,
  defaultColor = "#222222",
  allowTransparent = false
): string | "ambiguous" | null {
  const candidates = new Set<string>();
  for (const match of command.matchAll(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b|rgb\s*\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)/gi)) {
    const color = normalizeDesignerColor(match[0], allowTransparent);
    if (color) candidates.add(color);
  }
  const normalized = normalizeDesignerText(command);
  for (const token of normalized.split(/[\s,()]+/)) {
    const color = normalizeDesignerColor(token, allowTransparent);
    if (color) candidates.add(color);
  }
  if (/\b(couleur )?(par )?defaut\b/.test(normalized)) candidates.add(defaultColor);
  return candidates.size > 1 ? "ambiguous" : [...candidates][0] ?? null;
}

export function extractHeight(normalized: string): ActivityHeight | "ambiguous" | null {
  const candidates = new Set<ActivityHeight>();
  if (/\b(minimum|minimale|minimales|minimal|min|petit|petite|petits|petites)\b/.test(normalized)) candidates.add("minimum");
  if (/\b(moyen|moyenne|moyennes|medium)\b/.test(normalized)) candidates.add("medium");
  if (/\b(grand|grande|grandes|large)\b/.test(normalized)) candidates.add("large");
  return candidates.size > 1 ? "ambiguous" : [...candidates][0] ?? null;
}

export function extractBoolean(normalized: string, property: "background" | "fullscreen"): boolean | "ambiguous" | null {
  const positive = property === "background"
    ? /\b(avec fond|fond (?:oui|actif|active|activee|on)|active(?:r)? (?:le )?fond)\b/.test(normalized)
    : /\b(autorise|autoriser|active|activer|permet|permettre)\b/.test(normalized);
  const negative = property === "background"
    ? /\b(sans fond|fond (?:non|inactif|inactive|desactive|desactivee|off)|desactive(?:r)? (?:le )?fond)\b/.test(normalized)
    : /\b(interdit|interdire|desactive|desactiver|sans)\b/.test(normalized);
  if (positive && negative) return "ambiguous";
  if (positive) return true;
  if (negative) return false;
  if (/^(oui|active|activer|on)$/.test(normalized)) return true;
  if (/^(non|desactive|desactiver|off|sans)$/.test(normalized)) return false;
  return null;
}

export function extractOutline(normalized: string): CaptionOutline | "ambiguous" | null {
  const candidates = new Set<CaptionOutline>();
  if (/\b(sans contour|aucun contour|contour (?:sans|aucun|none|non|desactive))\b/.test(normalized) || /^(sans|aucun|none)$/.test(normalized)) candidates.add("none");
  if (/\b(contour (?:fin|thin)|fin)\b/.test(normalized)) candidates.add("thin");
  if (/\b(contour (?:epais|thick)|epais)\b/.test(normalized)) candidates.add("thick");
  return candidates.size > 1 ? "ambiguous" : [...candidates][0] ?? null;
}

export function extractFontSize(normalized: string): number | "ambiguous" | null {
  const withoutChapterReference = normalized.replace(/\bchapitre\s+\d+\b/g, " ");
  const candidates = new Set<number>();
  for (const match of withoutChapterReference.matchAll(/\b(\d{1,3})(?:\s*px)?\b/g)) {
    const value = Number(match[1]);
    if (value >= 6 && value <= 96) candidates.add(value);
  }
  return candidates.size > 1 ? "ambiguous" : [...candidates][0] ?? null;
}

export function extractActivitySpacing(normalized: string): ActivitySpacing | "ambiguous" | null {
  const candidates = new Set<ActivitySpacing>();
  if (/\b(minimum|minimale|minimal|min|petit|petite)\b/.test(normalized)) candidates.add("minimum");
  if (/\b(moyen|moyenne|milieu|medium|normal|normale)\b/.test(normalized)) candidates.add("medium");
  if (/\b(maximum|maximal|maximale|maxi|max|grand|grande)\b/.test(normalized)) candidates.add("maximum");
  return candidates.size > 1 ? "ambiguous" : [...candidates][0] ?? null;
}

export function extractActivityFrameBorderWidth(normalized: string): ActivityFrameBorderWidth | "ambiguous" | null {
  const candidates = new Set<ActivityFrameBorderWidth>();
  if (/\b(tres fine|ultra fine)\b/.test(normalized)) candidates.add("1px");
  else if (/\b(fin|fine|fins|fines)\b/.test(normalized)) candidates.add("1px");
  if (/\b(normal|normale|normaux|normales|moyen|moyenne)\b/.test(normalized)) candidates.add("2px");
  if (/\b(epais|epaisse|epaisses)\b/.test(normalized) && !/\btres\s+epais/.test(normalized)) candidates.add("4px");
  if (/\b(tres epais|tres epaisse|tres epaisses)\b/.test(normalized)) candidates.add("6px");
  return candidates.size > 1 ? "ambiguous" : [...candidates][0] ?? null;
}

export function extractActivityFrameBorderStyle(normalized: string): ActivityFrameBorderStyle | "ambiguous" | null {
  const candidates = new Set<ActivityFrameBorderStyle>();
  if (/\b(sans trait|aucun trait|trait aucun|trait sans|pas de trait)\b/.test(normalized)) candidates.add("none");
  if (/\b(plein|continu|continue|solide)\b/.test(normalized)) candidates.add("solid");
  if (/\b(tiret|tirets|tirete|tiretee|discontinu)\b/.test(normalized)) candidates.add("dashed");
  if (/\b(pointille|pointilles|points)\b/.test(normalized)) candidates.add("dotted");
  return candidates.size > 1 ? "ambiguous" : [...candidates][0] ?? null;
}

export function extractSectionMarkerScheme(normalized: string): SectionMarkerScheme | "ambiguous" | null {
  const candidates = new Set<SectionMarkerScheme>();
  if (/\b(chiffres? arabes?|numerotation arabe|nombres?)\b/.test(normalized)) candidates.add("arabic");
  if (/\b(chiffres? romains?|numerotation romaine)\b/.test(normalized)) candidates.add("roman");
  if (/\b(lettres?|alphabetique|alphabetiques)\b/.test(normalized)) candidates.add("alpha");
  return candidates.size > 1 ? "ambiguous" : [...candidates][0] ?? null;
}

export function extractSectionMarkerType(normalized: string): SectionMarkerType | "ambiguous" | null {
  const candidates = new Set<SectionMarkerType>();
  if (/\b(sans repere|aucun repere|repere sans|repere aucun)\b/.test(normalized)) candidates.add("none");
  if (/\b(cercle|contour)\b/.test(normalized)) candidates.add("outline");
  if (/\b(rond plein|cercle plein|plein)\b/.test(normalized)) candidates.add("filled");
  return candidates.size > 1 ? "ambiguous" : [...candidates][0] ?? null;
}

export function extractHeaderContentAlign(normalized: string): HeaderContentAlign | "ambiguous" | null {
  const candidates = new Set<HeaderContentAlign>();
  if (/\b(a gauche|gauche)\b/.test(normalized)) candidates.add("left");
  if (/\b(au centre|centre|centrer|centre)\b/.test(normalized)) candidates.add("center");
  if (/\b(a droite|droite)\b/.test(normalized)) candidates.add("right");
  return candidates.size > 1 ? "ambiguous" : [...candidates][0] ?? null;
}

export function extractHeaderTextOutline(normalized: string): HeaderTextOutline | "ambiguous" | null {
  const candidates = new Set<HeaderTextOutline>();
  if (/\b(sans (?:contour|renforcement)|aucun (?:contour|renforcement))\b/.test(normalized)) candidates.add("none");
  if (/\b(?:contour|renforcement) (?:fin|leger)\b/.test(normalized)) candidates.add("thin");
  if (/\b(?:contour|renforcement) (?:moyen|medium)\b/.test(normalized)) candidates.add("medium");
  if (/\b(?:contour|renforcement) (?:epais|fort)\b/.test(normalized)) candidates.add("thick");
  return candidates.size > 1 ? "ambiguous" : [...candidates][0] ?? null;
}

export function extractHeaderTextOutlineColor(normalized: string): HeaderTextOutlineColor | "ambiguous" | null {
  const candidates = new Set<HeaderTextOutlineColor>();
  if (/\b(contour|renforcement) (?:clair|blanc)|(?:clair|blanc) (?:contour|renforcement)\b/.test(normalized)) candidates.add("light");
  if (/\b(contour|renforcement) (?:sombre|noir)|(?:sombre|noir) (?:contour|renforcement)\b/.test(normalized)) candidates.add("dark");
  return candidates.size > 1 ? "ambiguous" : [...candidates][0] ?? null;
}

export function extractBackgroundIntensity(normalized: string): BackgroundIntensity | "ambiguous" | null {
  const candidates = new Set<BackgroundIntensity>();
  if (/\b(aucun|aucune|sans|nul|nulle|zero)\b/.test(normalized)) candidates.add("none");
  if (/\b(leger|legere|faible)\b/.test(normalized)) candidates.add("light");
  if (/\b(moyen|moyenne|medium)\b/.test(normalized)) candidates.add("medium");
  if (/\b(fort|forte|eleve|elevee)\b/.test(normalized)) candidates.add("strong");
  return candidates.size > 1 ? "ambiguous" : [...candidates][0] ?? null;
}

export function extractAppearanceBoolean(normalized: string): boolean | "ambiguous" | null {
  const positive = /\b(active|activer|activee|autorise|autoriser|avec|oui|on)\b/.test(normalized);
  const negative = /\b(desactive|desactiver|desactivee|sans|non|off|retire|retirer|supprime|supprimer)\b/.test(normalized);
  if (positive && negative) return "ambiguous";
  if (positive) return true;
  if (negative) return false;
  return null;
}

export function appearanceClause(normalized: string, property: RegExp) {
  return normalized.split(/\s*[,;]\s*/).find((part) => property.test(part)) ?? normalized;
}

export function confirmationAnswer(normalized: string): boolean | null {
  if (/^non\b/.test(normalized) || /^(?:aucun|aucune|aucune de ces activites|annule|annuler|abandonne|abandonner)$/.test(normalized)) return false;
  if (/^oui\b/.test(normalized) || /^(?:confirme|confirmer|je suis sur|je confirme|fais le|faites le|vas y|allez y)$/.test(normalized)) return true;
  return null;
}

export function extractReplacementLabel(command: string): string | null {
  const quoted = command.match(/[«“"]([^»”"]+)[»”"]/);
  const raw = quoted?.[1] ?? command.match(/\b(?:par|avec|en)\s+(.+)$/i)?.[1];
  const label = raw?.trim().replace(/^[«“"]|[»”"]$/g, "").trim();
  return label && label.length <= 120 && !/[\u0000-\u001F\u007F]/.test(label) ? label : null;
}

export type ExtractedAppearanceTarget = {
  target: AppearanceActivityTarget;
  activityReference?: string;
  activityType?: string;
  activityTypes?: string[];
  excludedActivityTypes?: string[];
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type ActivityAlias = { blockType: string; label: string; tokens: string[] };

function activityAliases(): ActivityAlias[] {
  const aliases = PAIDEIA_ACTIVITY_CATALOG.flatMap((entry) => [entry.name, ...entry.aliases].map((candidate) => ({
    blockType: entry.blockType,
    label: entry.name,
    tokens: normalizeDesignerText(candidate)
      .replace(/^(?:activites?|blocs?)\s+(?:de\s+)?/, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
  })));
  const unique = new Map<string, ActivityAlias>();
  for (const alias of aliases) {
    if (alias.tokens.join(" ").length < 3) continue;
    unique.set(`${alias.blockType}:${alias.tokens.join(" ")}`, alias);
  }
  return [...unique.values()].sort((left, right) => right.tokens.length - left.tokens.length || right.tokens.join(" ").length - left.tokens.join(" ").length);
}

function sameActivityToken(actual: string, expected: string) {
  if (actual === expected) return true;
  const singular = (value: string) => value.replace(/(?:s|x)$/, "");
  return singular(actual) === singular(expected);
}

export type ParsedDesignerActivityTypeList = {
  activityTypes: string[];
  labels: string[];
};

/**
 * Parses only complete, exact catalog names and aliases. Connectors are optional
 * so "audio vidéo" remains usable, but every token must belong to one unique
 * decomposition. This strict parser is also used by destructive commands.
 */
export function parseDesignerActivityTypeList(value: string): ParsedDesignerActivityTypeList | null {
  const tokens = normalizeDesignerText(value)
    .replace(/[;,+/&]/g, " , ")
    .split(/\s+/)
    .filter(Boolean);
  while (tokens.length && /^(?:les|des|de|d|activites?|blocs?)$/.test(tokens[0])) tokens.shift();
  if (!tokens.length) return null;
  const aliases = activityAliases();
  const exactAliases = aliases.filter((alias) => alias.tokens.length === tokens.length
    && alias.tokens.every((token, index) => sameActivityToken(tokens[index], token)));
  const exactTypes = [...new Set(exactAliases.map((alias) => alias.blockType))];
  if (exactTypes.length === 1) {
    const exact = exactAliases.find((alias) => alias.blockType === exactTypes[0])!;
    return { activityTypes: [exact.blockType], labels: [exact.label] };
  }
  const solutions: Array<Array<{ blockType: string; label: string }>> = [];
  const walk = (index: number, selected: Array<{ blockType: string; label: string }>) => {
    while (index < tokens.length && /^(?:,|et|ainsi|que)$/.test(tokens[index])) index += 1;
    if (index === tokens.length) {
      if (selected.length) solutions.push(selected);
      return;
    }
    for (const alias of aliases) {
      if (index + alias.tokens.length > tokens.length) continue;
      if (!alias.tokens.every((token, offset) => sameActivityToken(tokens[index + offset], token))) continue;
      walk(index + alias.tokens.length, [...selected, { blockType: alias.blockType, label: alias.label }]);
      if (solutions.length > 24) return;
    }
  };
  walk(0, []);
  const normalizedSolutions = new Map<string, Array<{ blockType: string; label: string }>>();
  for (const solution of solutions) {
    const deduplicated = solution.filter((item, index) => solution.findIndex((candidate) => candidate.blockType === item.blockType) === index);
    normalizedSolutions.set(deduplicated.map((item) => item.blockType).join("|"), deduplicated);
  }
  if (normalizedSolutions.size !== 1) return null;
  const selected = [...normalizedSolutions.values()][0];
  return { activityTypes: selected.map((item) => item.blockType), labels: selected.map((item) => item.label) };
}

function extractExcludedActivityTypes(normalized: string) {
  const exclusion = normalized.match(/\bsauf\s+(.+?)(?=\s+(?:(?:dans|sur|pour)\s+(?:(?:le|les)\s+)?|(?:du|des)\s+)chapitres?\b|$)/)?.[1]?.trim();
  return exclusion ? parseDesignerActivityTypeList(exclusion) : null;
}

function parseCollectiveActivityTypes(value: string) {
  const direct = parseDesignerActivityTypeList(value);
  if (direct) return direct;
  const words = value.split(/\s+/).filter(Boolean);
  for (let index = words.length - 1; index > 0; index -= 1) {
    if (!/^(?:en|avec|a|au|sur|pour)$/.test(words[index])) continue;
    const parsed = parseDesignerActivityTypeList(words.slice(0, index).join(" "));
    if (parsed) return parsed;
  }
  return null;
}

function activityTypeFromCollectiveTarget(normalized: string) {
  const aliases = PAIDEIA_ACTIVITY_CATALOG.flatMap((entry) => [entry.name, ...entry.aliases]
    .map((alias) => normalizeDesignerText(alias).replace(/^(?:activites?|blocs?)\s+(?:de\s+)?/, ""))
    .map((alias) => ({ alias, blockType: entry.blockType })))
    .filter((entry) => entry.alias.length >= 3)
    .sort((left, right) => right.alias.length - left.alias.length);
  for (const { alias, blockType } of aliases) {
    const words = alias.split(" ").map(escapeRegex);
    const singular = words.join("\\s+");
    const plural = words.length === 1 ? `${singular}s?` : singular;
    const typeTarget = new RegExp(
      `(?:^|\\b)(?:(?:(?:toutes?\\s+les|tous\\s+les|les|des)\\s+)(?:(?:activites?|blocs?)\\s+(?:de\\s+)?)?|(?:(?:l|un|une)\\s+)?(?:activites?|blocs?)\\s+(?:de\\s+)?)${plural}(?=$|\\s+(?:au|avec|en|pour|sans|sur)\\b|\\s+a\\s+(?:\\d|minimum|minimale|moyen|moyenne|maximum|maximale|grand|grande)\\b)`
    );
    if (typeTarget.test(normalized)) return blockType;
  }
  return null;
}

export function extractAppearanceActivityTarget(normalized: string): ExtractedAppearanceTarget | null {
  const hasExclusion = /\bsauf\b/.test(normalized);
  const exclusions = extractExcludedActivityTypes(normalized);
  if (hasExclusion && !exclusions) return null;
  const excludedActivityTypes = exclusions?.activityTypes;
  const targetsAllActivities = /\b(toutes? les activites(?: compatibles)?|ensemble des activites|tous les fonds? d activites?|fonds? d activites|fonds? des activites|ecarts? entre (?:toutes? )?les activites)\b/.test(normalized);
  if (targetsAllActivities && excludedActivityTypes?.length) return { target: "all", excludedActivityTypes };
  const collective = normalized.match(/\b(?:les|des)\s+activites?\s+(.+?)(?=\s+sauf\b|\s+(?:(?:dans|sur|pour)\s+(?:(?:le|les)\s+)?|(?:du|des)\s+)chapitres?\b|$)/)?.[1]?.trim();
  const collectiveTypes = collective ? parseCollectiveActivityTypes(collective) : null;
  if (collectiveTypes?.activityTypes.length) {
    return {
      target: "type",
      activityType: collectiveTypes.activityTypes[0],
      activityTypes: collectiveTypes.activityTypes,
      ...(excludedActivityTypes?.length ? { excludedActivityTypes } : {})
    };
  }
  const activityType = activityTypeFromCollectiveTarget(normalized)
    ?? (/\b(?:les|des)\s+mises en situation\b/.test(normalized) ? "situational-dialogue" : null);
  if (activityType) return { target: "type", activityType, ...(excludedActivityTypes?.length ? { excludedActivityTypes } : {}) };
  if (targetsAllActivities) return { target: "all" };
  return null;
}

export const extractSpacingActivityTarget = extractAppearanceActivityTarget;
export const extractBackgroundActivityTarget = extractAppearanceActivityTarget;

export function extractFontActivityTarget(normalized: string) {
  const withoutFontValue = normalized
    .replace(/\s+(?:en|avec)\s+(?:la\s+police\s+)?[^,;]+$/i, "")
    .replace(/\s+(?:sur|a)\s+(?:la\s+police\s+)?[^,;]+$/i, "")
    .trim();
  const activityClause = withoutFontValue.match(/\b(?:toutes?\s+les\s+activites?|l\s+activite|une\s+activite|activite\s+(?:nommee?|intitulee?))\b.*$/i)?.[0]
    ?? withoutFontValue;
  return extractAppearanceActivityTarget(activityClause)
    ?? extractAppearanceActivityTarget(withoutFontValue)
    ?? extractAppearanceActivityTarget(normalized);
}

export function extractFontReference(command: string, normalized: string) {
  if (/\b(?:police|fonte)s?\s+(?:par\s+)?defaut\b|\b(?:police|fonte)\s+(?:de\s+)?la\s+lecon\b/.test(normalized)) {
    return "__default__";
  }
  const match = command.match(/\b(?:en|avec)\s+(?:la\s+police\s+)?([^,;.]+?)\s*$/i)
    ?? command.match(/\b(?:police|fonte)\s+(?:sur|a)\s+([^,;.]+?)\s*$/i);
  return match?.[1]?.trim() ?? null;
}
