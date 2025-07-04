import { createContext, useContext } from 'react';
import { translations } from './translations';

export type Language = 'en' | 'fr' | 'es';
export type TranslationKey = keyof typeof translations.en;

export interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

export const I18nContext = createContext<I18nContextType | null>(null);

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

export const availableLanguages: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español'
};

export const getBrowserLanguage = (): Language => {
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('fr')) return 'fr';
  if (browserLang.startsWith('es')) return 'es';
  return 'en';
};

export const formatMessage = (message: string, params?: Record<string, string | number>): string => {
  if (!params) return message;
  
  return Object.entries(params).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  }, message);
};