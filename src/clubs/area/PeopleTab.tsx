import { useEffect, useMemo, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { Button } from '../../components/Button';
import { GroupedList, ListRow } from '../../components/GroupedList';
import { SkeletonBlock } from '../../components/Skeleton';
import { StatusLayout } from '../../components/StatusLayout';
import { TeamGrantList } from './TeamGrantList';
import { useTeamPages } from './useTeamPages';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useContextMenu } from '../../components/ContextMenu';
import type { MenuItem } from '../../components/Menu';
import { useUndoable } from '../../components/Notice';
import { Sheet } from '../../components/Sheet';
import { useMediaQuery } from '../../components/useMediaQuery';
import { usePublishPageChrome } from '../../layout/PageChrome';
import { AddPersonSheet } from './AddPersonSheet';
import { SECTION_KEYS, type SectionKey } from '../../auth/access';
import { useAuth } from '../../auth/AuthContext';
import {
  emptyGrantSet, listGrantHolders, saveGrants,
  type GrantHolder, type GrantSet,
} from '../../access/accessApi';
import { canChangeRole, listMembers, removeFromClub, setMemberRole } from '../../access/membersApi';
import { transferOwnership } from '../clubAdminApi';
import type { Member, MemberRole } from '../../types/club';
import { useT } from '../../i18n/I18nProvider';

function sameGrants(a: GrantSet, b: GrantSet): boolean {
  const sa = [...a.teamIds].sort().join(',');
  const sb = [...b.teamIds].sort().join(',');
  return sa === sb && SECTION_KEYS.every((s) => a.sections[s] === b.sections[s]);
}

type Confirm = 'remove' | 'owner' | 'demoteSelf' | null;

export function PeopleTab() {
  const { club, appUser } = useAuth();
  const t = useT();
  const p = t.clubs.people;
  const ownerEmail = (club?.ownerEmail ?? '').toLowerCase();
  const myEmail = appUser?.email ?? '';
  const teamPages = useTeamPages();
  const undoable = useUndoable();
  const narrow = useMediaQuery('(max-width: 1023px)', false);
  const [loaded, setLoaded] = useState(false);
  const [holders, setHolders] = useState<GrantHolder[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<GrantSet>(emptyGrantSet());
  const [adding, setAdding] = useState(false);
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
      setLoaded(true);
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

  const save = () => run(async () => {
    if (!selected) return;
    await saveGrants(selected, draft, original);
    await reload();
  }, t.common.couldNotSave);

  async function changeRole(email: string, role: MemberRole) {
    const previous = members.find((x) => x.email === email)?.role;
    const ok = await run(async () => {
      await setMemberRole(email, role);
      await reload();
    }, t.common.couldNotChangeRole);
    if (!ok || !previous) return;
    undoable({
      message: role === 'admin' ? p.madeAdmin(email) : p.madeMember(email),
      commit: () => {},
      onUndo: () => {
        void (async () => {
          const undone = await run(async () => {
            await setMemberRole(email, previous);
            await reload();
          }, t.common.couldNotChangeRole);
          // The rules may refuse the way back (for example the person became owner meanwhile).
          if (!undone) await reload();
        })();
      },
    });
  }

  function askDemote(email: string) {
    select(email);
    if (email === myEmail) { setError(null); setConfirm('demoteSelf'); }
    else void changeRole(email, 'member');
  }
  function askOwner(email: string) { select(email); setError(null); setConfirm('owner'); }
  function askRemove(email: string) { select(email); setError(null); setConfirm('remove'); }

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

  usePublishPageChrome({
    title: t.clubs.area.pageTitle,
    mainAction: { label: p.addPerson, icon: UserPlus, onSelect: () => setAdding(true), disabled: busy },
  });

  const detail = !target || !rules ? (
    <StatusLayout icon={Users} className="py-10">
      <p className="text-callout">{p.selectPerson}</p>
    </StatusLayout>
  ) : (
    <>
      {!narrow && <h2 className="mb-4 break-all text-title-3 text-ink">{target.email}</h2>}
      {narrow && error && !confirm && <p role="alert" className="mb-4 text-footnote text-red-strong">{error}</p>}

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
          <TeamGrantList key={target.email} teams={teamPages.teams} hasMore={teamPages.hasMore}
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
            disabled={busy || !rules.demote} onClick={() => askDemote(target.email)}>
            {p.makeMember}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" className="w-full sm:w-auto"
            disabled={busy} onClick={() => void changeRole(target.email, 'admin')}>
            {p.makeAdmin}
          </Button>
        )}
        {target.role === 'admin' && target.email !== ownerEmail && (
          <Button variant="secondary" size="sm" className="w-full sm:w-auto"
            disabled={busy} onClick={() => askOwner(target.email)}>
            {p.makeOwner}
          </Button>
        )}
        <Button variant="dangerGhost" size="sm" className="w-full sm:w-auto"
          disabled={busy || !rules.remove} onClick={() => askRemove(target.email)}>
          {p.removeFromClub}
        </Button>
      </div>
      {rules.reason && <p className="mt-2 text-footnote text-ink-2">{p.reason[rules.reason]}</p>}
    </>
  );

  return (
    <div>
      {(error ?? (teamPages.error === 'load' ? p.loadFailed : null)) && !confirm && !(narrow && target) && (
        <p role="alert" className="mb-4 text-red-strong">{error ?? p.loadFailed}</p>
      )}
      <div className={narrow ? '' : 'grid items-start gap-6 lg:grid-cols-[20rem_1fr]'}>
        <GroupedList header={p.people}>
            {!loaded
              ? [0, 1, 2, 3].map((i) => (
                <li key={i} className="flex min-h-[52px] items-center px-4"><SkeletonBlock className="h-4 w-40" /></li>
              ))
              : members.map((x) => (
                <MemberRow key={x.email} member={x} isOwner={x.email === ownerEmail}
                  rules={canChangeRole(x, members, ownerEmail)} busy={busy}
                  selected={selected === x.email} onSelect={() => select(x.email)}
                  onMakeAdmin={() => { select(x.email); void changeRole(x.email, 'admin'); }}
                  onMakeMember={() => askDemote(x.email)}
                  onMakeOwner={() => askOwner(x.email)}
                  onRemove={() => askRemove(x.email)} />
              ))}
        </GroupedList>

        {/* mt-6 lines the panel up with the list under its "People" header. */}
        {!narrow && <div className="mt-6 rounded-lg bg-surface p-4 shadow-card">{detail}</div>}
      </div>

      {narrow && target && (
        <Sheet title={target.email} size="md" detent="large" dirty={!sameGrants(draft, original)}
          onClose={() => setSelected(null)}>
          {detail}
        </Sheet>
      )}

      {adding && (
        <AddPersonSheet myEmail={myEmail} onClose={() => setAdding(false)}
          onAdded={(email) => {
            setAdding(false);
            void (async () => { const fresh = await reload(); select(email, fresh ?? holders); })();
          }} />
      )}

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

function MemberRow({ member: x, isOwner, rules, busy, selected, onSelect, onMakeAdmin, onMakeMember, onMakeOwner, onRemove }: {
  member: Member;
  isOwner: boolean;
  rules: ReturnType<typeof canChangeRole>;
  busy: boolean;
  selected: boolean;
  onSelect: () => void;
  onMakeAdmin: () => void;
  onMakeMember: () => void;
  onMakeOwner: () => void;
  onRemove: () => void;
}) {
  const p = useT().clubs.people;
  const hint = rules.reason ? p.reason[rules.reason] : undefined;
  const items: MenuItem[] = [
    x.role === 'admin'
      ? { kind: 'action', label: p.makeMember, onSelect: onMakeMember, disabled: busy || !rules.demote, hint: rules.demote ? undefined : hint }
      : { kind: 'action', label: p.makeAdmin, onSelect: onMakeAdmin, disabled: busy },
    ...(x.role === 'admin' && !isOwner
      ? [{ kind: 'action', label: p.makeOwner, onSelect: onMakeOwner, disabled: busy } as MenuItem]
      : []),
    { kind: 'action', label: `${p.removeFromClub}…`, onSelect: onRemove, danger: true, disabled: busy || !rules.remove, hint: rules.remove ? undefined : hint },
  ];
  const { targetProps, menu } = useContextMenu({ label: p.rowMenu(x.email), items });
  return (
    <>
      <ListRow title={x.email} rowProps={{ title: x.email, ...targetProps }}
        selected={selected} onClick={onSelect}
        trailing={(
          <span className="flex items-center gap-1">
            {isOwner && <span className="rounded-full bg-ink px-2 text-caption text-on-ink">{p.owner}</span>}
            <span className="rounded-full bg-surface-3 px-2 text-caption text-ink-2">
              {x.role === 'admin' ? p.admin : p.member}
            </span>
          </span>
        )} />
      {menu}
    </>
  );
}
