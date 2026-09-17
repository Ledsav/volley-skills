import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import player from '../assets/player-spike.webp';
import ball from '../assets/ball-mikasa.webp';

// The light-theme navy, pinned as a hex so the court doesn't darken with the
// dark theme's navy.
const COURT = '#2356A8';

function CourtLines() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <line x1="4%" y1="0" x2="4%" y2="100%" stroke="white" strokeOpacity="0.08" strokeWidth="1" />
      <line
        x1="96%"
        y1="0"
        x2="96%"
        y2="100%"
        stroke="white"
        strokeOpacity="0.08"
        strokeWidth="1"
      />
      <line
        x1="70%"
        y1="0"
        x2="100%"
        y2="58%"
        stroke="white"
        strokeOpacity="0.85"
        strokeWidth="6"
      />
      <line
        x1="80%"
        y1="100%"
        x2="100%"
        y2="84%"
        stroke="white"
        strokeOpacity="0.85"
        strokeWidth="6"
      />
    </svg>
  );
}

function SpikingPlayer() {
  return (
    // Anchored bottom-right of the left column so it can grow beside the
    // subtitle instead of being squeezed underneath it.
    <div
      className="pointer-events-none absolute bottom-0 right-[-3%] hidden aspect-[89/100] h-[72%] max-h-[700px] lg:block"
      aria-hidden="true"
    >
      <img src={player} alt="" className="h-full w-full" />
      <img src={ball} alt="" className="absolute left-[72%] top-[-20%] w-[18%]" />
    </div>
  );
}

export function AuthShell({
  title,
  navAction,
  children,
}: {
  title?: string;
  navAction?: { to: string; label: string };
  children: ReactNode;
}) {
  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden text-white"
      style={{ backgroundColor: COURT }}
    >
      <CourtLines />

      <header className="relative border-b border-white/15 py-4">
        <div className="mx-auto flex max-w-[82rem] items-center justify-between px-6 lg:px-12">
          <Logo className="text-[30px]" />
          {navAction && (
            <Link
              to={navAction.to}
              className="rounded-md border border-white/70 px-4 py-2 text-sm font-medium hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {navAction.label}
            </Link>
          )}
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-[82rem] flex-1 flex-col lg:flex-row">
        <section className="relative flex flex-1 flex-col px-6 pt-8 lg:px-12 lg:pt-12">
          <p className="relative z-10 text-[2rem] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] sm:text-5xl lg:text-6xl">
            Players. Progress.
            <br />
            Together.
          </p>
          <p className="relative z-10 mt-4 max-w-sm text-lg leading-relaxed text-white/85">
            Track every player&apos;s skills, plan their development and run your training sessions,
            all in one place. Built for coaches and clubs.
          </p>
          <SpikingPlayer />
        </section>

        <div className="relative z-10 flex items-center justify-center px-6 py-10 lg:w-[38%] lg:px-12">
          <div className="w-full max-w-sm rounded-lg bg-surface p-7 text-ink shadow-pop">
            {title && (
              <h1 className="mb-4 text-center text-[22px] font-semibold leading-7 tracking-[-0.01em] text-ink">
                {title}
              </h1>
            )}
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
