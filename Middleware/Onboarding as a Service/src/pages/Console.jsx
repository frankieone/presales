import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Loader2, LogOut, RefreshCw, UserPlus, X, Code2, UserMinus } from 'lucide-react';
import { demoPeople, getClient, getSession, listClients, me, removeClient, setSession, submitClient } from '../api';

const STATUS = {
  VERIFIED: ['Verified', 'bg-green-50 text-green-700 border-green-200'],
  IN_REVIEW: ['In review', 'bg-amber-50 text-amber-700 border-amber-200'],
  ACTION_REQUIRED: ['Action required', 'bg-orange-50 text-orange-700 border-orange-200'],
  DECLINED: ['Declined', 'bg-red-50 text-red-700 border-red-200'],
};

export function StatusPill({ status }) {
  const [label, cls] = STATUS[status] || [status, 'bg-slate-50 text-slate-600 border-slate-200'];
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}

const fmt = (iso) => (iso ? new Date(iso).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/**
 * The intermediary console: what a broker or adviser on the platform works
 * in. It shows only this intermediary's clients, by its own handle and
 * reference, with nothing about other intermediaries or FrankieOne.
 */
export default function Console({ demo }) {
  const navigate = useNavigate();
  const session = getSession();
  const [im, setIm] = useState(null);
  const [clients, setClients] = useState([]);
  const [people, setPeople] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => listClients().then((r) => setClients(r.clients)).catch((e) => setError(e.message)), []);

  useEffect(() => {
    if (session?.role !== 'intermediary') { navigate('/'); return; }
    me().then(setIm).catch(() => navigate('/'));
    demoPeople().then((r) => setPeople(r.people));
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!im) return null;
  const signOut = () => { setSession(null); navigate('/'); };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ background: im.colour }}>
              <Building2 className="w-5 h-5" />
            </span>
            <div>
              <p className="font-semibold text-slate-900">{im.name}</p>
              <p className="text-xs text-slate-500">Client onboarding · powered by {im.platform}</p>
            </div>
          </div>
          <button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1.5">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Your clients</h1>
            <p className="text-sm text-slate-500">{clients.length} {clients.length === 1 ? 'client' : 'clients'}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 inline-flex items-center gap-1.5 hover:bg-white">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg text-white text-sm font-medium inline-flex items-center gap-1.5" style={{ background: im.colour }}>
              <UserPlus className="w-4 h-4" /> Onboard a client
            </button>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-left px-4 py-3">Your reference</th>
                <th className="text-left px-4 py-3">Handle</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Risk</th>
                <th className="text-left px-4 py-3">Completed</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No clients yet. Onboard one to start.</td></tr>
              )}
              {clients.map((c) => (
                <tr key={c.handle} onClick={() => setSelected(c)} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-500">Born {c.dateOfBirth}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{c.clientRef}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.handle}</td>
                  <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{c.riskBand}</td>
                  <td className="px-4 py-3 text-slate-500">{fmt(c.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {showForm && (
        <OnboardForm im={im} people={people} count={clients.length} minResponseMs={demo.minResponseMs}
          onClose={() => setShowForm(false)}
          onDone={(c) => { setShowForm(false); load(); setSelected(c); }} />
      )}
      {selected && (
        <ClientPanel client={selected} onClose={() => setSelected(null)}
          onChanged={(c) => { load(); setSelected(c); }} />
      )}
    </div>
  );
}

function OnboardForm({ im, people, count, minResponseMs, onClose, onDone }) {
  const [pick, setPick] = useState(people[0]?.id || '');
  const [clientRef, setClientRef] = useState(`${im.id.slice(0, 2).toUpperCase()}-${1001 + count}`);
  const [consent, setConsent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const person = people.find((p) => p.id === pick)?.person;

  const submit = async () => {
    setBusy(true); setError('');
    try {
      onDone(await submitClient({ clientRef, consent, person }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Onboard a client</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <label className="block mt-4 text-sm font-medium text-slate-700">Client
          <select value={pick} onChange={(e) => setPick(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
            {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        {person && (
          <div className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-lg p-3 space-y-0.5">
            <p><span className="text-slate-400">Name</span> {[person.givenName, person.middleName, person.familyName].filter(Boolean).join(' ')}</p>
            <p><span className="text-slate-400">Born</span> {person.dateOfBirth}</p>
            <p><span className="text-slate-400">Document</span> {person.document.type.replace(/_/g, ' ').toLowerCase()} {person.document.number}</p>
            <p className="pt-1 text-slate-400">FrankieOne published UAT test identity.</p>
          </div>
        )}
        <label className="block mt-4 text-sm font-medium text-slate-700">Your client reference
          <input value={clientRef} onChange={(e) => setClientRef(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" />
        </label>
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
          The client has consented to identity verification.
        </label>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-slate-400">{busy ? `Every response takes at least ${Math.round(minResponseMs / 1000)} seconds.` : ''}</p>
          <button onClick={submit} disabled={busy || !person}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-60" style={{ background: im.colour }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {busy ? 'Verifying…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientPanel({ client, onClose, onChanged }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showJson, setShowJson] = useState(true);

  const refresh = async () => {
    setBusy('refresh'); setError('');
    try { onChanged(await getClient(client.handle)); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  const remove = async () => {
    setBusy('remove'); setError('');
    try { await removeClient(client.handle); onChanged(null); onClose(); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex justify-end">
      <div className="bg-white w-full max-w-md h-full overflow-y-auto p-6 pt-10">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{client.name}</h2>
            <p className="text-sm text-slate-500">Born {client.dateOfBirth}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-slate-500">Status</dt><dd><StatusPill status={client.status} /></dd>
          <dt className="text-slate-500">Risk band</dt><dd>{client.riskBand}</dd>
          <dt className="text-slate-500">Your reference</dt><dd className="font-mono text-xs">{client.clientRef}</dd>
          <dt className="text-slate-500">Handle</dt><dd className="font-mono text-xs">{client.handle}</dd>
          <dt className="text-slate-500">Method</dt><dd>{client.method}</dd>
          <dt className="text-slate-500">Completed</dt><dd>{fmt(client.completedAt)}</dd>
        </dl>

        {client.actions?.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-slate-700">Actions</h3>
            {client.actions.map((a) => (
              <div key={a.code} className="mt-2 text-sm bg-slate-50 rounded-lg p-3">
                <p className="text-slate-700">{a.message}</p>
                <p className="mt-1 text-xs text-slate-400">{a.owner === 'INTERMEDIARY' ? 'For you to do' : 'With the platform'} · {a.code}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <button onClick={refresh} disabled={!!busy} className="px-3 py-2 rounded-lg border border-slate-300 text-sm inline-flex items-center gap-1.5">
            {busy === 'refresh' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Check status
          </button>
          <button onClick={remove} disabled={!!busy} className="px-3 py-2 rounded-lg border border-slate-300 text-sm inline-flex items-center gap-1.5 text-slate-600">
            {busy === 'remove' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />} Client has left
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        <button onClick={() => setShowJson(!showJson)} className="mt-8 text-xs text-slate-500 inline-flex items-center gap-1.5">
          <Code2 className="w-4 h-4" /> {showJson ? 'Hide' : 'Show'} the API response
        </button>
        {showJson && (
          <>
            <p className="mt-2 text-xs text-slate-500">Everything this intermediary received for this client. No entity ID, no other intermediary, no score, no data source.</p>
            <pre className="mt-2 text-[11px] bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto">{JSON.stringify(client, null, 2)}</pre>
          </>
        )}
      </div>
    </div>
  );
}
