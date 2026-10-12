import { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Activity, Ban, Database, Eye, FlaskConical, GitMerge, LogOut, Palette, Scale, Settings2, ShieldCheck, Trash2 } from 'lucide-react';
import { getSession, network, platformMe, resetDemo, setSession } from '../../api';
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
  const [me, setMe] = useState(null);
  const load = useCallback(() => network().then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)), []);

  useEffect(() => {
    if (getSession()?.role !== 'platform') { navigate('/'); return undefined; }
    load();
    platformMe().then(setMe).catch(() => { setSession(null); navigate('/'); });
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
      {me && !collapsed && (
        <div className="px-2.5 pb-2 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[10px] font-semibold flex items-center justify-center">{me.name.split(' ').map((w) => w[0]).join('')}</span>
          <span className="min-w-0"><span className="block text-[12px] text-slate-900 truncate">{me.name}</span><span className="block text-[11px] text-slate-500 truncate">{me.role}</span></span>
        </div>
      )}
      <SideButton collapsed={collapsed} icon={Trash2} onClick={reset}>Reset demo</SideButton>
      <SideButton collapsed={collapsed} icon={LogOut} onClick={() => { setSession(null); navigate('/'); }}>Sign out</SideButton>
    </>
  );
  return (
    <Shell brand={brand} footer={footer} nav={[
      { to: '/platform', label: 'Records', icon: Database, end: true },
      { to: '/platform/decisions', label: 'Decisions', icon: Scale, badge: data?.reviews.length || null,
        badgeTone: data?.reviews.some((r) => Date.now() - Date.parse(r.at) >= data.policy.decisionTargetMinutes * 60000) ? 'red' : null },
      { to: '/platform/activity', label: 'Activity', icon: Activity },
      { to: '/platform/merges', label: 'Merges', icon: GitMerge },
      { to: '/platform/blocklist', label: 'Blocklist', icon: Ban, badge: data?.blocklist?.length || null },
      { to: '/platform/disclosures', label: 'Disclosure log', icon: Eye },
      { to: '/platform/simulation', label: 'Simulation', icon: FlaskConical },
      { to: '/platform/branding', label: 'Branding', icon: Palette },
      { to: '/platform/policies', label: 'Policies', icon: Settings2 },
    ]}>
      {error && <p className="px-5 pt-3 text-[13px] text-red-700">{error}</p>}
      <Outlet context={{ data, reload: load, demo, me }} />
    </Shell>
  );
}
