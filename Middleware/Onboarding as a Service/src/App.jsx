import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { demoSession } from './api';
import Home from './pages/Home';
import ConsoleLayout from './pages/console/Layout';
import Clients from './pages/console/Clients';
import ClientPage from './pages/console/ClientPage';
import Onboard from './pages/console/Onboard';
import { useParams } from 'react-router-dom';
import PlatformLayout from './pages/platform/Layout';
import Record from './pages/platform/Record';
import Branding from './pages/platform/Branding';
import Simulation from './pages/platform/Simulation';
import { ActivityLog, Decisions, Disclosures, Merges, Policies, Records } from './pages/platform/pages';

// A fresh client page per client, so nothing carries over when moving between them.
function KeyedClientPage() { const { handle } = useParams(); return <ClientPage key={handle} />; }

export default function App() {
  const [demo, setDemo] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { demoSession().then(setDemo).catch((e) => setError(e.message)); }, []);

  return (
    <BrowserRouter>
      <div className="h-screen flex flex-col">
      <div className="h-6 shrink-0 bg-amber-300 text-amber-950 text-[11px] font-medium flex items-center justify-center">
        Connected to {demo?.envLabel || '…'} · Demo: every brand here is a placeholder
      </div>
      <div className="flex-1 min-h-0">
        {error && <p className="m-6 text-sm text-red-700">The platform server isn't reachable: {error}. Start it with npm run dev.</p>}
        {demo && (
          <Routes>
            <Route path="/" element={<div className="h-full overflow-y-auto bg-[#f6f7f9]"><Home demo={demo} /></div>} />
            <Route path="/console" element={<ConsoleLayout demo={demo} />}>
              <Route index element={<Clients />} />
              <Route path="onboard" element={<Onboard />} />
              <Route path="clients/:handle" element={<KeyedClientPage />} />
            </Route>
            <Route path="/platform" element={<PlatformLayout demo={demo} />}>
              <Route index element={<Records />} />
              <Route path="decisions" element={<Decisions />} />
              <Route path="records" element={<Navigate to="/platform" replace />} />
              <Route path="records/:entityId" element={<Record />} />
              <Route path="activity" element={<ActivityLog />} />
              <Route path="merges" element={<Merges />} />
              <Route path="disclosures" element={<Disclosures />} />
              <Route path="policies" element={<Policies />} />
              <Route path="branding" element={<Branding />} />
              <Route path="simulation" element={<Simulation />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </div>
      </div>
    </BrowserRouter>
  );
}
