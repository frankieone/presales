import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RiskProvider } from './context/RiskContext';
import { vertical } from './config';
import Layout from './components/Layout';
import RiskSimulator from './components/RiskSimulator';
import EnvBanner from './components/EnvBanner';
import Login from './pages/Login';
import Register from './pages/Register';
import Application from './pages/Application';
import People from './pages/People';
import Overview from './pages/Overview';
import Security from './pages/Security';
import Payments from './pages/Payments';
import Reset from './pages/Reset';
import DeviceCheck from './pages/DeviceCheck';
import MemberConfirm from './pages/MemberConfirm';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/application" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <RiskProvider>
        <BrowserRouter>
          <EnvBanner />
          {/* Clears the fixed environment banner (h-6). */}
          <div className="pt-6">
            <Routes>
              {/* The customer's public website — a separate site from the portal. */}
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/reset" element={<Reset />} />
              {/* Opened on a related person's own phone, from their link. */}
              <Route path="/m/:entityId" element={<MemberConfirm />} />
              <Route path="/device-check/:entityId" element={<DeviceCheck />} />

              <Route path="/application" element={<ProtectedRoute><Application /></ProtectedRoute>} />
              {vertical.people.enabled && (
                <Route path="/people" element={<ProtectedRoute><People /></ProtectedRoute>} />
              )}
              <Route path="/dashboard" element={<ProtectedRoute><Overview /></ProtectedRoute>} />
              <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
              <Route path="/security" element={<ProtectedRoute><Security /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/register" replace />} />
            </Routes>
          </div>
          <RiskSimulator />
        </BrowserRouter>
      </RiskProvider>
    </AuthProvider>
  );
}
