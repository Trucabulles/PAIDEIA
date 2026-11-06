import registryData from "./designerSocialRegistry.data.json";
import { normalizeDesignerText } from "./designerLanguage";
import { compileRecognitionPattern } from './designerRecognition.mjs';

type DesignerSocialTranslation = (key: string, params?: Record<string, string | number>, fallback?: string) => string;

export type DesignerAddressForm = "neutral" | "feminine";
export type DesignerSocialSelection = "fixed" | "random";
export type DesignerSocialMediaEffect = {
  kind: "audio" | "video" | "image";
  source: string;
  altKey?: string;
  altFallback?: string;
  volume?: number;
};
export type ResolvedDesignerSocialMediaEffect = Omit<DesignerSocialMediaEffect, "altKey" | "altFallback"> & { alt?: string };

export type DesignerSocialResponseVariant = {
  key: string;
  fallback: string;
};

export type DesignerSocialDefinition = {
  patterns: RegExp[];
  examples: string[];
  responses: DesignerSocialResponseVariant[];
  selection: DesignerSocialSelection;
  effect?: DesignerSocialMediaEffect;
};

type DesignerSocialSourceDefinition = {
  id: string;
  phrases?: string[];
  patterns: string[];
  examples: string[];
  responses: DesignerSocialResponseVariant[];
  selection: DesignerSocialSelection;
  effect?: DesignerSocialMediaEffect;
};

function exactPhrasePattern(phrase: string) {
  const escaped = normalizeDesignerText(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`^${escaped}$`);
}

const DESIGNER_SOCIAL_SOURCE_DEFINITIONS = registryData.intents as DesignerSocialSourceDefinition[];

export const DESIGNER_SOCIAL_REGISTRY: Record<string, DesignerSocialDefinition> = Object.fromEntries(
  DESIGNER_SOCIAL_SOURCE_DEFINITIONS.map((definition) => [
    definition.id,
    {
      patterns: [...(definition.phrases ?? []).map(exactPhrasePattern), ...definition.patterns.map(compileRecognitionPattern)],
      examples: [...(definition.phrases ?? []), ...definition.examples],
      responses: definition.responses.map((response) => ({ ...response })),
      selection: definition.selection as DesignerSocialSelection,
      ...(definition.effect ? { effect: definition.effect } : {})
    }
  ])
);

export type DesignerSocialResponse = string;

function socialPlainText(normalized: string) {
  return normalized.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
}

export function matchDesignerSocialResponse(normalized: string): DesignerSocialResponse | null {
  const plain = socialPlainText(normalized);
  for (const definition of DESIGNER_SOCIAL_SOURCE_DEFINITIONS) {
    if ((definition.phrases ?? []).some((phrase) => socialPlainText(normalizeDesignerText(phrase)) === plain)) {
      return definition.id;
    }
  }
  for (const [response, definition] of Object.entries(DESIGNER_SOCIAL_REGISTRY) as [DesignerSocialResponse, DesignerSocialDefinition][]) {
    if (definition.patterns.some((pattern) => pattern.test(plain))) return response;
  }
  return null;
}

export function applyDesignerAddressForm(value: string, addressForm: DesignerAddressForm) {
  if (addressForm !== "feminine") return value;
  return value.replace(/Êtes-vous sûr\b/g, "Êtes-vous sûre");
}

export function resolveDesignerSocialResponse(
  response: DesignerSocialResponse,
  translate: DesignerSocialTranslation,
  addressForm: DesignerAddressForm,
  random: () => number = Math.random,
  previousResponseKey?: string
) {
  const definition = DESIGNER_SOCIAL_REGISTRY[response];
  if (!definition) return "";
  const candidates = definition.selection === "random" && definition.responses.length > 1 && previousResponseKey
    ? definition.responses.filter((candidate) => candidate.key !== previousResponseKey)
    : definition.responses;
  const variant = definition.selection === "fixed"
    ? definition.responses[0]
    : candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
  if (!variant) return "";
  return applyDesignerAddressForm(translate(variant.key, undefined, variant.fallback), addressForm);
}

export function isAllowedDesignerSocialMediaEffect(effect: DesignerSocialMediaEffect) {
  return /^\/arion-easter-eggs\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(effect.source)
    && !effect.source.includes("..")
    && (effect.volume === undefined || (Number.isFinite(effect.volume) && effect.volume >= 0 && effect.volume <= 1));
}

export function resolveDesignerSocialTurn(
  response: DesignerSocialResponse,
  translate: DesignerSocialTranslation,
  addressForm: DesignerAddressForm,
  random: () => number = Math.random,
  previousResponseKey?: string
): { text: string; responseKey?: string; effect?: ResolvedDesignerSocialMediaEffect } {
  const definition = DESIGNER_SOCIAL_REGISTRY[response];
  if (!definition) return { text: "" };
  const candidates = definition.selection === "random" && definition.responses.length > 1 && previousResponseKey
    ? definition.responses.filter((candidate) => candidate.key !== previousResponseKey)
    : definition.responses;
  const variant = definition.selection === "fixed"
    ? definition.responses[0]
    : candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
  const effect = definition.effect && isAllowedDesignerSocialMediaEffect(definition.effect)
    ? {
        kind: definition.effect.kind,
        source: definition.effect.source,
        volume: definition.effect.volume,
        alt: definition.effect.altKey
          ? translate(definition.effect.altKey, undefined, definition.effect.altFallback ?? "")
          : definition.effect.altFallback
      }
    : undefined;
  return {
    text: variant ? applyDesignerAddressForm(translate(variant.key, undefined, variant.fallback), addressForm) : "",
    ...(variant ? { responseKey: variant.key } : {}),
    ...(effect ? { effect } : {})
  };
}
