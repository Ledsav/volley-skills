import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { usePageMeta } from '../layout/usePageMeta';
import { BrandMark } from '../components/Logo';
import { LegalLangSwitcher } from './LegalLangSwitcher';
import { LanguageToggle } from '../i18n/LanguageToggle';
import { useLocale, useT } from '../i18n/I18nProvider';
import type { Locale } from '../i18n/locales';
import { LegalLinks } from './LegalLinks';
import { LegalMarkdown } from './LegalMarkdown';
import { legalText, rawLegalText } from './legalDocs';
import {
  CURRENT_DOC_VERSION, LEGAL_LANGS, defaultLegalLang, inForce,
  type LegalDocId, type LegalLang, type VersionedDoc,
} from './versions';

const NAV_PILL =
  "relative inline-flex min-h-9 items-center after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] whitespace-nowrap rounded-full bg-surface-2 px-4 text-callout font-semibold text-ink hover:bg-surface-3";

const VERSIONED: readonly string[] = ['terms', 'dpa', 'subprocessors'];
/** Documents served at /legal/:doc (the privacy notice keeps its own /privacy route). */
const ROUTED: readonly string[] = ['terms', 'dpa', 'subprocessors', 'dpia-pack'];

function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

/** One legal text with its language switcher, shared by /legal/:doc and /privacy. */
export function LegalDocView({ doc, canonicalPath }: { doc: LegalDocId | null; canonicalPath: string }) {
  const { firebaseUser } = useAuth();
  const t = useT();
  const { locale } = useLocale();
  const titles: Record<LegalDocId, string> = { ...t.legal.docTitles, 'dpia-pack': t.legal.docTitles.dpiaPack };
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
    title: found && doc ? titles[doc] : t.layout.notFound.title,
    description: found && doc ? t.legal.page.description(titles[doc]) : undefined,
    robots: indexable ? 'index' : 'noindex',
    canonicalPath: indexable ? canonicalPath : undefined,
  });

  function changeLang(next: LegalLang) {
    const copy = new URLSearchParams(params);
    copy.set('lang', next);
    setParams(copy, { replace: true });
  }

  return (
    <div className="canvas min-h-dvh bg-bg text-ink">
      <header className="glass sticky top-0 z-10">
        <div className="mx-auto flex h-[52px] max-w-[720px] items-center justify-between gap-3 px-4 sm:px-6">
          <BrandMark className="min-w-0" />
          <div className="flex shrink-0 items-center gap-2">
            <LanguageToggle />
            <Link to={firebaseUser ? '/' : '/login'} className={NAV_PILL}>
              {firebaseUser ? t.legal.page.backToApp : t.signup.info.signIn}
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[720px] px-4 py-8 sm:px-6">
        {found && doc && version ? (
          <>
            <LegalLangSwitcher lang={lang} onChange={changeLang} />
            {(VERSIONED.includes(doc) || requestedVersion) && (
              <p className="mt-3 text-footnote text-ink-2 tabular-nums">
                {inForceSince ? t.legal.page.versionInForce(version, formatDate(inForceSince, locale)) : t.legal.page.version(version)}
              </p>
            )}
            <div lang={lang} className="mt-6 text-base leading-[1.625rem]">
              <LegalMarkdown text={legalText(doc, version, lang)} />
            </div>
          </>
        ) : (
          <>
            <h1 className="text-title-1">{t.layout.notFound.title}</h1>
            <p className="mt-2 text-body text-ink-2">{t.legal.page.notFound}</p>
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
