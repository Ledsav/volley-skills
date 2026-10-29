import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SearchPalette } from './SearchPalette';

interface SearchApi {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const SearchContext = createContext<SearchApi>({ open: () => {}, close: () => {}, isOpen: false });

const DIAGRAM_ROUTE = /^\/exercises\/[^/]+\/diagram\/?$/;

export function SearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;

  const open = useCallback(() => {
    // Already open: keep the first opener, so closing returns focus to where the person was.
    if (isOpenRef.current) return;
    isOpenRef.current = true;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsOpen(true);
  }, []);

  const closeWith = useCallback((restoreFocus = true) => {
    setIsOpen(false);
    if (restoreFocus) openerRef.current?.focus();
    openerRef.current = null;
  }, []);

  const close = useCallback(() => closeWith(true), [closeWith]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return;
      if (isOpen) {
        e.preventDefault();
        closeWith(true);
        return;
      }
      // Never interrupt an open sheet, dialog or alert dialog (it may hold unsaved edits), nor the diagram editor.
      if (DIAGRAM_ROUTE.test(window.location.pathname)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      e.preventDefault();
      open();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, open, closeWith]);

  const value = useMemo<SearchApi>(() => ({ open, close, isOpen }), [open, close, isOpen]);
  return (
    <SearchContext.Provider value={value}>
      {children}
      {isOpen && <SearchPalette onClose={closeWith} />}
    </SearchContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- the hook belongs with its provider
export function useSearch(): SearchApi {
  return useContext(SearchContext);
}
