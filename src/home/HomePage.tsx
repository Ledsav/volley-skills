import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PageSkeleton } from '../components/Skeleton';
import { matchMvpLabel } from '../awards/matchMvp';
import { PageHeader } from '../layout/PageHeader';
import { usePageMeta } from '../layout/usePageMeta';
import { TeamCard } from '../teams/TeamCard';
import { liveMatches, nextUp, recentResults } from './homeFeed';
import { LiveNowBlock } from './LiveNowBlock';
import { NextUpBlock } from './NextUpBlock';
import { RecentResultsBlock } from './RecentResultsBlock';
import { Shortcuts, useTeamAction } from './Shortcuts';
import { useHomeFeed } from './useHomeFeed';
import { GetStartedCard } from '../onboarding/GetStartedCard';
import { WelcomeSheet } from '../onboarding/WelcomeSheet';
import { useT } from '../i18n/I18nProvider';
import { formatDateValue } from '../i18n/format';
import { PageContainer } from '../layout/PageContainer';

export function HomePage() {
  const t = useT().home;
  usePageMeta({ title: t.title });
  const { appUser, access } = useAuth();
  const email = appUser?.email ?? null;
  // A club admin sees every club team; everyone else the teams they admin. Unknown access reads nothing.
  const scope = access ? (access.isClubAdmin ? 'club' : 'mine') : null;
  const state = useHomeFeed(email, scope);
  const anySection = !!access && (access.sections.exercises || access.sections.trainings || access.sections.guides || access.isClubAdmin);
  const today = state.today;
  const plan = useTeamAction(state.teams, 'new-session');
  const canPlan = state.teams.length > 0 && !!access?.sections.trainings;

  return (
    <PageContainer>
      <PageHeader title={t.title} eyebrow={formatDateValue(new Date(), 'full')} />
      {state.loading ? (
        <PageSkeleton layout="team" label={t.loading} />
      ) : state.errors.teams ? (
        <p role="alert" className="text-red-strong">{t.teamsError}</p>
      ) : state.teams.length === 0 && !anySection ? (
        <div className="max-w-lg rounded-lg bg-surface p-6 shadow-card">
          <h2 className="text-title-3 text-ink">{t.noAccessTitle}</h2>
          <p className="mt-2 text-footnote text-ink-2">{t.noAccessBody}</p>
          <Link to="/request-access" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-callout font-semibold text-on-ink pressable hover:bg-ink/90">
            {t.requestAccess}
          </Link>
        </div>
      ) : (
        <>
          <GetStartedCard teams={state.teams} adminsAnyTeam={!!access?.isClubAdmin || state.teams.length > 0} />
          <LiveNowBlock items={liveMatches(state.feed)} />
          {/* grid-cols-1 (minmax(0,1fr)), not the implicit auto track: a long
              session name would otherwise widen the column past a phone's screen. */}
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <NextUpBlock items={nextUp(state.feed, today)} failed={state.errors.sessions} onPlan={canPlan ? plan.start : undefined} />
            <RecentResultsBlock items={recentResults(state.feed)} failed={state.errors.matches} mvpFor={(fm) => matchMvpLabel(fm.match)} />
          </div>
          {state.teams.length > 0 && (
            <section aria-labelledby="your-teams" className="mb-6">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 id="your-teams" className="text-title-3 text-ink">{t.yourTeams}</h2>
                {state.hasMoreTeams && <Link to="/teams" className="text-callout text-ink-2 hover:underline">{t.allTeams}</Link>}
              </div>
              {state.hasMoreTeams && <p className="mb-2 text-footnote text-ink-2">{t.showingFirst(state.teams.length)}</p>}
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {state.teams.map((tm) => (
                  <TeamCard key={tm.id} team={tm} layout="card" />
                ))}
              </ul>
            </section>
          )}
          <Shortcuts teams={state.teams} access={access} />
          {plan.picker}
        </>
      )}
      {!state.loading && <WelcomeSheet adminsAnyTeam={!!access?.isClubAdmin || state.teams.length > 0} />}
    </PageContainer>
  );
}
