import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { RequireAdmin } from './auth/RequireAdmin';
import { AppShell } from './layout/AppShell';
import { LoginPage } from './auth/LoginPage';
import { FinishSignInPage } from './auth/FinishSignInPage';
import { TeamsListPage } from './teams/TeamsListPage';
import { TeamPage } from './teams/TeamPage';
import { PlayerCardPage } from './players/PlayerCardPage';
import { GuidesPage } from './admin/GuidesPage';
import { ExercisesPage } from './exercises/ExercisesPage';

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
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/finish-sign-in" element={<FinishSignInPage />} />
          <Route element={<AuthenticatedLayout />}>
            <Route path="/teams" element={<TeamsListPage />} />
            <Route path="/teams/:teamId" element={<TeamPage />} />
            <Route path="/teams/:teamId/players/:playerId" element={<PlayerCardPage />} />
            <Route
              path="/admin/guides"
              element={
                <RequireAdmin>
                  <GuidesPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/exercises"
              element={
                <RequireAdmin>
                  <ExercisesPage />
                </RequireAdmin>
              }
            />
          </Route>
          <Route path="/" element={<Navigate to="/teams" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
