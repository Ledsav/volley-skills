import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { sendSigningLink } from '../auth/reauth';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Input } from '../components/Input';
import { useNotify } from '../components/Notice';
import { requestTermination } from '../clubs/clubAdminApi';
import { otherUsableClubs } from '../clubs/activeClub';
import { MinimalShell } from '../layout/MinimalShell';
import { DocumentsStep } from '../signup/DocumentsStep';
import { SpecificApprovalStep } from '../signup/SpecificApprovalStep';
import { newSignNonce, saveSignDraft } from './signDraft';
import { defaultLegalLang, inForce, type LegalLang } from './versions';

type Errors = Partial<Record<'person' | 'authority', string>>;

/** Blocks a club admin until they accept the Terms and DPA versions now in force. */
export function LegalReviewScreen() {
  const { club, activeClubId, firebaseUser, appUser, memberships, switchClub } = useAuth();
  const others = otherUsableClubs(memberships, activeClubId);
  const notify = useNotify();
  const email = (appUser?.email ?? firebaseUser?.email ?? '').trim().toLowerCase();
  // Frozen on mount so the draft always matches the texts shown, even across an effective date.
  const [versions] = useState(() => {
    const now = new Date();
    return {
      terms: inForce('terms', now),
      dpa: inForce('dpa', now),
      subprocessors: inForce('subprocessors', now),
    };
  });
  const [step, setStep] = useState<1 | 2 | 3>(1);
  // One nonce per visit, so every link sent from here commits the same draft.
  const nonceRef = useRef<string | null>(null);
  const [person, setPerson] = useState('');
  const [authority, setAuthority] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [lang, setLang] = useState<LegalLang>(() =>
    defaultLegalLang(typeof navigator === 'undefined' ? undefined : navigator.language),
  );
  const [confirming, setConfirming] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  const title = club?.legal ? 'Review the updated Terms and DPA' : 'Accept the Terms and DPA';
  const canEnd = (club?.status === 'active' || club?.status === 'suspended') && !club.termination.requestedAt;

  function submitDetails(event: FormEvent) {
    event.preventDefault();
    const e: Errors = {};
    const p = person.trim();
    if (p.length < 1 || p.length > 100) e.person = 'Enter your name (1 to 100 characters).';
    if (!authority) e.authority = 'Confirm that you are authorised to act for this club.';
    setErrors(e);
    if (Object.keys(e).length === 0) setStep(2);
  }

  async function send() {
    if (!activeClubId) throw new Error('No active club');
    nonceRef.current ??= newSignNonce();
    saveSignDraft({
      kind: 'reaccept',
      clubId: activeClubId,
      email,
      personName: person.trim(),
      termsVersion: versions.terms.version,
      dpaVersion: versions.dpa.version,
      subprocessorsVersion: versions.subprocessors.version,
      language: lang,
      savedAt: Date.now(),
      nonce: nonceRef.current,
    });
    await sendSigningLink(email, nonceRef.current);
  }

  async function endContract() {
    setEndError(null);
    try {
      await requestTermination(email);
      setConfirming(false);
      notify('End of contract requested');
    } catch {
      setEndError("Couldn't send the request. Try again.");
    }
  }

  return (
    <MinimalShell title={club?.name ?? 'Club'}>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-2 text-title font-semibold text-ink">{title}</h1>
        <ul className="mb-4 list-disc pl-5 text-sm text-ink">
          <li>{versions.terms.summary}</li>
          <li>{versions.dpa.summary}</li>
        </ul>

        {step === 1 && (
          <form onSubmit={submitDetails} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="review-person" className="text-sm font-medium text-ink">Your name</label>
              <Input id="review-person" value={person} onChange={(e) => setPerson(e.target.value)} autoComplete="name"
                aria-invalid={errors.person ? true : undefined}
                aria-describedby={errors.person ? 'review-person-error' : undefined} />
              {errors.person && <p id="review-person-error" role="alert" className="text-sm text-red">{errors.person}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="review-authority" className="flex items-start gap-2 text-sm text-ink">
                <input id="review-authority" type="checkbox" checked={authority} onChange={(e) => setAuthority(e.target.checked)}
                  aria-invalid={errors.authority ? true : undefined}
                  aria-describedby={errors.authority ? 'review-authority-error' : undefined}
                  className="mt-1 h-4 w-4" />
                <span>I am authorised to act for this club and accept these terms on its behalf</span>
              </label>
              {errors.authority && <p id="review-authority-error" role="alert" className="text-sm text-red">{errors.authority}</p>}
            </div>
            <div><Button type="submit" variant="primary">Next</Button></div>
          </form>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <DocumentsStep
              termsVersion={versions.terms.version}
              dpaVersion={versions.dpa.version}
              lang={lang}
              onLangChange={setLang}
              onDone={() => setStep(3)}
            />
            <div><Button variant="ghost" onClick={() => setStep(1)}>Back</Button></div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <SpecificApprovalStep
              termsVersion={versions.terms.version}
              dpaVersion={versions.dpa.version}
              lang={lang}
              email={email}
              onSend={send}
            />
            <div><Button variant="ghost" onClick={() => setStep(2)}>Back</Button></div>
          </div>
        )}

        {others.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {others.map((m) => (
              <Button key={m.clubId} variant="secondary" onClick={() => switchClub(m.clubId)}>
                Switch to {m.clubName}
              </Button>
            ))}
          </div>
        )}

        {canEnd && (
          <div className="mt-8 border-t border-border pt-4">
            <p className="mb-2 text-sm text-slate">Don&apos;t agree?</p>
            <Button variant="destructive" onClick={() => setConfirming(true)}>End our contract</Button>
          </div>
        )}
        {confirming && (
          <ConfirmDialog
            title="End your club's contract?"
            message="We'll be told you want to leave. Your club keeps full use and a window to export your data until the end date we confirm."
            confirmLabel="Request end of contract"
            error={endError}
            onCancel={() => { setConfirming(false); setEndError(null); }}
            onConfirm={() => void endContract()}
          />
        )}
      </div>
    </MinimalShell>
  );
}
