import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, RefreshCw, LogOut, Trash2, Repeat } from 'lucide-react';
import { getSession, network, resetDemo, setSession } from '../api';
import { StatusPill } from './Console';

const fmt = (iso) => (iso ? new Date(iso).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'medium' }) : '');

/**
 * The platform's own view, for its compliance and operations staff. It shows
 * what no intermediary ever sees: one record per investor with every
 * intermediary's relationship, and a log of what each intermediary was shown.
 * Staff work cases themselves in the FrankieOne Portal.
 */
export default function Platform({ demo }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = () => network().then(setData).catch((e) => setError(e.message));

  useEffect(() => {
    if (getSession()?.role !== 'platform') { navigate('/'); return; }
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = async () => {
    if (!window.confirm('Clear the platform\'s demo records (index, relationships, logs)? FrankieOne records are not deleted.')) return;
    await resetDemo();
    load();
  };

  return (
    <div className="min-h-screen">
      <header className="bg-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-brand" />
            <div>
              <p className="font-semibold">{demo.platform} · Platform operations</p>
              <p className="text-xs text-slate-300">Internal. Never shown to intermediaries.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <button onClick={load} className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white"><RefreshCw className="w-4 h-4" /> Refresh</button>
            <button onClick={reset} className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white"><Trash2 className="w-4 h-4" /> Reset demo</button>
            <button onClick={() => { setSession(null); navigate('/'); }} className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white"><LogOut className="w-4 h-4" /> Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && <p className="text-sm text-red-700">{error}</p>}
        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat label="Intermediaries on the platform" value={data.intermediariesConfigured} />
              <Stat label="With clients" value={data.intermediariesActive} />
              <Stat label="Investor records" value={data.investors.length} hint="one per person" />
              <Stat label="Intermediary relationships" value={data.relationships} />
              <Stat label="Onboardings on a record already held" value={data.reusedOnboardings} />
            </div>

            <h2 className="mt-10 text-lg font-semibold text-slate-900">Investors across the network</h2>
            <p className="text-sm text-slate-500">One FrankieOne record per person. Each intermediary holding them has its own reference, handle and verification.</p>
            <div className="mt-4 space-y-4">
              {data.investors.length === 0 && <p className="text-sm text-slate-400">No investors yet.</p>}
              {data.investors.map((inv) => (
                <div key={inv.entityId} className="bg-white rounded-xl border border-slate-200">
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{inv.name} <span className="font-normal text-slate-500 text-sm">· born {inv.dateOfBirth}</span></p>
                      <p className="text-xs text-slate-400 font-mono">FrankieOne entity {inv.entityId}</p>
                    </div>
                    <span className="text-xs text-slate-500">{inv.relationships.filter((r) => !r.removedAt).length} active {inv.relationships.filter((r) => !r.removedAt).length === 1 ? 'relationship' : 'relationships'}</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="text-xs text-slate-400 uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-5 py-2">Intermediary</th>
                        <th className="text-left px-5 py-2">Their reference</th>
                        <th className="text-left px-5 py-2">Handle they see</th>
                        <th className="text-left px-5 py-2">Workflow</th>
                        <th className="text-left px-5 py-2">Outcome</th>
                        <th className="text-left px-5 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {inv.relationships.map((r) => (
                        <tr key={`${r.intermediaryId}-${r.createdAt}`} className={`border-t border-slate-100 ${r.removedAt ? 'opacity-40' : ''}`}>
                          <td className="px-5 py-2 text-slate-800">{r.intermediary}</td>
                          <td className="px-5 py-2 font-mono text-xs">{r.clientRef}</td>
                          <td className="px-5 py-2 font-mono text-xs text-slate-500">{r.handle}</td>
                          <td className="px-5 py-2 text-xs text-slate-500">{r.workflow}</td>
                          <td className="px-5 py-2"><StatusPill status={r.status} /> <span className="text-xs text-slate-400 ml-1">{r.workflowStatus}</span></td>
                          <td className="px-5 py-2 text-xs text-slate-500">
                            {r.removedAt ? 'Left' : r.reusedRecord ? <span className="inline-flex items-center gap-1"><Repeat className="w-3 h-3" /> Record already held</span> : 'New to the network'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            <div className="mt-10 grid md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Disclosure log</h2>
                <p className="text-sm text-slate-500">What each intermediary was shown, and when.</p>
                <div className="mt-3 bg-white rounded-xl border border-slate-200 max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <tbody>
                      {data.disclosures.map((d, i) => (
                        <tr key={i} className="border-t border-slate-100 first:border-0">
                          <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmt(d.at)}</td>
                          <td className="px-3 py-2 text-slate-700">{d.intermediary}</td>
                          <td className="px-3 py-2 font-mono text-slate-500">{d.handle}</td>
                          <td className="px-3 py-2 text-slate-500">{d.action}</td>
                          <td className="px-3 py-2 text-slate-400">{d.fields.length} fields</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Policies</h2>
                <dl className="mt-3 bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-2 gap-y-2 text-sm">
                  <dt className="text-slate-500">Minimum response time</dt><dd>{data.policy.minResponseMs / 1000} s</dd>
                  <dt className="text-slate-500">Submissions per intermediary</dt><dd>{data.policy.ratePerMinute} a minute</dd>
                  <dt className="text-slate-500">Evidence reuse window</dt><dd>{data.policy.reuseWindowDays} days</dd>
                  <dt className="text-slate-500">Concurrent FrankieOne calls</dt><dd>{data.policy.maxConcurrent}, shared fairly</dd>
                  <dt className="text-slate-500">Identity index</dt><dd>{data.indexKeys} hashed keys</dd>
                </dl>
                <h3 className="mt-5 text-sm font-semibold text-slate-700">Fields an intermediary may receive</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {data.permittedFields.map((f) => <span key={f} className="text-xs font-mono bg-white border border-slate-200 rounded px-2 py-0.5">{f}</span>)}
                </div>
                <p className="mt-2 text-xs text-slate-500">Responses are built from this list, so a new field in FrankieOne's response never reaches an intermediary until it's added here.</p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-2xl font-bold text-navy">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
