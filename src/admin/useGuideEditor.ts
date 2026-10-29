import { useCallback, useEffect, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useNotify } from '../components/Notice';
import { useT } from '../i18n/I18nProvider';
import { usePublishPageChrome } from '../layout/PageChrome';

/**
 * The draft behind a guide editor: loads the guide, keeps the edits as a draft against the last loaded or
 * saved baseline, publishes Save to the toolbar (only while `active`), and warns before the tab unloads.
 * The write is the whole guide in one call, exactly as before.
 */
export function useGuideEditor<T extends { key: string }>(o: {
  load: () => Promise<{ items: T[]; stored: boolean }>;
  save: (items: T[], uid: string) => Promise<void>;
  /** The catalog slice: reload when the language catalog arrives. */
  reloadOn: unknown;
  messages: { loadError: string; saveError: string; saved: string };
  /** Only the visible editor publishes the toolbar. */
  active: boolean;
}): {
  items: T[];
  loaded: boolean;
  loadError: string | null;
  saveError: string | null;
  isEdited(key: string): boolean;
  replace(item: T): void;
} {
  const { firebaseUser } = useAuth();
  const notify = useNotify();
  const tr = useT();
  const t = tr.admin.guidesPage;
  const common = tr.common;
  const latest = useRef(o);
  latest.current = o;
  const [baseline, setBaseline] = useState<T[]>([]);
  const [draft, setDraft] = useState<T[]>([]);
  const [stored, setStored] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  // Reloads when the catalog changes (the Italian one arrives after first paint): an unsaved guide
  // shows its fallback in the active language, a saved one is returned as stored.
  useEffect(() => {
    let cancelled = false;
    latest.current
      .load()
      .then((r) => {
        if (cancelled) return;
        setBaseline(r.items);
        setDraft(r.items);
        setStored(r.stored);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError(latest.current.messages.loadError);
      });
    return () => {
      cancelled = true;
    };
  }, [o.reloadOn]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useCallback(async () => {
    if (!firebaseUser || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await latest.current.save(draft, firebaseUser.uid);
      setBaseline(draft);
      setStored(true);
      notify(latest.current.messages.saved);
    } catch {
      setSaveError(latest.current.messages.saveError);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [firebaseUser, draft, notify]);

  usePublishPageChrome(
    {
      title: t.title,
      mainAction: loadError
        ? undefined
        : { label: common.save, icon: Save, onSelect: () => void save(), disabled: !loaded || saving || !(dirty || !stored) },
    },
    o.active
  );

  return {
    items: draft,
    loaded,
    loadError,
    saveError,
    isEdited: (key) => JSON.stringify(draft.find((x) => x.key === key)) !== JSON.stringify(baseline.find((x) => x.key === key)),
    replace: (item) => setDraft((cur) => cur.map((x) => (x.key === item.key ? item : x))),
  };
}
