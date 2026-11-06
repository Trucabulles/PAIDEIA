import registryData from "./designerDocumentationRegistry.data.json";
import { normalizeDesignerText } from "./designerLanguage";
import { PAIDEIA_ACTIVITY_CATALOG } from "./designerKnowledgeCatalog";

export type DesignerDocumentationEntry = {
  id: string;
  title: string;
  aliases: string[];
  keywords: string[];
  activities: string[];
  groupId?: string;
  content: string;
  markdown?: string;
};

export const DESIGNER_DOCUMENTATION_REGISTRY = registryData.entries as DesignerDocumentationEntry[];

const ignoredTokens = new Set(["a", "aide", "au", "aux", "avec", "besoin", "cas", "ce", "ces", "cette", "comment", "dans", "de", "des", "dis", "du", "en", "est", "et", "faire", "information", "informations", "l", "la", "le", "les", "m", "ma", "me", "mes", "mon", "plus", "pour", "probleme", "problemes", "quoi", "rubrique", "rubriques", "sert", "sont", "sur", "un", "une", "utiliser", "votre", "vos"]);
const vocabulary = (text: string) => normalizeDesignerText(text).replace(/\b(?:optimiser|optimisation|optimisee?)\b/g, 'optimis').replace(/\b(?:generer|generation)\b/g, 'gener').replace(/\b(?:modifier|modification|editer|editeur)\b/g, 'edit').replace(/\btitres\b/g, 'titre');
const words = (text: string) => vocabulary(text).split(" ").filter(Boolean);
const tokenMatches = (queryToken: string, candidate: string) => queryToken === candidate
  || queryToken === `${candidate}s`
  || queryToken === `${candidate}x`
  || candidate === `${queryToken}s`
  || candidate === `${queryToken}x`
  || queryToken.length >= 4 && candidate.length >= 4 && candidate.startsWith(queryToken);

function containsPhrase(text: string, phrase: string) {
  return phrase.length > 0 && (` ${text} `).includes(` ${phrase} `);
}

export function searchDesignerDocumentation(query: string, activityType?: string) {
  const normalized = vocabulary(query);
  const tokens = normalized.split(" ").filter((token) => token.length >= 3 && !ignoredTokens.has(token));
  const meaningfulQuery = tokens.join(" ");
  const embeddedActivityGroups = PAIDEIA_ACTIVITY_CATALOG.flatMap((activity) =>
    [activity.name, ...activity.aliases].map(vocabulary)
      .filter((phrase) => phrase.split(" ").length > 1 && containsPhrase(normalized, phrase) && normalized !== phrase && normalized !== `aide ${phrase}`)
      .map(() => DESIGNER_DOCUMENTATION_REGISTRY.find((entry) => {
        const title = vocabulary(entry.title);
        return title === `activite ${vocabulary(activity.name)}` || title === vocabulary(activity.name);
      })?.groupId)
      .filter((groupId): groupId is string => Boolean(groupId))
  );
  const matches = DESIGNER_DOCUMENTATION_REGISTRY.map((entry, index) => {
    const title = vocabulary(entry.title);
    const aliases = entry.aliases.map(vocabulary);
    const keywords = entry.keywords.map(vocabulary);
    const content = vocabulary(entry.content);
    const titleWords = words(title);
    const aliasWords = aliases.flatMap(words);
    const keywordWords = keywords.flatMap(words);
    const contentWords = words(content);
    const groupRoot = entry.groupId ? DESIGNER_DOCUMENTATION_REGISTRY.find((candidate) => candidate.groupId === entry.groupId) : null;
    const groupWords = groupRoot ? words(`${groupRoot.title} ${groupRoot.aliases.join(" ")} ${groupRoot.keywords.join(" ")}`)
      .filter((word) => word.length >= 3 && !ignoredTokens.has(word)) : [];
    const hasOwnGroupContext = tokens.some((token) => groupWords.some((word) => tokenMatches(token, word)));
    const blockedByEmbeddedActivity = embeddedActivityGroups.length > 0
      && !embeddedActivityGroups.includes(entry.groupId ?? "")
      && !hasOwnGroupContext;
    let score = blockedByEmbeddedActivity ? 0 : activityType && entry.activities.includes(activityType) ? 35 : 0;
    if (!blockedByEmbeddedActivity && (normalized === title || normalized === `aide ${title}` || meaningfulQuery === title)) score += 80;
    if (aliases.some((alias) => containsPhrase(normalized, alias))) score += 8;
    let matchedTokens = 0;
    for (const token of blockedByEmbeddedActivity ? [] : tokens) {
      if (titleWords.some((word) => tokenMatches(token, word))) { score += 24; matchedTokens += 1; }
      else if (aliasWords.some((word) => tokenMatches(token, word))) { score += 15; matchedTokens += 1; }
      else if (keywordWords.some((word) => tokenMatches(token, word))) { score += 12; matchedTokens += 1; }
      else if (contentWords.some((word) => tokenMatches(token, word))) { score += 6; matchedTokens += 1; }
    }
    return { entry, index, score, matchedTokens };
  }).filter(({ score, matchedTokens }) => tokens.length > 0 && matchedTokens === tokens.length && score >= 18)
    .sort((left, right) => right.score - left.score || left.index - right.index);
  return matches;
}

export function findDesignerDocumentation(query: string, activityType?: string): DesignerDocumentationEntry | null {
  return searchDesignerDocumentation(query, activityType)[0]?.entry ?? null;
}

export function findDesignerDocumentationById(id: string): DesignerDocumentationEntry | null {
  return DESIGNER_DOCUMENTATION_REGISTRY.find((entry) => entry.id === id) ?? null;
}

export function designerActivityDocumentation() {
  return DESIGNER_DOCUMENTATION_REGISTRY.filter((entry) => /^activite\s/u.test(normalizeDesignerText(entry.title)) || entry.id === "video-1");
}

export function ambiguousDesignerDocumentation(query: string, limit = 30) {
  const matches = searchDesignerDocumentation(query);
  if (matches.length < 2 || matches[0].score !== matches[1].score) return [];
  return matches.filter((match) => match.score === matches[0].score).slice(0, limit).map((match) => match.entry);
}

function documentationGroupTitle(entry: DesignerDocumentationEntry) {
  if (!entry.groupId) return null;
  const heading = DESIGNER_DOCUMENTATION_REGISTRY.find((candidate) =>
    candidate.groupId === entry.groupId && /^activit[eé]\s+/i.test(candidate.title)
  ) ?? DESIGNER_DOCUMENTATION_REGISTRY.find((candidate) => candidate.groupId === entry.groupId);
  return heading?.title.replace(/^activit[eé]\s+/i, "").trim() || null;
}

export function designerDocumentationDisplayTitle(entry: DesignerDocumentationEntry) {
  const normalizedTitle = normalizeDesignerText(entry.title);
  const titleIsAmbiguous = DESIGNER_DOCUMENTATION_REGISTRY.some((candidate) =>
    candidate.id !== entry.id && normalizeDesignerText(candidate.title) === normalizedTitle
  );
  if (!titleIsAmbiguous) return entry.title;
  const groupTitle = documentationGroupTitle(entry);
  return groupTitle ? `${entry.title} · ${groupTitle}` : entry.title;
}

export function relatedDesignerDocumentation(entry: DesignerDocumentationEntry, limit = 5, _query = "") {
  if (entry.groupId) {
    return DESIGNER_DOCUMENTATION_REGISTRY
      .filter((candidate) => candidate.groupId === entry.groupId && candidate.id !== entry.id)
      .slice(0, limit);
  }
  if (!entry.activities.length) return [];
  return DESIGNER_DOCUMENTATION_REGISTRY
    .filter((candidate) => candidate.id !== entry.id
      && candidate.activities.some((activity) => entry.activities.includes(activity)))
    .slice(0, limit);
}

export function designerDocumentationGroupEntries(groupId: string) {
  return DESIGNER_DOCUMENTATION_REGISTRY.filter((entry) => entry.groupId === groupId);
}

export function designerDocumentationNavigation(entry: DesignerDocumentationEntry) {
  if (!entry.groupId) return { previous: null, next: null, groupId: null };
  const entries = designerDocumentationGroupEntries(entry.groupId);
  const index = entries.findIndex((candidate) => candidate.id === entry.id);
  return {
    previous: index > 0 ? entries[index - 1] : null,
    next: index >= 0 && index < entries.length - 1 ? entries[index + 1] : null,
    groupId: entry.groupId
  };
}
