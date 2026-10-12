import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Building2, ChevronDown, Code2, Download, Loader2, RefreshCw, User, UserMinus } from 'lucide-react';
import { getClient, getClientFile, idvLink, removeClient, uploadDocument } from '../../api';
import { Card, Details, Loading, StatusPill, Tabs, btn, fmtDateTime } from '../../components/ui';
import { Documents, History, IdvLink, Risk, UploadDocument, Verifications, printFile } from '../../components/ClientFile';
import { subtitle } from './Clients';

const ESTABLISHING_FOR = { Trust: 'TRUST_DEED', Partnership: 'PARTNERSHIP_AGREEMENT', Company: 'CERTIFICATE_OF_REGISTRATION', 'Other organisation': 'CONSTITUTION' };
const ESTABLISHING_LABEL = { Trust: 'trust deed', Partnership: 'partnership agreement', Company: 'certificate of registration', 'Other organisation': 'constitution' };

/**
 * One client, on its own page: the status the platform returned, and the
 * client file (verifications, risk, documents, history) scoped to this
 * intermediary.
 */
export default function ClientPage() {
  const { handle } = useParams();
  const { im, clients, reload } = useOutletContext();
  const navigate = useNavigate();
  const [client, setClient] = useState(() => clients?.find((c) => c.handle === handle) || null);
  const [file, setFile] = useState(null);
  const [tab, setTab] = useState('overview');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showJson, setShowJson] = useState(false);

  const loadFile = useCallback(() => getClientFile(handle).then((f) => { setFile(f); return f; }).catch((e) => { setError(e.message); return null; }), [handle]);
  useEffect(() => {
    getClient(handle).then(setClient).catch((e) => setError(e.message));
    loadFile();
  }, [handle, loadFile]);

  if (!client) return error ? <p className="text-sm text-red-700">{error}</p> : <Loading />;
  const business = client.kind === 'BUSINESS';

  const changed = async (c) => { setClient(c); reload(); await loadFile(); };
  const refresh = async () => {
    setBusy('refresh'); setError('');
    try { await changed(await getClient(handle)); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  const remove = async () => {
    if (!window.confirm(`Remove ${client.name} from ${im.name}'s clients?`)) return;
    setBusy('remove');
    try { await removeClient(handle); reload(); navigate('/console'); } catch (e) { setError(e.message); setBusy(''); }
  };
  const download = () => file && printFile(file, { title: `Client file: ${client.name}`, subtitle: `${im.name} · your reference ${client.clientRef}` });
  const upload = async (body) => changed(await uploadDocument(handle, body));
  const attachmentPath = (person) => (d, a) => `/api/v1/clients/${handle}/documents/${d.documentId}/attachments/${a.attachmentId}${person ? `?person=${person}` : ''}`;
  const mine = client.actions?.filter((a) => a.owner === 'INTERMEDIARY') || [];

  const tabs = [
    ['overview', 'Overview'],
    ...(business ? [['people', 'People', client.people?.length]] : []),
    ['verifications', 'Verifications', file?.verifications.length],
    ['risk', 'Risk'],
    ['documents', 'Documents', file?.documents.length],
    ['history', 'History'],
  ];

  return (
    <>
      <Link to="/console" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="w-4 h-4" /> Clients</Link>

      <div className="mt-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-4 min-w-0">
          <span className="w-14 h-14 rounded-2xl bg-white border border-slate-200 text-slate-500 flex items-center justify-center shrink-0">
            {business ? <Building2 className="w-6 h-6" strokeWidth={1.75} /> : <User className="w-6 h-6" strokeWidth={1.75} />}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-slate-900">{client.name}</h1>
              <StatusPill status={client.status} />
            </div>
            <p className="mt-1 text-[15px] text-slate-500">{subtitle(client)} · reference <span className="font-mono">{client.clientRef}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} disabled={!!busy} className={btn.secondary}>
            {busy === 'refresh' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Check status
          </button>
          <button onClick={download} disabled={!file} className={btn.secondary}><Download className="w-4 h-4" /> Client file (PDF)</button>
        </div>
      </div>
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      <div className="mt-8 grid xl:grid-cols-[1fr_320px] gap-8 items-start">
        <div className="min-w-0">
          <Tabs tabs={tabs} value={tab} onChange={setTab} />
          <div className="pt-6">
            {tab === 'overview' && (
              <div className="space-y-6">
                {mine.length > 0 && (
                  <Card title="What you need to do">
                    <div className="space-y-5">
                      {mine.map((a) => (
                        <div key={a.code} className="flex gap-4">
                          <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" strokeWidth={1.75} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] text-slate-800">{a.message}</p>
                            {['PROVIDE_ESTABLISHING_DOCUMENT', 'CHECK_REGISTRATION'].includes(a.code) && (
                              <div className="mt-4 max-w-md">
                                <UploadDocument defaultType={ESTABLISHING_FOR[client.businessType] || 'OTHER'} onUpload={upload} />
                                <p className="mt-2 text-xs text-slate-500">Upload the {ESTABLISHING_LABEL[client.businessType] || 'establishing document'}.</p>
                              </div>
                            )}
                            {['COLLECT_DOCUMENTS', 'PERSON_DOCUMENTS'].includes(a.code) && (
                              <button onClick={() => setTab(business ? 'people' : 'documents')} className={`${btn.secondary} mt-3`}>Add a document or send an ID check</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
                {client.actions?.filter((a) => a.owner !== 'INTERMEDIARY').map((a) => (
                  <Card key={a.code}><p className="text-[15px] text-slate-700">{a.message}</p></Card>
                ))}

                {business && (
                  <Card title="People behind the business" padded={false}>
                    <ul className="divide-y divide-slate-100">
                      {client.people.map((p, i) => (
                        <li key={i} className="px-6 py-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"><User className="w-4 h-4" /></span>
                            <div><p className="text-[14px] font-medium text-slate-900">{p.name}</p><p className="text-[13px] text-slate-500">{p.role}</p></div>
                          </div>
                          <StatusPill status={p.status} />
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                <Card title="Latest verification" actions={file?.verifications.length > 1 ? <button onClick={() => setTab('verifications')} className={btn.ghost}>See all</button> : null}>
                  {!file ? <Loading>Loading from the platform…</Loading>
                    : file.verifications[0] ? <Verifications items={[file.verifications[0]]} />
                    : <p className="text-sm text-slate-500">{business ? 'Each person behind the business is verified individually. See People.' : 'No verification has run yet.'}</p>}
                </Card>

                <div>
                  <button onClick={() => setShowJson(!showJson)} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
                    <Code2 className="w-4 h-4" /> The API response {im.name} received
                    <ChevronDown className={`w-4 h-4 transition ${showJson ? 'rotate-180' : ''}`} />
                  </button>
                  {showJson && (
                    <div className="mt-3">
                      <p className="text-sm text-slate-500 mb-2">This is everything sent for this client: no FrankieOne entity ID, no other intermediary, no score, no data source.</p>
                      <pre className="text-[12px] leading-relaxed bg-slate-900 text-slate-100 rounded-xl p-5 overflow-x-auto">{JSON.stringify(client, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab !== 'overview' && !file && <Loading>Loading the client file…</Loading>}
            {file && tab === 'verifications' && <Verifications items={file.verifications} />}
            {file && tab === 'risk' && <Risk risk={file.risk} />}
            {file && tab === 'documents' && (
              <div className="space-y-6">
                <div className={`grid gap-4 ${business ? '' : 'md:grid-cols-2'}`}>
                  <UploadDocument defaultType={business ? ESTABLISHING_FOR[client.businessType] || 'OTHER' : 'OTHER'} onUpload={upload} />
                  {!business && <IdvLink who={client.name} onCreate={() => idvLink(handle)} />}
                </div>
                <Documents items={file.documents} attachmentPath={attachmentPath(null)} />
              </div>
            )}
            {file && tab === 'history' && <History items={file.history} />}
            {file && tab === 'people' && <People file={file} handle={handle} onUpload={async (person, body) => changed(await uploadDocument(handle, { ...body, person }))} attachmentPath={attachmentPath} />}

            {file && tab !== 'overview' && (
              <p className="mt-8 text-sm text-slate-500">
                This file shows your own verifications, the documents you supplied or collected, and the history of your own checks. If anyone else on the platform also deals with this client, nothing of theirs appears here.
              </p>
            )}
          </div>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-10">
          <Card title="Details">
            <Details rows={[
              ['Status', <StatusPill key="s" status={client.status} />],
              ['Risk band', client.riskBand],
              ['Your reference', <span key="r" className="font-mono">{client.clientRef}</span>],
              ['Handle', <span key="h" className="font-mono text-slate-600">{client.handle}</span>],
              ['Method', client.method],
              ['Onboarded', fmtDateTime(client.createdAt)],
              ['Last outcome', fmtDateTime(client.completedAt)],
            ]} />
          </Card>
          <Card title="Relationship">
            <p className="text-sm text-slate-500">If this client no longer deals with {im.name}, remove them. Only your relationship ends; the verification record is kept.</p>
            <button onClick={remove} disabled={!!busy} className={`${btn.secondary} mt-4 w-full`}>
              {busy === 'remove' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />} Client has left
            </button>
          </Card>
        </aside>
      </div>
    </>
  );
}

function People({ file, handle, onUpload, attachmentPath }) {
  const [open, setOpen] = useState(file.people[0]?.personHandle || null);
  const [section, setSection] = useState('verifications');
  return (
    <div className="space-y-4">
      {file.people.map((p) => {
        const isOpen = open === p.personHandle;
        return (
          <div key={p.personHandle} className="rounded-2xl border border-slate-200 bg-white">
            <button onClick={() => setOpen(isOpen ? null : p.personHandle)} className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"><User className="w-5 h-5" strokeWidth={1.75} /></span>
                <div><p className="text-[15px] font-medium text-slate-900">{p.name}</p><p className="text-sm text-slate-500">{p.role}</p></div>
              </div>
              <div className="flex items-center gap-3"><StatusPill status={p.status} /><ChevronDown className={`w-5 h-5 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} /></div>
            </button>
            {isOpen && (
              <div className="px-6 pb-6 border-t border-slate-100">
                <div className="pt-2">
                  <Tabs value={section} onChange={setSection} tabs={[['verifications', 'Verifications', p.verifications.length], ['risk', 'Risk'], ['documents', 'Documents', p.documents.length], ['history', 'History']]} />
                </div>
                <div className="pt-6">
                  {section === 'verifications' && <Verifications items={p.verifications} />}
                  {section === 'risk' && <Risk risk={p.risk} />}
                  {section === 'documents' && (
                    <div className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-4">
                        <UploadDocument onUpload={(body) => onUpload(p.personHandle, body)} />
                        <IdvLink who={p.name} onCreate={() => idvLink(handle, p.personHandle)} />
                      </div>
                      <Documents items={p.documents} attachmentPath={attachmentPath(p.personHandle)} />
                    </div>
                  )}
                  {section === 'history' && <History items={p.history} />}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
