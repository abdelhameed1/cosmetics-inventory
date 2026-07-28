import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type FontSizePreset = 'small' | 'medium' | 'large';

const STORAGE_KEY = 'inventory-dashboard-font-size';

interface FontSizeContextValue {
  fontSizePreset: FontSizePreset;
  setFontSizePreset: (preset: FontSizePreset) => void;
}

const FontSizeContext = createContext<FontSizeContextValue | null>(null);

function isFontSizePreset(value: string | null): value is FontSizePreset {
  return value === 'small' || value === 'medium' || value === 'large';
}

function readInitialFontSizePreset(): FontSizePreset {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isFontSizePreset(stored) ? stored : 'medium';
}

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [fontSizePreset, setFontSizePresetState] = useState<FontSizePreset>(readInitialFontSizePreset);

  const setFontSizePreset = (next: FontSizePreset) => {
    setFontSizePresetState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo(() => ({ fontSizePreset, setFontSizePreset }), [fontSizePreset]);

  return (
    <FontSizeContext.Provider value={value}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSizePreset(): FontSizeContextValue {
  const ctx = useContext(FontSizeContext);
  if (!ctx) throw new Error('useFontSizePreset must be used within FontSizeProvider');
  return ctx;
}
