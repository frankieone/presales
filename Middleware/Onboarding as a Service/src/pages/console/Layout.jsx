import { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, UserPlus, Users } from 'lucide-react';
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
  const needAction = (clients || []).filter((c) => c.status === 'ACTION_REQUIRED').length;
  const brand = (collapsed) => (
    <>
      <span className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[12px] font-semibold shrink-0" style={{ background: im.colour }}>
        {im.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
      </span>
      {!collapsed && (
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900 truncate">{im.name}</p>
          <p className="text-[11px] text-slate-500 truncate">via {im.platform}</p>
        </div>
      )}
    </>
  );
  return (
    <Shell brand={brand}
      footer={(collapsed) => <SideButton collapsed={collapsed} icon={LogOut} onClick={() => { setSession(null); navigate('/'); }}>Sign out</SideButton>}
      nav={[
        { to: '/console', label: 'Clients', icon: Users, end: true, badge: needAction || null },
        { to: '/console/onboard', label: 'New client', icon: UserPlus },
      ]}>
      {error && <p className="px-5 pt-3 text-[13px] text-red-700">{error}</p>}
      <Outlet context={{ im, clients, reload, people, demo }} />
    </Shell>
  );
}
