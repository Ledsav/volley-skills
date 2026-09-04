import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './auth/LoginPage';
import { FinishSignInPage } from './auth/FinishSignInPage';

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
                <div>Signed in. Teams list coming in Task 7.</div>
              </RequireAuth>
            }
          />
          <Route path="/" element={<Navigate to="/teams" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
