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

const ROW = 'relative flex min-h-[52px] flex-col justify-center gap-0.5 px-4 py-3 before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator first:before:hidden';
const LINK = 'text-callout text-ink underline underline-offset-2';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={ROW}>
      <dt className="text-caption text-ink-2">{label}</dt>
      <dd className="flex flex-col gap-0.5 text-callout text-ink">{children}</dd>
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
    <section className="flex max-w-xl flex-col gap-6">
      <dl className="overflow-hidden rounded-lg bg-surface shadow-card">
        <Row label={c.status}>
          <span className="text-headline">{t.status[club.status]}</span>
          {club.status === 'suspended' && club.statusReason && (
            <p className="text-footnote text-ink-2 tabular-nums">{club.statusReason}</p>
          )}
          {effective && <p className="text-footnote text-ink-2 tabular-nums">{c.fullUseUntil(fmt(effective))}</p>}
          {retrieval && <p className="text-footnote text-ink-2 tabular-nums">{c.exportUntil(fmt(retrieval))}</p>}
        </Row>
        <Row label={c.acceptedTerms}>
          <span className="text-callout tabular-nums">
            {legal
              ? c.acceptedSummary(legal.versionKey, legal.acceptedAt ? fmt(legal.acceptedAt.toDate()) : null, legal.acceptedBy)
              : c.notAccepted}
          </span>
          <span className="flex flex-wrap gap-x-4">
            {accepted && (
              <>
                <Link className={LINK} to={`/legal/terms?v=${encodeURIComponent(accepted.terms)}`}>{c.terms}</Link>
                <Link className={LINK} to={`/legal/dpa?v=${encodeURIComponent(accepted.dpa)}`}>{c.dpa}</Link>
              </>
            )}
            <Link className={LINK} to="/legal/subprocessors">{c.subprocessors}</Link>
          </span>
        </Row>
      </dl>

      {requestedAt && (
        <p className="px-4 text-footnote text-ink-2 tabular-nums">
          {c.requestedOn(fmt(requestedAt), termination.requestedBy ?? '')}
        </p>
      )}
      {canEnd && (
        <div className="overflow-hidden rounded-lg bg-surface shadow-card">
          <Button variant="destructive" className="min-h-[52px] w-full rounded-none" onClick={() => setConfirming(true)}>{c.endOurContract}</Button>
        </div>
      )}
      {OPERATOR_CONTACT_EMAIL && (
        <p className="px-4 text-footnote text-ink-2">
          {c.questionsPrefix}
          <a className="text-ink underline underline-offset-2" href={`mailto:${OPERATOR_CONTACT_EMAIL}`}>{OPERATOR_CONTACT_EMAIL}</a>{c.questionsSuffix}
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
