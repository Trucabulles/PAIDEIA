import registryData from "./designerHelpRegistry.data.json";
import { normalizeDesignerText } from "./designerLanguage";
import { compileRecognitionPattern } from './designerRecognition.mjs';

type DesignerHelpIntentDefinition = { patterns: RegExp[]; examples: string[] };
type DesignerHelpSourceDefinition = { id: string; phrases?: string[]; patterns: string[]; examples: string[] };

function containedPhrasePattern(phrase: string) {
  const escaped = normalizeDesignerText(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`);
}

export const DESIGNER_HELP_INTENT_REGISTRY: Record<string, DesignerHelpIntentDefinition> = Object.fromEntries(
  (registryData.intents as DesignerHelpSourceDefinition[]).map((definition) => [definition.id, {
    patterns: [...(definition.phrases ?? []).map(containedPhrasePattern), ...definition.patterns.map(compileRecognitionPattern)],
    examples: [...(definition.phrases ?? []), ...definition.examples]
  }])
);

export type DesignerHelpIntent = string;

export type DesignerHelpTranslation = (key: string, params?: Record<string, string | number>, fallback?: string) => string;

export const DESIGNER_HELP_TEXT_TEMPLATES: Record<string, { key: string; fallback: string }> = Object.fromEntries(
  registryData.textTemplates.map(({ id, key, fallback }) => [id, { key, fallback }])
);

export const DESIGNER_HELP_SUGGESTION_TEMPLATES = registryData.suggestionTemplates.map((template) => ({
  ...template,
  command: { ...template.command }
}));

export function matchDesignerHelpIntents(normalized: string) {
  return new Set<DesignerHelpIntent>(
    (Object.entries(DESIGNER_HELP_INTENT_REGISTRY) as [DesignerHelpIntent, { patterns: readonly RegExp[] }][]) 
      .filter(([, definition]) => definition.patterns.some((pattern) => pattern.test(normalized)))
      .map(([intent]) => intent)
  );
}

export function renderDesignerHelpTemplate(template: string, params: Record<string, string>) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => params[name] ?? match);
}

export function localizedDesignerHelpTemplate(
  template: { key: string; fallback: string },
  translate: DesignerHelpTranslation | undefined,
  params: Record<string, string> = {}
) {
  const value = translate ? translate(template.key, params, template.fallback) : template.fallback;
  return renderDesignerHelpTemplate(value, params);
}
