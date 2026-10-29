import { lazy, Suspense, type ReactNode } from 'react';
import { ScoutRoot } from './matches/scout/ScoutRoot';
import { AwardsRoot } from './awards/AwardsRoot';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { NoticeProvider } from './components/Notice';
import { I18nProvider, useT } from './i18n/I18nProvider';
import { RequireAuth, RequireSignedIn } from './auth/RequireAuth';
import { SignupInfoPage } from './signup/SignupInfoPage';
import { SignupPage } from './signup/SignupPage';
import { SignCompletePage } from './signup/SignCompletePage';
import { RequireClubAdmin } from './auth/RequireClubAdmin';
import { RequirePlatformAdmin } from './auth/RequirePlatformAdmin';
import { PlatformShell } from './platform/PlatformShell';
import { PlatformPage } from './platform/PlatformPage';
import { RequireSection } from './auth/RequireSection';
import { AppShell } from './layout/AppShell';
import { PageChromeProvider } from './layout/PageChrome';
import { SearchProvider } from './search/SearchProvider';
import { LoginPage } from './auth/LoginPage';
import { FinishSignInPage } from './auth/FinishSignInPage';
import { TeamsListPage } from './teams/TeamsListPage';
import { TeamPage } from './teams/TeamPage';
import { PlayerCardPage } from './players/PlayerCardPage';
import { GuidesPage } from './admin/GuidesPage';
import { ExercisesPage } from './exercises/ExercisesPage';
import { TrainingsPage } from './trainings/TrainingsPage';
import { PrivacyPage } from './legal/PrivacyPage';
import { LegalDocPage } from './legal/LegalDocPage';
import { SettingsPage } from './settings/SettingsPage';
import { MorePage } from './layout/MorePage';
import { ClubAreaPage } from './clubs/area/ClubAreaPage';
import { RequestAccessPage } from './interest/RequestAccessPage';
import { NotFoundPage } from './layout/NotFoundPage';
import { RouteErrorBoundary, RouteLoadError } from './layout/RouteErrorBoundary';
import { HomePage } from './home/HomePage';
import { MatchPage } from './matches/MatchPage';

const DiagramEditorPage = lazy(() =>
  import('./diagrams/DiagramEditorPage').then((m) => ({ default: m.DiagramEditorPage })),
);

// Dev-only: the guard is a build-time constant, so production bundles drop the gallery entirely.
const UiGallery = import.meta.env.DEV ? lazy(() => import('./dev/UiGallery')) : null;
const DiagramEditorPreview = import.meta.env.DEV ? lazy(() => import('./dev/DiagramEditorPreview')) : null;
const ShellPreview = import.meta.env.DEV ? lazy(() => import('./dev/ShellPreview')) : null;

const AwardsPage = lazy(() => import('./awards/AwardsPage'));
const ScoutPage = lazy(() => import('./matches/scout/ScoutPage').then((m) => ({ default: m.ScoutPage })));

type LazyWhat = 'editor' | 'scouting' | 'awards';

/** Scouting and awards paint their own (dark) canvas; the loading and error screens sit on it too. */
function LazyFrame({ what, children }: { what: LazyWhat; children: ReactNode }) {
  if (what === 'scouting') return <ScoutRoot>{children}</ScoutRoot>;
  return what === 'awards' ? <AwardsRoot>{children}</AwardsRoot> : <>{children}</>;
}

/** A lazily loaded full-screen route: a loading line while its code downloads, an error screen if that fails. */
function LazyRoute({ what, children }: { what: LazyWhat; children: ReactNode }) {
  const t = useT();
  return (
    <RouteErrorBoundary
      fallback={
        <LazyFrame what={what}>
          <RouteLoadError />
        </LazyFrame>
      }
    >
      <Suspense
        fallback={
          <LazyFrame what={what}>
            <div className="p-6 text-ink-2">{t.layout.lazyLoading[what]}</div>
          </LazyFrame>
        }
      >
        {children}
      </Suspense>
    </RouteErrorBoundary>
  );
}

function AuthenticatedLayout() {
  return (
    <RequireAuth>
      <PageChromeProvider>
        <SearchProvider>
          <AppShell>
            <Outlet />
          </AppShell>
        </SearchProvider>
      </PageChromeProvider>
    </RequireAuth>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <I18nProvider>
        <NoticeProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/finish-sign-in" element={<FinishSignInPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/legal/:doc" element={<LegalDocPage />} />
            <Route path="/request-access" element={<RequestAccessPage />} />
            <Route path="/signup" element={<SignupInfoPage />} />
            <Route path="/signup/club" element={<RequireSignedIn><SignupPage /></RequireSignedIn>} />
            <Route path="/sign/complete" element={<RequireSignedIn><SignCompletePage /></RequireSignedIn>} />
            {UiGallery && (
              <Route
                path="/dev/ui"
                element={
                  <RequireSignedIn>
                    <SearchProvider>
                      <Suspense fallback={null}>
                        <UiGallery />
                      </Suspense>
                    </SearchProvider>
                  </RequireSignedIn>
                }
              />
            )}
            {import.meta.env.DEV && DiagramEditorPreview && (
              // Dev-only and not behind sign-in: the editor over an in-memory scene, for screenshots.
              <Route
                path="/dev/preview/diagram-editor"
                element={
                  <Suspense fallback={null}>
                    <DiagramEditorPreview />
                  </Suspense>
                }
              />
            )}
            {import.meta.env.DEV && ShellPreview && (
              // Dev-only and not behind sign-in: the shell and shared controls over static content, for screenshots.
              <Route
                path="/dev/preview/shell"
                element={
                  <Suspense fallback={null}>
                    <ShellPreview />
                  </Suspense>
                }
              />
            )}
            <Route
              path="/platform"
              element={
                <RequirePlatformAdmin>
                  <PlatformShell>
                    <PlatformPage />
                  </PlatformShell>
                </RequirePlatformAdmin>
              }
            />
            {/* Leads moved to the operator's platform page. */}
            <Route path="/admin/interest" element={<Navigate to="/platform?tab=leads" replace />} />
            <Route element={<AuthenticatedLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/teams" element={<TeamsListPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/more" element={<MorePage />} />
              <Route path="/teams/:teamId" element={<TeamPage />} />
              <Route path="/teams/:teamId/players/:playerId" element={<PlayerCardPage />} />
              <Route path="/teams/:teamId/matches/:matchId" element={<MatchPage />} />
              <Route
                path="/admin/guides"
                element={
                  <RequireSection section="guides">
                    <GuidesPage />
                  </RequireSection>
                }
              />
              <Route
                path="/exercises"
                element={
                  <RequireSection section="exercises">
                    <ExercisesPage />
                  </RequireSection>
                }
              />
              <Route
                path="/trainings"
                element={
                  <RequireSection section="trainings">
                    <TrainingsPage />
                  </RequireSection>
                }
              />
              <Route
                path="/club"
                element={
                  <RequireClubAdmin>
                    <ClubAreaPage />
                  </RequireClubAdmin>
                }
              />
              {/* Old link targets: access management moved into the club area. */}
              <Route path="/admin/access" element={<Navigate to="/club?tab=people" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            {/* Full screen, outside the shell: no sidebar, tab bar or palette. */}
            <Route
              path="/exercises/:exerciseId/diagram"
              element={
                <RequireAuth>
                  <RequireSection section="exercises">
                    <LazyRoute what="editor">
                      <DiagramEditorPage />
                    </LazyRoute>
                  </RequireSection>
                </RequireAuth>
              }
            />
            <Route
              path="/teams/:teamId/matches/:matchId/scout"
              element={
                <RequireAuth>
                  <LazyRoute what="scouting">
                    <ScoutPage />
                  </LazyRoute>
                </RequireAuth>
              }
            />
            <Route
              path="/teams/:teamId/awards"
              element={
                <RequireAuth>
                  <LazyRoute what="awards">
                    <AwardsPage scope="season" />
                  </LazyRoute>
                </RequireAuth>
              }
            />
            <Route
              path="/teams/:teamId/matches/:matchId/awards"
              element={
                <RequireAuth>
                  <LazyRoute what="awards">
                    <AwardsPage scope="match" />
                  </LazyRoute>
                </RequireAuth>
              }
            />
          </Routes>
        </NoticeProvider>
        </I18nProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
