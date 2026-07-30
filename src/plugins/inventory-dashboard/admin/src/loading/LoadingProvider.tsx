import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface LoadingContextValue {
  count: number;
  begin: () => void;
  end: () => void;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const begin = useCallback(() => setCount((c) => c + 1), []);
  const end = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);

  return (
    <LoadingContext.Provider value={{ count, begin, end }}>
      {children}
    </LoadingContext.Provider>
  );
}

function useLoadingContext(): LoadingContextValue {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error('useLoadingContext must be used within a LoadingProvider');
  return ctx;
}

export function useIsLoading(): boolean {
  return useLoadingContext().count > 0;
}

export function useLoadingTracker(): { begin: () => void; end: () => void } {
  const { begin, end } = useLoadingContext();
  return { begin, end };
}
