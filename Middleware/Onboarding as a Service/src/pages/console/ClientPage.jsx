import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Download, Loader2, MoreHorizontal, RefreshCw, Smartphone, Upload, UserMinus, X } from 'lucide-react';
import { getClient, getClientFile, idvLink, removeClient, uploadDocument } from '../../api';
import { Attributes, Avatar, Loading, Menu, Panel, RecordLayout, StatusPill, Tabs, TopBar, btn, fmtDateTime, menuItem } from '../../components/ui';
import { Documents, History, IdvLink, RecordSummary, Risk, UploadDocument, Verifications, printFile } from '../../components/ClientFile';
import { subtitle } from './Clients';

const ESTABLISHING_FOR = { Trust: 'TRUST_DEED', Partnership: 'PARTNERSHIP_AGREEMENT', Company: 'CERTIFICATE_OF_REGISTRATION', 'Other organisation': 'CONSTITUTION' };

/**
 * One client, laid out like a CRM record: attributes on the left, the client
 * file in the middle, tasks and people on the right. Everything is scoped to
 * this intermediary.
 */
export default function ClientPage() {
  const { handle } = useParams();
  const { im, clients, reload } = useOutletContext();
  const navigate = useNavigate();
  const [client, setClient] = useState(() => clients?.find((c) => c.handle === handle) || null);
  const [file, setFile] = useState(null);
  const [tab, setTab] = useState('activity');
  const [person, setPerson] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [focus, setFocus] = useState(null);

  const loadFile = useCallback(() => getClientFile(handle).then(setFile).catch((e) => setError(e.message)), [handle]);
  useEffect(() => {
    getClient(handle).then(setClient).catch((e) => setError(e.message));
    loadFile();
  }, [handle, loadFile]);

  if (!client) return error ? <p className="p-5 text-[13px] text-red-700">{error}</p> : <Loading />;
  const business = client.kind === 'BUSINESS';
  const subject = person && file ? file.people.find((p) => p.personHandle === person) : null;
  const view = subject || file;

  const changed = async (c) => { if (c) setClient(c); reload(); await loadFile(); };
  const refresh = async () => {
    setBusy('refresh'); setError('');
    try { await changed(await getClient(handle)); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  const remove = async () => {
    if (!window.confirm(`Remove ${client.name} from ${im.name}'s clients? Only your relationship ends.`)) return;
    try { await removeClient(handle); reload(); navigate('/console'); } catch (e) { setError(e.message); }
  };
  const upload = async (body) => changed(await uploadDocument(handle, { ...body, person: subject?.personHandle }));
  const attachmentPath = (d, a) => `/api/v1/clients/${handle}/documents/${d.documentId}/attachments/${a.attachmentId}${subject ? `?person=${subject.personHandle}` : ''}`;
  const tasks = client.actions || [];
  const openRun = (ref) => {
    const owner = business && !subject && file?.people.find((p) => p.verifications.some((v) => v.ref === ref));
    if (owner) setPerson(owner.personHandle);
    setFocus(ref); setTab('verifications');
  };
  // A business is verified through its people: summarise their runs, and the highest risk among them.
  const RANK = ['Low', 'Medium', 'High', 'Unacceptable'];
  const summary = business && !subject && file ? {
    risk: file.people.map((p) => p.risk).filter(Boolean).sort((x, y) => RANK.indexOf(y.level) - RANK.indexOf(x.level))[0] || null,
    verifications: file.people.flatMap((p) => p.verifications.map((v) => ({ ...v, for: p.name })))
      .sort((x, y) => Date.parse(y.startedAt) - Date.parse(x.startedAt)),
  } : view;

  const left = (
    <>
      <div className="px-5 py-5 border-b border-slate-200">
        <Avatar name={client.name} kind={client.kind} size="lg" />
        <h1 className="mt-3 text-[18px] font-semibold leading-snug text-slate-900">{client.name}</h1>
        <p className="mt-0.5 text-[13px] text-slate-500">{subtitle(client)}</p>
        <div className="mt-3"><StatusPill status={client.status} /></div>
      </div>
      <RecordSummary file={summary} onOpenRun={openRun} />
      <Panel title="Details">
        <Attributes rows={[
          ['Reference', <span key="r" className="font-mono">{client.clientRef}</span>],
          ['Handle', <span key="h" className="font-mono text-slate-600">{client.handle}</span>],
          ['Method', client.method],
          ['Onboarded', fmtDateTime(client.createdAt)],
        ]} />
      </Panel>
    </>
  );

  const right = (
    <>
      <Panel title="Open tasks" count={tasks.length}>
        {tasks.length === 0 ? <p className="text-[13px] text-slate-500">Nothing to do.</p> : (
          <ul className="space-y-4">
            {tasks.map((a) => (
              <li key={a.code} className="text-[13px]">
                <p className="text-slate-800">{a.message}</p>
                <p className="mt-1 text-[12px] text-slate-400">{a.owner === 'INTERMEDIARY' ? 'For you' : 'With the platform'}</p>
                {['PROVIDE_ESTABLISHING_DOCUMENT', 'CHECK_REGISTRATION'].includes(a.code) && (
                  <div className="mt-3">
                    <UploadDocument defaultType={ESTABLISHING_FOR[client.businessType] || 'OTHER'} onUpload={async (body) => changed(await uploadDocument(handle, body))} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {business && (
        <Panel title="People" count={client.people?.length}>
          <ul className="-mx-2">
            {(file?.people || []).map((p) => (
              <li key={p.personHandle}>
                <button onClick={() => setPerson(person === p.personHandle ? null : p.personHandle)}
                  className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-left ${person === p.personHandle ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                  <Avatar name={p.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-slate-900 truncate">{p.name}</span>
                    <span className="block text-[12px] text-slate-500">{p.role}</span>
                  </span>
                  <StatusPill status={p.status} />
                </button>
              </li>
            ))}
            {!file && <li className="px-2 text-[13px] text-slate-400">Loading…</li>}
          </ul>
        </Panel>
      )}
    </>
  );

  const tabs = [
    ['activity', 'Activity'],
    ['verifications', 'Verifications', view?.verifications.length],
    ['documents', 'Documents', view?.documents.length],
    ['risk', 'Risk'],
  ];
  const main = (
    <>
      {subject && (
        <div className="h-10 shrink-0 px-5 flex items-center justify-between bg-sky-50 border-b border-sky-100 text-[13px]">
          <span className="text-slate-700">Showing <span className="font-medium">{subject.name}</span>, {subject.role.toLowerCase()}</span>
          <button onClick={() => setPerson(null)} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900"><X className="w-3.5 h-3.5" /> Back to the business</button>
        </div>
      )}
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {error && <p className="px-5 pt-3 text-[13px] text-red-700">{error}</p>}
      {!view ? <Loading>Loading the client file…</Loading> : (
        <>
          {tab === 'activity' && <History items={subject || !business ? view.history : [
            ...view.history,
            ...view.people.flatMap((p) => p.history.map((e) => ({ ...e, who: p.name }))),
          ].sort((x, y) => Date.parse(y.at) - Date.parse(x.at))} />}
          {tab === 'verifications' && (business && !subject && !view.verifications.length
            ? <p className="px-5 py-6 text-[13px] text-slate-500">Each person behind the business is verified individually. Choose someone under People.</p>
            : <Verifications key={`${person || 'main'}-${focus}`} focus={focus} items={view.verifications} />)}
          {tab === 'documents' && <Documents items={view.documents} attachmentPath={attachmentPath} />}
          {tab === 'risk' && <Risk risk={view.risk} />}
        </>
      )}
    </>
  );

  const target = subject ? subject.name : client.name;
  return (
    <>
      <TopBar crumbs={[{ label: 'Clients', to: '/console' }, { label: client.name }]} actions={<>
        <Menu width="w-72" label={<><Upload className="w-4 h-4" /> Upload</>}>
          <div className="p-2"><p className="mb-2 text-[12px] text-slate-500">Add a document for {target}</p><UploadDocument onUpload={upload} /></div>
        </Menu>
        {(!business || subject) && (
          <Menu width="w-80" label={<><Smartphone className="w-4 h-4" /> ID check</>}>
            <div className="p-2"><IdvLink key={target} who={target} onCreate={() => idvLink(handle, subject?.personHandle)} /></div>
          </Menu>
        )}
        <button onClick={refresh} disabled={!!busy} className={btn.secondary}>
          {busy === 'refresh' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Check status
        </button>
        <Menu className={btn.ghost} label={<MoreHorizontal className="w-4 h-4" />}>
          <button data-close disabled={!file} onClick={() => printFile(file, { title: `Client file: ${client.name}`, subtitle: `${im.name} · reference ${client.clientRef}` })} className={menuItem}><Download className="w-4 h-4" /> Download client file (PDF)</button>
          <button data-close onClick={remove} className={`${menuItem} text-red-700`}><UserMinus className="w-4 h-4" /> Client has left</button>
        </Menu>
      </>} />
      <RecordLayout left={left} main={main} right={right} />
    </>
  );
}
