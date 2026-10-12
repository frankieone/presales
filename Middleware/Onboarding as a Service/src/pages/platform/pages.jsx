import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Activity as ActivityIcon, ChevronRight, Database, Eye, GitMerge, Loader2, Scale, Undo2 } from 'lucide-react';
import { decideReview, reverseMerge } from '../../api';
import { Attributes, Avatar, Badge, Body, Empty, ListToolbar, Loading, Panel, StatusPill, TopBar, ago, btn, fmtDateTime, td, th } from '../../components/ui';

const useData = () => useOutletContext();
const docLine = (d) => (d ? `${d.type.replace(/_/g, ' ').toLowerCase()} ····${d.last4}` : '—');

function useAct(reload) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const act = async (key, fn) => {
    setBusy(key); setError('');
    try { await fn(); await reload(); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  return { busy, error, act };
}

// ── records (the landing list) ──────────────────────────────────────
export function Records() {
  const { data } = useData();
  const navigate = useNavigate();
  const [view, setView] = useState('ALL');
  const [q, setQ] = useState('');
  const rows = useMemo(() => (data?.investors || []).map((inv) => {
    const active = inv.relationships.filter((r) => !r.removedAt);
    return { inv, active, holders: [...new Set(active.map((r) => r.intermediary))], latest: [...active].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] };
  }), [data]);
  if (!data) return <><TopBar crumbs={[{ label: 'Records' }]} /><Loading /></>;
  const shown = rows
    .filter((r) => view === 'ALL' || (view === 'SHARED' ? r.holders.length > 1 : r.inv.entityType === view))
    .filter((r) => !q || r.inv.name.toLowerCase().includes(q.toLowerCase()));
  const views = [
    ['ALL', 'All records', rows.length],
    ['INDIVIDUAL', 'People', rows.filter((r) => r.inv.entityType === 'INDIVIDUAL').length],
    ['ORGANIZATION', 'Businesses', rows.filter((r) => r.inv.entityType === 'ORGANIZATION').length],
    ['SHARED', 'Held by more than one', rows.filter((r) => r.holders.length > 1).length],
  ];
  return (
    <>
      <TopBar crumbs={[{ label: 'Records' }]} actions={<span className="text-[13px] text-slate-500">{data.intermediariesConfigured} intermediaries · {data.relationships} relationships</span>} />
      <ListToolbar views={views} value={view} onChange={setView} search={q} onSearch={setQ} placeholder="Search records" />
      <div className="flex-1 min-h-0 overflow-auto">
        {shown.length === 0 ? <Empty icon={Database} title="No records" /> : (
          <table className="w-full">
            <thead><tr>
              <th className={th}>Name</th><th className={th}>Type</th><th className={th}>Held by</th><th className={th}>Latest outcome</th><th className={th}>First onboarded</th>
            </tr></thead>
            <tbody>
              {shown.map(({ inv, active, holders, latest }) => (
                <tr key={inv.entityId} onClick={() => navigate(`/platform/records/${inv.entityId}`)} className="cursor-pointer hover:bg-slate-50">
                  <td className={td}><span className="flex items-center gap-2.5"><Avatar name={inv.name} kind={inv.entityType} /><span className="font-medium text-slate-900">{inv.name}</span></span></td>
                  <td className={`${td} text-slate-600`}>{inv.entityType === 'ORGANIZATION' ? inv.businessType : 'Individual'}</td>
                  <td className={td}>
                    <span className="flex items-center gap-1.5">
                      {holders.map((h) => <Badge key={h}>{h}</Badge>)}
                      {active.length > holders.length && <span className="text-[12px] text-slate-400">+{active.length - holders.length} roles</span>}
                    </span>
                  </td>
                  <td className={td}>{latest && <StatusPill status={latest.status} />}</td>
                  <td className={`${td} text-slate-500`}>{ago(inv.relationships.map((r) => r.createdAt).sort()[0])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── decisions ───────────────────────────────────────────────────────
export function Decisions() {
  const { data, reload } = useData();
  const { busy, error, act } = useAct(reload);
  const [selected, setSelected] = useState(null);
  if (!data) return <><TopBar crumbs={[{ label: 'Decisions' }]} /><Loading /></>;
  const reviews = data.reviews;
  const rv = reviews.find((r) => r.id === selected) || reviews[0];
  return (
    <>
      <TopBar crumbs={[{ label: 'Decisions' }]} />
      {reviews.length === 0 ? <Body><Empty icon={Scale} title="Nothing waiting for a decision">Possible duplicates the merge policy can't settle appear here.</Empty></Body> : (
        <div className="flex-1 min-h-0 flex">
          <ul className="w-80 shrink-0 border-r border-slate-200 overflow-y-auto">
            {reviews.map((r) => (
              <li key={r.id}>
                <button onClick={() => setSelected(r.id)} className={`w-full text-left px-5 py-3 border-b border-slate-100 ${r === rv ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                  <p className="text-[13px] font-medium text-slate-900">{r.submitted?.name}</p>
                  <p className="text-[12px] text-slate-500">{r.kind === 'business' ? 'Same business?' : 'Same person?'} · {r.intermediary} · {ago(r.at)}</p>
                </button>
              </li>
            ))}
          </ul>
          {rv && rv.candidates.map((c) => {
            const biz = rv.kind === 'business';
            const row = (label, a, b) => (
              <tr className="border-t border-slate-100">
                <td className="py-2.5 pr-4 text-[13px] text-slate-500 w-36">{label}</td>
                <td className="py-2.5 pr-4 text-[13px] text-slate-900">{a}</td>
                <td className="py-2.5 text-[13px] text-slate-900">{b}</td>
              </tr>
            );
            return (
              <div key={c.entityId} className="flex-1 min-w-0 overflow-y-auto px-6 py-5">
                <h1 className="text-[18px] font-semibold text-slate-900">Is this the {biz ? 'same business' : 'same person'}?</h1>
                <p className="mt-1 text-[13px] text-slate-500">Matched on {c.matchedOn.map((f) => f.replace(/_/g, ' ').toLowerCase()).join(', ')}, which isn't enough to merge automatically. {rv.intermediary} sees “In review”.</p>
                <table className="mt-5 w-full max-w-3xl">
                  <thead><tr className="text-left text-[12px] text-slate-500"><th className="font-medium pb-2" /><th className="font-medium pb-2">New submission</th><th className="font-medium pb-2">Already on the network</th></tr></thead>
                  <tbody>
                    {row('Name', rv.submitted?.name, c.name)}
                    {!biz && row('Date of birth', rv.submitted?.dateOfBirth, c.dateOfBirth)}
                    {!biz && row('Document', docLine(rv.submitted?.document), docLine(c.document))}
                    {row('Held by', rv.intermediary, c.heldBy?.filter(Boolean).join(', ') || '—')}
                    {row('Reference', <span className="font-mono">{rv.submitted?.clientRef}</span>, '—')}
                    {row('Record', <span className="font-mono text-slate-500">{rv.newEntityId?.slice(0, 8)}</span>, <span className="font-mono text-slate-500">{c.entityId.slice(0, 8)}</span>)}
                  </tbody>
                </table>
                <div className="mt-6 flex gap-2">
                  <button disabled={!!busy} onClick={() => act(rv.id, () => decideReview(rv.id, 'merge', c.entityId))} className={btn.primary}>
                    {busy === rv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />} Same {biz ? 'business' : 'person'}: merge
                  </button>
                  <button disabled={!!busy} onClick={() => act(rv.id, () => decideReview(rv.id, 'different'))} className={btn.secondary}>Different {biz ? 'businesses' : 'people'}</button>
                </div>
                {error && <p className="mt-3 text-[13px] text-red-700">{error}</p>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── activity ────────────────────────────────────────────────────────
export function ActivityLog() {
  const { data } = useData();
  const [open, setOpen] = useState(null);
  if (!data) return <><TopBar crumbs={[{ label: 'Activity' }]} /><Loading /></>;
  const openId = open ?? data.activity[0]?.id;
  return (
    <>
      <TopBar crumbs={[{ label: 'Activity' }]} actions={
        <span className="flex gap-4 text-[12px] text-slate-500">
          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400" /> Platform</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand" /> FrankieOne call</span>
        </span>} />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {data.activity.length === 0 ? <Empty icon={ActivityIcon} title="Nothing yet">Onboard a client as an intermediary in another tab.</Empty> : (
          <ul>
            {data.activity.map((a) => {
              const isOpen = openId === a.id;
              return (
                <li key={a.id} className="border-b border-slate-100">
                  <button onClick={() => setOpen(isOpen ? '' : a.id)} className="w-full h-12 px-5 flex items-center gap-3 text-left hover:bg-slate-50">
                    <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition ${isOpen ? 'rotate-90' : ''}`} />
                    <span className="text-[13px] font-medium text-slate-900 truncate">{a.title}</span>
                    <span className="ml-auto flex items-center gap-4 shrink-0">
                      {a.result && <span className="text-[12px] text-slate-500 hidden md:inline">{a.result}</span>}
                      <span className="w-20 text-right text-[12px] text-slate-400">{ago(a.at)}</span>
                    </span>
                  </button>
                  {isOpen && (
                    <ol className="pl-12 pr-5 pb-4 space-y-2">
                      {a.steps.map((s, i) => (
                        <li key={i} className="flex gap-3 text-[13px] text-slate-700">
                          <span className={`mt-[7px] w-2 h-2 rounded-full shrink-0 ${s.kind === 'frankieone' ? 'bg-brand' : 'bg-slate-400'}`} />
                          <span>{s.text}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

// ── merges ──────────────────────────────────────────────────────────
export function Merges() {
  const { data, reload } = useData();
  const { busy, error, act } = useAct(reload);
  if (!data) return <><TopBar crumbs={[{ label: 'Merges' }]} /><Loading /></>;
  return (
    <>
      <TopBar crumbs={[{ label: 'Merges' }]} />
      {error && <p className="px-5 pt-3 text-[13px] text-red-700">{error}</p>}
      <div className="flex-1 min-h-0 overflow-auto">
        {data.merges.length === 0 ? <Empty icon={GitMerge} title="No merges yet" /> : (
          <table className="w-full">
            <thead><tr><th className={th}>When</th><th className={th}>Intermediary</th><th className={th}>Decided by</th><th className={th}>Reason</th><th className={th} /></tr></thead>
            <tbody>
              {data.merges.map((m) => (
                <tr key={m.id} className={m.reversedAt ? 'opacity-50' : ''}>
                  <td className={`${td} text-slate-500`}>{fmtDateTime(m.at)}</td>
                  <td className={`${td} text-slate-900`}>{m.intermediary}</td>
                  <td className={td}><Badge tone={m.decidedBy === 'Compliance' ? 'slate' : 'blue'}>{m.decidedBy === 'Compliance' ? 'Compliance' : 'Merge policy'}</Badge></td>
                  <td className={`${td} text-slate-600 whitespace-normal`}>{m.reason}</td>
                  <td className={`${td} text-right`}>
                    {m.reversedAt ? <span className="text-[12px] text-slate-400">Reversed</span> : (
                      <button disabled={!!busy} onClick={() => act(m.id, () => reverseMerge(m.id))} className={btn.secondary}>
                        {busy === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />} Reverse
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── disclosures ─────────────────────────────────────────────────────
export function Disclosures() {
  const { data } = useData();
  if (!data) return <><TopBar crumbs={[{ label: 'Disclosure log' }]} /><Loading /></>;
  return (
    <>
      <TopBar crumbs={[{ label: 'Disclosure log' }]} actions={<span className="text-[13px] text-slate-500">What each intermediary was shown</span>} />
      <div className="flex-1 min-h-0 overflow-auto">
        {data.disclosures.length === 0 ? <Empty icon={Eye} title="Nothing shown yet" /> : (
          <table className="w-full">
            <thead><tr><th className={th}>When</th><th className={th}>Intermediary</th><th className={th}>Handle</th><th className={th}>Action</th><th className={th}>Fields</th></tr></thead>
            <tbody>
              {data.disclosures.map((d, i) => (
                <tr key={i}>
                  <td className={`${td} text-slate-500`}>{fmtDateTime(d.at)}</td>
                  <td className={`${td} text-slate-900`}>{d.intermediary}</td>
                  <td className={`${td} font-mono text-slate-500`}>{d.handle}</td>
                  <td className={td}><Badge>{d.action}</Badge></td>
                  <td className={`${td} text-slate-500`} title={d.fields.join(', ')}>{d.fields.length} fields</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── policies ────────────────────────────────────────────────────────
export function Policies() {
  const { data } = useData();
  if (!data) return <><TopBar crumbs={[{ label: 'Policies' }]} /><Loading /></>;
  const p = data.policy;
  return (
    <>
      <TopBar crumbs={[{ label: 'Policies' }]} actions={<span className="text-[13px] text-slate-500">Set in server/config.mjs</span>} />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-2xl">
          <Panel title="Controls">
            <Attributes rows={[
              ['Response time', `At least ${p.minResponseMs / 1000} s (people), ${p.minBusinessResponseMs / 1000} s (businesses)`],
              ['Rate limit', `${p.ratePerMinute} submissions a minute per intermediary`],
              ['Evidence reuse', `${p.reuseWindowDays} days`],
              ['FrankieOne calls', `${p.maxConcurrent} at once, shared fairly`],
              ['Auto-merge', p.autoMergeOnDocumentAndDob ? 'Document and exact date of birth, one candidate' : 'Off'],
              ['Identity index', `${data.indexKeys} hashed keys`],
            ]} />
          </Panel>
          <Panel title="Fields an intermediary can receive" count={data.permittedFields.length}>
            <div className="flex flex-wrap gap-1.5">
              {data.permittedFields.map((f) => <span key={f} className="text-[12px] font-mono bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700">{f}</span>)}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
