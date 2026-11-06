import { createContext, useContext, type ReactNode } from "react";
import type { AppLanguage, TranslationParams } from "./index";
import { createTranslator } from "./index";

type I18nContextValue = {
  language: AppLanguage;
  t: (key: string, params?: TranslationParams, fallback?: string) => string;
};

const fallbackLanguage: AppLanguage = "fr";
const I18nContext = createContext<I18nContextValue>({
  language: fallbackLanguage,
  t: createTranslator(fallbackLanguage)
});

type I18nProviderProps = {
  children: ReactNode;
  language: AppLanguage;
  t: (key: string, params?: TranslationParams, fallback?: string) => string;
};

export function I18nProvider({ children, language, t }: I18nProviderProps) {
  return (
    <I18nContext.Provider value={{ language, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
