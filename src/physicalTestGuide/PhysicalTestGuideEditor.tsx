import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Textarea } from '../components/Input';
import { getPhysicalTestGuide, updatePhysicalTestGuide } from './physicalTestGuideApi';
import { useT } from '../i18n/I18nProvider';
import type { PhysicalTestGuideEntry } from '../types/physicalTestGuide';

export function PhysicalTestGuideEditor() {
  const { firebaseUser } = useAuth();
  const t = useT();
  const s = t.physicalTestGuide;
  const [tests, setTests] = useState<PhysicalTestGuideEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reloads when the catalog changes (the Italian one arrives after first paint): an unsaved guide
  // shows its fallback in the active language, a saved one is returned as stored.
  useEffect(() => {
    getPhysicalTestGuide()
      .then((guide) => {
        setTests(guide.tests);
        setLoaded(true);
      })
      .catch(() => setLoadError(s.loadError));
  }, [s]);

  function updateProtocol(key: string, value: string) {
    setTests((current) => current.map((x) => (x.key === key ? { ...x, protocol: value } : x)));
  }

  async function handleSave() {
    setError(null);
    if (!firebaseUser) return;
    try {
      await updatePhysicalTestGuide(tests, firebaseUser.uid);
    } catch {
      setError(s.saveError);
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="p-6 text-red">
        {loadError}
      </p>
    );
  }

  return (
    <div>
      <div className="space-y-6">
        {tests.map((test) => (
          <section key={test.key} className="rounded-lg border border-border bg-surface p-6 shadow-card">
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">{t.labels.physicalTest[test.key] ?? test.label}</h2>
            <label htmlFor={`${test.key}-protocol`} className="mb-1 mt-3 block text-sm font-medium text-ink">
              {s.protocol}
            </label>
            <Textarea
              id={`${test.key}-protocol`}
              value={test.protocol}
              onChange={(e) => updateProtocol(test.key, e.target.value)}
              className="w-full min-h-[100px]"
            />
          </section>
        ))}
      </div>
      <Button variant="primary" onClick={() => void handleSave()} className="mt-6" disabled={!loaded}>
        {t.common.save}
      </Button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red">
          {error}
        </p>
      )}
    </div>
  );
}
