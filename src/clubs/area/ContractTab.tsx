import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useNotify } from '../../components/Notice';
import { Link } from 'react-router-dom';
import { OPERATOR_CONTACT_EMAIL } from '../../legal/operator';
import { parseVersionKey } from '../../legal/versions';
import { CLUB_STATUS_LABEL } from '../statusLabels';
import { requestTermination } from '../clubAdminApi';

const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}

export function ContractTab() {
  const { club, appUser } = useAuth();
  const notify = useNotify();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!club) return null;

  const { termination, legal } = club;
  const accepted = legal ? parseVersionKey(legal.versionKey) : null;
  const effective = termination.effectiveAt?.toDate();
  const retrieval = termination.retrievalEndsAt?.toDate();
  const requestedAt = termination.requestedAt?.toDate();
  const canEnd = (club.status === 'active' || club.status === 'suspended') && !termination.requestedAt;

  async function confirm() {
    setError(null);
    try {
      await requestTermination((appUser?.email ?? '').toLowerCase());
      setConfirming(false);
      notify('End of contract requested');
    } catch {
      setError("Couldn't send the request. Try again.");
    }
  }

  return (
    <section className="flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-card">
      <dl className="flex flex-col gap-4">
        <Row label="Status">
          <span className="font-medium">{CLUB_STATUS_LABEL[club.status]}</span>
          {club.status === 'suspended' && club.statusReason && (
            <p className="mt-1 text-slate">{club.statusReason}</p>
          )}
          {effective && <p className="mt-1 text-slate">{`Full use until ${fmt(effective)}`}</p>}
          {retrieval && <p className="mt-1 text-slate">{`Data export until ${fmt(retrieval)}`}</p>}
        </Row>
        <Row label="Accepted terms">
          {legal
            ? `${legal.versionKey}, accepted ${legal.acceptedAt ? `${fmt(legal.acceptedAt.toDate())} ` : ''}by ${legal.acceptedBy}`
            : 'Not yet accepted'}
          <span className="mt-1 flex flex-wrap gap-x-4">
            {accepted && (
              <>
                <Link className="text-blue underline" to={`/legal/terms?v=${encodeURIComponent(accepted.terms)}`}>Terms</Link>
                <Link className="text-blue underline" to={`/legal/dpa?v=${encodeURIComponent(accepted.dpa)}`}>DPA</Link>
              </>
            )}
            <Link className="text-blue underline" to="/legal/subprocessors">Sub-processors</Link>
          </span>
        </Row>
      </dl>

      {requestedAt && (
        <p className="text-sm text-ink">
          {`End of contract requested on ${fmt(requestedAt)} by ${termination.requestedBy}`}
        </p>
      )}
      {canEnd && (
        <div>
          <Button variant="destructive" onClick={() => setConfirming(true)}>End our contract</Button>
        </div>
      )}
      {OPERATOR_CONTACT_EMAIL && (
        <p className="text-sm text-slate">
          Questions about your contract? Contact{' '}
          <a className="text-blue underline" href={`mailto:${OPERATOR_CONTACT_EMAIL}`}>{OPERATOR_CONTACT_EMAIL}</a>.
        </p>
      )}
      {confirming && (
        <ConfirmDialog
          title="End your club's contract?"
          message="We'll be told you want to leave. Your club keeps full use and a window to export your data until the end date we confirm."
          confirmLabel="Request end of contract"
          error={error}
          onCancel={() => { setConfirming(false); setError(null); }}
          onConfirm={() => void confirm()}
        />
      )}
    </section>
  );
}
