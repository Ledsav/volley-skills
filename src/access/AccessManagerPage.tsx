import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { SECTION_KEYS, type SectionKey } from '../auth/access';
import {
  emptyGrantSet, listAllTeams, listGrantHolders, removeAllGrants, saveGrants,
  type GrantHolder, type GrantSet, type TeamRow,
} from './accessApi';

const SECTION_LABEL: Record<SectionKey, string> = {
  exercises: 'Exercises', trainings: 'Trainings', guides: 'Guides',
};

function sameGrants(a: GrantSet, b: GrantSet): boolean {
  const sa = [...a.teamIds].sort().join(',');
  const sb = [...b.teamIds].sort().join(',');
  return sa === sb && SECTION_KEYS.every((s) => a.sections[s] === b.sections[s]);
}

export function AccessManagerPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [holders, setHolders] = useState<GrantHolder[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<GrantSet>(emptyGrantSet());
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    setError(null);
    try {
      const [{ teams: allTeams }, allHolders] = await Promise.all([listAllTeams(), listGrantHolders()]);
      setTeams(allTeams);
      setHolders(allHolders);
    } catch {
      setError('Could not load access data. Please refresh the page.');
    }
  }
  useEffect(() => { void reload(); }, []);

  const original = useMemo<GrantSet>(
    () => holders.find((h) => h.email === selected)?.grants ?? emptyGrantSet(),
    [holders, selected],
  );

  function select(email: string) {
    setSelected(email);
    setDraft(holders.find((h) => h.email === email)?.grants ?? emptyGrantSet());
  }

  function addPerson() {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setNewEmail('');
    if (!holders.some((h) => h.email === email)) {
      setHolders((cur) => [...cur, { email, grants: emptyGrantSet() }].sort((a, b) => a.email.localeCompare(b.email)));
    }
    setSelected(email);
    setDraft(emptyGrantSet());
  }

  function toggleTeam(id: string) {
    setDraft((d) => ({
      ...d,
      teamIds: d.teamIds.includes(id) ? d.teamIds.filter((t) => t !== id) : [...d.teamIds, id],
    }));
  }
  function toggleSection(s: SectionKey) {
    setDraft((d) => ({ ...d, sections: { ...d.sections, [s]: !d.sections[s] } }));
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await saveGrants(selected, draft, original);
      await reload();
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function removeAll() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await removeAllGrants(selected);
      await reload();
      setSelected(null);
    } catch {
      setError('Could not remove access. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">Access</h1>
      {error && <p role="alert" className="mb-4 text-red">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <div className="mb-3 flex flex-col gap-2">
            <label htmlFor="new-person" className="text-sm font-medium text-ink">Add person by email</label>
            <div className="flex flex-col gap-2">
              <Input id="new-person" type="email" value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)} className="w-full" />
              <Button variant="primary" size="sm" className="w-full" onClick={addPerson}>Add person</Button>
            </div>
          </div>
          {holders.length > 0 && (
            <p className="mb-2 text-sm font-medium text-ink">People with access</p>
          )}
          {holders.length === 0 ? (
            <p className="text-sm text-slate">No one has been granted access yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {holders.map((h) => (
                <li key={h.email}>
                  <button type="button" onClick={() => select(h.email)} title={h.email}
                    aria-current={selected === h.email}
                    className={`block w-full truncate rounded-md px-2 py-2 text-left text-sm ${
                      selected === h.email ? 'bg-blue/10 font-semibold text-blue' : 'text-ink hover:bg-bg'
                    }`}>
                    {h.email}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-border pt-3 text-xs text-slate">
            Super-admins (full access) are managed directly in Firestore
            (<code>adminAllowlist</code>) and are not listed here.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
          {!selected ? (
            holders.length > 0 && (
              <p className="text-sm text-slate">Select a person to manage their access.</p>
            )
          ) : (
            <>
              <h2 className="mb-4 break-all text-lg font-semibold text-ink">{selected}</h2>

              <fieldset className="mb-4">
                <legend className="mb-2 text-sm font-medium text-ink">Sections</legend>
                <div className="flex flex-col gap-2">
                  {SECTION_KEYS.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm text-ink">
                      <input type="checkbox" aria-label={SECTION_LABEL[s]}
                        checked={draft.sections[s]} onChange={() => toggleSection(s)} />
                      {SECTION_LABEL[s]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="mb-4">
                <legend className="mb-2 text-sm font-medium text-ink">Teams</legend>
                <div className="flex flex-col gap-2">
                  {teams.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm text-ink">
                      <input type="checkbox" aria-label={t.name}
                        checked={draft.teamIds.includes(t.id)} onChange={() => toggleTeam(t.id)} />
                      {t.name}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <Button variant="primary" size="sm" className="w-full sm:w-auto"
                  disabled={saving || sameGrants(draft, original)} onClick={() => void save()}>
                  Save
                </Button>
                <Button variant="dangerGhost" size="sm" className="w-full sm:w-auto"
                  disabled={saving} onClick={() => void removeAll()}>
                  Remove all access
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
