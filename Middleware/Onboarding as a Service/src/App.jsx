import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { demoSession } from './api';
import Home from './pages/Home';
import ConsoleLayout from './pages/console/Layout';
import Clients from './pages/console/Clients';
import ClientPage from './pages/console/ClientPage';
import Onboard from './pages/console/Onboard';
import PlatformLayout from './pages/platform/Layout';
import Record from './pages/platform/Record';
import { ActivityLog, Decisions, Disclosures, Merges, Overview, Policies, Records } from './pages/platform/pages';

export default function App() {
  const [demo, setDemo] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { demoSession().then(setDemo).catch((e) => setError(e.message)); }, []);

  return (
    <BrowserRouter>
      <div className="fixed top-0 inset-x-0 z-50 h-6 bg-amber-300 text-amber-950 text-[11px] font-medium flex items-center justify-center">
        Connected to {demo?.envLabel || '…'} · Demo: every brand here is a placeholder
      </div>
      <div className="pt-6 min-h-screen">
        {error && <p className="m-6 text-sm text-red-700">The platform server isn't reachable: {error}. Start it with npm run dev.</p>}
        {demo && (
          <Routes>
            <Route path="/" element={<Home demo={demo} />} />
            <Route path="/console" element={<ConsoleLayout demo={demo} />}>
              <Route index element={<Clients />} />
              <Route path="onboard" element={<Onboard />} />
              <Route path="clients/:handle" element={<ClientPage />} />
            </Route>
            <Route path="/platform" element={<PlatformLayout demo={demo} />}>
              <Route index element={<Overview />} />
              <Route path="decisions" element={<Decisions />} />
              <Route path="records" element={<Records />} />
              <Route path="records/:entityId" element={<Record />} />
              <Route path="activity" element={<ActivityLog />} />
              <Route path="merges" element={<Merges />} />
              <Route path="disclosures" element={<Disclosures />} />
              <Route path="policies" element={<Policies />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </div>
    </BrowserRouter>
  );
}
