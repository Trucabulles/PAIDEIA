export const EU_LANGUAGE_CATALOG = [
  { code: "bg", nativeName: "Български", status: "complete" },
  { code: "hr", nativeName: "Hrvatski", status: "complete" },
  { code: "cs", nativeName: "Čeština", status: "complete" },
  { code: "da", nativeName: "Dansk", status: "complete" },
  { code: "nl", nativeName: "Nederlands", status: "complete" },
  { code: "en", nativeName: "English", status: "complete" },
  { code: "et", nativeName: "Eesti", status: "complete" },
  { code: "fi", nativeName: "Suomi", status: "complete" },
  { code: "fr", nativeName: "Français", status: "complete" },
  { code: "de", nativeName: "Deutsch", status: "complete" },
  { code: "el", nativeName: "Ελληνικά", status: "complete" },
  { code: "hu", nativeName: "Magyar", status: "complete" },
  { code: "ga", nativeName: "Gaeilge", status: "complete" },
  { code: "it", nativeName: "Italiano", status: "complete" },
  { code: "lv", nativeName: "Latviešu", status: "complete" },
  { code: "lt", nativeName: "Lietuvių", status: "complete" },
  { code: "mt", nativeName: "Malti", status: "complete" },
  { code: "pl", nativeName: "Polski", status: "complete" },
  { code: "pt", nativeName: "Português", status: "complete" },
  { code: "ro", nativeName: "Română", status: "complete" },
  { code: "sk", nativeName: "Slovenčina", status: "complete" },
  { code: "sl", nativeName: "Slovenščina", status: "complete" },
  { code: "es", nativeName: "Español", status: "complete" },
  { code: "sv", nativeName: "Svenska", status: "complete" }
] as const;

export const REGIONAL_LANGUAGE_CATALOG = [
  { code: "br", nativeName: "Brezhoneg", status: "complete" },
  { code: "co", nativeName: "Corsu", status: "complete" },
  { code: "cy", nativeName: "Cymraeg", status: "complete" },
  { code: "eu", nativeName: "Euskara", status: "complete" },
  { code: "sc", nativeName: "Sardu", status: "complete" }
] as const;

export const OTHER_LANGUAGE_CATALOG = [
  { code: "tr", nativeName: "Türkçe", status: "complete" }
] as const;

export type EuLanguageCode = (typeof EU_LANGUAGE_CATALOG)[number]["code"];
export type EuLocaleStatus = (typeof EU_LANGUAGE_CATALOG)[number]["status"];
export type RegionalLanguageCode = (typeof REGIONAL_LANGUAGE_CATALOG)[number]["code"];
export type OtherLanguageCode = (typeof OTHER_LANGUAGE_CATALOG)[number]["code"];
