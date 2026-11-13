import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CheckCircle2, Circle, Database, Loader2, Play, RotateCcw, Trash2, Zap } from 'lucide-react';
import { clearDemo, decideReview, demoSummary, fillDemo, network, resetDemo, setLiveDemo, setPolicy } from '../../api';
import { Badge, BrandLogo, StatusPill, TopBar, btn } from '../../components/ui';

/**
 * A guided run of the network story: James onboarded by one intermediary,
 * then another, then a third with a different document (so only the
 * duplicate check finds him), and finally the first intermediary re-running
 * checks. Each step calls the same API an intermediary's own system would,
 * and shows what the intermediary saw next to what the platform did.
 */
const STEPS = [
  { id: 'ng', who: 'northgate', title: 'Northgate onboards James Testone', detail: 'Driver licence. New to the network, so the platform creates his record, runs the duplicate check, then Northgate’s workflow.', person: 'testone', ref: 'NG-SIM' },
  { id: 'bw', who: 'bluewave', title: 'Bluewave onboards the same James', detail: 'Same licence, so the identity index recognises him. Bluewave’s reference is added to the same record and the checks Northgate’s run passed are reused.', person: 'testone', ref: 'BW-SIM' },
  { id: 'kw', who: 'kestrel', title: 'Kestrel onboards James with his Medicare card', detail: 'A different document, so the index misses. The platform creates a record and its duplicate-check workflow finds James on name, date of birth and address.', person: 'testone-medicare', ref: 'KW-SIM' },
  { id: 'resolve', who: 'platform', title: 'The platform resolves the duplicate', detail: 'Same person: keep the record already held, retire the new one, move Kestrel’s reference across and reuse the passed checks.' },
  { id: 'rerun', who: 'northgate', title: 'Northgate re-runs checks on James', detail: 'A passed run inside the reuse window already covers Northgate’s workflow, so it is reused. Northgate just sees the result.' },
];

async function asIntermediary(token, method, path, body) {
  const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Request failed (${res.status})`);
  return json;
}

export default function Simulation() {
  const { demo, reload } = useOutletContext();
  const [results, setResults] = useState({});
  const [running, setRunning] = useState('');
  const [auto, setAuto] = useState(false);
  const [error, setError] = useState('');
  const tokenOf = (id) => demo.intermediaries.find((i) => i.id === id)?.token;
  const brandOf = (id) => demo.intermediaries.find((i) => i.id === id)?.brand;
  const people = async () => Object.fromEntries((await (await fetch('/demo/people')).json()).people.map((p) => [p.id, p.person]));

  const latestActivity = async (since) => (await network()).activity.filter((a) => Date.parse(a.at) >= since - 1000);

  const run = async (step) => {
    setRunning(step.id); setError('');
    const started = Date.now();
    try {
      let saw = null;
      let note = null;
      if (step.person) {
        const p = (await people())[step.person];
        saw = await asIntermediary(tokenOf(step.who), 'POST', '/api/v1/clients', { clientRef: step.ref, consent: true, person: p });
      } else if (step.id === 'resolve') {
        const kw = results.kw?.saw;
        const pending = (await network()).reviews.find((r) => r.intermediary === 'Kestrel Wealth');
        if (pending) {
          await decideReview(pending.id, 'merge', pending.candidates[0].entityId, 'Simulation: same name, date of birth and address; Medicare card and licence both belong to James.');
          saw = await asIntermediary(tokenOf('kestrel'), 'GET', `/api/v1/clients/${kw.handle}`);
        } else {
          note = kw?.status === 'VERIFIED' ? 'Already resolved automatically when Kestrel submitted (the merge policy was met).' : 'Nothing waiting for a decision.';
          if (kw) saw = await asIntermediary(tokenOf('kestrel'), 'GET', `/api/v1/clients/${kw.handle}`);
        }
      } else if (step.id === 'rerun') {
        saw = await asIntermediary(tokenOf('northgate'), 'POST', `/api/v1/clients/${results.ng.saw.handle}/rerun`);
      }
      const activity = await latestActivity(started);
      setResults((r) => ({ ...r, [step.id]: { saw, note, activity, seconds: Math.round((Date.now() - started) / 1000) } }));
      reload();
    } catch (e) { setError(e.message); } finally { setRunning(''); }
  };

  const fresh = async () => {
    if (!window.confirm("Start fresh? This clears the platform's demo records. FrankieOne records are kept.")) return;
    await resetDemo(); await setPolicy({ autoMergeOnNameDobAddress: auto });
    setResults({}); reload();
  };
  const toggleAuto = async (v) => { setAuto(v); await setPolicy({ autoMergeOnNameDobAddress: v }); };
  const next = STEPS.find((s) => !results[s.id]);

  return (
    <>
      <TopBar crumbs={[{ label: 'Simulation' }]} actions={<button onClick={fresh} disabled={!!running} className={btn.secondary}><RotateCcw className="w-4 h-4" /> Start fresh</button>} />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-4xl px-6 py-6">
          <DemoData onChange={reload} />

          <h1 className="mt-10 text-[20px] font-semibold text-slate-900">One person, three intermediaries</h1>
          <p className="mt-1 text-[13px] text-slate-500 max-w-2xl">Each step calls the same API an intermediary’s own system would. On the left, what the platform did; on the right, all the intermediary saw. Start fresh first, then run the steps in order. Each takes 10 to 25 seconds.</p>

          <label className="mt-4 flex items-start gap-2.5 text-[13px] text-slate-700 rounded-lg border border-slate-200 px-4 py-3 max-w-2xl">
            <input type="checkbox" checked={auto} onChange={(e) => toggleAuto(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-slate-300" />
            <span>Resolve duplicates automatically when name, date of birth and address all match exactly
              <span className="block text-[12px] text-slate-500">Off: the platform holds Kestrel’s James for a person to decide (step 4). On: it merges at step 3 without anyone. A matching identity document always merges automatically.</span>
            </span>
          </label>
          {error && <p className="mt-3 text-[13px] text-red-700">{error}</p>}

          <ol className="mt-6 space-y-4">
            {STEPS.map((s, i) => {
              const r = results[s.id];
              const brand = s.who !== 'platform' && brandOf(s.who);
              const isNext = next === s;
              return (
                <li key={s.id} className={`rounded-xl border ${isNext ? 'border-brand/40 shadow-sm' : 'border-slate-200'} bg-white`}>
                  <div className="px-5 py-4 flex items-start gap-4">
                    <span className="mt-0.5">{r ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <Circle className="w-5 h-5 text-slate-300" />}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-slate-400">Step {i + 1}</span>
                        {brand ? <BrandLogo brand={brand} compact size={20} /> : <Badge>Platform</Badge>}
                        <h2 className="text-[14px] font-semibold text-slate-900">{s.title}</h2>
                      </div>
                      <p className="mt-1 text-[13px] text-slate-500">{s.detail}</p>
                    </div>
                    <button onClick={() => run(s)} disabled={!!running || !isNext} className={isNext ? btn.primary : btn.secondary}>
                      {running === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} {r ? 'Done' : 'Run'}
                    </button>
                  </div>
                  {r && (
                    <div className="grid md:grid-cols-[1fr_240px] border-t border-slate-100">
                      <div className="px-5 py-4">
                        <p className="text-[12px] font-semibold text-slate-500 mb-2">What the platform did</p>
                        {r.note && <p className="text-[13px] text-slate-700 mb-2">{r.note}</p>}
                        <ol className="space-y-1.5">
                          {r.activity.flatMap((a) => a.steps).map((st, j) => (
                            <li key={j} className="flex gap-2.5 text-[13px] text-slate-700">
                              <span className={`mt-[7px] w-2 h-2 rounded-full shrink-0 ${st.kind === 'frankieone' ? 'bg-brand' : 'bg-slate-400'}`} />
                              <span>{st.text}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                      <div className="px-5 py-4 bg-[#fafafa] md:border-l border-slate-100 rounded-br-xl">
                        <p className="text-[12px] font-semibold text-slate-500 mb-2">{s.who === 'platform' ? 'What Kestrel now sees' : `What ${brand?.displayName || s.who} saw`}</p>
                        {r.saw ? (
                          <div className="space-y-2 text-[13px]">
                            <StatusPill status={r.saw.status} />
                            <p className="text-slate-600">Handle <span className="font-mono">{r.saw.handle}</span></p>
                            <p className="text-slate-600">Risk {r.saw.riskBand}</p>
                            <p className="text-[12px] text-slate-400">Answered in {r.seconds} s</p>
                          </div>
                        ) : <p className="text-[13px] text-slate-500">—</p>}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </>
  );
}

/**
 * Fill the network with generated people and events, and optionally keep
 * adding more every few seconds. All of it is answered by the FrankieOne
 * stand-in inside the platform; none of it goes to FrankieOne.
 */
function DemoData({ onChange }) {
  const [sum, setSum] = useState(null);
  const [busy, setBusy] = useState('');
  const load = () => demoSummary().then(setSum).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);
  const go = async (key, fn) => { setBusy(key); try { setSum(await fn()); onChange?.(); } finally { setBusy(''); } };
  const clear = () => window.confirm('Clear everything? This removes all demo data and the platform\u2019s records (FrankieOne records are kept).') && go('clear', clearDemo);
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-900 flex items-center gap-2"><Database className="w-4 h-4 text-slate-400" /> Demo data</h2>
          <p className="mt-1 text-[13px] text-slate-500 max-w-xl">Fill the network with two weeks of generated activity: clients onboarding across nine intermediaries, checks reused or topped up, duplicates found, people blocklisted. Answered by a stand-in for FrankieOne inside the platform; nothing is sent to FrankieOne.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => go('fill', fillDemo)} disabled={!!busy} className={btn.primary}>{busy === 'fill' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />} Fill the network</button>
          <button onClick={() => go('live', () => setLiveDemo(!sum?.live))} disabled={!!busy} className={sum?.live ? `${btn.secondary} !border-green-300 !bg-green-50 !text-green-800` : btn.secondary}>
            {sum?.live ? <span className="relative flex w-2 h-2"><span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" /><span className="relative inline-flex w-2 h-2 rounded-full bg-green-600" /></span> : <Zap className="w-4 h-4" />}
            {sum?.live ? 'Live: on' : 'Live activity'}
          </button>
          <button onClick={clear} disabled={!!busy} title="Clear everything" className={btn.ghost}><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      {sum && (
        <div className="px-5 py-4 border-t border-slate-100 grid md:grid-cols-[auto_1fr] gap-x-10 gap-y-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] content-start">
            <dt className="text-slate-500">Records</dt><dd className="font-medium text-slate-900 tabular-nums">{sum.records}</dd>
            <dt className="text-slate-500">Relationships</dt><dd className="font-medium text-slate-900 tabular-nums">{sum.relationships}</dd>
            <dt className="text-slate-500">Intermediaries</dt><dd className="font-medium text-slate-900 tabular-nums">{sum.intermediaries}</dd>
            <dt className="text-slate-500">Waiting decisions</dt><dd className="font-medium text-slate-900 tabular-nums">{sum.waiting}</dd>
            <dt className="text-slate-500">Blocklisted</dt><dd className="font-medium text-slate-900 tabular-nums">{sum.blocklisted}</dd>
          </dl>
          <div>
            <p className="text-[12px] font-semibold text-slate-500 mb-1.5">What each intermediary checks</p>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-[12px]">
              {sum.checkProfiles.map((c) => (
                <li key={c.intermediary} className="flex items-center justify-between gap-3">
                  <span className="text-slate-700 truncate">{c.intermediary}</span>
                  <span className="flex gap-1">{c.checks.filter((x) => x !== 'MATCHLIST').map((x) => <Badge key={x} tone={{ KYC: 'blue', AML: 'amber', IDV: 'violet', BIOMETRICS: 'violet' }[x]}>{x === 'BIOMETRICS' ? 'Selfie' : x === 'IDV' ? 'Photo ID' : x}</Badge>)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
