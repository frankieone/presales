import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, X, ShieldCheck, RefreshCw, LogOut, Trash2, Repeat, GitMerge, AlertTriangle, Undo2, Loader2, Activity, Building2, User } from 'lucide-react';
import { decideReview, forgetIndex, getSession, network, resetDemo, reverseMerge, setSession, getEntityFile } from '../api';
import { Documents, History, Risk, Verifications, printFile } from '../components/ClientFile';
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

  const [busy, setBusy] = useState('');
  const [openFile, setOpenFile] = useState(null);
  const act = async (key, fn) => {
    setBusy(key); setError('');
    try { await fn(); await load(); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

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
              <Stat label="Onboardings on a record already held" value={data.reusedOnboardings} hint={data.reviews.length ? `${data.reviews.length} awaiting a decision` : undefined} />
            </div>

            <h2 className="mt-10 text-lg font-semibold text-slate-900 flex items-center gap-2"><Activity className="w-5 h-5 text-brand" /> What the platform did</h2>
            <p className="text-sm text-slate-500">Each submission and decision, step by step: what the platform decided itself, and what it asked FrankieOne to do. Updates every few seconds.</p>
            <div className="mt-3 space-y-3">
              {data.activity.length === 0 && <p className="text-sm text-slate-400">Nothing yet. Onboard a client as an intermediary, in another tab.</p>}
              {data.activity.slice(0, 6).map((a) => (
                <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium text-slate-900">{a.title} <span className="font-mono text-xs text-slate-400">{a.clientRef}</span></p>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{fmt(a.at)}</span>
                  </div>
                  <ol className="mt-2 space-y-1.5">
                    {a.steps.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className={`mt-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${s.kind === 'frankieone' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                          {s.kind === 'frankieone' ? 'FrankieOne' : 'Platform'}
                        </span>
                        <span className="text-slate-600">{s.text}</span>
                      </li>
                    ))}
                  </ol>
                  {a.result && <p className="mt-2 text-xs text-slate-500">Result: {a.result}</p>}
                </div>
              ))}
            </div>

            {data.reviews.length > 0 && (
              <>
                <h2 className="mt-10 text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" /> Needs a decision
                </h2>
                <p className="text-sm text-slate-500">The identity index didn't recognise these submissions, but a possible match was found in the network: by FrankieOne's duplicate check for people, or by name and postcode for a business with no ABN or ACN. They didn't meet the merge policy, so a person decides. The intermediary sees only that the application is in review.</p>
                {data.reviews.map((rv) => (
                  <div key={rv.id} className="mt-4 bg-white rounded-xl border border-amber-200">
                    <div className="px-5 py-3 border-b border-slate-100 text-sm text-slate-600">
                      Possible {rv.kind === 'business' ? 'same business' : 'duplicate'} · submitted by <span className="font-medium text-slate-900">{rv.intermediary}</span> · {fmt(rv.at)}
                    </div>
                    {rv.candidates.map((c) => (
                      <div key={c.entityId} className="grid md:grid-cols-2 gap-0 border-b border-slate-100 last:border-0">
                        <Side title="New submission" person={rv.submitted} entityId={rv.newEntityId} heldBy={[rv.intermediary]} />
                        <div className="border-t md:border-t-0 md:border-l border-slate-100">
                          <Side title="Record already held" person={c} entityId={c.entityId} heldBy={c.heldBy} />
                          <div className="px-5 pb-4">
                            <p className="text-xs text-slate-500">Matched on</p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {c.matchedOn.map((f) => <span key={f} className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded px-2 py-0.5">{f.replace(/_/g, ' ').toLowerCase()}</span>)}
                            </div>
                            <p className="mt-2 text-xs text-slate-400">Rules: {c.rules.join(', ').replace(/_\+_/g, ' + ').replace(/_/g, ' ')}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="px-5 py-3 flex gap-2 justify-end bg-slate-50 rounded-b-xl">
                      <button disabled={!!busy} onClick={() => act(rv.id, () => decideReview(rv.id, 'different'))}
                        className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white">{rv.kind === 'business' ? 'Different businesses' : 'Different people'}</button>
                      <button disabled={!!busy} onClick={() => act(rv.id, () => decideReview(rv.id, 'merge', rv.candidates[0].entityId))}
                        className="px-3 py-2 rounded-lg bg-navy text-white text-sm inline-flex items-center gap-1.5">
                        {busy === rv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />} {rv.kind === 'business' ? 'Same business' : 'Same person'}: merge
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            <h2 className="mt-10 text-lg font-semibold text-slate-900">Investors across the network</h2>
            <p className="text-sm text-slate-500">One FrankieOne record per person or business. Each intermediary holding them has its own reference, handle and verification. A person behind a business client is held in that role, on the same record as when they're a client in their own right.</p>
            <div className="mt-4 space-y-4">
              {data.investors.length === 0 && <p className="text-sm text-slate-400">No investors yet.</p>}
              {data.investors.map((inv) => (
                <div key={inv.entityId} className="bg-white rounded-xl border border-slate-200">
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                        {inv.entityType === 'ORGANIZATION' ? <Building2 className="w-4 h-4 text-slate-400" /> : <User className="w-4 h-4 text-slate-400" />}
                        {inv.name}
                        <span className="font-normal text-slate-500 text-sm">· {inv.entityType === 'ORGANIZATION' ? `${inv.businessType}, ${inv.registration || 'no ABN or ACN'}` : `born ${inv.dateOfBirth}`}</span>
                      </p>
                      <p className="text-xs text-slate-400 font-mono">FrankieOne {inv.entityType === 'ORGANIZATION' ? 'organisation' : 'entity'} {inv.entityId}</p>
                    </div>
                    <span className="text-xs text-slate-500 text-right">
                      <button onClick={() => setOpenFile(inv)} className="mb-1 px-2.5 py-1 rounded-md border border-slate-300 text-xs text-slate-700 inline-flex items-center gap-1.5 hover:bg-slate-50">
                        <FolderOpen className="w-3.5 h-3.5" /> Client file
                      </button><br />
                      {inv.relationships.filter((r) => !r.removedAt).length} active {inv.relationships.filter((r) => !r.removedAt).length === 1 ? 'relationship' : 'relationships'}
                      {inv.entityType !== 'ORGANIZATION' && <button title="Presenter tool: drop this record's identity index entries, as if the client had never been indexed. The next submission then relies on FrankieOne's duplicate check."
                        onClick={() => act(`f-${inv.entityId}`, () => forgetIndex(inv.entityId))} className="block ml-auto mt-0.5 text-[11px] text-slate-400 hover:text-slate-700 underline decoration-dotted">
                        {busy === `f-${inv.entityId}` ? 'Dropping…' : 'Drop index entry'}
                      </button>}
                    </span>
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
                          <td className="px-5 py-2 text-slate-800">
                            {r.intermediary}
                            {r.role && <p className="text-xs text-slate-500">{r.role} of {r.business}</p>}
                          </td>
                          <td className="px-5 py-2 font-mono text-xs">{r.clientRef}</td>
                          <td className="px-5 py-2 font-mono text-xs text-slate-500">{r.handle}</td>
                          <td className="px-5 py-2 text-xs text-slate-500">{r.workflow || (inv.entityType === 'ORGANIZATION' ? 'No register check' : '—')}</td>
                          <td className="px-5 py-2"><StatusPill status={r.status} /> <span className="text-xs text-slate-400 ml-1">{r.workflowStatus}</span></td>
                          <td className="px-5 py-2 text-xs text-slate-500">
                            {r.removedAt ? 'Left'
                              : r.reviewId ? <span className="text-amber-700">Possible duplicate</span>
                              : r.mergedFrom ? <span className="inline-flex items-center gap-1"><GitMerge className="w-3 h-3" /> Merged in</span>
                              : r.reusedRecord ? <span className="inline-flex items-center gap-1"><Repeat className="w-3 h-3" /> Record already held</span>
                              : 'New to the network'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {data.merges.length > 0 && (
              <>
                <h2 className="mt-10 text-lg font-semibold text-slate-900">Merges</h2>
                <p className="text-sm text-slate-500">Every merge records its reason, and can be reversed. Reversing restores the retired record and re-runs that intermediary's verification on it.</p>
                <div className="mt-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {data.merges.map((m) => (
                        <tr key={m.id} className={`border-t border-slate-100 first:border-0 ${m.reversedAt ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmt(m.at)}</td>
                          <td className="px-4 py-3 text-slate-800">{m.intermediary}</td>
                          <td className="px-4 py-3 text-xs"><span className={`px-2 py-0.5 rounded ${m.decidedBy === 'Compliance' ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-700'}`}>{m.decidedBy}</span></td>
                          <td className="px-4 py-3 text-xs text-slate-500">{m.reason}</td>
                          <td className="px-4 py-3 text-right">
                            {m.reversedAt ? <span className="text-xs text-slate-400">Reversed</span> : (
                              <button disabled={!!busy} onClick={() => act(m.id, () => reverseMerge(m.id))} className="text-xs px-2.5 py-1 rounded border border-slate-300 inline-flex items-center gap-1">
                                {busy === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />} Reverse
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

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
                  <dt className="text-slate-500">Minimum response time</dt><dd>{data.policy.minResponseMs / 1000} s, businesses {data.policy.minBusinessResponseMs / 1000} s</dd>
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
      {openFile && <EntityFile inv={openFile} onClose={() => setOpenFile(null)} />}
    </div>
  );
}

function Side({ title, person, entityId, heldBy }) {
  return (
    <div className="px-5 py-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
      <p className="mt-1 font-semibold text-slate-900">{person?.name}</p>
      {person?.dateOfBirth ? <p className="text-sm text-slate-600">Born {person.dateOfBirth}</p> : <p className="text-sm text-slate-600">No ABN or ACN</p>}
      {person?.document && <p className="text-sm text-slate-600">{person.document.type.replace(/_/g, ' ').toLowerCase()} ending {person.document.last4}</p>}
      <p className="mt-1 text-xs text-slate-400">Held by {heldBy?.filter(Boolean).join(', ') || '—'} · <span className="font-mono">{entityId?.slice(0, 8)}</span></p>
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

const FILE_TABS = [['verifications', 'Verifications'], ['risk', 'Risk'], ['documents', 'Documents'], ['history', 'Audit history'], ['holders', 'Held by']];

/**
 * The platform's full client file: every run on the record and who it was
 * for, the full risk assessment with scores, every document, and the whole
 * FrankieOne audit trail. Intermediaries only ever see their own slice.
 */
function EntityFile({ inv, onClose }) {
  const [file, setFile] = useState(null);
  const [tab, setTab] = useState('verifications');
  const [error, setError] = useState('');
  useEffect(() => { getEntityFile(inv.entityId).then(setFile).catch((e) => setError(e.message)); }, [inv.entityId]);
  const attachmentPath = (d, a) => `/internal/entities/${inv.entityId}/documents/${d.documentId}/attachments/${a.attachmentId}`;
  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex justify-end">
      <div className="bg-white w-full max-w-3xl h-full overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 px-6 pt-8 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{inv.name}</h2>
              <p className="text-xs text-slate-400 font-mono">FrankieOne {inv.entityType === 'ORGANIZATION' ? 'organisation' : 'entity'} {inv.entityId}{file?.state ? ` · ${file.state}` : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <button disabled={!file} onClick={() => printFile(file, { title: `Client file: ${inv.name}`, subtitle: `Platform compliance view · FrankieOne record ${inv.entityId}`, full: true })}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs disabled:opacity-50">Client file (PDF)</button>
              <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
          </div>
          <nav className="mt-4 flex gap-4 text-sm">
            {FILE_TABS.map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`pb-2 border-b-2 ${tab === k ? 'border-slate-900 text-slate-900 font-medium' : 'border-transparent text-slate-500'}`}>{label}</button>
            ))}
          </nav>
        </div>
        <div className="p-6">
          {error && <p className="text-sm text-red-700">{error}</p>}
          {!file && !error && <p className="text-sm text-slate-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading from FrankieOne…</p>}
          {file && tab === 'verifications' && <Verifications items={file.verifications} full />}
          {file && tab === 'risk' && <Risk risk={file.risk} full />}
          {file && tab === 'documents' && <Documents items={file.documents} attachmentPath={attachmentPath} full />}
          {file && tab === 'history' && <History items={file.history} full />}
          {file && tab === 'holders' && (
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-400 uppercase tracking-wide"><tr><th className="text-left py-1">Intermediary</th><th className="text-left py-1">Their reference</th><th className="text-left py-1">Handle</th><th className="text-left py-1">As</th></tr></thead>
              <tbody>
                {file.holders.map((h, i) => (
                  <tr key={i} className={`border-t border-slate-100 ${h.removedAt ? 'opacity-40' : ''}`}>
                    <td className="py-1.5">{h.intermediary}</td><td className="py-1.5 font-mono text-xs">{h.clientRef}</td><td className="py-1.5 font-mono text-xs text-slate-500">{h.handle}</td><td className="py-1.5 text-xs text-slate-500">{h.role || 'Client'}{h.removedAt ? ' (left)' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {file && <p className="mt-6 text-[11px] text-slate-400">FrankieOne's own PDF audit report for this record is generated by the compliance team in the FrankieOne Portal.</p>}
        </div>
      </div>
    </div>
  );
}
