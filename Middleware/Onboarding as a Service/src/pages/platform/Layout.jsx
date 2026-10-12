import { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Activity, Database, Eye, GitMerge, LogOut, Palette, Scale, Settings2, ShieldCheck, Trash2 } from 'lucide-react';
import { getSession, network, resetDemo, setSession } from '../../api';
import { Shell, SideButton } from '../../components/ui';

/**
 * The platform's own view, for its compliance and operations staff. It shows
 * what no intermediary ever sees: one record per person or business with
 * every intermediary's relationship, decisions, merges and a log of what each
 * intermediary was shown. Staff work cases themselves in the FrankieOne Portal.
 */
export default function PlatformLayout({ demo }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => network().then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)), []);

  useEffect(() => {
    if (getSession()?.role !== 'platform') { navigate('/'); return undefined; }
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = async () => {
    if (!window.confirm("Clear the platform's demo records (index, relationships, logs)? FrankieOne records are not deleted.")) return;
    await resetDemo();
    load();
    navigate('/platform');
  };

  const brand = (collapsed) => (
    <>
      <span className="w-7 h-7 rounded-md bg-navy text-brand flex items-center justify-center shrink-0"><ShieldCheck className="w-4 h-4" /></span>
      {!collapsed && (
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900 truncate">{demo.platform}</p>
          <p className="text-[11px] text-slate-500">Platform operations</p>
        </div>
      )}
    </>
  );
  const footer = (collapsed) => (
    <>
      <SideButton collapsed={collapsed} icon={Trash2} onClick={reset}>Reset demo</SideButton>
      <SideButton collapsed={collapsed} icon={LogOut} onClick={() => { setSession(null); navigate('/'); }}>Sign out</SideButton>
    </>
  );
  return (
    <Shell brand={brand} footer={footer} nav={[
      { to: '/platform', label: 'Records', icon: Database, end: true },
      { to: '/platform/decisions', label: 'Decisions', icon: Scale, badge: data?.reviews.length || null },
      { to: '/platform/activity', label: 'Activity', icon: Activity },
      { to: '/platform/merges', label: 'Merges', icon: GitMerge },
      { to: '/platform/disclosures', label: 'Disclosure log', icon: Eye },
      { to: '/platform/branding', label: 'Branding', icon: Palette },
      { to: '/platform/policies', label: 'Policies', icon: Settings2 },
    ]}>
      {error && <p className="px-5 pt-3 text-[13px] text-red-700">{error}</p>}
      <Outlet context={{ data, reload: load, demo }} />
    </Shell>
  );
}
