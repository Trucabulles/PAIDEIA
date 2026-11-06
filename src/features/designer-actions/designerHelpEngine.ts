import { PAIDEIA_ACTIVITY_CATALOG, PAIDEIA_HELP_PROCEDURES } from "./designerKnowledgeCatalog";
import {
  DESIGNER_HELP_SUGGESTION_TEMPLATES,
  DESIGNER_HELP_TEXT_TEMPLATES,
  localizedDesignerHelpTemplate,
  matchDesignerHelpIntents,
  renderDesignerHelpTemplate,
  type DesignerHelpIntent,
  type DesignerHelpTranslation
} from "./designerHelpRegistry";
import { normalizeDesignerText as normalize } from "./designerLanguage";
import { designerDocumentationDisplayTitle, designerDocumentationNavigation, findDesignerDocumentation, findDesignerDocumentationById, relatedDesignerDocumentation, searchDesignerDocumentation, type DesignerDocumentationEntry } from "./designerDocumentationRegistry";
import type { DesignerActionSuggestion } from "./designerCapabilityRegistry";

const ignoredSuggestionTokens = new Set(["aide", "a", "au", "aux", "d", "de", "des", "du", "en", "l", "la", "le", "les", "pour", "sur", "un", "une", "activite", "quoi", "sert", "dis", "m", "plus"]);

function containsPhrase(text: string, phrase: string) {
  return phrase.length > 0 && (` ${text} `).includes(` ${phrase} `);
}

function searchableTokens(text: string) {
  return normalize(text).split(" ").filter((token) => token.length >= 3 && !ignoredSuggestionTokens.has(token));
}

function suggestionTokenMatches(queryToken: string, candidate: string) {
  return candidate === queryToken
    || queryToken === `${candidate}s`
    || queryToken === `${candidate}x`
    || candidate === `${queryToken}s`
    || candidate === `${queryToken}x`
    || candidate.startsWith(queryToken);
}

export type DesignerHelpResponse = {
  intent: DesignerHelpIntent;
  subjectId?: string;
  text: string;
  relatedTopics?: DesignerActionSuggestion[];
};

export function findExactDesignerActivity(query: string) {
  const raw = normalize(query);
  if (/^boutons?\s+/.test(raw)) return null;
  const normalized = raw
    .replace(/^(?:aide(?: moi)?|modifier|modifie|modification|changer|change|editer|edite|edition|regler|regle|reglage)\s+(?:(?:a|sur|pour|concernant)\s+)?/, "")
    .replace(/^(?:l |le |la |les |un |une |des )?activites?\s+/, "")
    .replace(/^(?:l |le |la |les |un |une |des )/, "")
    .trim();
  return PAIDEIA_ACTIVITY_CATALOG.find((entry) =>
    [entry.name, ...entry.aliases].some((alias) => normalize(alias) === normalized)
  ) ?? null;
}

function findActivity(query: string) {
  const normalized = normalize(query);
  return PAIDEIA_ACTIVITY_CATALOG
    .flatMap((entry, index) => [entry.name, ...entry.aliases].map((alias) => ({ entry, index, alias: normalize(alias) })))
    .filter(({ alias }) => containsPhrase(normalized, alias))
    .sort((left, right) => right.alias.length - left.alias.length || left.index - right.index)[0]?.entry ?? null;
}

function findExactActivityDocumentation(activity: (typeof PAIDEIA_ACTIVITY_CATALOG)[number]) {
  const expectedTitle = `activite ${normalize(activity.name)}`;
  return searchDesignerDocumentation(expectedTitle, activity.blockType)
    .map(({ entry }) => entry)
    .find((entry) => normalize(entry.title) === expectedTitle) ?? null;
}

export function resolveExactDesignerActivityHelp(query: string) {
  const activity = findExactDesignerActivity(query);
  if (!activity) return null;
  const documentation = findExactActivityDocumentation(activity);
  return documentation ? documentationHelpResponse(documentation, "details", query) : null;
}

function joinList(values: string[]) {
  return values.length <= 1 ? values[0] ?? "" : `${values.slice(0, -1).join(", ")} et ${values[values.length - 1]}`;
}

function documentationHelpResponse(documentation: DesignerDocumentationEntry, intent: "how-to" | "details" | "limitation", query = ""): DesignerHelpResponse {
  const navigation = designerDocumentationNavigation(documentation);
  const relatedTopics: DesignerActionSuggestion[] = [];
  if (navigation.previous) relatedTopics.push({
    id: `documentation:${navigation.previous.id}`,
    command: `Rubrique précédente : ${designerDocumentationDisplayTitle(navigation.previous)}`,
    searchTerms: navigation.previous.content,
    concepts: ["activity" as const]
  });
  if (navigation.next) relatedTopics.push({
    id: `documentation:${navigation.next.id}`,
    command: `Rubrique suivante : ${designerDocumentationDisplayTitle(navigation.next)}`,
    searchTerms: navigation.next.content,
    concepts: ["activity" as const]
  });
  if (navigation.groupId) relatedTopics.push({
    id: `documentation:${navigation.groupId}-all`,
    command: "Toutes les rubriques de cette aide",
    searchTerms: documentation.title,
    concepts: ["activity" as const]
  });
  if (!navigation.groupId) {
    relatedTopics.push(...relatedDesignerDocumentation(documentation, 5, query).map((entry) => ({
      id: `documentation:${entry.id}`,
      command: `Aide associée : ${designerDocumentationDisplayTitle(entry)}`,
      searchTerms: entry.content,
      concepts: ["activity" as const]
    })));
  }
  const endOfHelp = navigation.groupId && !navigation.next
    ? "\n\n*Vous êtes arrivé à la dernière rubrique de cette aide.*"
    : "";
  return {
    intent,
    subjectId: documentation.id,
    text: `## ${documentation.title}\n\n${documentation.markdown ?? documentation.content}${endOfHelp}`,
    relatedTopics
  };
}

export function resolveDesignerHelpSubject(subjectId: string, intent: "how-to" | "details" | "limitation" = "details") {
  const documentation = findDesignerDocumentationById(subjectId);
  return documentation ? documentationHelpResponse(documentation, intent) : null;
}

export function isDesignerHelpRequest(command: string) {
  const value = normalize(command).replace(/^(?:bonjour|salut)\s+/, "").replace(/\s+(?:s il (?:te|vous) plait|svp|stp)$/, "");
  return /^(?:aide|aide moi|aidez moi|(?:peux tu|pouvez vous|pourrais tu|pourriez vous|tu peux|vous pouvez) m aider|j ai besoin d aide|besoin d aide|au secours|help)$/.test(value);
}

export function designerHelpSubject(command: string): string | null {
  const match = normalize(command).match(/^(?:(?:comment\s+)?(?:peux tu|pouvez vous|pourrais tu|pourriez vous|tu peux|vous pouvez) m aider|aide moi|aidez moi|j ai besoin d aide|besoin d aide|aide)\s+(?:(?:a|sur|pour|avec|concernant)\s+)?(.+)$/);
  return match?.[1] ?? null;
}

export function resolveDesignerHelp(command: string, translate?: DesignerHelpTranslation): DesignerHelpResponse | null {
  const normalized = normalize(command);
  const intents = matchDesignerHelpIntents(normalized);
  const howTo = intents.has("how-to");
  const recommend = intents.has("recommend");
  const compare = intents.has("compare");
  const purpose = intents.has("purpose");
  const details = intents.has("details") || /^aide\b/.test(normalized);
  const limitation = intents.has("limitation");
  if (!howTo && !recommend && !compare && !purpose && !details && !limitation) return null;

  const referencedActivity = findActivity(command);

  if (howTo) {
    const procedure = PAIDEIA_HELP_PROCEDURES.find((entry) => [entry.name, ...entry.aliases].some((alias) => containsPhrase(normalized, normalize(alias))));
    if (procedure) return { intent: "how-to", subjectId: procedure.id, text: `${procedure.summary}\n\n${procedure.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}` };
  }

  if (howTo || details || limitation) {
    const documentation = findDesignerDocumentation(command, referencedActivity?.blockType);
    if (documentation) return documentationHelpResponse(documentation, limitation ? "limitation" : details ? "details" : "how-to", command);
  }

  if (recommend) {
    const normalizedWords = new Set(normalized.split(" "));
    const matches = PAIDEIA_ACTIVITY_CATALOG.filter((entry) => entry.whenToUse.some((use) => normalize(use).split(" ").some((token) => token.length >= 5 && normalizedWords.has(token))));
    if (matches.length) {
      const selected = matches.slice(0, 3);
      return { intent: "recommend", text: `${selected.map((entry) => `${entry.name} : ${entry.purpose}`).join("\n")}\n\n${localizedDesignerHelpTemplate(DESIGNER_HELP_TEXT_TEMPLATES.recommendationConclusion, translate)}` };
    }
  }

  if (compare) {
    const matches = PAIDEIA_ACTIVITY_CATALOG.filter((entry) => [entry.name, ...entry.aliases].some((alias) => containsPhrase(normalized, normalize(alias)))).slice(0, 2);
    if (matches.length === 2) return { intent: "compare", text: `${matches[0].name} : ${matches[0].purpose}\n\n${matches[1].name} : ${matches[1].purpose}` };
  }

  const activity = referencedActivity;
  if (!activity) return { intent: limitation ? "limitation" : details ? "details" : purpose ? "purpose" : "how-to", text: localizedDesignerHelpTemplate(DESIGNER_HELP_TEXT_TEMPLATES.undocumented, translate) };
  if (purpose) return { intent: "purpose", subjectId: activity.id, text: localizedDesignerHelpTemplate(DESIGNER_HELP_TEXT_TEMPLATES.purpose, translate, { name: activity.name, purpose: `${activity.purpose.charAt(0).toLocaleLowerCase("fr")}${activity.purpose.slice(1)}` }) };
  if (details || limitation) {
    const cautions = activity.cautions?.length ? `\n\n${localizedDesignerHelpTemplate(DESIGNER_HELP_TEXT_TEMPLATES.cautionsLabel, translate)} : ${joinList(activity.cautions)}` : "";
    return { intent: limitation ? "limitation" : "details", subjectId: activity.id, text: `${activity.purpose}\n\n${localizedDesignerHelpTemplate(DESIGNER_HELP_TEXT_TEMPLATES.functioningLabel, translate)} : ${activity.howItWorks}\n\n${localizedDesignerHelpTemplate(DESIGNER_HELP_TEXT_TEMPLATES.suitableUsesLabel, translate)} : ${joinList(activity.whenToUse)}.${cautions}` };
  }
  if (howTo && activity.howTo?.length) return { intent: "how-to", subjectId: activity.id, text: activity.howTo.map((step, index) => `${index + 1}. ${step}`).join("\n") };
  return { intent: "how-to", subjectId: activity.id, text: localizedDesignerHelpTemplate(DESIGNER_HELP_TEXT_TEMPLATES.undocumentedProcedure, translate) };
}

export function buildDesignerHelpSuggestions(translate?: DesignerHelpTranslation): DesignerActionSuggestion[] {
  return PAIDEIA_ACTIVITY_CATALOG.flatMap((entry) =>
  DESIGNER_HELP_SUGGESTION_TEMPLATES.map((template) => ({
    id: `help-${template.id}:${entry.id}`,
    command: localizedDesignerHelpTemplate(template.command, translate, { name: entry.name }),
    searchTerms: renderDesignerHelpTemplate(template.searchTerms, {
      name: entry.name,
      aliases: entry.aliases.join(" "),
      purpose: entry.purpose,
      uses: entry.whenToUse.join(" ")
    }),
    concepts: ["activity" as const]
  }))
  );
}

export const DESIGNER_HELP_SUGGESTIONS: DesignerActionSuggestion[] = buildDesignerHelpSuggestions();

export function suggestDesignerHelp(value: string, limit = 6, translate?: DesignerHelpTranslation) {
  if (isDesignerHelpRequest(value)) return [];
  value = designerHelpSubject(value) ?? value;
  const exactActivity = findExactDesignerActivity(value);
  if (exactActivity) {
    const documentation = findExactActivityDocumentation(exactActivity);
    if (documentation) return [{
      id: `documentation:${documentation.id}`,
      command: `Aide : ${designerDocumentationDisplayTitle(documentation)}`,
      searchTerms: documentation.content,
      concepts: ["activity" as const]
    }];
  }
  const documents = searchDesignerDocumentation(value).slice(0, limit).map(({ entry }) => ({
    id: `documentation:${entry.id}`, command: `Aide : ${designerDocumentationDisplayTitle(entry)}`, searchTerms: entry.content, concepts: ["activity" as const]
  }));
  if (documents.length) return documents;
  const suggestions = translate ? buildDesignerHelpSuggestions(translate) : DESIGNER_HELP_SUGGESTIONS;
  const tokens = searchableTokens(value);
  if (!tokens.length) return [];
  return suggestions.map((suggestion, index) => {
    const candidates = searchableTokens(`${suggestion.command} ${suggestion.searchTerms}`);
    return tokens.every((token) => candidates.some((candidate) => suggestionTokenMatches(token, candidate)))
      ? { suggestion, index, score: tokens.reduce((total, token) => total + (candidates.includes(token) ? 0 : 1), 0) }
      : null;
  }).filter((entry): entry is { suggestion: DesignerActionSuggestion; index: number; score: number } => entry !== null)
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, limit)
    .map(({ suggestion }) => suggestion);
}
