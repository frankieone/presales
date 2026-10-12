import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, CircleDashed, FileText, Image as ImageIcon, Loader2, Upload, Smartphone, Copy, ExternalLink, ShieldCheck, FolderOpen, History as HistoryIcon, Check } from 'lucide-react';
import { fileUrl } from '../api';
import { Badge, Empty, btn, fmtDate, fmtDateTime, fmtTime } from './ui';

/**
 * The client file: verifications, risk, documents and history, as FrankieOne
 * holds them. The same sections render the intermediary's scoped file and
 * the platform's full one; `full` adds the platform-only detail (which
 * intermediary a run was for, workflow names, scores).
 */
const fmt = fmtDateTime;
const RESULT_TONE = { Passed: 'green', Complete: 'green', Failed: 'red', Blocked: 'red', 'Needs review': 'amber', 'In progress': 'blue' };
const RISK = {
  Low: ['text-green-700', 'bg-green-50', 'border-green-200'],
  Medium: ['text-amber-700', 'bg-amber-50', 'border-amber-200'],
  High: ['text-red-700', 'bg-red-50', 'border-red-200'],
  Unacceptable: ['text-red-700', 'bg-red-50', 'border-red-200'],
};

export function Result({ value }) {
  if (!value) return null;
  return <Badge tone={RESULT_TONE[value] || 'slate'}>{value}</Badge>;
}

function RiskChip({ level, score }) {
  if (!level) return null;
  const [text] = RISK[level] || ['text-slate-600'];
  return <span className={`text-[13px] font-medium ${text}`}>{level} risk{score != null ? <span className="text-slate-400 font-normal"> · {score}</span> : null}</span>;
}

export function Verifications({ items, full }) {
  if (!items?.length) return <Empty icon={ShieldCheck} title="No verifications yet">Verifications appear here once a check has run.</Empty>;
  return (
    <ol className="space-y-4">
      {items.map((v) => (
        <li key={v.ref} className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[15px] font-semibold text-slate-900">{v.kind}</h3>
                <Result value={v.result} />
                {v.monitoring && <Badge tone="violet">Ongoing monitoring</Badge>}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {fmt(v.startedAt)}
                {full && v.for ? <> · for <span className="text-slate-700">{v.for}</span></> : null}
              </p>
              {full && v.workflow && <p className="mt-0.5 text-xs font-mono text-slate-400">{v.workflow}</p>}
            </div>
            <RiskChip level={v.riskLevel} score={full ? v.riskScore : null} />
          </div>
          {v.checks.length > 0 && (
            <ul className="px-5 py-4 border-t border-slate-100 grid sm:grid-cols-2 gap-x-8 gap-y-2.5">
              {v.checks.map((c, i) => (
                <li key={i} className="text-sm text-slate-700 flex items-start gap-2.5">
                  {c.result === 'Passed' ? <CheckCircle2 className="w-[18px] h-[18px] text-green-600 shrink-0" strokeWidth={1.75} />
                    : c.result === 'Failed' ? <XCircle className="w-[18px] h-[18px] text-red-500 shrink-0" strokeWidth={1.75} />
                    : <CircleDashed className="w-[18px] h-[18px] text-slate-400 shrink-0" strokeWidth={1.75} />}
                  <span>{c.check}</span>
                </li>
              ))}
            </ul>
          )}
          {v.issues?.length > 0 && <p className="px-5 pb-4 text-sm text-amber-700">{v.issues.join(' · ')}</p>}
        </li>
      ))}
    </ol>
  );
}

export function Risk({ risk, full }) {
  if (!risk) return <Empty icon={ShieldCheck} title="No risk assessment yet">A risk assessment is made when a verification runs.</Empty>;
  const [text, bg, border] = RISK[risk.level] || ['text-slate-800', 'bg-slate-50', 'border-slate-200'];
  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-6 items-start">
      <div className={`rounded-xl border ${border} ${bg} p-5`}>
        <p className="text-[13px] text-slate-600">Overall risk</p>
        <p className={`mt-1 text-3xl font-semibold tracking-tight ${text}`}>{risk.level || '—'}</p>
        {full && risk.score != null && <p className="mt-1 text-sm text-slate-600">Score {risk.score}</p>}
        <p className="mt-3 text-xs text-slate-500">Assessed {fmt(risk.assessedAt)}</p>
        {full && risk.entityLevel && <p className="mt-1 text-xs text-slate-500">Record level: {risk.entityLevel}{risk.entityScore != null ? ` (${risk.entityScore})` : ''}</p>}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex justify-between text-[12px] font-medium text-slate-500">
          <span>Factor</span><span>{full ? 'Value · score' : 'Value'}</span>
        </div>
        {risk.factors.length ? (
          <ul className="divide-y divide-slate-100">
            {risk.factors.map((f, i) => (
              <li key={i} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
                <span className="text-slate-700">{f.factor}</span>
                <span className="text-slate-500">{String(f.value).replace(/_/g, ' ').toLowerCase()}{full && f.score != null ? <span className="ml-3 inline-block w-6 text-right text-slate-900 font-medium">{f.score}</span> : null}</span>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-6 text-sm text-slate-500">No factors to show.</p>}
        {!full && <p className="px-5 py-3 border-t border-slate-100 text-xs text-slate-500">Shown as a level and the factors behind it. Scores stay with the platform.</p>}
      </div>
    </div>
  );
}

function Attachment({ path, att }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  const isImage = String(att.mimeType || '').startsWith('image/');
  useEffect(() => {
    let u;
    if (isImage) fileUrl(path).then((x) => { u = x; setUrl(x); }).catch((e) => setError(e.message));
    return () => u && URL.revokeObjectURL(u);
  }, [path, isImage]);
  const open = async () => { try { window.open(url || await fileUrl(path), '_blank', 'noopener'); } catch (e) { setError(e.message); } };
  return (
    <button onClick={open} title={att.filename || ''} className="group block w-full text-left">
      <span className="block aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 ring-1 ring-slate-200 group-hover:ring-slate-400 transition">
        {isImage
          ? url ? <img src={url} alt={att.filename || 'Attachment'} className="w-full h-full object-cover" />
            : <span className="w-full h-full flex items-center justify-center text-slate-400">{error ? <ImageIcon className="w-6 h-6" /> : <Loader2 className="w-5 h-5 animate-spin" />}</span>
          : <span className="w-full h-full flex items-center justify-center text-slate-400"><FileText className="w-8 h-8" strokeWidth={1.5} /></span>}
      </span>
      <span className="block mt-1.5 text-xs text-slate-500 truncate">{att.side ? `${att.side[0]}${att.side.slice(1).toLowerCase()} · ` : ''}{att.filename || att.mimeType}</span>
    </button>
  );
}

export function Documents({ items, attachmentPath, full }) {
  if (!items?.length) return <Empty icon={FolderOpen} title="No documents yet">Documents you add, and photos from an ID check, appear here.</Empty>;
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {items.map((d) => (
        <div key={d.documentId} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><FileText className="w-[18px] h-[18px]" strokeWidth={1.75} /></span>
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-slate-900">{d.type}</p>
              <p className="text-sm text-slate-500">
                {d.number ? <span className="font-mono">{full && d.fullNumber ? d.fullNumber : d.number}</span> : 'No number'}
                {d.country ? ` · ${d.country}` : ''}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Added {fmtDate(d.addedAt)}{full && d.addedBy ? ` by ${d.addedBy}` : ''}{d.class ? ` · ${d.class.toLowerCase()}` : ''}</p>
          {d.attachments.length > 0 ? (
            <div className="mt-4 grid grid-cols-3 gap-3">
              {d.attachments.map((a) => <Attachment key={a.attachmentId} att={a} path={attachmentPath(d, a)} />)}
            </div>
          ) : <p className="mt-4 text-xs text-slate-400">Details only, no file attached.</p>}
        </div>
      ))}
    </div>
  );
}

export function History({ items, full }) {
  if (!items?.length) return <Empty icon={HistoryIcon} title="Nothing recorded yet" />;
  const days = [];
  for (const e of items) {
    const day = fmtDate(e.at);
    if (days.at(-1)?.day !== day) days.push({ day, events: [] });
    days.at(-1).events.push(e);
  }
  return (
    <div className="space-y-8">
      {days.map(({ day, events }) => (
        <div key={day}>
          <p className="text-[13px] font-medium text-slate-500 mb-3">{day}</p>
          <ol className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {events.map((e, i) => (
              <li key={i} className="px-5 py-3 flex items-start gap-4">
                <span className="w-16 shrink-0 text-sm text-slate-400 tabular-nums">{fmtTime(e.at)}</span>
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${e.source === 'Platform' ? 'bg-slate-400' : 'bg-brand'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">{e.text}</p>
                  {(full && (e.workflow || e.for)) && (
                    <p className="mt-0.5 text-xs text-slate-500">{e.for ? `For ${e.for}` : ''}{e.for && e.workflow ? ' · ' : ''}{e.workflow ? <span className="font-mono">{e.workflow}</span> : null}</p>
                  )}
                </div>
                <span className="shrink-0 flex items-center gap-2">
                  {e.result && e.result !== 'Not checked' && <Result value={e.result} />}
                  <span className="text-xs text-slate-400 w-20 text-right">{e.source === 'Platform' ? 'Platform' : 'FrankieOne'}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
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

export function UploadDocument({ defaultType = 'OTHER', onUpload }) {
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
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-5 flex flex-col">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0"><Upload className="w-[18px] h-[18px]" strokeWidth={1.75} /></span>
        <div>
          <p className="text-[15px] font-medium text-slate-900">Add a document</p>
          <p className="text-sm text-slate-500">Stored on the client's record, alongside their verification.</p>
        </div>
      </div>
      <div className="mt-auto pt-4 space-y-3">
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-500 cursor-pointer hover:border-slate-400">
          <FileText className="w-4 h-4 shrink-0" />
          <span className="truncate flex-1">{file ? file.name : 'Choose a photo or PDF (optional)'}</span>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="sr-only" />
        </label>
        <button onClick={submit} disabled={busy} className={`${btn.primary} w-full`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Add to file
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function IdvLink({ who, onCreate }) {
  const [link, setLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const create = async () => {
    setBusy(true); setError('');
    try { setLink(await onCreate()); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-5 flex flex-col">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-lg bg-blue-50 text-brand flex items-center justify-center shrink-0"><Smartphone className="w-[18px] h-[18px]" strokeWidth={1.75} /></span>
        <div>
          <p className="text-[15px] font-medium text-slate-900">ID check by phone</p>
          <p className="text-sm text-slate-500">A one-time link for {who} to photograph their ID and take a selfie. Photos and results land in this file.</p>
        </div>
      </div>
      {!link ? (
        <button onClick={create} disabled={busy} className={`${btn.secondary} w-full mt-auto`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />} Create link
        </button>
      ) : (
        <div className="mt-auto pt-4">
          <div className="flex items-center gap-2">
            <input readOnly value={link.url} className="flex-1 min-w-0 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" />
            <button onClick={() => { navigator.clipboard?.writeText(link.url); setCopied(true); }} title="Copy link" className={btn.secondary}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
            <a href={link.url} target="_blank" rel="noreferrer" title="Open link" className={btn.secondary}><ExternalLink className="w-4 h-4" /></a>
          </div>
          {link.expiresAt && <p className="mt-2 text-xs text-slate-500">Expires {fmt(link.expiresAt)}. Check status once they've finished.</p>}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
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
