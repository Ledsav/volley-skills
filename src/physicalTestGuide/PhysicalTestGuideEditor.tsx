import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Textarea } from '../components/Input';
import { getPhysicalTestGuide, updatePhysicalTestGuide } from './physicalTestGuideApi';
import type { PhysicalTestGuideEntry } from '../types/physicalTestGuide';

export function PhysicalTestGuideEditor() {
  const { firebaseUser } = useAuth();
  const [tests, setTests] = useState<PhysicalTestGuideEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPhysicalTestGuide()
      .then((guide) => {
        setTests(guide.tests);
        setLoaded(true);
      })
      .catch(() => setLoadError('Could not load the physical test guide. Please refresh the page.'));
  }, []);

  function updateProtocol(key: string, value: string) {
    setTests((current) => current.map((t) => (t.key === key ? { ...t, protocol: value } : t)));
  }

  async function handleSave() {
    setError(null);
    if (!firebaseUser) return;
    try {
      await updatePhysicalTestGuide(tests, firebaseUser.uid);
    } catch {
      setError('Could not save the physical test guide. Please try again.');
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
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">{test.label}</h2>
            <label htmlFor={`${test.key}-protocol`} className="mb-1 mt-3 block text-sm font-medium text-ink">
              Protocol
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
        Save
      </Button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red">
          {error}
        </p>
      )}
    </div>
  );
}
