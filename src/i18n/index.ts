import fr from "../locales/fr.json";
import en from "../locales/en.json";
import de from "../locales/de.json";
import bg from "../locales/bg.json";
import hr from "../locales/hr.json";
import da from "../locales/da.json";
import es from "../locales/es.json";
import it from "../locales/it.json";
import et from "../locales/et.json";
import fi from "../locales/fi.json";
import cs from "../locales/cs.json";
import nl from "../locales/nl.json";
import ro from "../locales/ro.json";
import el from "../locales/el.json";
import ga from "../locales/ga.json";
import hu from "../locales/hu.json";
import mt from "../locales/mt.json";
import pl from "../locales/pl.json";
import pt from "../locales/pt.json";
import sv from "../locales/sv.json";
import lt from "../locales/lt.json";
import sl from "../locales/sl.json";
import lv from "../locales/lv.json";
import sk from "../locales/sk.json";
import br from "../locales/br.json";
import eu from "../locales/eu.json";
import sc from "../locales/sc.json";
import co from "../locales/co.json";
import cy from "../locales/cy.json";
import tr from "../locales/tr.json";
export { EU_LANGUAGE_CATALOG, REGIONAL_LANGUAGE_CATALOG, OTHER_LANGUAGE_CATALOG } from "./euLanguageCatalog";
export type { EuLanguageCode, EuLocaleStatus, RegionalLanguageCode, OtherLanguageCode } from "./euLanguageCatalog";

export const APP_LANGUAGE_STORAGE_KEY = "paideia.appLanguage";

// Only complete, parity-checked dictionaries may be exposed in the UI.
export const SUPPORTED_APP_LANGUAGES = ["fr", "en", "de", "bg", "hr", "da", "es", "it", "et", "fi", "cs", "nl", "ro", "el", "ga", "hu", "mt", "pl", "pt", "sv", "lt", "sl", "lv", "sk", "br", "eu", "sc", "co", "cy", "tr"] as const;

export type AppLanguage = (typeof SUPPORTED_APP_LANGUAGES)[number];
export type TranslationParams = Record<string, string | number | boolean | null | undefined>;
export type TranslationKey = keyof typeof fr;

type Dictionary = Record<string, string>;

const dictionaries: Record<AppLanguage, Dictionary> = {
  fr,
  en,
  de,
  bg,
  hr,
  da,
  es,
  it,
  et,
  fi,
  cs,
  nl,
  ro,
  el,
  ga,
  hu,
  mt,
  pl,
  pt,
  sv,
  lt,
  sl,
  lv,
  sk,
  br,
  eu,
  sc,
  co,
  cy,
  tr
};

export function isSupportedAppLanguage(value: string | null | undefined): value is AppLanguage {
  return SUPPORTED_APP_LANGUAGES.includes(value as AppLanguage);
}

export function normalizeAppLanguage(value: string | null | undefined): AppLanguage | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase().split(/[-_]/)[0];
  return isSupportedAppLanguage(normalized) ? normalized : null;
}

export function detectInitialAppLanguage(): AppLanguage {
  const stored = normalizeAppLanguage(localStorage.getItem(APP_LANGUAGE_STORAGE_KEY));
  if (stored) {
    return stored;
  }

  const candidates = typeof navigator === "undefined"
    ? []
    : [navigator.language, ...(navigator.languages ?? [])];

  for (const candidate of candidates) {
    const detected = normalizeAppLanguage(candidate);
    if (detected) {
      return detected;
    }
  }

  return "fr";
}

function interpolate(value: string, params?: TranslationParams) {
  if (!params) {
    return value;
  }
  return value.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => {
    const replacement = params[name];
    return replacement === null || replacement === undefined ? match : String(replacement);
  });
}

export function translate(language: AppLanguage, key: string, params?: TranslationParams, fallback?: string): string {
  const value = dictionaries[language]?.[key] ?? dictionaries.fr[key] ?? fallback ?? key;
  return interpolate(value, params);
}

export function createTranslator(language: AppLanguage) {
  return (key: string, params?: TranslationParams, fallback?: string) => translate(language, key, params, fallback);
}

export function translateActive(key: string, params?: TranslationParams, fallback?: string): string {
  const storedLanguage = typeof localStorage === "undefined"
    ? null
    : normalizeAppLanguage(localStorage.getItem(APP_LANGUAGE_STORAGE_KEY));
  return translate(storedLanguage ?? "fr", key, params, fallback);
}

export function appLanguageLabel(language: AppLanguage, activeLanguage: AppLanguage = language) {
  return translate(activeLanguage, `language.${language}`);
}
