import { ReactNode, useState, useEffect } from 'react';
import { I18nContext, Language, TranslationKey, getBrowserLanguage, formatMessage } from './index';
import { translations } from './translations';

interface I18nProviderProps {
  children: ReactNode;
}

const LANGUAGE_STORAGE_KEY = 'app-language';

export function I18nProvider({ children }: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Get saved language from localStorage or detect from browser
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && ['en', 'fr', 'es'].includes(saved)) {
      return saved as Language;
    }
    return getBrowserLanguage();
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const message = (translations[language] as any)[key] || (translations.en as any)[key] || key;
    return formatMessage(message, params);
  };

  // Update document language attribute
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = {
    language,
    setLanguage,
    t,
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}