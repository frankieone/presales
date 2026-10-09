import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { demoSession } from './api';
import Home from './pages/Home';
import Console from './pages/Console';
import Platform from './pages/Platform';

export default function App() {
  const [demo, setDemo] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { demoSession().then(setDemo).catch((e) => setError(e.message)); }, []);

  return (
    <BrowserRouter>
      <div className="fixed top-0 inset-x-0 z-50 h-6 bg-amber-400 text-amber-950 text-xs font-medium flex items-center justify-center">
        Connected to {demo?.envLabel || '…'} · Demo — every brand here is a placeholder
      </div>
      <div className="pt-6 min-h-screen">
        {error && <p className="m-6 text-sm text-red-700">The platform server isn't reachable: {error}. Start it with npm run dev.</p>}
        {demo && (
          <Routes>
            <Route path="/" element={<Home demo={demo} />} />
            <Route path="/console" element={<Console demo={demo} />} />
            <Route path="/platform" element={<Platform demo={demo} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </div>
    </BrowserRouter>
  );
}
