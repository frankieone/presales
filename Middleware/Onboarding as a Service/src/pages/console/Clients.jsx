import { useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { Building2, ChevronRight, Info, RefreshCw, Search, User, UserPlus, Users } from 'lucide-react';
import { Callout, Empty, Loading, PageHeader, Stat, StatusPill, ago, btn } from '../../components/ui';

export const subtitle = (c) => (c.kind === 'BUSINESS'
  ? `${c.businessType || 'Business'} · ${c.people?.length || 0} ${c.people?.length === 1 ? 'person' : 'people'}`
  : `Born ${c.dateOfBirth}`);

const FILTERS = [['ALL', 'All'], ['ACTION_REQUIRED', 'Action required'], ['IN_REVIEW', 'In review'], ['VERIFIED', 'Verified'], ['DECLINED', 'Declined']];

export default function Clients() {
  const { im, clients, reload } = useOutletContext();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('ALL');

  const count = (s) => (clients || []).filter((c) => c.status === s).length;
  const shown = useMemo(() => (clients || [])
    .filter((c) => filter === 'ALL' || c.status === filter)
    .filter((c) => !q || `${c.name} ${c.clientRef}`.toLowerCase().includes(q.toLowerCase())), [clients, q, filter]);

  return (
    <>
      <PageHeader
        title="Clients"
        description={`Everyone ${im.name} has onboarded through ${im.platform}. Open a client to see their verification, documents and history.`}
        actions={<>
          <button onClick={reload} className={btn.secondary}><RefreshCw className="w-4 h-4" /> Refresh</button>
          <Link to="/console/onboard" className={btn.primary} style={{ background: im.colour }}><UserPlus className="w-4 h-4" /> Onboard a client</Link>
        </>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Clients" value={clients?.length ?? '—'} />
        <Stat label="Verified" value={count('VERIFIED')} tone="green" />
        <Stat label="Need your action" value={count('ACTION_REQUIRED')} tone={count('ACTION_REQUIRED') ? 'amber' : undefined} />
        <Stat label="In review" value={count('IN_REVIEW')} />
      </div>

      <div className="mt-8 bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between border-b border-slate-100">
          <div className="flex gap-1 overflow-x-auto">
            {FILTERS.map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${filter === k ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>
            ))}
          </div>
          <label className="relative sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or reference"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:bg-white" />
          </label>
        </div>

        {!clients ? <Loading /> : shown.length === 0 ? (
          clients.length === 0
            ? <Empty icon={Users} title="No clients yet">Onboard your first client to get started. It takes about ten seconds.</Empty>
            : <Empty icon={Search} title="No matching clients" />
        ) : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead>
              <tr className="text-left text-[13px] text-slate-500">
                <th className="font-medium px-5 py-3">Client</th>
                <th className="font-medium px-5 py-3 hidden md:table-cell">Your reference</th>
                <th className="font-medium px-5 py-3">Status</th>
                <th className="font-medium px-5 py-3 hidden sm:table-cell">Risk</th>
                <th className="font-medium px-5 py-3 hidden lg:table-cell">Updated</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.handle} onClick={() => navigate(`/console/clients/${c.handle}`)} className="border-t border-slate-100 hover:bg-slate-50/70 cursor-pointer">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                        {c.kind === 'BUSINESS' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-slate-900 truncate">{c.name}</p>
                        <p className="text-[13px] text-slate-500">{subtitle(c)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600 font-mono whitespace-nowrap hidden md:table-cell">{c.clientRef}</td>
                  <td className="px-5 py-4"><StatusPill status={c.status} /></td>
                  <td className="px-5 py-4 text-sm text-slate-600 hidden sm:table-cell">{c.riskBand}</td>
                  <td className="px-5 py-4 text-sm text-slate-500 hidden lg:table-cell">{ago(c.updatedAt || c.completedAt)}</td>
                  <td className="pr-4 text-slate-300"><ChevronRight className="w-4 h-4" /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      <div className="mt-6">
        <Callout icon={Info}>
          You only see your own clients, under your own reference. You can't see FrankieOne, or whether anyone else on {im.platform} also deals with a client.
          Your own systems can do everything here through the API, starting with <code className="text-[13px] bg-white border border-slate-200 px-1.5 py-0.5 rounded">POST /api/v1/clients</code>.
        </Callout>
      </div>
    </>
  );
}
