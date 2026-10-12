import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CheckCircle2, Circle, Loader2, Play, RotateCcw } from 'lucide-react';
import { decideReview, network, resetDemo, setPolicy } from '../../api';
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
          await decideReview(pending.id, 'merge', pending.candidates[0].entityId);
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
          <h1 className="text-[20px] font-semibold text-slate-900">One person, three intermediaries</h1>
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
