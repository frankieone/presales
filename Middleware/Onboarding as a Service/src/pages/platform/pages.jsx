import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Activity as ActivityIcon, AlertTriangle, Ban, ChevronRight, Clock, Database, Eye, GitMerge, Loader2, Scale, Undo2 } from 'lucide-react';
import { compareRecords, decideReview, reverseMerge, reviewComparison } from '../../api';
import { Thumb } from '../../components/ClientFile';
import { Attributes, Avatar, Badge, Body, CopyValue, Empty, ListToolbar, Loading, Panel, StatusPill, TopBar, WAIT_CLS, ago, btn, duration, fmtDate, fmtDateTime, td, th, waitTone } from '../../components/ui';

const useData = () => useOutletContext();

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
                  <td className={td}><span className="flex items-center gap-2.5"><Avatar name={inv.name} kind={inv.entityType} /><span className="font-medium text-slate-900">{inv.name}</span>{inv.entityId.startsWith('feed') && <span title="Generated demo data, not a FrankieOne record" className="text-[10px] font-medium uppercase tracking-wide text-slate-400 border border-slate-200 rounded px-1">Demo</span>}</span></td>
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
const norm = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const fmtDob = (d) => (d ? `${new Date(`${d}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} (age ${Math.floor((Date.now() - Date.parse(d)) / 31557600000)})` : '—');

/** One comparison row: label, the new submission, the record already held, and whether they agree. */
function Row({ label, a, b, same }) {
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="py-3 pr-4 text-[13px] text-slate-500 w-40">
        <span className="flex items-center gap-1.5">
          {same === true && <span title="Same on both" className="w-1.5 h-1.5 rounded-full bg-green-500" />}
          {same === false && <span title="Different" className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
          {label}
        </span>
      </td>
      <td className={`py-3 pr-6 text-[13px] text-slate-900 ${same === false ? 'bg-amber-50/50' : ''}`}>{a ?? '—'}</td>
      <td className={`py-3 text-[13px] text-slate-900 ${same === false ? 'bg-amber-50/50' : ''}`}>{b ?? '—'}</td>
    </tr>
  );
}

function DocBlock({ p }) {
  if (!p.documents.length) return <span className="text-slate-400">None on file</span>;
  return (
    <div className="space-y-3">
      {p.documents.map((d) => (
        <div key={d.documentId} className="rounded-lg border border-slate-200 p-3">
          <p className="font-medium text-slate-900">{d.type}</p>
          <dl className="mt-1.5 grid grid-cols-[96px_1fr] gap-y-0.5 text-[12px]">
            {d.number && <><dt className="text-slate-500">Number</dt><dd className="font-mono"><CopyValue value={d.number} /></dd></>}
            {d.cardNumber && <><dt className="text-slate-500">Card number</dt><dd className="font-mono">{d.cardNumber}</dd></>}
            {d.colour && <><dt className="text-slate-500">Colour</dt><dd>{d.colour}, position {d.position}</dd></>}
            {d.nameOnCard && <><dt className="text-slate-500">Name on card</dt><dd>{d.nameOnCard}</dd></>}
            {d.state && <><dt className="text-slate-500">Issued in</dt><dd>{d.state}{d.country ? `, ${d.country}` : ''}</dd></>}
            {d.expiry && <><dt className="text-slate-500">Expires</dt><dd>{fmtDate(d.expiry)}</dd></>}
          </dl>
          <div className="mt-2.5 flex gap-1.5 items-center">
            {d.attachments.length
              ? d.attachments.map((at) => <Thumb key={at.attachmentId} att={at} path={`/internal/entities/${p.entityId}/documents/${d.documentId}/attachments/${at.attachmentId}`} />)
              : <span className="text-[12px] text-slate-400">No images on file</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Comparison({ rv, cmp, busy, act, readOnly }) {
  const [note, setNote] = useState('');
  const a = cmp.submitted;
  const biz = rv.kind === 'business';
  return cmp.candidates.map((b, idx) => {
    const c = rv.candidates?.[idx] || { matchedOn: rv.matchedOn || [] };
    const sameDoc = a.documents.some((x) => b.documents.some((y) => x.number && x.number === y.number));
    return (
      <div key={b.entityId} className={readOnly ? '' : 'flex-1 min-w-0 overflow-y-auto px-6 py-5'}>
        {!readOnly && rv.target && (() => {
          const waited = Date.now() - Date.parse(rv.at);
          const tone = waitTone(waited, rv.target);
          return (
            <div className={`mb-5 rounded-lg px-4 py-3 flex items-start gap-3 ${tone === 'overdue' ? 'bg-red-50 text-red-800' : tone === 'soon' ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-700'}`}>
              {tone === 'overdue' ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <Clock className="w-5 h-5 shrink-0" />}
              <div className="text-[13px]">
                <p className="font-semibold">{tone === 'overdue' ? 'Overdue: ' : ''}{rv.submitted?.name} has been waiting {duration(waited)} for a decision.</p>
                <p>{rv.intermediary}’s onboarding is on hold until you decide. Target: {duration(rv.target * 60000)}{tone === 'overdue' ? `, missed by ${duration(waited - rv.target * 60000)}` : ''}.</p>
              </div>
            </div>
          );
        })()}
        {!readOnly && (
          <>
            <h1 className="text-[18px] font-semibold text-slate-900">Is this the same person?</h1>
            <p className="mt-1 text-[13px] text-slate-500">
              The duplicate check matched on {c.matchedOn.map((f) => f.replace(/_/g, ' ').toLowerCase()).join(', ')}. There's no identity document in common, so the merge policy leaves it to you. {rv.intermediary} sees “In review”.
            </p>
          </>
        )}
        <table className="mt-5 w-full max-w-5xl">
          <thead>
            <tr className="text-left text-[12px] text-slate-500">
              <th className="pb-2 w-40" />
              <th className="pb-2 pr-6 font-medium"><span className="text-amber-700">{readOnly ? 'Submitted' : 'New submission'}</span> · from {rv.intermediary}</th>
              <th className="pb-2 font-medium"><span className="text-slate-900">Already on the network</span></th>
            </tr>
          </thead>
          <tbody>
            <Row label="First onboarded" a={fmtDateTime(a.firstOnboarded)} b={<>{fmtDateTime(b.firstOnboarded)} <span className="text-slate-500">· {ago(b.firstOnboarded)}</span></>} />
            <Row label="Held by" a={a.heldBy.map((h) => `${h.intermediary} (${h.clientRef})`).join(', ')}
              b={<div className="space-y-0.5">{b.heldBy.map((h) => <p key={h.intermediary + h.clientRef}>{h.intermediary} <span className="text-slate-500">· {h.clientRef}{h.role ? ` · ${h.role}` : ''} · since {fmtDate(h.since)}</span></p>)}</div>} />
            <Row label="Name" a={a.name} b={b.name} same={norm(a.name) === norm(b.name)} />
            <Row label="Date of birth" a={fmtDob(a.dateOfBirth)} b={fmtDob(b.dateOfBirth)} same={a.dateOfBirth === b.dateOfBirth} />
            <Row label="Address" a={a.address} b={b.address} same={norm(a.address) === norm(b.address)} />
            {(a.email || b.email) && <Row label="Email" a={a.email} b={b.email} same={a.email && b.email ? a.email.toLowerCase() === b.email.toLowerCase() : undefined} />}
            {(a.phone || b.phone) && <Row label="Mobile" a={a.phone} b={b.phone} same={a.phone && b.phone ? norm(a.phone) === norm(b.phone) : undefined} />}
            <Row label="Identity documents" a={<DocBlock p={a} />} b={<DocBlock p={b} />} same={sameDoc} />
            <Row label="Latest workflow" a={a.latestRun ? `${a.latestRun.workflow} · ${a.latestRun.result}` : 'Not verified yet'}
              b={b.latestRun ? <>{b.latestRun.workflow} · <Badge tone={b.latestRun.result === 'Passed' ? 'green' : 'slate'}>{b.latestRun.result}</Badge> <span className="text-slate-500">· {fmtDate(b.latestRun.at)}{b.latestRun.risk ? ` · ${b.latestRun.risk} risk` : ''}</span></> : '—'} />
            <Row label="FrankieOne ID" a={<CopyValue value={a.entityId} />} b={<CopyValue value={b.entityId} />} />
          </tbody>
        </table>
        {!readOnly && (
          <div className="mt-6 max-w-3xl">
            <label className="block text-[12px] font-medium text-slate-600 mb-1">Reason for your decision <span className="font-normal text-slate-400">(required, recorded with your name)</span></label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="For example: same name, date of birth and address; the Medicare card and licence both belong to James."
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-[13px] focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
            <div className="mt-3 flex items-center gap-2">
              <button disabled={!!busy || !note.trim()} onClick={() => act(rv.id, () => decideReview(rv.id, 'merge', b.entityId, note))} className={btn.primary}>
                {busy === rv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />} Same person: merge
              </button>
              <button disabled={!!busy || !note.trim()} onClick={() => act(rv.id, () => decideReview(rv.id, 'different', null, note))} className={btn.secondary}>Different {biz ? 'businesses' : 'people'}</button>
              <span className="ml-2 text-[12px] text-slate-500">Merging keeps the record already held, moves {rv.intermediary}’s reference across and reuses its passed checks.</span>
            </div>
          </div>
        )}
      </div>
    );
  });
}

export function Decisions() {
  const { data, reload } = useData();
  const { busy, error, act } = useAct(reload);
  const [view, setView] = useState('open');
  const [selected, setSelected] = useState(null);
  const [cmp, setCmp] = useState({});
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  const target = data?.policy.decisionTargetMinutes || 60;
  const reviews = (data?.reviews || []).map((r) => ({ ...r, target }));
  const decided = data?.decisions || [];
  const rv = reviews.find((r) => r.id === selected) || reviews[0];
  const past = decided.find((d) => d.id === selected) || decided[0];
  useEffect(() => {
    if (view === 'open' && rv && rv.kind !== 'business' && !cmp[rv.id]) reviewComparison(rv.id).then((c) => setCmp((m) => ({ ...m, [rv.id]: c }))).catch(() => {});
  }, [view, rv?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <><TopBar crumbs={[{ label: 'Decisions' }]} /><Loading /></>;
  const views = [['open', 'Waiting', reviews.length], ['decided', 'Decided', decided.length]];
  const list = view === 'open' ? reviews : decided;
  return (
    <>
      <TopBar crumbs={[{ label: 'Decisions' }]} />
      <ListToolbar views={views} value={view} onChange={(v) => { setView(v); setSelected(null); }} />
      {view === 'open' && reviews.length > 0 && (() => {
        const waits = reviews.map((r) => Date.now() - Date.parse(r.at));
        const overdue = waits.filter((w) => w >= target * 60000).length;
        const oldest = Math.max(...waits);
        return (
          <div className={`h-10 shrink-0 px-5 border-b flex items-center gap-5 text-[13px] ${overdue ? 'bg-red-50 border-red-100 text-red-800' : 'bg-[#fafafa] border-slate-200 text-slate-600'}`}>
            <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4" /> Oldest waiting <b>{duration(oldest)}</b></span>
            <span>{overdue ? <b>{overdue} overdue</b> : 'None overdue'}</span>
            <span className="text-slate-500">{reviews.length} {reviews.length === 1 ? 'onboarding' : 'onboardings'} on hold · target {duration(target * 60000)}</span>
          </div>
        );
      })()}
      {list.length === 0 ? <Body><Empty icon={Scale} title={view === 'open' ? 'Nothing waiting for a decision' : 'No decisions yet'}>{view === 'open' ? "Possible duplicates the merge policy can't settle appear here." : 'Decisions made by staff, and merges the policy made on its own, are listed here.'}</Empty></Body> : (
        <div className="flex-1 min-h-0 flex relative">
          <ul className="w-72 shrink-0 border-r border-slate-200 overflow-y-auto">
            {view === 'open' ? reviews.map((r) => (
              <li key={r.id}>
                <button onClick={() => setSelected(r.id)} className={`w-full text-left px-5 py-3 border-b border-slate-100 ${r === rv ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-slate-900 truncate">{r.submitted?.name}</p>
                    <span className={`shrink-0 inline-flex items-center gap-1 h-[22px] px-2 rounded-md text-[12px] font-medium ${WAIT_CLS[waitTone(Date.now() - Date.parse(r.at), target)]}`}>
                      <Clock className="w-3 h-3" />{duration(Date.now() - Date.parse(r.at))}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-500">{r.kind === 'business' ? 'Same business?' : 'Same person?'} · {r.intermediary} on hold</p>
                </button>
              </li>
            )) : decided.map((d) => (
              <li key={d.id}>
                <button onClick={() => setSelected(d.id)} className={`w-full text-left px-5 py-3 border-b border-slate-100 ${d === past ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-slate-900 truncate">{d.name}</p>
                    <OutcomeBadge d={d} />
                  </div>
                  <p className="text-[12px] text-slate-500">{d.decidedBy ? d.decidedBy.name : d.outcome === 'Merged automatically' ? 'Merge policy' : 'Sign-off not recorded'} · {d.outcome === 'Merged automatically' ? 'instant' : `decided in ${duration(Date.parse(d.at) - Date.parse(d.raisedAt))}`}</p>
                </button>
              </li>
            ))}
          </ul>
          {view === 'open'
            ? (rv.kind === 'business' ? <BusinessDecision rv={rv} busy={busy} act={act} />
              : cmp[rv.id] ? <Comparison rv={rv} cmp={cmp[rv.id]} busy={busy} act={act} />
              : <div className="flex-1"><Loading>Loading both records from FrankieOne…</Loading></div>)
            : <PastDecision key={past.id} d={past} busy={busy} act={act} target={target} />}
          {error && <p className="absolute bottom-4 right-6 text-[13px] text-red-700">{error}</p>}
        </div>
      )}
    </>
  );
}

function OutcomeBadge({ d }) {
  if (d.reversed) return <Badge tone="slate">Reversed</Badge>;
  return <Badge tone={d.outcome === 'Kept separate' ? 'slate' : d.decidedBy ? 'violet' : 'blue'}>{d.outcome}</Badge>;
}

/** A decision already made: who signed it off, when and why, any reversal, and both records. */
function PastDecision({ d, busy, act, target }) {
  const [cmp, setCmp] = useState(null);
  const [note, setNote] = useState('');
  useEffect(() => {
    if (d.kind !== 'business' && d.newEntityId && d.existingEntityId) compareRecords(d.newEntityId, d.existingEntityId).then(setCmp).catch(() => setCmp(false));
  }, [d.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const canReverse = d.mergeId && !d.reversed;
  return (
    <div className="flex-1 min-w-0 overflow-y-auto px-6 py-5">
      <div className="flex items-center gap-3">
        <h1 className="text-[18px] font-semibold text-slate-900">{d.name}</h1>
        <OutcomeBadge d={d} />
      </div>
      <p className="mt-1 text-[13px] text-slate-500">Raised when {d.intermediary} submitted them on {fmtDateTime(d.raisedAt)} · matched on {d.matchedOn.map((f) => f.replace(/_/g, ' ').toLowerCase()).join(', ') || '—'}</p>

      <div className="mt-5 grid lg:grid-cols-2 gap-4 max-w-5xl">
        <section className="rounded-xl border border-slate-200 p-4">
          <h2 className="text-[12px] font-semibold text-slate-500 mb-3">Sign-off</h2>
          <Attributes rows={[
            ['Decision', d.outcome],
            ['Decided by', d.decidedBy ? <span key="b">{d.decidedBy.name} <span className="text-slate-500">· {d.decidedBy.role}</span></span>
              : d.outcome === 'Merged automatically' ? 'Merge policy (automatic, no person)' : <span key="n" className="text-slate-500">Not recorded (decided before sign-off was added)</span>],
            ['When', fmtDateTime(d.at)],
            d.outcome !== 'Merged automatically' && ['Time on hold', (() => {
              const ms = Date.parse(d.at) - Date.parse(d.raisedAt);
              const over = ms >= target * 60000;
              return <span key="t" className={over ? 'text-red-700 font-medium' : ''}>{duration(ms)}{over ? ` (target ${duration(target * 60000)})` : ''}</span>;
            })()],
            ['Reason', d.note || '—'],
          ]} />
        </section>
        <section className="rounded-xl border border-slate-200 p-4">
          <h2 className="text-[12px] font-semibold text-slate-500 mb-3">Reversal</h2>
          {d.reversed ? (
            <Attributes rows={[
              ['Reversed by', d.reversed.by ? <span key="r">{d.reversed.by.name} <span className="text-slate-500">· {d.reversed.by.role}</span></span> : '—'],
              ['When', fmtDateTime(d.reversed.at)],
              ['Reason', d.reversed.note || '—'],
            ]} />
          ) : canReverse ? (
            <>
              <p className="text-[13px] text-slate-500">If this merge was wrong, reversing restores the retired record and re-runs {d.intermediary}’s verification on it.</p>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Reason for reversing (required)"
                className="mt-3 w-full rounded-md border border-slate-200 px-3 py-2 text-[13px] focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              <button disabled={!!busy || !note.trim()} onClick={() => act(d.mergeId, () => reverseMerge(d.mergeId, note))} className={`${btn.secondary} mt-2`}>
                {busy === d.mergeId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />} Reverse merge
              </button>
            </>
          ) : <p className="text-[13px] text-slate-500">Not applicable: the records were kept separate.</p>}
        </section>
      </div>

      <h2 className="mt-8 mb-1 text-[12px] font-semibold text-slate-500">The two records, as they are now</h2>
      {cmp === null ? <Loading>Loading both records from FrankieOne…</Loading>
        : cmp ? <Comparison rv={{ ...d, candidates: null }} cmp={cmp} readOnly />
        : <p className="text-[13px] text-slate-500">These records are no longer available to compare.</p>}
    </div>
  );
}

/** A business held on name and postcode: the platform's own details are all there is to compare. */
function BusinessDecision({ rv, busy, act }) {
  const c = rv.candidates[0];
  return (
    <div className="flex-1 min-w-0 overflow-y-auto px-6 py-5">
      <h1 className="text-[18px] font-semibold text-slate-900">Is this the same business?</h1>
      <p className="mt-1 text-[13px] text-slate-500">No ABN or ACN on either, so the platform matched the normalised name and postcode. {rv.intermediary} sees “In review”.</p>
      <table className="mt-5 w-full max-w-3xl">
        <tbody>
          <Row label="Name" a={rv.submitted?.name} b={c.name} same={norm(rv.submitted?.name) === norm(c.name)} />
          <Row label="Held by" a={rv.intermediary} b={c.heldBy?.filter(Boolean).join(', ')} />
          <Row label="FrankieOne ID" a={<CopyValue value={rv.newEntityId} />} b={<CopyValue value={c.entityId} />} />
        </tbody>
      </table>
      <div className="mt-6 flex gap-2">
        <button disabled={!!busy} onClick={() => act(rv.id, () => decideReview(rv.id, 'merge', c.entityId))} className={btn.primary}><GitMerge className="w-4 h-4" /> Same business: merge</button>
        <button disabled={!!busy} onClick={() => act(rv.id, () => decideReview(rv.id, 'different'))} className={btn.secondary}>Different businesses</button>
      </div>
    </div>
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
                  <td className={td}>{m.staff ? <span>{m.staff.name} <span className="text-slate-500">· {m.staff.role}</span></span> : <Badge tone="blue">Merge policy</Badge>}</td>
                  <td className={`${td} text-slate-600 whitespace-normal`}>{m.reason}</td>
                  <td className={`${td} text-right`}>
                    {m.reversedAt ? <span className="text-[12px] text-slate-500">Reversed{m.reversedBy ? ` by ${m.reversedBy.name}` : ''}</span> : (
                      <button disabled={!!busy} onClick={() => { const why = window.prompt('Reason for reversing this merge (recorded with your name):'); if (why?.trim()) act(m.id, () => reverseMerge(m.id, why)); }} className={btn.secondary}>
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
              ['Decision target', `${p.decisionTargetMinutes} min for a held duplicate (the client's onboarding waits until then)`],
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

// ── blocklist ───────────────────────────────────────────────────────
/** People the platform won't onboard through any intermediary, why, who added them, and who has tried since. */
export function Blocklist() {
  const { data } = useData();
  const navigate = useNavigate();
  if (!data) return <><TopBar crumbs={[{ label: 'Blocklist' }]} /><Loading /></>;
  const list = data.blocklist || [];
  return (
    <>
      <TopBar crumbs={[{ label: 'Blocklist' }]} actions={<span className="text-[13px] text-slate-500">Intermediaries see Declined, never why</span>} />
      <div className="flex-1 min-h-0 overflow-auto">
        {list.length === 0 ? <Empty icon={Ban} title="No one on the blocklist">Fill the network with demo data (Simulation) to see blocklisted people and the attempts they make.</Empty> : (
          <table className="w-full">
            <thead><tr><th className={th}>Person</th><th className={th}>Reason</th><th className={th}>Added by</th><th className={th}>Attempts since</th></tr></thead>
            <tbody>
              {list.map((b) => {
                const last = b.attempts?.at(-1);
                return (
                  <tr key={b.id} onClick={() => navigate(`/platform/records/${b.entityId}`)} className="cursor-pointer hover:bg-slate-50 align-top">
                    <td className={`${td} py-3`}>
                      <span className="flex items-center gap-2.5"><Avatar name={b.name} /><span><span className="block font-medium text-slate-900">{b.name}</span><span className="block text-[12px] text-slate-500">Born {b.dateOfBirth}</span></span></span>
                    </td>
                    <td className={`${td} py-3 whitespace-normal text-slate-700 max-w-md`}>{b.reason}</td>
                    <td className={`${td} py-3`}>
                      <span className="block text-slate-900">{b.addedBy?.name}</span>
                      <span className="block text-[12px] text-slate-500">{b.addedBy?.role} · {fmtDate(b.at)}</span>
                    </td>
                    <td className={`${td} py-3`}>
                      {b.attempts?.length ? (
                        <>
                          <Badge tone="red">{b.attempts.length} blocked</Badge>
                          <span className="block mt-1 text-[12px] text-slate-500">Latest: {last.intermediary}, {ago(last.at)}</span>
                        </>
                      ) : <span className="text-[12px] text-slate-400">None</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
