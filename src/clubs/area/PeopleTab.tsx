import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FIELD_CLASS, Input } from '../../components/Input';
import { SECTION_KEYS, type SectionKey } from '../../auth/access';
import { useAuth } from '../../auth/AuthContext';
import {
  emptyGrantSet, listAllTeams, listGrantHolders, saveGrants,
  type GrantHolder, type GrantSet, type TeamRow,
} from '../../access/accessApi';
import { addMember, canChangeRole, listMembers, removeFromClub, setMemberRole } from '../../access/membersApi';
import { transferOwnership } from '../clubAdminApi';
import type { Member, MemberRole } from '../../types/club';

const SECTION_LABEL: Record<SectionKey, string> = {
  exercises: 'Exercises', trainings: 'Trainings', guides: 'Guides',
};

function sameGrants(a: GrantSet, b: GrantSet): boolean {
  const sa = [...a.teamIds].sort().join(',');
  const sb = [...b.teamIds].sort().join(',');
  return sa === sb && SECTION_KEYS.every((s) => a.sections[s] === b.sections[s]);
}

type Confirm = 'remove' | 'owner' | null;

export function PeopleTab() {
  const { club, appUser } = useAuth();
  const ownerEmail = (club?.ownerEmail ?? '').toLowerCase();
  const myEmail = appUser?.email ?? '';
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [holders, setHolders] = useState<GrantHolder[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<GrantSet>(emptyGrantSet());
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<MemberRole>('member');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);

  async function reload() {
    try {
      const [{ teams: allTeams }, allHolders, allMembers] = await Promise.all([
        listAllTeams(), listGrantHolders(), listMembers(),
      ]);
      setTeams(allTeams);
      setHolders(allHolders);
      setMembers(allMembers);
      return allHolders;
    } catch {
      setError('Could not load people. Please refresh the page.');
      return null;
    }
  }
  useEffect(() => { void reload(); }, []);

  const original = useMemo<GrantSet>(
    () => holders.find((h) => h.email === selected)?.grants ?? emptyGrantSet(),
    [holders, selected],
  );
  const target = members.find((x) => x.email === selected) ?? null;
  const rules = target ? canChangeRole(target, members, ownerEmail) : null;

  function select(email: string, from = holders) {
    setSelected(email);
    setDraft(from.find((h) => h.email === email)?.grants ?? emptyGrantSet());
  }

  async function run(fn: () => Promise<void>, failure: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch {
      setError(failure);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setBusy(true);
    setError(null);
    try {
      await addMember(email, newRole, myEmail);
      setNewEmail('');
      setNewRole('member');
      const fresh = await reload();
      select(email, fresh ?? holders);
    } catch (e) {
      setError(e instanceof Error && e.message === 'already-member'
        ? `${email} is already a member.`
        : 'Could not add this person. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const save = () => run(async () => {
    if (!selected) return;
    await saveGrants(selected, draft, original);
    await reload();
  }, 'Could not save. Please try again.');

  const changeRole = (role: MemberRole) => run(async () => {
    if (!selected) return;
    await setMemberRole(selected, role);
    await reload();
  }, 'Could not change the role. Please try again.');

  async function doRemove() {
    if (!selected) return;
    const email = selected;
    const ok = await run(async () => {
      await removeFromClub(email);
      setSelected(null);
      await reload();
    }, 'Could not remove this person. Please try again.');
    if (ok) setConfirm(null);
  }

  async function doTransfer() {
    if (!selected) return;
    const email = selected;
    const ok = await run(async () => {
      await transferOwnership(email);
      await reload();
    }, 'Could not transfer ownership. Please try again.');
    if (ok) setConfirm(null);
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

  return (
    <div>
      {error && !confirm && <p role="alert" className="mb-4 text-red">{error}</p>}
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <div className="mb-3 flex flex-col gap-2">
            <label htmlFor="new-person" className="text-sm font-medium text-ink">Add person by email</label>
            <Input id="new-person" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <label htmlFor="new-role" className="text-sm font-medium text-ink">Role</label>
            <select id="new-role" value={newRole} onChange={(e) => setNewRole(e.target.value as MemberRole)}
              className={`${FIELD_CLASS} w-full`}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Button variant="primary" size="sm" className="w-full" disabled={busy} onClick={() => void add()}>
              Add person
            </Button>
          </div>
          <p className="mb-2 text-sm font-medium text-ink">People</p>
          <ul className="divide-y divide-border">
            {members.map((x) => (
              <li key={x.email}>
                <button type="button" onClick={() => select(x.email)} title={x.email}
                  aria-current={selected === x.email}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                    selected === x.email ? 'bg-blue/10 font-semibold text-blue' : 'text-ink hover:bg-bg'
                  }`}>
                  <span className="min-w-0 flex-1 truncate">{x.email}</span>
                  {x.email === ownerEmail && (
                    <span className="rounded-full bg-navy px-2 py-0.5 text-xs font-medium text-white">Owner</span>
                  )}
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-slate">
                    {x.role === 'admin' ? 'Admin' : 'Member'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
          {!target || !rules ? (
            <p className="text-sm text-slate">Select a person to manage their access.</p>
          ) : (
            <>
              <h2 className="mb-4 break-all text-lg font-semibold text-ink">{target.email}</h2>

              {target.role === 'admin' ? (
                <p className="mb-4 text-sm text-slate">Admins have full access to every team and section.</p>
              ) : (
                <>
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
                  <Button variant="primary" size="sm" className="mb-4 w-full sm:w-auto"
                    disabled={busy || sameGrants(draft, original)} onClick={() => void save()}>
                    Save
                  </Button>
                </>
              )}

              <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:flex-wrap">
                {target.role === 'admin' ? (
                  <Button variant="secondary" size="sm" className="w-full sm:w-auto"
                    disabled={busy || !rules.demote} onClick={() => void changeRole('member')}>
                    Make member
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" className="w-full sm:w-auto"
                    disabled={busy} onClick={() => void changeRole('admin')}>
                    Make admin
                  </Button>
                )}
                {target.role === 'admin' && target.email !== ownerEmail && (
                  <Button variant="secondary" size="sm" className="w-full sm:w-auto"
                    disabled={busy} onClick={() => { setError(null); setConfirm('owner'); }}>
                    Make owner
                  </Button>
                )}
                <Button variant="dangerGhost" size="sm" className="w-full sm:w-auto"
                  disabled={busy || !rules.remove} onClick={() => { setError(null); setConfirm('remove'); }}>
                  Remove from club
                </Button>
              </div>
              {rules.reason && <p className="mt-2 text-sm text-slate">{rules.reason}</p>}
            </>
          )}
        </div>
      </div>

      {confirm === 'remove' && target && (
        <ConfirmDialog title={`Remove ${target.email} from the club?`}
          message="They lose all access to this club's teams and sections right away."
          confirmLabel="Remove" error={error}
          onConfirm={() => void doRemove()} onCancel={() => setConfirm(null)} />
      )}
      {confirm === 'owner' && target && (
        <ConfirmDialog title={`Make ${target.email} the club owner?`}
          message="The owner receives billing and contract contact. You stay an admin."
          confirmLabel="Make owner" error={error}
          onConfirm={() => void doTransfer()} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}
