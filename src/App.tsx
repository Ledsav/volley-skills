import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './auth/LoginPage';
import { FinishSignInPage } from './auth/FinishSignInPage';
import { TeamsListPage } from './teams/TeamsListPage';
import { TeamPage } from './teams/TeamPage';
import { PlayerCardPage } from './players/PlayerCardPage';
import { SkillGuidePage } from './skillGuide/SkillGuidePage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/finish-sign-in" element={<FinishSignInPage />} />
          <Route
            path="/teams"
            element={
              <RequireAuth>
                <TeamsListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/teams/:teamId"
            element={
              <RequireAuth>
                <TeamPage />
              </RequireAuth>
            }
          />
          <Route
            path="/teams/:teamId/players/:playerId"
            element={
              <RequireAuth>
                <PlayerCardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/guides"
            element={
              <RequireAuth>
                <SkillGuidePage />
              </RequireAuth>
            }
          />
          <Route path="/" element={<Navigate to="/teams" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
