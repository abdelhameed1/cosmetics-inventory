import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { IntlProvider } from 'react-intl';
import { en } from './en';
import { ar } from './ar';

export type Locale = 'en' | 'ar';

const STORAGE_KEY = 'inventory-dashboard-locale';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readInitialLocale(): Locale {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'ar' ? 'ar' : 'en';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo(() => ({ locale, setLocale }), [locale]);
  const messages = locale === 'ar' ? ar : en;

  return (
    <LocaleContext.Provider value={value}>
      <IntlProvider locale={locale} messages={messages}>
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
