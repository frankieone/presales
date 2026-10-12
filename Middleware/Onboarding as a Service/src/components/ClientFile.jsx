import { useEffect, useState } from 'react';
import { Check, CheckCircle2, ChevronRight, CircleDashed, Copy, ExternalLink, FileText, FolderOpen, History as HistoryIcon, Image as ImageIcon, Loader2, ShieldCheck, Upload, XCircle } from 'lucide-react';
import { fileUrl } from '../api';
import { Badge, Empty, Panel, btn, fmtDate, fmtDateTime, fmtTime, input } from './ui';

/**
 * The client file: verifications, risk, documents and history, as FrankieOne
 * holds them. The same sections render the intermediary's scoped file and
 * the platform's full one; `full` adds the platform-only detail (which
 * intermediary a run was for, workflow names, scores).
 */
const fmt = fmtDateTime;
const RESULT_TONE = { Passed: 'green', Complete: 'green', Failed: 'red', Blocked: 'red', 'Needs review': 'amber', 'In progress': 'blue' };
const RISK_TEXT = { Low: 'text-green-700', Medium: 'text-amber-700', High: 'text-red-700', Unacceptable: 'text-red-700' };

export function Result({ value }) {
  if (!value) return null;
  return <Badge tone={RESULT_TONE[value] || 'slate'}>{value}</Badge>;
}

const CheckIcon = ({ result }) => (result === 'Passed' ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" strokeWidth={1.75} />
  : result === 'Failed' ? <XCircle className="w-4 h-4 text-red-500 shrink-0" strokeWidth={1.75} />
  : <CircleDashed className="w-4 h-4 text-slate-300 shrink-0" strokeWidth={1.75} />);

/** Every run as a row; open one to see its checks. The latest starts open. */
export function Verifications({ items, full, focus }) {
  const [open, setOpen] = useState(() => new Set(focus ? [focus] : items?.[0] ? [items[0].ref] : []));
  if (!items?.length) return <Empty icon={ShieldCheck} title="No verifications yet" />;
  const toggle = (ref) => setOpen((o) => { const n = new Set(o); if (n.has(ref)) n.delete(ref); else n.add(ref); return n; });
  return (
    <div className="divide-y divide-slate-100">
      {items.map((v) => {
        const isOpen = open.has(v.ref);
        return (
          <div key={v.ref}>
            <button onClick={() => toggle(v.ref)} className="w-full px-5 h-12 flex items-center gap-3 text-left hover:bg-slate-50">
              <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition ${isOpen ? 'rotate-90' : ''}`} />
              <span className="text-[13px] font-medium text-slate-900 truncate">{v.kind}{v.monitoring ? ' (monitoring)' : ''}</span>
              {full && v.for && <span className="text-[13px] text-slate-500 truncate">for {v.for}</span>}
              <span className="ml-auto flex items-center gap-3 shrink-0">
                {v.riskLevel && <span className={`text-[12px] ${RISK_TEXT[v.riskLevel] || 'text-slate-500'}`}>{v.riskLevel}{v.riskScore != null ? ` · ${v.riskScore}` : ''}</span>}
                <Result value={v.result} />
                <span className="w-32 text-right text-[12px] text-slate-500">{fmt(v.startedAt)}</span>
              </span>
            </button>
            {isOpen && (
              <div className="pl-12 pr-5 pb-4 -mt-1">
                {full && v.workflow && <p className="mb-2 text-[12px] font-mono text-slate-400">{v.workflow}</p>}
                <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                  {v.checks.map((c, i) => (
                    <li key={i} className={`flex items-start gap-2 text-[13px] ${c.result === 'Not done' ? 'text-slate-400' : 'text-slate-700'}`}>
                      <CheckIcon result={c.result} /><span>{c.check}{c.result === 'Not done' ? ' (not needed)' : ''}</span>
                    </li>
                  ))}
                </ul>
                {v.issues?.length > 0 && <p className="mt-2 text-[13px] text-amber-700">{v.issues.join(' · ')}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Risk({ risk, full }) {
  if (!risk) return <Empty icon={ShieldCheck} title="No risk assessment yet" />;
  return (
    <div className="px-5 py-5">
      <div className="flex items-baseline gap-3">
        <p className={`text-2xl font-semibold tracking-tight ${RISK_TEXT[risk.level] || 'text-slate-900'}`}>{risk.level || '—'} risk</p>
        <p className="text-[13px] text-slate-500">{risk.score != null ? `Score ${risk.score} · ` : ''}assessed {fmt(risk.assessedAt)}</p>
      </div>
      <table className="mt-5 w-full max-w-2xl">
        <thead><tr className="text-left text-[12px] text-slate-500"><th className="font-medium pb-2">Factor</th><th className="font-medium pb-2">Value</th>{full && <th className="font-medium pb-2 text-right">Score</th>}</tr></thead>
        <tbody>
          {risk.factors.map((f, i) => (
            <tr key={i} className="border-t border-slate-100 text-[13px]">
              <td className="py-2 text-slate-700">{f.factor}</td>
              <td className="py-2 text-slate-500">{String(f.value).replace(/_/g, ' ').toLowerCase()}</td>
              {full && <td className="py-2 text-right text-slate-900">{f.score}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {!risk.factors.length && <p className="mt-2 text-[13px] text-slate-500">No factors to show.</p>}
    </div>
  );
}

function Thumb({ path, att }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const isImage = String(att.mimeType || '').startsWith('image/');
  useEffect(() => {
    let u;
    if (isImage) fileUrl(path).then((x) => { u = x; setUrl(x); }).catch(() => setFailed(true));
    return () => u && URL.revokeObjectURL(u);
  }, [path, isImage]);
  const open = async () => { try { window.open(url || await fileUrl(path), '_blank', 'noopener'); } catch { setFailed(true); } };
  return (
    <button onClick={open} title={`${att.side ? `${att.side.toLowerCase()} · ` : ''}${att.filename || 'Open file'}`}
      className="w-10 h-10 rounded-md overflow-hidden bg-slate-100 ring-1 ring-slate-200 hover:ring-slate-400 flex items-center justify-center text-slate-400 shrink-0">
      {isImage && url ? <img src={url} alt="" className="w-full h-full object-cover" /> : isImage && !failed ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isImage ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
    </button>
  );
}

export function Documents({ items, attachmentPath, full }) {
  if (!items?.length) return <Empty icon={FolderOpen} title="No documents yet" />;
  return (
    <div className="divide-y divide-slate-100">
      {items.map((d) => (
        <div key={d.documentId} className="px-5 py-3 flex items-center gap-3">
          <span className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><FileText className="w-4 h-4" strokeWidth={1.75} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-slate-900">{d.type}{d.number && <span className="ml-2 font-normal font-mono text-slate-500">{full && d.fullNumber ? d.fullNumber : d.number}</span>}</p>
            <p className="text-[12px] text-slate-500">{fmtDate(d.addedAt)}{full && d.addedBy ? ` · added by ${d.addedBy}` : ''}{d.attachments.length ? '' : ' · details only'}</p>
          </div>
          <div className="flex gap-1.5">{d.attachments.map((a) => <Thumb key={a.attachmentId} att={a} path={attachmentPath(d, a)} />)}</div>
        </div>
      ))}
    </div>
  );
}

// FrankieOne's raw audit trail logs every internal step. The platform view shows the key
// events by default, with everything one click away.
const ROUTINE = /initiat|evaluating|results ready|enablement|step finished|step completed|entity was updated|workflow started|status was updated|monitoring|toggle|risk has changed|connector service|hosted url|onboarding url/i;

/** A timeline grouped by day. The dot says who acted; the legend says it once. */
export function History({ items, full }) {
  const [all, setAll] = useState(false);
  if (!items?.length) return <Empty icon={HistoryIcon} title="Nothing recorded yet" />;
  const shown = full && !all ? items.filter((e) => !ROUTINE.test(e.text)) : items;
  const days = [];
  for (const e of shown) {
    const day = fmtDate(e.at);
    if (days.at(-1)?.day !== day) days.push({ day, events: [] });
    days.at(-1).events.push(e);
  }
  return (
    <div className="px-5 py-4">
      <div className="mb-4 flex items-center gap-4 text-[12px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand" /> FrankieOne</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400" /> Platform</span>
        {full && (
          <button onClick={() => setAll(!all)} className="ml-auto text-slate-600 hover:text-slate-900 underline decoration-dotted underline-offset-2">
            {all ? 'Key events only' : `Show all ${items.length} events`}
          </button>
        )}
      </div>
      {days.map(({ day, events }) => (
        <div key={day} className="mb-5 last:mb-0">
          <p className="text-[12px] font-medium text-slate-500 mb-1">{day}</p>
          <ol>
            {events.map((e, i) => (
              <li key={i} className="flex items-start gap-3 py-1.5">
                <span className={`mt-[7px] w-2 h-2 rounded-full shrink-0 ${e.source === 'Platform' ? 'bg-slate-400' : 'bg-brand'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-slate-800">{e.who && <span className="text-slate-500">{e.who} · </span>}{e.text}{e.result && e.result !== 'Not checked' && <span className="ml-2"><Result value={e.result} /></span>}</p>
                  {full && e.for && <p className="text-[12px] text-slate-400">for {e.for}</p>}
                </div>
                <span className="text-[12px] text-slate-400 tabular-nums shrink-0">{fmtTime(e.at)}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

/**
 * The side-panel summary of a record: current risk, the latest workflow's
 * result, and the earlier runs. Clicking a run opens it in the main column.
 */
export function RecordSummary({ file, full, onOpenRun }) {
  if (!file) return <Panel title="Risk"><p className="text-[13px] text-slate-400">Loading…</p></Panel>;
  const runs = (file.verifications || []).filter((v) => !v.monitoring);
  const [latest, ...previous] = runs;
  const risk = file.risk;
  return (
    <>
      <Panel title="Risk">
        {risk ? (
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className={`text-[22px] leading-none font-semibold ${RISK_TEXT[risk.level] || 'text-slate-900'}`}>{risk.level}</p>
              <p className="mt-1.5 text-[12px] text-slate-500">Assessed {fmtDate(risk.assessedAt)}</p>
            </div>
            {risk.score != null && (
              <div className="text-right">
                <p className="text-[22px] leading-none font-semibold text-slate-900 tabular-nums">{risk.score}</p>
                <p className="mt-1.5 text-[12px] text-slate-500">Score</p>
              </div>
            )}
          </div>
        ) : <p className="text-[13px] text-slate-500">Not assessed yet.</p>}
      </Panel>
      <Panel title="Latest workflow">
        {latest ? (
          <button onClick={() => onOpenRun?.(latest.ref)} className="w-full text-left">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-slate-900 truncate">{latest.kind}</span>
              <Result value={latest.result} />
            </div>
            <p className="mt-1 text-[12px] text-slate-500">{fmtDateTime(latest.startedAt)}{latest.for ? ` · ${full ? 'for ' : ''}${latest.for}` : ''}</p>
            <ul className="mt-2.5 space-y-1">
              {latest.checks.filter((c) => c.result !== 'Not done').map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-slate-600"><CheckIcon result={c.result} /><span>{c.check}</span></li>
              ))}
            </ul>
          </button>
        ) : <p className="text-[13px] text-slate-500">No workflow has run yet.</p>}
      </Panel>
      {previous.length > 0 && (
        <Panel title="Previous workflows" count={previous.length}>
          <ul className="-mx-2">
            {previous.map((v) => (
              <li key={v.ref}>
                <button onClick={() => onOpenRun?.(v.ref)} className="w-full px-2 py-1.5 rounded-md flex items-center gap-2 text-left hover:bg-slate-50">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-slate-800 truncate">{v.kind}</span>
                    <span className="block text-[12px] text-slate-500 truncate">{fmtDate(v.startedAt)}{v.for ? ` · ${v.for}` : ''}</span>
                  </span>
                  <Result value={v.result} />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

// ── adding to the file (intermediary) ───────────────────────────────
export const DOC_TYPES = [
  ['DRIVERS_LICENSE', 'Driver licence'], ['PASSPORT', 'Passport'], ['NATIONAL_HEALTH_ID', 'Medicare card'],
  ['UTILITY_BILL', 'Utility bill'], ['BANK_STATEMENT', 'Bank statement'], ['ATTESTATION', 'Statutory declaration'],
  ['TRUST_DEED', 'Trust deed'], ['PARTNERSHIP_AGREEMENT', 'Partnership agreement'], ['CONSTITUTION', 'Constitution'],
  ['CERTIFICATE_OF_REGISTRATION', 'Certificate of registration'], ['OTHER', 'Other document'],
];
const readBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1]);
  r.onerror = () => reject(new Error('That file could not be read.'));
  r.readAsDataURL(file);
});

/** Upload form, sized for a dropdown or a task. */
export function UploadDocument({ defaultType = 'OTHER', onUpload, onDone }) {
  const [type, setType] = useState(defaultType);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setBusy(true); setError('');
    try {
      if (file && file.size > 6 * 1024 * 1024) throw new Error('Files can be up to 6 MB.');
      await onUpload({ type, file: file ? { filename: file.name, mimeType: file.type || 'application/octet-stream', base64: await readBase64(file) } : undefined });
      setFile(null);
      onDone?.();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2">
      <select value={type} onChange={(e) => setType(e.target.value)} className={input}>
        {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <label className="flex items-center gap-2 h-9 rounded-md border border-dashed border-slate-300 px-3 text-[13px] text-slate-500 cursor-pointer hover:border-slate-400">
        <FileText className="w-4 h-4 shrink-0" />
        <span className="truncate">{file ? file.name : 'Choose a photo or PDF'}</span>
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="sr-only" />
      </label>
      <button onClick={submit} disabled={busy} className={`${btn.primary} w-full`}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
      </button>
      {error && <p className="text-[12px] text-red-700">{error}</p>}
    </div>
  );
}

/** One-time hosted ID check link (document photo and selfie). */
export function IdvLink({ who, onCreate }) {
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const create = async () => {
    setBusy(true); setError('');
    try { setLink(await onCreate()); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2">
      <p className="text-[13px] text-slate-600">A one-time link for {who} to photograph their ID and take a selfie on their phone.</p>
      {!link ? (
        <button onClick={create} disabled={busy} className={`${btn.primary} w-full`}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Create link
        </button>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <input readOnly value={link.url} className={`${input} font-mono text-[12px] bg-slate-50`} />
            <button onClick={() => { navigator.clipboard?.writeText(link.url); setCopied(true); }} title="Copy link" className={btn.secondary}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
            <a href={link.url} target="_blank" rel="noreferrer" title="Open link" className={btn.secondary}><ExternalLink className="w-4 h-4" /></a>
          </div>
          {link.expiresAt && <p className="text-[12px] text-slate-500">Expires {fmt(link.expiresAt)}.</p>}
        </>
      )}
      {error && <p className="text-[12px] text-red-700">{error}</p>}
    </div>
  );
}

// ── printable client file ───────────────────────────────────────────
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function printSections(f, full) {
  const v = (f.verifications || []).map((x) => `<tr><td>${esc(fmt(x.startedAt))}</td><td>${esc(x.kind)}${full && x.for ? `<br><small>for ${esc(x.for)}</small>` : ''}</td><td>${esc(x.result)}</td><td>${esc(x.riskLevel || '')}</td><td>${x.checks.map((c) => `${esc(c.result)}: ${esc(c.check)}`).join('<br>')}</td></tr>`).join('');
  const r = f.risk ? `<p><b>${esc(f.risk.level)}</b> risk, assessed ${esc(fmt(f.risk.assessedAt))}</p><table><tr><th>Factor</th><th>Value</th>${full ? '<th>Score</th>' : ''}</tr>${f.risk.factors.map((x) => `<tr><td>${esc(x.factor)}</td><td>${esc(x.value)}</td>${full ? `<td>${esc(x.score)}</td>` : ''}</tr>`).join('')}</table>` : '<p>No risk assessment yet.</p>';
  const d = (f.documents || []).map((x) => `<tr><td>${esc(x.type)}</td><td>${esc(x.number || '')}</td><td>${esc(x.class || '')}</td><td>${esc(fmt(x.addedAt))}</td><td>${x.attachments.length}</td></tr>`).join('');
  const h = (f.history || []).map((x) => `<tr><td>${esc(fmt(x.at))}</td><td>${esc(x.source === 'Platform' ? 'Platform' : 'FrankieOne')}</td><td>${esc(x.text)}${x.result ? ` (${esc(x.result)})` : ''}${full && x.for ? `<br><small>for ${esc(x.for)}</small>` : ''}</td></tr>`).join('');
  return `<h2>Verifications</h2>${v ? `<table><tr><th>Date</th><th>Verification</th><th>Result</th><th>Risk</th><th>Checks</th></tr>${v}</table>` : '<p>None.</p>'}
    <h2>Risk assessment</h2>${r}
    <h2>Documents</h2>${d ? `<table><tr><th>Document</th><th>Number</th><th>Class</th><th>Added</th><th>Files</th></tr>${d}</table>` : '<p>None.</p>'}
    <h2>History</h2>${h ? `<table><tr><th>When</th><th>Source</th><th>Event</th></tr>${h}</table>` : '<p>None.</p>'}`;
}

/** Open the client file as a printable page; the browser's print dialog saves it as a PDF. */
export function printFile(f, { title, subtitle, full }) {
  const w = window.open('', '_blank');
  if (!w) return;
  const people = (f.people || []).map((p) => `<section class="person"><h1 style="font-size:16px">${esc(p.role)}: ${esc(p.name)}</h1>${printSections(p, full)}</section>`).join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{font:12px/1.45 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;margin:32px}
    h1{font-size:20px;margin:0}h2{font-size:13px;margin:22px 0 6px;text-transform:uppercase;letter-spacing:.05em;color:#475569}
    table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:4px 6px;border-bottom:1px solid #e2e8f0}th{font-size:10px;color:#64748b;text-transform:uppercase}
    small{color:#64748b}.meta{color:#64748b;margin-top:4px}.person{margin-top:28px;padding-top:12px;border-top:2px solid #0f172a;break-inside:avoid-page}
  </style></head><body><h1>${esc(title)}</h1><p class="meta">${esc(subtitle)} · generated ${esc(fmt(new Date().toISOString()))}</p>
  ${printSections(f, full)}${people}<script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}
