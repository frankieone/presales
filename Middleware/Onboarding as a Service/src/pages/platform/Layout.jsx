import { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Activity, Database, Eye, GitMerge, LayoutDashboard, LogOut, RefreshCw, Scale, Settings2, ShieldCheck, Trash2 } from 'lucide-react';
import { getSession, network, resetDemo, setSession } from '../../api';
import { Shell, SideButton } from '../../components/ui';

/**
 * The platform's own view, for its compliance and operations staff. It shows
 * what no intermediary ever sees: one record per investor with every
 * intermediary's relationship, and a log of what each intermediary was shown.
 * Staff work cases themselves in the FrankieOne Portal.
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

  const brand = (
    <div className="flex items-center gap-3">
      <span className="w-10 h-10 rounded-xl bg-brand/15 text-brand flex items-center justify-center shrink-0"><ShieldCheck className="w-5 h-5" /></span>
      <div className="min-w-0">
        <p className="font-semibold text-white truncate">{demo.platform}</p>
        <p className="text-xs text-slate-400">Platform operations</p>
      </div>
    </div>
  );
  const footer = (
    <>
      <p className="px-3 pb-3 text-xs text-slate-500">Internal. Never shown to intermediaries.</p>
      <SideButton dark icon={RefreshCw} onClick={load}>Refresh</SideButton>
      <SideButton dark icon={Trash2} onClick={reset}>Reset demo</SideButton>
      <SideButton dark icon={LogOut} onClick={() => { setSession(null); navigate('/'); }}>Sign out</SideButton>
    </>
  );
  return (
    <Shell dark brand={brand} footer={footer} nav={[
      { to: '/platform', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/platform/decisions', label: 'Needs a decision', icon: Scale, badge: data?.reviews.length },
      { to: '/platform/records', label: 'Records', icon: Database },
      { to: '/platform/activity', label: 'Activity', icon: Activity },
      { to: '/platform/merges', label: 'Merges', icon: GitMerge },
      { to: '/platform/disclosures', label: 'Disclosure log', icon: Eye },
      { to: '/platform/policies', label: 'Policies', icon: Settings2 },
    ]}>
      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}
      <Outlet context={{ data, reload: load, demo }} />
    </Shell>
  );
}
