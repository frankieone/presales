import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, CircleDashed, FileText, Image as ImageIcon, Loader2, Upload, Smartphone, Copy, ExternalLink } from 'lucide-react';
import { fileUrl } from '../api';

/**
 * The client file: verifications, risk, documents and history, as FrankieOne
 * holds them. The same sections render the intermediary's scoped file and
 * the platform's full one; `full` adds the platform-only columns (which
 * intermediary a run was for, workflow names, scores).
 */
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const RESULT_CLS = {
  Passed: 'bg-green-50 text-green-700 border-green-200', Complete: 'bg-green-50 text-green-700 border-green-200',
  Failed: 'bg-red-50 text-red-700 border-red-200', Blocked: 'bg-red-50 text-red-700 border-red-200',
  'Needs review': 'bg-amber-50 text-amber-700 border-amber-200',
};
const RISK_CLS = { Low: 'text-green-700', Medium: 'text-amber-700', High: 'text-red-700', Unacceptable: 'text-red-700' };

export function Result({ value }) {
  if (!value) return null;
  return <span className={`text-[11px] px-1.5 py-0.5 rounded border ${RESULT_CLS[value] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{value}</span>;
}

const Empty = ({ children }) => <p className="text-sm text-slate-400 py-4">{children}</p>;

export function Verifications({ items, full }) {
  if (!items?.length) return <Empty>No verifications yet.</Empty>;
  return (
    <div className="space-y-3">
      {items.map((v) => (
        <div key={v.ref} className="rounded-lg border border-slate-200 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{v.kind}{v.monitoring ? ' · ongoing monitoring' : ''}</p>
              <p className="text-xs text-slate-500">{fmt(v.startedAt)}{full && v.workflow ? <> · <span className="font-mono">{v.workflow}</span></> : null}</p>
              {full && v.for && <p className="text-xs text-slate-500">For {v.for}</p>}
            </div>
            <div className="text-right shrink-0">
              <Result value={v.result} />
              {v.riskLevel && <p className={`mt-1 text-xs ${RISK_CLS[v.riskLevel] || 'text-slate-600'}`}>{v.riskLevel} risk{full && v.riskScore != null ? ` · ${v.riskScore}` : ''}</p>}
            </div>
          </div>
          {v.checks.length > 0 && (
            <ul className="mt-2 space-y-1">
              {v.checks.map((c, i) => (
                <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                  {c.result === 'Passed' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-px shrink-0" />
                    : c.result === 'Failed' ? <XCircle className="w-3.5 h-3.5 text-red-600 mt-px shrink-0" />
                    : <CircleDashed className="w-3.5 h-3.5 text-slate-400 mt-px shrink-0" />}
                  {c.check}
                </li>
              ))}
            </ul>
          )}
          {v.issues?.length > 0 && <p className="mt-2 text-xs text-amber-700">{v.issues.join(' · ')}</p>}
        </div>
      ))}
    </div>
  );
}

export function Risk({ risk, full }) {
  if (!risk) return <Empty>No risk assessment yet.</Empty>;
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <p className={`text-2xl font-bold ${RISK_CLS[risk.level] || 'text-slate-800'}`}>{risk.level || '—'}</p>
        <p className="text-xs text-slate-500">Assessed {fmt(risk.assessedAt)}{full && risk.score != null ? ` · score ${risk.score}` : ''}</p>
      </div>
      {full && risk.entityLevel && <p className="text-xs text-slate-500">Record-level risk: {risk.entityLevel}{risk.entityScore != null ? ` (${risk.entityScore})` : ''}</p>}
      {risk.factors.length > 0 ? (
        <table className="mt-3 w-full text-sm">
          <thead className="text-[11px] text-slate-400 uppercase tracking-wide">
            <tr><th className="text-left py-1">Factor</th><th className="text-left py-1">Value</th>{full && <th className="text-right py-1">Score</th>}</tr>
          </thead>
          <tbody>
            {risk.factors.map((f, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-1.5 text-slate-700">{f.factor}</td>
                <td className="py-1.5 text-slate-500 font-mono text-xs">{String(f.value).replace(/_/g, ' ')}</td>
                {full && <td className="py-1.5 text-right text-slate-500">{f.score}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="mt-2 text-xs text-slate-400">No factors to show.</p>}
      {!full && <p className="mt-3 text-[11px] text-slate-400">Shown as a level and the factors behind it. Scores stay with the platform.</p>}
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
    <button onClick={open} className="text-left rounded-md border border-slate-200 bg-white p-1.5 hover:border-slate-400 w-28">
      {isImage ? (url ? <img src={url} alt={att.filename || 'attachment'} className="w-full h-20 object-cover rounded" />
        : <span className="w-full h-20 flex items-center justify-center text-slate-300">{error ? <ImageIcon className="w-5 h-5" /> : <Loader2 className="w-4 h-4 animate-spin" />}</span>)
        : <span className="w-full h-20 flex items-center justify-center text-slate-400"><FileText className="w-6 h-6" /></span>}
      <span className="block mt-1 text-[10px] text-slate-500 truncate">{att.side ? `${att.side.toLowerCase()} · ` : ''}{att.filename || att.mimeType}</span>
      {error && <span className="block text-[10px] text-red-600">{error}</span>}
    </button>
  );
}

export function Documents({ items, attachmentPath, full }) {
  if (!items?.length) return <Empty>No documents yet.</Empty>;
  return (
    <div className="space-y-3">
      {items.map((d) => (
        <div key={d.documentId} className="rounded-lg border border-slate-200 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{d.type}{d.number ? <span className="ml-1.5 font-mono text-xs text-slate-500">{full && d.fullNumber ? d.fullNumber : d.number}</span> : null}</p>
              <p className="text-xs text-slate-500">{d.class ? `${d.class.toLowerCase()} · ` : ''}{d.country ? `${d.country} · ` : ''}added {fmt(d.addedAt)}{full && d.addedBy ? ` by ${d.addedBy}` : ''}</p>
            </div>
            <span className="text-[11px] text-slate-400 shrink-0">{d.attachments.length ? `${d.attachments.length} file${d.attachments.length > 1 ? 's' : ''}` : 'details only'}</span>
          </div>
          {d.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {d.attachments.map((a) => <Attachment key={a.attachmentId} att={a} path={attachmentPath(d, a)} />)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function History({ items, full }) {
  if (!items?.length) return <Empty>Nothing recorded yet.</Empty>;
  return (
    <ol className="relative border-l border-slate-200 ml-1.5">
      {items.map((e, i) => (
        <li key={i} className="ml-4 pb-3">
          <span className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full ${e.source === 'Platform' ? 'bg-slate-700' : 'bg-brand'}`} />
          <p className="text-sm text-slate-800">{e.text} {e.result && e.result !== 'Not checked' ? <Result value={e.result} /> : null}</p>
          <p className="text-[11px] text-slate-400">
            {fmt(e.at)} · {e.source === 'Platform' ? 'Platform' : 'FrankieOne'}
            {full && e.workflow ? <> · <span className="font-mono">{e.workflow}</span></> : null}
            {full && e.for ? ` · for ${e.for}` : ''}
          </p>
        </li>
      ))}
    </ol>
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
    <div className="rounded-lg border border-dashed border-slate-300 p-3">
      <p className="text-xs font-medium text-slate-600">Add a document</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className="text-sm border border-slate-300 rounded-md px-2 py-1.5">
          {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-xs text-slate-600 max-w-[14rem]" />
        <button onClick={submit} disabled={busy} className="px-3 py-1.5 rounded-md bg-slate-800 text-white text-xs inline-flex items-center gap-1.5 disabled:opacity-50">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Add to file
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">Attached to the client's record in FrankieOne, so it sits with their verification for audit.</p>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function IdvLink({ who, onCreate }) {
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const create = async () => {
    setBusy(true); setError('');
    try { setLink(await onCreate()); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-3">
      <p className="text-xs font-medium text-slate-600">ID verification with photo and selfie</p>
      <p className="text-[11px] text-slate-400">A one-time link for {who} to photograph their ID and take a selfie on their phone. The photos and results land in this file.</p>
      {!link ? (
        <button onClick={create} disabled={busy} className="mt-2 px-3 py-1.5 rounded-md border border-slate-300 text-xs inline-flex items-center gap-1.5">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />} Create link
        </button>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <input readOnly value={link.url} className="flex-1 text-xs font-mono border border-slate-200 rounded px-2 py-1 bg-slate-50" />
          <button onClick={() => navigator.clipboard?.writeText(link.url)} title="Copy" className="p-1.5 border border-slate-300 rounded"><Copy className="w-3.5 h-3.5" /></button>
          <a href={link.url} target="_blank" rel="noreferrer" title="Open" className="p-1.5 border border-slate-300 rounded"><ExternalLink className="w-3.5 h-3.5" /></a>
        </div>
      )}
      {link?.expiresAt && <p className="mt-1 text-[11px] text-slate-400">Expires {fmt(link.expiresAt)}. Check status afterwards to see the result.</p>}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
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
