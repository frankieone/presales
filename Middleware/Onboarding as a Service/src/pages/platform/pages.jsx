import { useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { Activity as ActivityIcon, ArrowRight, Building2, ChevronRight, Eye, GitMerge, Loader2, Scale, Undo2, User } from 'lucide-react';
import { decideReview, reverseMerge } from '../../api';
import { Badge, Card, Details, Empty, Loading, PageHeader, Stat, StatusPill, ago, btn, fmtDateTime } from '../../components/ui';

const useData = () => useOutletContext();
const docLine = (d) => (d ? `${d.type.replace(/_/g, ' ').toLowerCase()} ending ${d.last4}` : null);

function useAct(reload) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const act = async (key, fn) => {
    setBusy(key); setError('');
    try { await fn(); await reload(); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  return { busy, error, act };
}

// ── overview ────────────────────────────────────────────────────────
export function Overview() {
  const { data } = useData();
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="Overview" description="One FrankieOne account serving every intermediary on the platform. This view is for the platform's own operations and compliance staff." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Intermediaries" value={data.intermediariesConfigured} hint={`${data.intermediariesActive} with clients`} />
        <Stat label="Records" value={data.investors.length} hint="one per person or business" />
        <Stat label="Relationships" value={data.relationships} hint={`${data.reusedOnboardings} on a record already held`} />
        <Stat label="Needs a decision" value={data.reviews.length} tone={data.reviews.length ? 'amber' : undefined} hint="possible duplicates" />
      </div>

      <div className="mt-8 grid lg:grid-cols-2 gap-6 items-start">
        <Card title="Needs a decision" actions={<Link to="/platform/decisions" className={btn.ghost}>Open <ArrowRight className="w-4 h-4" /></Link>} padded={false}>
          {data.reviews.length === 0 ? <Empty icon={Scale} title="Nothing waiting">Possible duplicates the merge policy can't settle appear here.</Empty> : (
            <ul className="divide-y divide-slate-100">
              {data.reviews.map((rv) => (
                <li key={rv.id}>
                  <Link to="/platform/decisions" className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50">
                    <div>
                      <p className="text-[14px] font-medium text-slate-900">{rv.submitted?.name}</p>
                      <p className="text-[13px] text-slate-500">Possible {rv.kind === 'business' ? 'same business' : 'duplicate'} · from {rv.intermediary}</p>
                    </div>
                    <span className="text-xs text-slate-400">{ago(rv.at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Latest activity" actions={<Link to="/platform/activity" className={btn.ghost}>All activity <ArrowRight className="w-4 h-4" /></Link>} padded={false}>
          {data.activity.length === 0 ? <Empty icon={ActivityIcon} title="Nothing yet">Onboard a client as an intermediary, in another tab.</Empty> : (
            <ul className="divide-y divide-slate-100">
              {data.activity.slice(0, 6).map((a) => (
                <li key={a.id} className="px-6 py-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-[14px] text-slate-900">{a.title}</p>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{ago(a.at)}</span>
                  </div>
                  {a.result && <p className="mt-0.5 text-[13px] text-slate-500">{a.result}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

// ── decisions ───────────────────────────────────────────────────────
function Side({ label, name, rows, tone }) {
  return (
    <div className={`p-6 ${tone === 'new' ? 'bg-amber-50/40' : ''}`}>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-[17px] font-semibold text-slate-900">{name}</p>
      <div className="mt-4"><Details rows={rows} /></div>
    </div>
  );
}

export function Decisions() {
  const { data, reload } = useData();
  const { busy, error, act } = useAct(reload);
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="Needs a decision" description="The identity index didn't recognise these submissions, but a possible match is already on the network. They didn't meet the merge policy, so a person decides. The intermediary only sees that the application is in review." />
      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}
      {data.reviews.length === 0 ? <Card><Empty icon={Scale} title="Nothing waiting for a decision" /></Card> : (
        <div className="space-y-8">
          {data.reviews.map((rv) => {
            const biz = rv.kind === 'business';
            return rv.candidates.map((c) => (
              <Card key={`${rv.id}-${c.entityId}`} padded={false}
                title={`Possible ${biz ? 'same business' : 'duplicate'}: ${rv.submitted?.name}`}
                description={`Submitted by ${rv.intermediary} · ${fmtDateTime(rv.at)}`}>
                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                  <Side tone="new" label="New submission" name={rv.submitted?.name} rows={[
                    !biz && ['Date of birth', rv.submitted?.dateOfBirth],
                    !biz && ['Document', docLine(rv.submitted?.document)],
                    ['Their reference', <span key="r" className="font-mono">{rv.submitted?.clientRef}</span>],
                    ['From', rv.intermediary],
                    ['Record', <span key="e" className="font-mono text-slate-500">{rv.newEntityId?.slice(0, 8)}</span>],
                  ]} />
                  <Side label="Already on the network" name={c.name} rows={[
                    !biz && ['Date of birth', c.dateOfBirth],
                    !biz && ['Document', docLine(c.document)],
                    ['Held by', c.heldBy?.filter(Boolean).join(', ') || '—'],
                    ['Record', <span key="e" className="font-mono text-slate-500">{c.entityId.slice(0, 8)}</span>],
                  ]} />
                </div>
                <div className="px-6 py-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-slate-500">Matched on</span>
                    {c.matchedOn.map((f) => <Badge key={f} tone="amber">{f.replace(/_/g, ' ').toLowerCase()}</Badge>)}
                  </div>
                  <div className="flex gap-2">
                    <button disabled={!!busy} onClick={() => act(rv.id, () => decideReview(rv.id, 'different'))} className={btn.secondary}>
                      {biz ? 'Different businesses' : 'Different people'}
                    </button>
                    <button disabled={!!busy} onClick={() => act(rv.id, () => decideReview(rv.id, 'merge', c.entityId))} className={btn.primary}>
                      {busy === rv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />} {biz ? 'Same business' : 'Same person'}: merge
                    </button>
                  </div>
                </div>
              </Card>
            ));
          })}
        </div>
      )}
    </>
  );
}

// ── records ─────────────────────────────────────────────────────────
export function Records() {
  const { data } = useData();
  const navigate = useNavigate();
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="Records" description="One FrankieOne record per person or business, across every intermediary. Open a record for its full client file." />
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        {data.investors.length === 0 ? <Empty icon={User} title="No records yet" /> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead>
              <tr className="text-left text-[13px] text-slate-500 border-b border-slate-100">
                <th className="font-medium px-5 py-3">Record</th>
                <th className="font-medium px-5 py-3">Held by</th>
                <th className="font-medium px-5 py-3 hidden lg:table-cell">Latest outcome</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {data.investors.map((inv) => {
                const active = inv.relationships.filter((r) => !r.removedAt);
                const latest = [...active].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
                const holders = [...new Set(active.map((r) => r.intermediary))];
                return (
                  <tr key={inv.entityId} onClick={() => navigate(`/platform/records/${inv.entityId}`)} className="border-t border-slate-100 first:border-0 hover:bg-slate-50/70 cursor-pointer">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                          {inv.entityType === 'ORGANIZATION' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium text-slate-900">{inv.name}</p>
                          <p className="text-[13px] text-slate-500">{inv.entityType === 'ORGANIZATION' ? `${inv.businessType} · ${inv.registration || 'no ABN or ACN'}` : `Born ${inv.dateOfBirth}`}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {holders.map((h) => <Badge key={h}>{h}</Badge>)}
                        {!holders.length && <span className="text-sm text-slate-400">No one</span>}
                      </div>
                      {active.length > holders.length && <p className="mt-1 text-xs text-slate-500">{active.length} relationships</p>}
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">{latest && <StatusPill status={latest.status} />}</td>
                    <td className="pr-4 text-slate-300"><ChevronRight className="w-4 h-4" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>
    </>
  );
}

// ── activity ────────────────────────────────────────────────────────
export function ActivityLog() {
  const { data } = useData();
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="Activity" description="Each submission and decision, step by step: what the platform decided itself, and what it asked FrankieOne to do. Updates every few seconds." />
      <div className="mb-6 flex gap-5 text-sm text-slate-500">
        <span className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> The platform</span>
        <span className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-brand" /> A FrankieOne call</span>
      </div>
      {data.activity.length === 0 ? <Card><Empty icon={ActivityIcon} title="Nothing yet">Onboard a client as an intermediary, in another tab.</Empty></Card> : (
        <div className="space-y-6">
          {data.activity.map((a) => (
            <Card key={a.id} title={a.title} description={`${fmtDateTime(a.at)}${a.clientRef ? ` · reference ${a.clientRef}` : ''}`}>
              <ol className="relative">
                {a.steps.map((s, i) => (
                  <li key={i} className="relative pl-7 pb-4 last:pb-0">
                    {i < a.steps.length - 1 && <span className="absolute left-[5px] top-3 bottom-0 w-px bg-slate-200" />}
                    <span className={`absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full ring-4 ring-white ${s.kind === 'frankieone' ? 'bg-brand' : 'bg-slate-400'}`} />
                    <p className="text-[14px] leading-relaxed text-slate-700">{s.text}</p>
                  </li>
                ))}
              </ol>
              {a.result && <p className="mt-5 pt-4 border-t border-slate-100 text-sm font-medium text-slate-900">{a.result}</p>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

// ── merges ──────────────────────────────────────────────────────────
export function Merges() {
  const { data, reload } = useData();
  const { busy, error, act } = useAct(reload);
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="Merges" description="Every merge records its reason and can be reversed. Reversing restores the retired record and re-runs that intermediary's verification on it." />
      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        {data.merges.length === 0 ? <Empty icon={GitMerge} title="No merges yet" /> : (
          <ul className="divide-y divide-slate-100">
            {data.merges.map((m) => (
              <li key={m.id} className={`px-6 py-5 flex flex-col md:flex-row md:items-center gap-4 justify-between ${m.reversedAt ? 'opacity-60' : ''}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14px] font-medium text-slate-900">{m.intermediary}</p>
                    <Badge tone={m.decidedBy === 'Compliance' ? 'slate' : 'blue'}>{m.decidedBy === 'Compliance' ? 'Compliance decision' : 'Merge policy'}</Badge>
                    {m.reversedAt && <Badge>Reversed</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{m.reason}</p>
                  <p className="mt-1 text-xs text-slate-400">{fmtDateTime(m.at)}</p>
                </div>
                {!m.reversedAt && (
                  <button disabled={!!busy} onClick={() => act(m.id, () => reverseMerge(m.id))} className={btn.secondary}>
                    {busy === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />} Reverse
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// ── disclosures ─────────────────────────────────────────────────────
export function Disclosures() {
  const { data } = useData();
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="Disclosure log" description="What each intermediary was shown, and when. Every response is recorded with the fields it contained." />
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        {data.disclosures.length === 0 ? <Empty icon={Eye} title="Nothing shown yet" /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[13px] text-slate-500 border-b border-slate-100">
                <th className="font-medium px-5 py-3">When</th>
                <th className="font-medium px-5 py-3">Intermediary</th>
                <th className="font-medium px-5 py-3">Handle</th>
                <th className="font-medium px-5 py-3">Action</th>
                <th className="font-medium px-5 py-3 hidden lg:table-cell">Fields</th>
              </tr>
            </thead>
            <tbody>
              {data.disclosures.map((d, i) => (
                <tr key={i} className="border-t border-slate-100 first:border-0 align-top">
                  <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{fmtDateTime(d.at)}</td>
                  <td className="px-5 py-3 text-slate-900">{d.intermediary}</td>
                  <td className="px-5 py-3 font-mono text-slate-500 whitespace-nowrap">{d.handle}</td>
                  <td className="px-5 py-3"><Badge>{d.action}</Badge></td>
                  <td className="px-5 py-3 text-slate-500 hidden lg:table-cell">{d.fields.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </>
  );
}

// ── policies ────────────────────────────────────────────────────────
export function Policies() {
  const { data } = useData();
  if (!data) return <Loading />;
  const p = data.policy;
  return (
    <>
      <PageHeader title="Policies" description="How the platform protects each intermediary's view and the shared FrankieOne account. Set in server/config.mjs." />
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <Card title="Controls">
          <Details rows={[
            ['Minimum response time', `${p.minResponseMs / 1000} s for people, ${p.minBusinessResponseMs / 1000} s for businesses`],
            ['Submissions per intermediary', `${p.ratePerMinute} a minute`],
            ['Evidence reuse window', `${p.reuseWindowDays} days`],
            ['Concurrent FrankieOne calls', `${p.maxConcurrent}, shared fairly`],
            ['Automatic merging', p.autoMergeOnDocumentAndDob ? 'On: identity document and exact date of birth, single candidate' : 'Off'],
            ['Identity index', `${data.indexKeys} hashed keys`],
          ]} />
        </Card>
        <Card title="Fields an intermediary can receive" description="Responses are built from this list, so a new field in FrankieOne's response never reaches an intermediary until it's added here.">
          <div className="flex flex-wrap gap-2">
            {data.permittedFields.map((f) => <span key={f} className="text-[13px] font-mono bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-700">{f}</span>)}
          </div>
        </Card>
      </div>
    </>
  );
}

