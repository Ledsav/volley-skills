import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../components/Logo';
import { LanguageToggle } from '../i18n/LanguageToggle';
import { useT } from '../i18n/I18nProvider';
import { LegalLinks } from '../legal/LegalLinks';
import { AuthCourt } from './AuthCourt';

/**
 * Sign-in frame (design spec §8.1): from 1100 px a stage (court, tagline)
 * beside a form pane, below that one column with a cropped court strip.
 */
export function AuthShell({
  title,
  navAction,
  legalLinks,
  children,
}: {
  title?: string;
  navAction?: { to: string; label: string };
  legalLinks?: boolean;
  children: ReactNode;
}) {
  const t = useT().auth.shell;
  return (
    <div className="canvas min-h-dvh bg-bg text-ink min-[1100px]:grid min-[1100px]:grid-cols-[1.15fr_1fr]">
      <section className="relative hidden overflow-hidden px-8 pb-8 pt-7 min-[1100px]:sticky min-[1100px]:top-0 min-[1100px]:flex min-[1100px]:h-dvh min-[1100px]:flex-col min-[1100px]:justify-between">
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-[40%] -ml-[260px] -mt-[260px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(var(--color-ink)/0.07),transparent)]"
        />
        <AuthCourt variant="stage" />
        <BrandMark className="relative" />
        <div className="relative flex max-w-[420px] flex-col gap-2.5">
          <p className="text-display text-ink">
            {t.tagline1}
            <br />
            <span className="text-ink-3">{t.tagline2}</span>
          </p>
          <p className="text-body text-ink-2">{t.pitch}</p>
        </div>
      </section>

      <div className="canvas flex min-h-dvh flex-col bg-bg px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))] min-[1100px]:border-l min-[1100px]:border-separator min-[1100px]:bg-sidebar min-[1100px]:px-7">
        <header className="flex min-h-11 items-center gap-2">
          <BrandMark className="min-w-0 min-[1100px]:hidden" />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <LanguageToggle />
            {navAction && (
              <Link
                to={navAction.to}
                className="relative inline-flex min-h-9 items-center after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] whitespace-nowrap rounded-full bg-surface-2 px-4 text-callout font-semibold text-ink hover:bg-surface-3"
              >
                {navAction.label}
              </Link>
            )}
          </div>
        </header>
        {title && (
          <div className="min-[1100px]:hidden">
            <AuthCourt variant="strip" />
          </div>
        )}
        <main className="mx-auto flex w-full max-w-[340px] flex-1 flex-col justify-center gap-[22px] py-8">
          {title && <h1 className="text-large-title text-ink min-[1100px]:text-title-1">{title}</h1>}
          {children}
        </main>
        {legalLinks && <LegalLinks />}
      </div>
    </div>
  );
}
