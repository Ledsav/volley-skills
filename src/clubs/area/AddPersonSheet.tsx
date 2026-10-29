import { useState, type FormEvent } from 'react';
import { FIELD_CLASS, Input } from '../../components/Input';
import { Sheet } from '../../components/Sheet';
import { addMember } from '../../access/membersApi';
import type { MemberRole } from '../../types/club';
import { useT } from '../../i18n/I18nProvider';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Adds a person to the club by email, as a member or an admin. */
export function AddPersonSheet({ myEmail, onAdded, onClose }: {
  myEmail: string;
  onAdded: (email: string) => void;
  onClose: () => void;
}) {
  const p = useT().clubs.people;
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<MemberRole>('member');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
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
      onAdded(email);
    } catch (err) {
      setError(err instanceof Error && err.message === 'already-member'
        ? p.alreadyMember(email)
        : p.addFailed);
      setBusy(false);
    }
  }

  return (
    <Sheet title={p.addPerson} onClose={onClose} guardUnsaved
      confirm={{ label: p.addPerson, form: 'add-person-form', disabled: busy }}>
      <form id="add-person-form" noValidate onSubmit={(e) => void add(e)} className="flex flex-col gap-2">
        <label htmlFor="new-person" className="text-footnote text-ink-2">{p.addByEmail}</label>
        <Input id="new-person" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        <label htmlFor="new-role" className="text-footnote text-ink-2">{p.role}</label>
        <select id="new-role" value={newRole} onChange={(e) => setNewRole(e.target.value as MemberRole)}
          className={`${FIELD_CLASS} w-full`}>
          <option value="member">{p.member}</option>
          <option value="admin">{p.admin}</option>
        </select>
        {error && <p role="alert" className="text-footnote text-red-strong">{error}</p>}
      </form>
    </Sheet>
  );
}
