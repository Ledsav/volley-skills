import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { LanguageToggle } from '../i18n/LanguageToggle';
import { useLocale, useT } from '../i18n/I18nProvider';
import { ITALIAN_ENABLED } from '../i18n/locales';
import { sendSigningLink } from '../auth/reauth';
import { Button } from '../components/Button';
import { FIELD_CLASS, Input } from '../components/Input';
import { CLUB_COUNTRY_CODES } from '../clubs/clubAdminApi';
import { MinimalShell } from '../layout/MinimalShell';
import { usePageMeta } from '../layout/usePageMeta';
import { newSignNonce, saveSignDraft } from '../legal/signDraft';
import { defaultLegalLang, inForce, type LegalLang } from '../legal/versions';
import type { ClubLocale } from '../types/club';
import { DocumentsStep } from './DocumentsStep';
import { newClubId } from './newClubId';
import { SpecificApprovalStep } from './SpecificApprovalStep';

const LOCALES: { id: ClubLocale; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'it', label: 'Italiano' },
];

type Errors = Partial<Record<'name' | 'country' | 'person' | 'authority', true>>;

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} role="alert" className="text-footnote text-red-strong">{message}</p> : null;
}

/** /signup/club: club details, then the documents, then the specific approval and the signing link. */
export function SignupPage() {
  const tAll = useT();
  const t = tAll.signup;
  const tc = tAll.common;
  const { locale: appLocale } = useLocale();
  const regionNames = useMemo(() => new Intl.DisplayNames([appLocale], { type: 'region' }), [appLocale]);
  usePageMeta({ title: t.shared.createClub });
  const { firebaseUser, appUser, memberships } = useAuth();
  const email = (appUser?.email ?? firebaseUser?.email ?? '').trim().toLowerCase();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [locale, setLocale] = useState<ClubLocale>('en');
  const [person, setPerson] = useState('');
  const [authority, setAuthority] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [lang, setLang] = useState<LegalLang>(() =>
    defaultLegalLang(typeof navigator === 'undefined' ? undefined : navigator.language),
  );
  // One id per sign-up attempt, so re-sending the link never produces a second club.
  const clubIdRef = useRef<string | null>(null);
  // One nonce per page visit, so every link sent from here commits the same draft.
  const nonceRef = useRef<string | null>(null);

  // Frozen on mount so the draft always matches the texts shown, even across an effective date.
  const [versions] = useState(() => {
    const now = new Date();
    return {
      terms: inForce('terms', now).version,
      dpa: inForce('dpa', now).version,
      subprocessors: inForce('subprocessors', now).version,
    };
  });

  if (memberships.some((m) => m.status === 'pending')) {
    return (
      <MinimalShell title={t.shared.createClub} actions={<LanguageToggle />}>
        <div className="mx-auto max-w-[720px] px-4 py-8 sm:px-6">
          <p className="text-body text-ink">{t.page.alreadyPending}</p>
          <p className="mt-2 text-footnote text-ink-2">{t.page.emailWhenActive}</p>
        </div>
      </MinimalShell>
    );
  }

  function validate(): Errors {
    const e: Errors = {};
    const n = name.trim();
    if (n.length < 2 || n.length > 80) e.name = true;
    if (!CLUB_COUNTRY_CODES.includes(country)) e.country = true;
    const p = person.trim();
    if (p.length < 1 || p.length > 100) e.person = true;
    if (!authority) e.authority = true;
    return e;
  }

  function submitDetails(event: FormEvent) {
    event.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length === 0) setStep(2);
  }

  async function send() {
    clubIdRef.current ??= newClubId();
    nonceRef.current ??= newSignNonce();
    saveSignDraft({
      kind: 'signup',
      clubId: clubIdRef.current,
      club: { name: name.trim(), country, locale },
      email,
      personName: person.trim(),
      termsVersion: versions.terms,
      dpaVersion: versions.dpa,
      subprocessorsVersion: versions.subprocessors,
      language: lang,
      savedAt: Date.now(),
      nonce: nonceRef.current,
    });
    await sendSigningLink(email, nonceRef.current);
  }

  const describe = (key: keyof Errors, base?: string) =>
    [errors[key] ? `signup-${key}-error` : null, base].filter(Boolean).join(' ') || undefined;

  return (
    <MinimalShell title={t.shared.createClub} actions={<LanguageToggle />}>
      <div className="mx-auto max-w-[720px] px-4 py-8 sm:px-6">
        <p className="text-footnote tabular-nums text-ink-2">{t.page.step(step)}</p>
        <h1 className="mb-4 text-large-title text-ink md:text-title-1">
          {step === 1 ? t.page.stepTitles.details : step === 2 ? t.page.stepTitles.documents : t.page.stepTitles.approval}
        </h1>

        {step === 1 && (
          <form onSubmit={submitDetails} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="signup-name" className="text-footnote font-medium text-ink-2">{t.page.clubName}</label>
              <Input id="signup-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
                aria-invalid={errors.name ? true : undefined} aria-describedby={describe('name')} />
              <FieldError id="signup-name-error" message={errors.name ? t.page.clubNameError : undefined} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="signup-country" className="text-footnote font-medium text-ink-2">{t.page.country}</label>
              <select id="signup-country" value={country} onChange={(e) => setCountry(e.target.value)}
                aria-invalid={errors.country ? true : undefined} aria-describedby={describe('country')}
                className={`${FIELD_CLASS} w-full`}>
                <option value="">{t.page.selectCountry}</option>
                {CLUB_COUNTRY_CODES.map((c) => <option key={c} value={c}>{regionNames.of(c) ?? c}</option>)}
              </select>
              <FieldError id="signup-country-error" message={errors.country ? t.page.countryError : undefined} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="signup-locale" className="text-footnote font-medium text-ink-2">{t.page.clubLanguage}</label>
              <select id="signup-locale" value={locale} onChange={(e) => setLocale(e.target.value as ClubLocale)}
                className={`${FIELD_CLASS} w-full`}>
                {LOCALES.filter((l) => ITALIAN_ENABLED || l.id === 'en').map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="signup-person" className="text-footnote font-medium text-ink-2">{t.shared.yourName}</label>
              <Input id="signup-person" value={person} onChange={(e) => setPerson(e.target.value)} autoComplete="name"
                aria-invalid={errors.person ? true : undefined} aria-describedby={describe('person')} />
              <FieldError id="signup-person-error" message={errors.person ? t.shared.nameRequired : undefined} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="signup-authority" className="flex min-h-11 items-start gap-3 text-body text-ink">
                <input id="signup-authority" type="checkbox" checked={authority} onChange={(e) => setAuthority(e.target.checked)}
                  aria-invalid={errors.authority ? true : undefined} aria-describedby={describe('authority')}
                  className="mt-0.5 h-5 w-5 accent-ink" />
                <span>{t.shared.authority}</span>
              </label>
              <FieldError id="signup-authority-error" message={errors.authority ? t.shared.authorityRequired : undefined} />
            </div>
            <div>
              <Button type="submit" variant="primary">{t.shared.next}</Button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <DocumentsStep
              termsVersion={versions.terms}
              dpaVersion={versions.dpa}
              lang={lang}
              onLangChange={setLang}
              onDone={() => setStep(3)}
            />
            <div><Button variant="ghost" onClick={() => setStep(1)}>{tc.back}</Button></div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <SpecificApprovalStep
              termsVersion={versions.terms}
              dpaVersion={versions.dpa}
              lang={lang}
              email={email}
              onSend={send}
            />
            <div><Button variant="ghost" onClick={() => setStep(2)}>{tc.back}</Button></div>
          </div>
        )}
      </div>
    </MinimalShell>
  );
}
