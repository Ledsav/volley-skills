import { lazy, Suspense, type ReactNode } from 'react';
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
import { MinimalShell } from './layout/MinimalShell';
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
import { HomePage } from './home/HomePage';
import { MatchPage } from './matches/MatchPage';

const DiagramEditorPage = lazy(() =>
  import('./diagrams/DiagramEditorPage').then((m) => ({ default: m.DiagramEditorPage })),
);

// Dev-only: the guard is a build-time constant, so production bundles drop the gallery entirely.
const UiGallery = import.meta.env.DEV ? lazy(() => import('./dev/UiGallery')) : null;

const AwardsPage = lazy(() => import('./awards/AwardsPage'));
const ScoutPage = lazy(() => import('./matches/scout/ScoutPage').then((m) => ({ default: m.ScoutPage })));

function LazyFallback({ what }: { what: 'editor' | 'scouting' | 'awards' }) {
  const t = useT();
  return <div className="p-6 text-slate">{t.layout.lazyLoading[what]}</div>;
}

function PlatformShell({ children }: { children: ReactNode }) {
  const t = useT();
  return <MinimalShell title={t.layout.nav.platform}>{children}</MinimalShell>;
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
                path="/exercises/:exerciseId/diagram"
                element={
                  <RequireSection section="exercises">
                    <Suspense fallback={<LazyFallback what="editor" />}>
                      <DiagramEditorPage />
                    </Suspense>
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
            <Route
              path="/teams/:teamId/matches/:matchId/scout"
              element={
                <RequireAuth>
                  <Suspense fallback={<LazyFallback what="scouting" />}>
                    <ScoutPage />
                  </Suspense>
                </RequireAuth>
              }
            />
            <Route
              path="/teams/:teamId/awards"
              element={
                <RequireAuth>
                  <Suspense fallback={<LazyFallback what="awards" />}>
                    <AwardsPage scope="season" />
                  </Suspense>
                </RequireAuth>
              }
            />
            <Route
              path="/teams/:teamId/matches/:matchId/awards"
              element={
                <RequireAuth>
                  <Suspense fallback={<LazyFallback what="awards" />}>
                    <AwardsPage scope="match" />
                  </Suspense>
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
