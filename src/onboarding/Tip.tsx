import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { useT } from '../i18n/I18nProvider';
import { useReducedMotion } from '../motion/useReducedMotion';
import type { TipId } from './onboardingState';
import { useTip } from './useTip';

const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

/**
 * A one-time hint in place. Enters with the page-change motion (fade, rise 6 px, 180 ms) and leaves with the
 * list-delete motion (height collapse and fade, 200 ms); reduced motion cross-fades. `animated={false}` (live
 * scouting) shows and hides it instantly. Other triggers end a tip through their own `useTip(id).dismiss`: the
 * dismissal lives in the auth context, so this component follows.
 */
export function Tip({ id, icon: Icon, title, line, animated = true, className = 'mb-6' }: { id: TipId; icon: LucideIcon; title: string; line: ReactNode; animated?: boolean; className?: string }) {
  const { visible, dismiss } = useTip(id);
  const dismissLabel = useT().onboarding.dismiss;
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  // `present` keeps the node mounted through the exit animation.
  const [present, setPresent] = useState(visible);
  if (visible && !present) setPresent(true);
  const leaving = present && !visible;

  // Enter: whenever the tip becomes visible (including mounting hidden and showing later).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!visible || !el || !animated || typeof el.animate !== 'function') return;
    el.animate(reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], {
      duration: reduced ? 150 : 180,
      easing: EASE,
    });
    // Reduced motion changing mid-flight should not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Exit: collapse the height and fade (reduced motion: cross-fade), then unmount.
  useLayoutEffect(() => {
    if (!leaving) return;
    const el = ref.current;
    if (!animated || !el || typeof el.animate !== 'function') {
      setPresent(false);
      return;
    }
    const h = el.offsetHeight;
    const mb = getComputedStyle(el).marginBottom;
    const anim = el.animate(
      reduced
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { opacity: 1, height: `${h}px`, marginBottom: mb },
            { opacity: 0, height: '0px', marginBottom: '0px' },
          ],
      { duration: reduced ? 150 : 200, easing: EASE, fill: 'forwards' },
    );
    const done = () => setPresent(false);
    anim.addEventListener('finish', done);
    anim.addEventListener('cancel', done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  if (!present) return null;
  return (
    <div ref={ref} role="note" className={`${className} flex items-start gap-3 rounded-lg bg-surface-2 py-3 pl-4 pr-1 ${leaving ? 'pointer-events-none overflow-hidden' : ''}`}>
      <Icon size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-2" />
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-callout font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-footnote text-ink-2">{line}</p>
      </div>
      <button
        type="button"
        aria-label={dismissLabel}
        onClick={dismiss}
        className="-my-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
