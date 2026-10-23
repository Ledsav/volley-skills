import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { NoticeProvider } from './components/Notice';
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
import { ClubAreaPage } from './clubs/area/ClubAreaPage';
import { RequestAccessPage } from './interest/RequestAccessPage';
import { NotFoundPage } from './layout/NotFoundPage';
import { HomePage } from './home/HomePage';
import { MatchPage } from './matches/MatchPage';

const DiagramEditorPage = lazy(() =>
  import('./diagrams/DiagramEditorPage').then((m) => ({ default: m.DiagramEditorPage })),
);

const AwardsPage = lazy(() => import('./awards/AwardsPage'));
const ScoutPage = lazy(() => import('./matches/scout/ScoutPage').then((m) => ({ default: m.ScoutPage })));

function AuthenticatedLayout() {
  return (
    <RequireAuth>
      <AppShell>
        <Outlet />
      </AppShell>
    </RequireAuth>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
            <Route
              path="/platform"
              element={
                <RequirePlatformAdmin>
                  <MinimalShell title="Platform">
                    <PlatformPage />
                  </MinimalShell>
                </RequirePlatformAdmin>
              }
            />
            {/* Leads moved to the operator's platform page. */}
            <Route path="/admin/interest" element={<Navigate to="/platform?tab=leads" replace />} />
            <Route element={<AuthenticatedLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/teams" element={<TeamsListPage />} />
              <Route path="/settings" element={<SettingsPage />} />
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
                    <Suspense fallback={<div className="p-6 text-slate">Loading editor…</div>}>
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
                  <Suspense fallback={<div className="p-6 text-slate">Loading scouting…</div>}>
                    <ScoutPage />
                  </Suspense>
                </RequireAuth>
              }
            />
            <Route
              path="/teams/:teamId/awards"
              element={
                <RequireAuth>
                  <Suspense fallback={<div className="p-6 text-slate">Loading awards…</div>}>
                    <AwardsPage scope="season" />
                  </Suspense>
                </RequireAuth>
              }
            />
            <Route
              path="/teams/:teamId/matches/:matchId/awards"
              element={
                <RequireAuth>
                  <Suspense fallback={<div className="p-6 text-slate">Loading awards…</div>}>
                    <AwardsPage scope="match" />
                  </Suspense>
                </RequireAuth>
              }
            />
          </Routes>
        </NoticeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
