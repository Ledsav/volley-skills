import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { GroupedList, ListRow } from '../../components/GroupedList';
import { SkeletonBlock } from '../../components/Skeleton';
import { TeamGrantList } from './TeamGrantList';
import { useTeamPages } from './useTeamPages';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FIELD_CLASS, Input } from '../../components/Input';
import { SECTION_KEYS, type SectionKey } from '../../auth/access';
import { useAuth } from '../../auth/AuthContext';
import {
  emptyGrantSet, listGrantHolders, saveGrants,
  type GrantHolder, type GrantSet,
} from '../../access/accessApi';
import { addMember, canChangeRole, listMembers, removeFromClub, setMemberRole } from '../../access/membersApi';
import { transferOwnership } from '../clubAdminApi';
import type { Member, MemberRole } from '../../types/club';
import { useT } from '../../i18n/I18nProvider';

function sameGrants(a: GrantSet, b: GrantSet): boolean {
  const sa = [...a.teamIds].sort().join(',');
  const sb = [...b.teamIds].sort().join(',');
  return sa === sb && SECTION_KEYS.every((s) => a.sections[s] === b.sections[s]);
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Confirm = 'remove' | 'owner' | 'demoteSelf' | null;

export function PeopleTab() {
  const { club, appUser } = useAuth();
  const t = useT();
  const p = t.clubs.people;
  const ownerEmail = (club?.ownerEmail ?? '').toLowerCase();
  const myEmail = appUser?.email ?? '';
  const teamPages = useTeamPages();
  const [loaded, setLoaded] = useState(false);
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
      const [allHolders, allMembers] = await Promise.all([listGrantHolders(), listMembers()]);
      setHolders(allHolders);
      setMembers(allMembers);
      setLoaded(true);
      return allHolders;
    } catch {
      setError(p.loadFailed);
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
    if (!EMAIL_SHAPE.test(email)) {
      setError(p.invalidEmail);
      return;
    }
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
        ? p.alreadyMember(email)
        : p.addFailed);
    } finally {
      setBusy(false);
    }
  }

  const save = () => run(async () => {
    if (!selected) return;
    await saveGrants(selected, draft, original);
    await reload();
  }, t.common.couldNotSave);

  const changeRole = (role: MemberRole) => run(async () => {
    if (!selected) return;
    await setMemberRole(selected, role);
    await reload();
  }, t.common.couldNotChangeRole);

  // Demoting yourself drops your admin access, so the page reloads to pick that up.
  async function doDemoteSelf() {
    const ok = await run(() => setMemberRole(myEmail, 'member'), t.common.couldNotChangeRole);
    if (ok) window.location.reload();
  }

  async function doRemove() {
    if (!selected) return;
    const email = selected;
    const ok = await run(async () => {
      await removeFromClub(email);
      setSelected(null);
      await reload();
    }, p.removeFailed);
    if (ok) setConfirm(null);
  }

  async function doTransfer() {
    if (!selected) return;
    const email = selected;
    const ok = await run(async () => {
      await transferOwnership(email);
      await reload();
    }, p.transferFailed);
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
      {(error ?? (teamPages.error === 'load' ? p.loadFailed : null)) && !confirm && (
        <p role="alert" className="mb-4 text-red-strong">{error ?? p.loadFailed}</p>
      )}
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <div className="rounded-lg bg-surface p-4 shadow-card">
          <div className="mb-4 flex flex-col gap-2">
            <label htmlFor="new-person" className="text-footnote text-ink-2">{p.addByEmail}</label>
            <Input id="new-person" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <label htmlFor="new-role" className="text-footnote text-ink-2">{p.role}</label>
            <select id="new-role" value={newRole} onChange={(e) => setNewRole(e.target.value as MemberRole)}
              className={`${FIELD_CLASS} w-full`}>
              <option value="member">{p.member}</option>
              <option value="admin">{p.admin}</option>
            </select>
            <Button variant="primary" size="sm" className="w-full" disabled={busy} onClick={() => void add()}>
              {p.addPerson}
            </Button>
          </div>
          <GroupedList header={p.people}>
            {!loaded
              ? [0, 1, 2, 3].map((i) => (
                <li key={i} className="flex min-h-[52px] items-center px-4"><SkeletonBlock className="h-4 w-40" /></li>
              ))
              : members.map((x) => (
                <ListRow key={x.email} title={x.email} rowProps={{ title: x.email }}
                  selected={selected === x.email} onClick={() => select(x.email)}
                  trailing={(
                    <span className="flex items-center gap-1">
                      {x.email === ownerEmail && (
                        <span className="rounded-full bg-ink px-2 text-caption text-on-ink">{p.owner}</span>
                      )}
                      <span className="rounded-full bg-surface-3 px-2 text-caption text-ink-2">
                        {x.role === 'admin' ? p.admin : p.member}
                      </span>
                    </span>
                  )} />
              ))}
          </GroupedList>
        </div>

        <div className="rounded-lg bg-surface p-4 shadow-card">
          {!target || !rules ? (
            <p className="text-callout text-ink-2">{p.selectPerson}</p>
          ) : (
            <>
              <h2 className="mb-4 break-all text-title-3 text-ink">{target.email}</h2>

              {target.role === 'admin' ? (
                <p className="mb-4 text-callout text-ink-2">{p.adminsFullAccess}</p>
              ) : (
                <>
                  <fieldset className="mb-4">
                    <legend className="mb-2 text-footnote text-ink-2">{p.sectionsLegend}</legend>
                    <div className="flex flex-col">
                      {SECTION_KEYS.map((s) => (
                        <label key={s} className="flex min-h-[52px] items-center gap-3 text-body text-ink">
                          <input type="checkbox" className="h-5 w-5" aria-label={p.sections[s]}
                            checked={draft.sections[s]} onChange={() => toggleSection(s)} />
                          {p.sections[s]}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <TeamGrantList teams={teamPages.teams} hasMore={teamPages.hasMore}
                    loadingMore={teamPages.loadingMore} loadMoreFailed={teamPages.error === 'more'}
                    onLoadMore={() => void teamPages.loadMore()}
                    selected={draft.teamIds} onToggle={toggleTeam} />
                  <Button variant="primary" size="sm" className="mb-4 w-full sm:w-auto"
                    disabled={busy || sameGrants(draft, original)} onClick={() => void save()}>
                    {t.common.save}
                  </Button>
                </>
              )}

              <div className="flex flex-col gap-2 border-t border-separator pt-4 sm:flex-row sm:flex-wrap">
                {target.role === 'admin' ? (
                  <Button variant="secondary" size="sm" className="w-full sm:w-auto"
                    disabled={busy || !rules.demote}
                    onClick={() => {
                      if (target.email === myEmail) { setError(null); setConfirm('demoteSelf'); }
                      else void changeRole('member');
                    }}>
                    {p.makeMember}
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" className="w-full sm:w-auto"
                    disabled={busy} onClick={() => void changeRole('admin')}>
                    {p.makeAdmin}
                  </Button>
                )}
                {target.role === 'admin' && target.email !== ownerEmail && (
                  <Button variant="secondary" size="sm" className="w-full sm:w-auto"
                    disabled={busy} onClick={() => { setError(null); setConfirm('owner'); }}>
                    {p.makeOwner}
                  </Button>
                )}
                <Button variant="dangerGhost" size="sm" className="w-full sm:w-auto"
                  disabled={busy || !rules.remove} onClick={() => { setError(null); setConfirm('remove'); }}>
                  {p.removeFromClub}
                </Button>
              </div>
              {rules.reason && <p className="mt-2 text-footnote text-ink-2">{p.reason[rules.reason]}</p>}
            </>
          )}
        </div>
      </div>

      {confirm === 'remove' && target && (
        <ConfirmDialog title={p.removeTitle(target.email)}
          message={p.removeMessage}
          confirmLabel={p.removeConfirm} error={error}
          onConfirm={() => void doRemove()} onCancel={() => setConfirm(null)} />
      )}
      {confirm === 'demoteSelf' && (
        <ConfirmDialog title={p.demoteTitle}
          message={p.demoteMessage}
          confirmLabel={p.demoteConfirm} error={error}
          onConfirm={() => void doDemoteSelf()} onCancel={() => setConfirm(null)} />
      )}
      {confirm === 'owner' && target && (
        <ConfirmDialog title={p.ownerTitle(target.email)}
          message={p.ownerMessage}
          confirmLabel={p.ownerConfirm} error={error}
          onConfirm={() => void doTransfer()} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}
