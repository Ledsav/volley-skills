import { useRef, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { Input, Textarea } from '../components/Input';
import { useNotify } from '../components/Notice';
import type { Club } from '../types/club';
import { changeClubStatus, type StatusChange } from './platformApi';
import { defaultTerminationDates, type ClubAction } from './clubActions';
import { endOfLocalDay, retrievalLongEnough, startOfLocalDay } from './dates';
import { useT } from '../i18n/I18nProvider';

const REASON_MAX = 300;

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface Props {
  club: Club;
  action: ClubAction;
  operatorEmail: string;
  onClose: () => void;
  /** The fields that changed on the club doc, for the caller to merge into its row. */
  onChanged: (patch: Partial<Club>) => void;
}

export function ClubActionDialog({ club, action, operatorEmail, onClose, onChanged }: Props) {
  const notify = useNotify();
  const t = useT();
  const d = t.platform.dialog;
  const intro: Record<ClubAction['kind'], string> = {
    ...d.intro,
    endContract: d.datesIntro,
    changeDates: d.datesIntro,
  };
  const [initial] = useState(() => {
    const current = club.termination;
    if (action.kind === 'changeDates' && current?.effectiveAt && current.retrievalEndsAt) {
      return { effective: toIso(current.effectiveAt.toDate()), retrieval: toIso(current.retrievalEndsAt.toDate()) };
    }
    const defaults = defaultTerminationDates(new Date(), club.status);
    return { effective: toIso(defaults.effectiveAt), retrieval: toIso(defaults.retrievalEndsAt) };
  });
  const [reason, setReason] = useState('');
  const [effective, setEffective] = useState(initial.effective);
  const [retrieval, setRetrieval] = useState(initial.retrieval);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const trimmed = reason.trim();
  // An unchanged end date goes back exactly as stored, so one that has passed can stay
  // while only the export date moves.
  const stored = action.kind === 'changeDates' ? club.termination?.effectiveAt ?? null : null;
  const keptEffective = stored && effective === initial.effective ? stored : null;
  let dateError: string | null = null;
  if (action.needsDates) {
    if (!effective || !retrieval) dateError = d.chooseBothDates;
    else if (!keptEffective && startOfLocalDay(effective) < startOfLocalDay(toIso(new Date()))) {
      dateError = d.endDatePast;
    } else if (!retrievalLongEnough(keptEffective?.toDate() ?? startOfLocalDay(effective), endOfLocalDay(retrieval))) {
      dateError = d.exportTooShort;
    }
  }
  const canConfirm = !saving && !dateError && (!action.reasonRequired || trimmed.length > 0);

  async function confirm() {
    if (!canConfirm || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    const change: StatusChange = { clubId: club.id, from: club.status, to: action.to, reason: trimmed || null };
    const dates = action.needsDates
      ? { effectiveAt: keptEffective ?? startOfLocalDay(effective), retrievalEndsAt: endOfLocalDay(retrieval) }
      : null;
    if (dates) change.dates = dates;
    try {
      await changeClubStatus(change, operatorEmail.toLowerCase());
    } catch {
      setError(t.common.couldNotUpdateClub);
      setSaving(false);
      inFlight.current = false;
      return;
    }
    const patch: Partial<Club> = { status: action.to, statusReason: change.reason };
    if (dates) {
      patch.termination = {
        ...club.termination,
        effectiveAt: keptEffective ?? Timestamp.fromDate(startOfLocalDay(effective)),
        retrievalEndsAt: Timestamp.fromDate(dates.retrievalEndsAt),
      };
    } else if (club.status === 'terminating' && action.to === 'active') {
      patch.termination = { requestedAt: null, requestedBy: null, effectiveAt: null, retrievalEndsAt: null };
    }
    notify(action.kind === 'changeDates' ? d.datesUpdated : d.nowStatus(club.name, t.clubs.status[action.to]));
    onChanged(patch);
    onClose();
  }

  return (
    <Dialog title={d.title(action.label, club.name)} onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
          <Button variant={action.kind === 'activate' || action.kind === 'reinstate' ? 'primary' : 'destructive'}
            disabled={!canConfirm} onClick={() => void confirm()}>
            {action.label}
          </Button>
        </>
      }>
      <div className="flex flex-col gap-4">
        <p className="text-slate">{intro[action.kind]}</p>
        {action.kind === 'endContract' && club.status === 'suspended' && (
          <p className="text-slate">{d.laterEndDate}</p>
        )}
        {action.needsDates && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              {d.endDate}
              <Input type="date" value={effective} onChange={(e) => setEffective(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              {d.exportOpenUntil}
              <Input type="date" value={retrieval} onChange={(e) => setRetrieval(e.target.value)} />
            </label>
          </div>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          {action.reasonRequired ? d.reason : d.reasonOptional}
          <Textarea rows={3} maxLength={REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} />
          <span className="self-end text-xs font-normal tabular-nums text-slate">{reason.length}/{REASON_MAX}</span>
        </label>
        {(dateError || error) && <p role="alert" className="text-sm text-red">{dateError ?? error}</p>}
      </div>
    </Dialog>
  );
}
