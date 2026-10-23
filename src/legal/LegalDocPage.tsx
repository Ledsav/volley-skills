import { Link, useParams, useSearchParams } from 'react-router-dom';
import { usePageMeta } from '../layout/usePageMeta';
import { Logo } from '../components/Logo';
import { LegalLangSwitcher } from './LegalLangSwitcher';
import { LegalLinks } from './LegalLinks';
import { LegalMarkdown } from './LegalMarkdown';
import { legalText, rawLegalText } from './legalDocs';
import {
  CURRENT_DOC_VERSION, LEGAL_LANGS, defaultLegalLang, inForce,
  type LegalDocId, type LegalLang, type VersionedDoc,
} from './versions';

const TITLES: Record<LegalDocId, string> = {
  terms: 'Terms of Service',
  dpa: 'Data Processing Agreement',
  subprocessors: 'Sub-processors',
  privacy: 'Privacy',
  'dpia-pack': 'DPIA pack',
};

const VERSIONED: readonly string[] = ['terms', 'dpa', 'subprocessors'];
/** Documents served at /legal/:doc (the privacy notice keeps its own /privacy route). */
const ROUTED: readonly string[] = ['terms', 'dpa', 'subprocessors', 'dpia-pack'];

function formatDate(iso: string, lang: LegalLang): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

/** One legal text with its language switcher, shared by /legal/:doc and /privacy. */
export function LegalDocView({ doc, canonicalPath }: { doc: LegalDocId | null; canonicalPath: string }) {
  const [params, setParams] = useSearchParams();
  const requestedVersion = params.get('v');
  const langParam = params.get('lang');
  const lang: LegalLang = (LEGAL_LANGS as readonly string[]).includes(langParam ?? '')
    ? (langParam as LegalLang)
    : defaultLegalLang(typeof navigator === 'undefined' ? undefined : navigator.language);

  let version: string | null = null;
  let inForceSince: string | null = null;
  if (doc) {
    if (requestedVersion) version = requestedVersion;
    else if (VERSIONED.includes(doc)) {
      const current = inForce(doc as VersionedDoc, new Date());
      version = current.version;
      inForceSince = current.effectiveFrom;
    } else version = CURRENT_DOC_VERSION[doc as 'privacy' | 'dpia-pack'];
  }
  const found = doc !== null && version !== null && rawLegalText(doc, version, lang) !== null;
  const indexable = found && !requestedVersion;

  usePageMeta({
    title: found && doc ? TITLES[doc] : 'Not found',
    description: found && doc ? `${TITLES[doc]} of Volley Skills.` : undefined,
    robots: indexable ? 'index' : 'noindex',
    canonicalPath: indexable ? canonicalPath : undefined,
  });

  function changeLang(next: LegalLang) {
    const copy = new URLSearchParams(params);
    copy.set('lang', next);
    setParams(copy, { replace: true });
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
          <Logo className="text-[22px]" />
          <Link to="/login" className="text-sm text-white/90 hover:underline">Sign in</Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl p-6">
        {found && doc && version ? (
          <>
            <LegalLangSwitcher lang={lang} onChange={changeLang} />
            {(VERSIONED.includes(doc) || requestedVersion) && (
              <p className="mt-3 text-sm text-slate">
                {inForceSince ? `Version ${version}, in force since ${formatDate(inForceSince, lang)}` : `Version ${version}`}
              </p>
            )}
            <div lang={lang}>
              <LegalMarkdown text={legalText(doc, version, lang)} />
            </div>
          </>
        ) : (
          <>
            <h1 className="text-title font-semibold">Not found</h1>
            <p className="mt-2 text-slate">We could not find that legal text.</p>
          </>
        )}
        <LegalLinks />
      </main>
    </div>
  );
}

export function LegalDocPage() {
  const { doc } = useParams();
  const known = doc !== undefined && ROUTED.includes(doc) ? (doc as LegalDocId) : null;
  return <LegalDocView doc={known} canonicalPath={`/legal/${doc ?? ''}`} />;
}
