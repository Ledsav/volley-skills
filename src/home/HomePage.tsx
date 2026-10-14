import { Link } from 'react-router-dom';
import { ClipboardList, Dumbbell, Users } from 'lucide-react';
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

export function HomePage() {
  usePageMeta({ title: 'Home' });
  const { appUser, access } = useAuth();
  const email = appUser?.email ?? null;
  const name = (email?.split('@')[0] ?? '').split(/[._-]/)[0];
  const state = useHomeFeed(email);
  const anySection = !!access && (access.sections.exercises || access.sections.trainings || access.sections.guides || access.isSuperAdmin);
  const today = state.today;

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">
        {greeting()}{name ? `, ${name.charAt(0).toUpperCase()}${name.slice(1)}` : ''}
      </h1>
      <p className="mb-6 mt-1 text-slate">
        {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

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
          <div className="grid gap-6 lg:grid-cols-2">
            <NextUpBlock items={nextUp(state.feed, today)} failed={state.errors.sessions} />
            <RecentResultsBlock items={recentResults(state.feed)} failed={state.errors.matches} mvpFor={(fm) => matchMvpLabel(fm.match)} />
          </div>
          {state.teams.length > 0 && (
            <section aria-labelledby="your-teams" className="mb-6">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 id="your-teams" className="text-lg font-semibold text-ink">Your teams</h2>
                <Link to="/teams" className="text-sm text-blue hover:underline">All teams →</Link>
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
          <section aria-label="Shortcuts" className="flex flex-wrap gap-2">
            <Link to="/teams" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-4 text-ink hover:bg-bg"><Users size={16} aria-hidden="true" /> Teams</Link>
            {access?.sections.exercises && <Link to="/exercises" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-4 text-ink hover:bg-bg"><Dumbbell size={16} aria-hidden="true" /> Exercises</Link>}
            {access?.sections.trainings && <Link to="/trainings" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-4 text-ink hover:bg-bg"><ClipboardList size={16} aria-hidden="true" /> Trainings</Link>}
          </section>
        </>
      )}
    </div>
  );
}
