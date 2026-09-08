import type { ReactNode } from 'react';
import logo from '../assets/logo.png';

/**
 * Split shell shared by the auth screens and the auth loading/error states:
 * a navy brand panel (desktop only — the card carries the mark on mobile)
 * plus the actual content card, both on the design-system's tokens.
 */
export function AuthShell({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg">
      <div className="relative hidden w-2/5 shrink-0 flex-col justify-between overflow-hidden bg-navy p-10 text-white lg:flex">
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          fill="none"
          className="pointer-events-none absolute -right-24 -top-24 h-[26rem] w-[26rem] opacity-10"
        >
          <circle cx="50" cy="50" r="46" stroke="white" strokeWidth="2.5" />
          <path
            d="M50 4c14 14 14 78 0 92M9 30c17 9 65 9 82 0M9 70c17-9 65-9 82 0"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-10 w-10 rounded-full border-2 border-white" />
          <span className="text-xl font-semibold tracking-[-0.01em]">Volley Skills</span>
        </div>
        <div className="relative">
          <p className="text-2xl font-semibold tracking-[-0.01em]">Players. Progress. Together.</p>
          <p className="mt-3 max-w-xs text-white/70">
            Develop players, manage teams, and run great training programs, all in one place.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-card">
          <img src={logo} alt="" className="mx-auto mb-4 h-12 w-12 rounded-full lg:hidden" />
          {title && <h1 className="mb-4 text-center text-xl font-semibold tracking-[-0.01em] text-ink">{title}</h1>}
          {children}
        </div>
      </div>
    </div>
  );
}
