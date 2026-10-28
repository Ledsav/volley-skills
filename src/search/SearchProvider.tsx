import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface SearchApi {
  open: () => void;
}

const SearchContext = createContext<SearchApi>({ open: () => {} });

// Stub: a later task (the search palette) replaces this with the real provider.
export function SearchProvider({ children }: { children: ReactNode }) {
  const value = useMemo<SearchApi>(() => ({ open: () => {} }), []);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchApi {
  return useContext(SearchContext);
}
