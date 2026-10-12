import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Download, GitMerge, Repeat, Sparkles, User } from 'lucide-react';
import { forgetIndex, getEntityFile } from '../../api';
import { Badge, Card, Details, Loading, StatusPill, Tabs, btn, fmtDateTime } from '../../components/ui';
import { Documents, History, Risk, Verifications, printFile } from '../../components/ClientFile';

/**
 * One FrankieOne record, as the platform sees it: every intermediary's
 * relationship, and the full client file with each run attributed to the
 * intermediary it was for.
 */
export default function Record() {
  const { entityId } = useParams();
  const { data, reload } = useOutletContext();
  const [file, setFile] = useState(null);
  const [tab, setTab] = useState('relationships');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => { setFile(null); getEntityFile(entityId).then(setFile).catch((e) => setError(e.message)); }, [entityId]);

  const inv = data?.investors.find((i) => i.entityId === entityId);
  if (!data) return <Loading />;
  if (!inv) return <p className="text-sm text-slate-500">That record isn't on the network. <Link to="/platform/records" className="underline">Back to records</Link></p>;
  const org = inv.entityType === 'ORGANIZATION';
  const active = inv.relationships.filter((r) => !r.removedAt);

  const drop = async () => {
    await forgetIndex(entityId);
    setNote("Index entries dropped. The next submission of this person won't be recognised by the index, so FrankieOne's duplicate check decides.");
    reload();
  };

  const tabs = [
    ['relationships', 'Relationships', inv.relationships.length],
    ['verifications', 'Verifications', file?.verifications.length],
    ['risk', 'Risk'],
    ['documents', 'Documents', file?.documents.length],
    ['history', 'Audit history', file?.history.length],
  ];

  return (
    <>
      <Link to="/platform/records" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="w-4 h-4" /> Records</Link>
      <div className="mt-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-4 min-w-0">
          <span className="w-14 h-14 rounded-2xl bg-white border border-slate-200 text-slate-500 flex items-center justify-center shrink-0">
            {org ? <Building2 className="w-6 h-6" strokeWidth={1.75} /> : <User className="w-6 h-6" strokeWidth={1.75} />}
          </span>
          <div className="min-w-0">
            <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-slate-900">{inv.name}</h1>
            <p className="mt-1 text-[15px] text-slate-500">{org ? `${inv.businessType} · ${inv.registration || 'no ABN or ACN'}` : `Born ${inv.dateOfBirth}`} · held by {active.length} {active.length === 1 ? 'relationship' : 'relationships'}</p>
          </div>
        </div>
        <button disabled={!file} onClick={() => printFile(file, { title: `Client file: ${inv.name}`, subtitle: `Platform compliance view · FrankieOne record ${entityId}`, full: true })} className={btn.secondary}>
          <Download className="w-4 h-4" /> Client file (PDF)
        </button>
      </div>
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      <div className="mt-8 grid xl:grid-cols-[1fr_320px] gap-8 items-start">
        <div className="min-w-0">
          <Tabs tabs={tabs} value={tab} onChange={setTab} />
          <div className="pt-6">
            {tab === 'relationships' && (
              <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[13px] text-slate-500 border-b border-slate-100">
                      <th className="font-medium px-5 py-3">Intermediary</th>
                      <th className="font-medium px-5 py-3">Their reference</th>
                      <th className="font-medium px-5 py-3 hidden md:table-cell">Handle they see</th>
                      <th className="font-medium px-5 py-3">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.relationships.map((r) => (
                      <tr key={`${r.intermediaryId}-${r.createdAt}`} className={`border-t border-slate-100 first:border-0 align-top ${r.removedAt ? 'opacity-50' : ''}`}>
                        <td className="px-5 py-4">
                          <p className="text-[14px] font-medium text-slate-900">{r.intermediary}</p>
                          <p className="text-[13px] text-slate-500">{r.role ? `${r.role} of ${r.business}` : 'Client'}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {r.removedAt ? <Badge>Left</Badge>
                              : r.reviewId ? <Badge tone="amber">Possible duplicate</Badge>
                              : r.mergedFrom ? <Badge tone="violet"><GitMerge className="w-3 h-3" /> Merged in</Badge>
                              : r.reusedRecord ? <Badge tone="blue"><Repeat className="w-3 h-3" /> Record already held</Badge>
                              : <Badge tone="green"><Sparkles className="w-3 h-3" /> New to the network</Badge>}
                          </div>
                        </td>
                        <td className="px-5 py-4 font-mono text-slate-700 whitespace-nowrap">{r.clientRef}</td>
                        <td className="px-5 py-4 font-mono text-slate-500 whitespace-nowrap hidden md:table-cell">{r.handle}</td>
                        <td className="px-5 py-4">
                          <StatusPill status={r.status} />
                          {r.workflow && <p className="mt-1.5 text-xs font-mono text-slate-400 whitespace-nowrap">{r.workflow}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            )}
            {tab !== 'relationships' && !file && <Loading>Loading from FrankieOne…</Loading>}
            {file && tab === 'verifications' && <Verifications items={file.verifications} full />}
            {file && tab === 'risk' && <Risk risk={file.risk} full />}
            {file && tab === 'documents' && <Documents items={file.documents} full attachmentPath={(d, a) => `/internal/entities/${entityId}/documents/${d.documentId}/attachments/${a.attachmentId}`} />}
            {file && tab === 'history' && <History items={file.history} full />}
          </div>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-10">
          <Card title="Record">
            <Details rows={[
              ['Type', org ? 'Organisation' : 'Individual'],
              ['State', file?.state || '—'],
              ['FrankieOne ID', <span key="id" className="font-mono text-xs text-slate-600 break-all">{entityId}</span>],
              ['First onboarded', fmtDateTime(inv.relationships.map((r) => r.createdAt).sort()[0])],
            ]} />
            <p className="mt-5 text-xs text-slate-500">FrankieOne's own PDF audit report for this record is generated in the FrankieOne Portal.</p>
          </Card>
          {!org && (
            <Card title="Presenter tools">
              <p className="text-sm text-slate-500">Drop this record's identity index entries, as if the client had never been indexed. The next submission then relies on FrankieOne's duplicate check.</p>
              <button onClick={drop} className={`${btn.secondary} mt-4 w-full`}>Drop index entry</button>
              {note && <p className="mt-3 text-xs text-green-700">{note}</p>}
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
