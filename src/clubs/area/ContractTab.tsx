import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useNotify } from '../../components/Notice';
import { Link } from 'react-router-dom';
import { OPERATOR_CONTACT_EMAIL } from '../../legal/operator';
import { parseVersionKey } from '../../legal/versions';
import { requestTermination } from '../clubAdminApi';
import { formatDateValue } from '../../i18n/format';
import { useT } from '../../i18n/I18nProvider';

const fmt = (d: Date) => formatDateValue(d, 'long');

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
  const t = useT().clubs;
  const c = t.contract;
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
      notify(c.requested);
    } catch {
      setError(c.requestFailed);
    }
  }

  return (
    <section className="flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-card">
      <dl className="flex flex-col gap-4">
        <Row label={c.status}>
          <span className="font-medium">{t.status[club.status]}</span>
          {club.status === 'suspended' && club.statusReason && (
            <p className="mt-1 text-slate">{club.statusReason}</p>
          )}
          {effective && <p className="mt-1 text-slate">{c.fullUseUntil(fmt(effective))}</p>}
          {retrieval && <p className="mt-1 text-slate">{c.exportUntil(fmt(retrieval))}</p>}
        </Row>
        <Row label={c.acceptedTerms}>
          {legal
            ? c.acceptedSummary(legal.versionKey, legal.acceptedAt ? fmt(legal.acceptedAt.toDate()) : null, legal.acceptedBy)
            : c.notAccepted}
          <span className="mt-1 flex flex-wrap gap-x-4">
            {accepted && (
              <>
                <Link className="text-blue underline" to={`/legal/terms?v=${encodeURIComponent(accepted.terms)}`}>{c.terms}</Link>
                <Link className="text-blue underline" to={`/legal/dpa?v=${encodeURIComponent(accepted.dpa)}`}>{c.dpa}</Link>
              </>
            )}
            <Link className="text-blue underline" to="/legal/subprocessors">{c.subprocessors}</Link>
          </span>
        </Row>
      </dl>

      {requestedAt && (
        <p className="text-sm text-ink">
          {c.requestedOn(fmt(requestedAt), termination.requestedBy ?? '')}
        </p>
      )}
      {canEnd && (
        <div>
          <Button variant="destructive" onClick={() => setConfirming(true)}>{c.endOurContract}</Button>
        </div>
      )}
      {OPERATOR_CONTACT_EMAIL && (
        <p className="text-sm text-slate">
          {c.questionsPrefix}
          <a className="text-blue underline" href={`mailto:${OPERATOR_CONTACT_EMAIL}`}>{OPERATOR_CONTACT_EMAIL}</a>{c.questionsSuffix}
        </p>
      )}
      {confirming && (
        <ConfirmDialog
          title={c.confirmTitle}
          message={c.confirmMessage}
          confirmLabel={c.confirmLabel}
          error={error}
          onCancel={() => { setConfirming(false); setError(null); }}
          onConfirm={() => void confirm()}
        />
      )}
    </section>
  );
}
