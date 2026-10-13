import { useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { Plus, RefreshCw, Users } from 'lucide-react';
import { Avatar, Empty, ListToolbar, Loading, StatusPill, TopBar, ago, btn, td, th } from '../../components/ui';

export const subtitle = (c) => (c.kind === 'BUSINESS'
  ? `${c.businessType || 'Business'} · ${c.people?.length || 0} ${c.people?.length === 1 ? 'person' : 'people'}`
  : 'Individual');

export default function Clients() {
  const { im, clients, reload } = useOutletContext();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [view, setView] = useState('ALL');

  const count = (s) => (clients || []).filter((c) => c.status === s).length;
  const views = [
    ['ALL', 'All clients', clients?.length],
    ['ACTION_REQUIRED', 'Action required', count('ACTION_REQUIRED')],
    ['IN_REVIEW', 'In review', count('IN_REVIEW')],
    ['VERIFIED', 'Verified', count('VERIFIED')],
    ['DECLINED', 'Declined', count('DECLINED')],
  ];
  const shown = useMemo(() => (clients || [])
    .filter((c) => view === 'ALL' || c.status === view)
    .filter((c) => !q || `${c.name} ${c.clientRef}`.toLowerCase().includes(q.toLowerCase())), [clients, q, view]);

  return (
    <>
      <TopBar crumbs={[{ label: 'Clients' }]} actions={<>
        <button onClick={reload} title="Refresh" className={btn.ghost}><RefreshCw className="w-4 h-4" /></button>
        <Link to="/console/onboard" className={btn.primary}><Plus className="w-4 h-4" /> New client</Link>
      </>} />
      <ListToolbar views={views} value={view} onChange={setView} search={q} onSearch={setQ} placeholder="Search name or reference" />
      <div className="flex-1 min-h-0 overflow-auto">
        {!clients ? <Loading /> : shown.length === 0 ? (
          clients.length ? <Empty title="No clients in this view" /> : <Empty icon={Users} title="No clients yet">Add your first client with New client.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Type</th>
                <th className={th}>Status</th>
                <th className={th}>Risk</th>
                <th className={th}>Reference</th>
                <th className={th}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.handle} onClick={() => navigate(`/console/clients/${c.handle}`)} className="cursor-pointer hover:bg-slate-50">
                  <td className={td}>
                    <span className="flex items-center gap-2.5"><Avatar name={c.name} kind={c.kind} /><span className="font-medium text-slate-900">{c.name}</span></span>
                  </td>
                  <td className={`${td} text-slate-600`}>{c.kind === 'BUSINESS' ? `${c.businessType} · ${c.people?.length} people` : 'Individual'}</td>
                  <td className={td}><StatusPill status={c.status} /></td>
                  <td className={`${td} text-slate-600`}>{c.riskBand}</td>
                  <td className={`${td} font-mono text-slate-600`}>{c.clientRef}</td>
                  <td className={`${td} text-slate-500`}>{ago(c.updatedAt || c.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
