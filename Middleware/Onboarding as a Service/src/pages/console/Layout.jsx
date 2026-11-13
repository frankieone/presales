import { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, UserPlus, Users } from 'lucide-react';
import { demoPeople, getSession, listClients, me, setSession } from '../../api';
import { BrandLogo, Shell, SideButton, themeStyle } from '../../components/ui';

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

  // White label: the intermediary's name in the tab, its logo as the icon, its theme on everything.
  useEffect(() => {
    if (!im) return undefined;
    const b = im.brand;
    const before = document.title;
    document.title = `${b.displayName} · Clients`;
    const icon = document.querySelector('link[rel="icon"]') || Object.assign(document.head.appendChild(document.createElement('link')), { rel: 'icon' });
    const letter = String(b.displayName || '?')[0].toUpperCase();
    icon.href = b.logoStyle === 'image' && b.logoImage ? b.logoImage
      : `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${b.primary}"/><text x="16" y="22" font-family="Arial" font-weight="700" font-size="17" text-anchor="middle" fill="${themeStyle(b)['--brand-fg']}">${letter}</text></svg>`)}`;
    return () => { document.title = before; };
  }, [im]);

  if (!im) return null;
  const b = im.brand;
  const needAction = (clients || []).filter((c) => c.status === 'ACTION_REQUIRED').length;
  const brand = (collapsed) => (
    <span className="min-w-0 flex flex-col gap-0.5">
      {b.logoStyle === 'monogram' || collapsed ? (
        <span className="flex items-center gap-2 min-w-0">
          <BrandLogo brand={b} compact={collapsed} />
          {!collapsed && <span className="text-[14px] font-semibold text-slate-900 truncate">{b.displayName}</span>}
        </span>
      ) : <BrandLogo brand={b} />}
      {!collapsed && b.tagline && <span className="text-[11px] text-slate-500 truncate">{b.tagline}</span>}
    </span>
  );
  const footer = (collapsed) => (
    <>
      {!collapsed && (b.domain || b.poweredBy) && (
        <div className="px-2.5 pb-2 text-[11px] text-slate-400 space-y-0.5">
          {b.domain && <p className="truncate">{b.domain}</p>}
          {b.poweredBy && <p>Powered by {im.platform}</p>}
        </div>
      )}
      <SideButton collapsed={collapsed} icon={LogOut} onClick={() => { setSession(null); navigate('/'); }}>Sign out</SideButton>
    </>
  );
  return (
    <div className="h-full" style={themeStyle(b)}>
      <Shell brand={brand} footer={footer}
        nav={[
          { to: '/console', label: 'Clients', icon: Users, end: true, badge: needAction || null },
          { to: '/console/onboard', label: 'New client', icon: UserPlus },
        ]}>
        {error && <p className="px-5 pt-3 text-[13px] text-red-700">{error}</p>}
        <Outlet context={{ im, clients, reload, people, demo }} />
      </Shell>
    </div>
  );
}
