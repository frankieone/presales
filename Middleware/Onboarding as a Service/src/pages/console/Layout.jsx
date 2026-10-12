import { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Building2, LogOut, UserPlus, Users } from 'lucide-react';
import { demoPeople, getSession, listClients, me, setSession } from '../../api';
import { Shell, SideButton } from '../../components/ui';

/**
 * The intermediary console: what a broker or adviser on the platform works
 * in. It shows only this intermediary's clients, by its own handle and
 * reference, with nothing about other intermediaries or FrankieOne.
 */
export default function ConsoleLayout({ demo }) {
  const navigate = useNavigate();
  const [im, setIm] = useState(null);
  const [clients, setClients] = useState(null);
  const [people, setPeople] = useState([]);
  const [error, setError] = useState('');

  const reload = useCallback(() => listClients().then((r) => setClients(r.clients)).catch((e) => setError(e.message)), []);
  useEffect(() => {
    if (getSession()?.role !== 'intermediary') { navigate('/'); return; }
    me().then(setIm).catch(() => navigate('/'));
    demoPeople().then((r) => setPeople(r.people)).catch(() => {});
    reload();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!im) return null;
  const brand = (
    <div className="flex items-center gap-3">
      <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: im.colour }}>
        <Building2 className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-slate-900 truncate">{im.name}</p>
        <p className="text-xs text-slate-500">Client onboarding</p>
      </div>
    </div>
  );
  const footer = (
    <>
      <p className="px-3 pb-3 text-xs text-slate-400">Powered by {im.platform}</p>
      <SideButton icon={LogOut} onClick={() => { setSession(null); navigate('/'); }}>Sign out</SideButton>
    </>
  );
  return (
    <Shell brand={brand} footer={footer} nav={[
      { to: '/console', label: 'Clients', icon: Users, end: true },
      { to: '/console/onboard', label: 'Onboard a client', icon: UserPlus },
    ]}>
      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}
      <Outlet context={{ im, clients, reload, people, demo }} />
    </Shell>
  );
}
