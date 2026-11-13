import { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Download, MoreHorizontal } from 'lucide-react';
import { addEntityComment, forgetIndex, getEntityFile } from '../../api';
import { Attributes, Avatar, Badge, CopyValue, Loading, Menu, Panel, RecordLayout, StatusPill, Tabs, TopBar, fmtDateTime, menuItem, btn } from '../../components/ui';
import { Activity, Documents, History, RecordSummary, Risk, Verifications, printFile, seen } from '../../components/ClientFile';

const how = (r) => (r.removedAt ? ['Left', 'slate'] : r.reviewId ? ['Possible duplicate', 'amber'] : r.mergedFrom ? ['Merged in', 'violet']
  : r.reusedRecord ? ['Record already held', 'blue'] : ['New to the network', 'green']);

/**
 * One FrankieOne record, as the platform sees it: attributes on the left, the
 * full client file in the middle (each run attributed), and every
 * intermediary's relationship on the right.
 */
export default function Record() {
  const { entityId } = useParams();
  const { data, reload } = useOutletContext();
  const [file, setFile] = useState(null);
  const [tab, setTab] = useState('activity');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [focus, setFocus] = useState(null);
  useEffect(() => { setFile(null); setError(''); getEntityFile(entityId).then(setFile).catch((e) => setError(e.message)); }, [entityId]);

  const inv = data?.investors.find((i) => i.entityId === entityId);
  if (!data) return <><TopBar crumbs={[{ label: 'Records', to: '/platform' }]} /><Loading /></>;
  if (!inv) return <><TopBar crumbs={[{ label: 'Records', to: '/platform' }, { label: 'Not found' }]} /><p className="p-5 text-[13px] text-slate-500">That record isn't on the network.</p></>;
  const org = inv.entityType === 'ORGANIZATION';
  const active = inv.relationships.filter((r) => !r.removedAt);

  const left = (
    <>
      <div className="px-5 py-5 border-b border-slate-200">
        <Avatar name={inv.name} kind={inv.entityType} size="lg" />
        <h1 className="mt-3 text-[18px] font-semibold leading-snug text-slate-900">{inv.name}</h1>
        <p className="mt-0.5 text-[13px] text-slate-500">{org ? `${inv.businessType} · ${inv.registration || 'no ABN or ACN'}` : 'Individual'}</p>
      </div>
      <RecordSummary file={file} full onOpenRun={(ref) => { setFocus(ref); setTab('verifications'); }} />
      <Panel title="Details">
        <Attributes rows={[
          ['FrankieOne ID', <CopyValue key="id" value={entityId} />],
          ['State', file?.state || '—'],
          ['First seen', fmtDateTime(seen(file?.verifications).first)],
          ['Last seen', fmtDateTime(seen(file?.verifications).last)],
        ]} />
      </Panel>
      {note && <Panel><p className="text-[13px] text-green-700">{note}</p></Panel>}
    </>
  );

  const right = (
    <Panel title="Relationships" count={active.length}>
      <ul className="space-y-3">
        {inv.relationships.map((r) => {
          const [label, tone] = how(r);
          return (
            <li key={`${r.intermediaryId}-${r.createdAt}`} className={`rounded-lg border border-slate-200 p-3 ${r.removedAt ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-900">{r.intermediary}</p>
                  <p className="text-[12px] text-slate-500">{r.role ? `${r.role} of ${r.business}` : 'Client'}</p>
                </div>
                <StatusPill status={r.status} />
              </div>
              <div className="mt-2.5 grid grid-cols-[72px_1fr] gap-y-1 text-[12px]">
                <span className="text-slate-500">Reference</span><CopyValue value={r.clientRef} />
                <span className="text-slate-500">Handle</span><span className="font-mono text-slate-800">{r.handle}</span>
                {r.workflow && <><span className="text-slate-500">Workflow</span><span className="font-mono text-slate-500 truncate">{r.workflow}</span></>}
              </div>
              <div className="mt-2.5"><Badge tone={tone}>{label}</Badge></div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );

  const main = (
    <>
      <Tabs value={tab} onChange={setTab} tabs={[
        ['activity', 'Activity'],
        ['verifications', 'Verifications', file?.verifications.length],
        ['documents', 'Documents', file?.documents.length],
        ['risk', 'Risk'],
        ['audit', 'Audit'],
      ]} />
      {error && <p className="px-5 pt-3 text-[13px] text-red-700">{error}</p>}
      {!file ? (!error && <Loading>Loading from FrankieOne…</Loading>) : (
        <>
          {tab === 'activity' && <Activity items={file.activity} full onOpenRun={(ref) => { setFocus(ref); setTab('verifications'); }}
            onComment={async (text) => { await addEntityComment(entityId, text); setFile(await getEntityFile(entityId)); }} />}
          {tab === 'audit' && <History items={file.history} full />}
          {tab === 'verifications' && <Verifications key={focus} focus={focus} items={file.verifications} full />}
          {tab === 'documents' && <Documents items={file.documents} full attachmentPath={(d, a) => `/internal/entities/${entityId}/documents/${d.documentId}/attachments/${a.attachmentId}`} />}
          {tab === 'risk' && <Risk risk={file.risk} full />}
        </>
      )}
    </>
  );

  return (
    <>
      <TopBar crumbs={[{ label: 'Records', to: '/platform' }, { label: inv.name }]} actions={
        <Menu className={btn.ghost} label={<MoreHorizontal className="w-4 h-4" />} width="w-72">
          <button data-close disabled={!file} onClick={() => printFile(file, { title: `Client file: ${inv.name}`, subtitle: `Platform compliance view · FrankieOne record ${entityId}`, full: true })} className={menuItem}>
            <Download className="w-4 h-4" /> Download client file (PDF)
          </button>
          {!org && (
            <button data-close onClick={async () => { await forgetIndex(entityId); setNote('Index entries dropped. The next submission of this person relies on the duplicate check.'); reload(); }} className={menuItem}>
              Drop index entry (presenter tool)
            </button>
          )}
        </Menu>
      } />
      <RecordLayout left={left} main={main} right={right} />
    </>
  );
}
