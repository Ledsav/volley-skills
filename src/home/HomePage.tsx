import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PageSkeleton } from '../components/Skeleton';
import { matchMvpLabel } from '../awards/matchMvp';
import { usePageMeta } from '../layout/usePageMeta';
import { liveMatches, nextUp, recentResults } from './homeFeed';
import { LiveNowBlock } from './LiveNowBlock';
import { NextUpBlock } from './NextUpBlock';
import { RecentResultsBlock } from './RecentResultsBlock';
import { useHomeFeed } from './useHomeFeed';

function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** Half a volleyball court in faint white lines, bleeding off the band's right edge. */
function CourtLines() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 90"
      className="pointer-events-none absolute -right-6 top-1/2 h-[140%] -translate-y-1/2 text-white/10"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="1" y="1" width="178" height="88" />
      <line x1="90" y1="1" x2="90" y2="89" strokeWidth="4" />
      <line x1="60" y1="1" x2="60" y2="89" />
      <line x1="120" y1="1" x2="120" y2="89" />
    </svg>
  );
}

export function HomePage() {
  usePageMeta({ title: 'Home' });
  const { appUser, access, club: activeClub } = useAuth();
  const email = appUser?.email ?? null;
  const name = (email?.split('@')[0] ?? '').split(/[._-]/)[0];
  const state = useHomeFeed(email);
  const anySection = !!access && (access.sections.exercises || access.sections.trainings || access.sections.guides || access.isClubAdmin);
  const today = state.today;
  const club = activeClub?.name;

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      {/* The one branded surface inside the app: navy band, club name from data. */}
      <section aria-label="Welcome" className="relative mb-6 overflow-hidden rounded-lg bg-navy p-5 text-white sm:p-6">
        <CourtLines />
        <div className="relative">
          {club && <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{club}</p>}
          <h1 className="mt-1 text-title font-semibold text-white">
            {greeting()}{name ? `, ${name.charAt(0).toUpperCase()}${name.slice(1)}` : ''}
          </h1>
          <p className="mt-1 text-sm text-white/80">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </section>

      {state.loading ? (
        <PageSkeleton layout="team" label="Loading your dashboard..." />
      ) : state.errors.teams ? (
        <p role="alert" className="text-red">Could not load your teams.</p>
      ) : state.teams.length === 0 && !anySection ? (
        <div className="max-w-lg rounded-lg border border-border bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold text-ink">You don't have access to any team yet</h2>
          <p className="mt-2 text-slate">A club administrator grants access to teams and sections. Ask them, or send a request.</p>
          <Link to="/request-access" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-blue px-4 font-medium text-white hover:bg-blue-strong">
            Request access
          </Link>
        </div>
      ) : (
        <>
          <LiveNowBlock items={liveMatches(state.feed)} />
          {/* grid-cols-1 (minmax(0,1fr)), not the implicit auto track: a long
              session name would otherwise widen the column past a phone's screen. */}
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <NextUpBlock items={nextUp(state.feed, today)} failed={state.errors.sessions} />
            <RecentResultsBlock items={recentResults(state.feed)} failed={state.errors.matches} mvpFor={(fm) => matchMvpLabel(fm.match)} />
          </div>
          {state.teams.length > 0 && (
            <section aria-labelledby="your-teams" className="mb-6">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 id="your-teams" className="text-lg font-semibold text-ink">Your teams</h2>
                {state.hasMoreTeams && <Link to="/teams" className="text-sm text-blue hover:underline">All teams →</Link>}
              </div>
              {state.hasMoreTeams && <p className="mb-2 text-sm text-slate">Showing your first {state.teams.length} teams.</p>}
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {state.teams.map((t) => (
                  <li key={t.id}>
                    <Link to={`/teams/${t.id}`} className="block rounded-lg border border-border bg-surface p-4 shadow-card hover:border-blue">
                      <p className="font-semibold text-ink">{t.name}</p>
                      <p className="text-sm text-slate">{t.ageGroup} · {t.season}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
