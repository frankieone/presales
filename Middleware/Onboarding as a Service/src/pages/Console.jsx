import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Info, Loader2, LogOut, RefreshCw, UserPlus, X, Code2, UserMinus, User, Download } from 'lucide-react';
import { demoPeople, getClient, getClientFile, getSession, idvLink, listClients, me, removeClient, setSession, submitClient, uploadDocument } from '../api';
import { Documents, History, IdvLink, Risk, UploadDocument, Verifications, printFile } from '../components/ClientFile';

const STATUS = {
  VERIFIED: ['Verified', 'bg-green-50 text-green-700 border-green-200'],
  IN_REVIEW: ['In review', 'bg-amber-50 text-amber-700 border-amber-200'],
  ACTION_REQUIRED: ['Action required', 'bg-orange-50 text-orange-700 border-orange-200'],
  DECLINED: ['Declined', 'bg-red-50 text-red-700 border-red-200'],
};

export function StatusPill({ status }) {
  const [label, cls] = STATUS[status] || [status, 'bg-slate-50 text-slate-600 border-slate-200'];
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}

const ROLE_LABEL = { DIRECTOR: 'Director', TRUSTEE: 'Trustee', PARTNER: 'Partner', BENEFICIAL_OWNER: 'Beneficial owner', SIGNATORY: 'Authorised signatory' };
const ESTABLISHING_FOR = { Trust: 'TRUST_DEED', Partnership: 'PARTNERSHIP_AGREEMENT', Company: 'CERTIFICATE_OF_REGISTRATION', 'Other organisation': 'CONSTITUTION' };
const subtitle = (c) => (c.kind === 'BUSINESS'
  ? `${c.businessType || 'Business'} · ${c.people?.length || 0} ${c.people?.length === 1 ? 'person' : 'people'}`
  : `Born ${c.dateOfBirth}`);

const fmt = (iso) => (iso ? new Date(iso).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/**
 * The intermediary console: what a broker or adviser on the platform works
 * in. It shows only this intermediary's clients, by its own handle and
 * reference, with nothing about other intermediaries or FrankieOne.
 */
export default function Console({ demo }) {
  const navigate = useNavigate();
  const session = getSession();
  const [im, setIm] = useState(null);
  const [clients, setClients] = useState([]);
  const [people, setPeople] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => listClients().then((r) => setClients(r.clients)).catch((e) => setError(e.message)), []);

  useEffect(() => {
    if (session?.role !== 'intermediary') { navigate('/'); return; }
    me().then(setIm).catch(() => navigate('/'));
    demoPeople().then((r) => setPeople(r.people));
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!im) return null;
  const signOut = () => { setSession(null); navigate('/'); };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ background: im.colour }}>
              <Building2 className="w-5 h-5" />
            </span>
            <div>
              <p className="font-semibold text-slate-900">{im.name}</p>
              <p className="text-xs text-slate-500">Client onboarding · powered by {im.platform}</p>
            </div>
          </div>
          <button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1.5">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Your clients</h1>
            <p className="text-sm text-slate-500">{clients.length} {clients.length === 1 ? 'client' : 'clients'}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 inline-flex items-center gap-1.5 hover:bg-white">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg text-white text-sm font-medium inline-flex items-center gap-1.5" style={{ background: im.colour }}>
              <UserPlus className="w-4 h-4" /> Onboard a client
            </button>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 flex gap-3 text-sm text-slate-600">
          <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p>
              This is <span className="font-medium text-slate-800">{im.name}</span>'s onboarding console, provided by {im.platform}.
              When you onboard a client, {im.platform} verifies them through FrankieOne on your behalf and tells you the outcome.
            </p>
            <p className="mt-1 text-slate-500">
              You only ever see your own clients, under your own reference. You can't see FrankieOne, or whether anyone else on {im.platform} also deals with a client.
              Your own systems can do the same through the API: <code className="text-xs bg-slate-100 px-1 rounded">POST /api/v1/clients</code>.
            </p>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-left px-4 py-3">Your reference</th>
                <th className="text-left px-4 py-3">Handle</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Risk</th>
                <th className="text-left px-4 py-3">Completed</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No clients yet. Onboard one to start.</td></tr>
              )}
              {clients.map((c) => (
                <tr key={c.handle} onClick={() => setSelected(c)} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 flex items-center gap-1.5">
                      {c.kind === 'BUSINESS' ? <Building2 className="w-3.5 h-3.5 text-slate-400" /> : <User className="w-3.5 h-3.5 text-slate-400" />}
                      {c.name}
                    </p>
                    <p className="text-xs text-slate-500">{subtitle(c)}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{c.clientRef}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.handle}</td>
                  <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{c.riskBand}</td>
                  <td className="px-4 py-3 text-slate-500">{fmt(c.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {showForm && (
        <OnboardForm im={im} people={people} count={clients.length} minResponseMs={demo.minResponseMs}
          onClose={() => setShowForm(false)}
          onDone={(c) => { setShowForm(false); load(); setSelected(c); }} />
      )}
      {selected && (
        <ClientPanel key={selected.handle} client={selected} imName={im.name} onClose={() => setSelected(null)}
          onChanged={(c) => { load(); setSelected(c); }} />
      )}
    </div>
  );
}

const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
const EMPTY_PERSON = {
  givenName: '', middleName: '', familyName: '', dateOfBirth: '',
  address: { unitNumber: '', streetNumber: '', streetName: '', streetType: '', locality: '', subdivision: 'VIC', postalCode: '' },
  document: { type: 'DRIVERS_LICENSE', number: '', secondary: '', subdivision: 'VIC', expiry: '', cardColour: 'G', cardReference: '1', nameOnCard: '' },
  email: '', phone: '',
};

function Field({ label, children, hint, wide }) {
  return (
    <label className={`block text-xs font-medium text-slate-600 ${wide ? 'sm:col-span-2' : ''}`}>
      {label}
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] font-normal text-slate-400">{hint}</p>}
    </label>
  );
}
const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300';

/** A person's details as the API expects them. */
function toPersonPayload(p) {
  const doc = p.document;
  const document = { type: doc.type, number: doc.number.trim(), country: 'AUS' };
  if (doc.type === 'DRIVERS_LICENSE') Object.assign(document, { secondary: doc.secondary.trim(), subdivision: doc.subdivision });
  if (doc.type === 'PASSPORT') Object.assign(document, { expiry: doc.expiry });
  if (doc.type === 'NATIONAL_HEALTH_ID') Object.assign(document, { cardColour: doc.cardColour, cardReference: doc.cardReference, nameOnCard: doc.nameOnCard || [p.givenName, p.middleName, p.familyName].filter(Boolean).join(' ').toUpperCase(), expiry: doc.expiry || '2030-01-01', subdivision: p.address.subdivision });
  return {
    givenName: p.givenName.trim(), middleName: p.middleName.trim() || undefined, familyName: p.familyName.trim(), dateOfBirth: p.dateOfBirth,
    address: Object.fromEntries(Object.entries(p.address).filter(([, v]) => v)), document,
    email: p.email.trim() || undefined, phone: p.phone.trim() || undefined,
  };
}
const fromTest = (t) => ({
  ...EMPTY_PERSON, ...t, middleName: t.middleName || '', email: t.email || '', phone: t.phone || '',
  address: { ...EMPTY_PERSON.address, ...t.address }, document: { ...EMPTY_PERSON.document, ...t.document },
});
const personComplete = (p) => p.givenName && p.familyName && p.dateOfBirth && p.document.number;
const setIn = (obj, path, v) => {
  const next = structuredClone(obj);
  const keys = path.split('.');
  keys.slice(0, -1).reduce((o, k) => o[k], next)[keys.at(-1)] = v;
  return next;
};

/** Name, date of birth, address, identity document and contact for one person. */
function PersonFields({ p, onChange, compact }) {
  const set = (path) => (e) => onChange(setIn(p, path, e.target.value));
  const doc = p.document;
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-4 gap-3">
        <Field label="Given name"><input className={inputCls} value={p.givenName} onChange={set('givenName')} /></Field>
        <Field label="Middle name"><input className={inputCls} value={p.middleName} onChange={set('middleName')} /></Field>
        <Field label="Family name"><input className={inputCls} value={p.familyName} onChange={set('familyName')} /></Field>
        <Field label="Date of birth"><input type="date" className={inputCls} value={p.dateOfBirth} onChange={set('dateOfBirth')} /></Field>
      </div>
      <div className="grid sm:grid-cols-4 gap-3">
        <Field label="Unit"><input className={inputCls} value={p.address.unitNumber} onChange={set('address.unitNumber')} /></Field>
        <Field label="Number"><input className={inputCls} value={p.address.streetNumber} onChange={set('address.streetNumber')} /></Field>
        <Field label="Street name" wide><input className={inputCls} value={p.address.streetName} onChange={set('address.streetName')} /></Field>
        <Field label="Street type"><input className={inputCls} value={p.address.streetType} onChange={set('address.streetType')} placeholder="STREET" /></Field>
        <Field label="Suburb"><input className={inputCls} value={p.address.locality} onChange={set('address.locality')} /></Field>
        <Field label="State">
          <select className={inputCls} value={p.address.subdivision} onChange={set('address.subdivision')}>{STATES.map((x) => <option key={x}>{x}</option>)}</select>
        </Field>
        <Field label="Postcode"><input className={inputCls} value={p.address.postalCode} onChange={set('address.postalCode')} /></Field>
      </div>
      <div className="grid sm:grid-cols-4 gap-3">
        <Field label="ID document">
          <select className={inputCls} value={doc.type} onChange={set('document.type')}>
            <option value="DRIVERS_LICENSE">Driver licence</option>
            <option value="PASSPORT">Australian passport</option>
            <option value="NATIONAL_HEALTH_ID">Medicare card</option>
          </select>
        </Field>
        <Field label={doc.type === 'NATIONAL_HEALTH_ID' ? 'Card number' : doc.type === 'PASSPORT' ? 'Passport number' : 'Licence number'}>
          <input className={inputCls} value={doc.number} onChange={set('document.number')} />
        </Field>
        {doc.type === 'DRIVERS_LICENSE' && <>
          <Field label="Card number"><input className={inputCls} value={doc.secondary} onChange={set('document.secondary')} /></Field>
          <Field label="Issuing state">
            <select className={inputCls} value={doc.subdivision} onChange={set('document.subdivision')}>{STATES.map((x) => <option key={x}>{x}</option>)}</select>
          </Field>
        </>}
        {doc.type === 'PASSPORT' && <Field label="Expiry"><input type="date" className={inputCls} value={doc.expiry} onChange={set('document.expiry')} /></Field>}
        {doc.type === 'NATIONAL_HEALTH_ID' && <>
          <Field label="Colour">
            <select className={inputCls} value={doc.cardColour} onChange={set('document.cardColour')}><option value="G">Green</option><option value="B">Blue</option><option value="Y">Yellow</option></select>
          </Field>
          <Field label="Position on card"><input className={inputCls} value={doc.cardReference} onChange={set('document.cardReference')} /></Field>
        </>}
      </div>
      {!compact && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Email (optional)"><input type="email" className={inputCls} value={p.email} onChange={set('email')} /></Field>
          <Field label="Mobile (optional)"><input className={inputCls} value={p.phone} onChange={set('phone')} /></Field>
        </div>
      )}
    </div>
  );
}

const BUSINESS_TYPES = [['COMPANY', 'Company'], ['TRUST', 'Trust'], ['PARTNERSHIP', 'Partnership'], ['OTHER', 'Other organisation']];
const ROLE_OPTIONS = [['DIRECTOR', 'Director'], ['TRUSTEE', 'Trustee'], ['PARTNER', 'Partner'], ['BENEFICIAL_OWNER', 'Beneficial owner'], ['SIGNATORY', 'Authorised signatory']];
const DEFAULT_ROLE = { COMPANY: 'DIRECTOR', TRUST: 'TRUSTEE', PARTNERSHIP: 'PARTNER', OTHER: 'SIGNATORY' };
const EMPTY_BUSINESS = { legalName: '', tradingName: '', type: 'TRUST', abn: '', acn: '', address: { streetNumber: '', streetName: '', streetType: '', locality: '', subdivision: 'VIC', postalCode: '' } };
const FERNTREE = { streetNumber: '35', streetName: 'CONN', streetType: 'STREET', locality: 'FERNTREE GULLY', subdivision: 'VIC', postalCode: '3156' };
const DEMO_BUSINESSES = [
  { id: 'trust', label: 'Testone Family Trust — no ABN, two trustees', business: { ...EMPTY_BUSINESS, legalName: 'Testone Family Trust', type: 'TRUST', address: FERNTREE }, members: [['TRUSTEE', 'testone'], ['TRUSTEE', 'testseven']] },
  { id: 'partnership', label: 'Testeight & Testseven Partnership — no ABN, two partners', business: { ...EMPTY_BUSINESS, legalName: 'Testeight & Testseven Partnership', type: 'PARTNERSHIP', address: { streetNumber: '56', streetName: 'VICTORIA', streetType: 'STREET', locality: 'FINGAL', subdivision: 'TAS', postalCode: '7214' } }, members: [['PARTNER', 'testeight'], ['PARTNER', 'testseven']] },
  { id: 'company', label: 'Testone Holdings Pty Ltd — made-up ACN, so the register check fails', business: { ...EMPTY_BUSINESS, legalName: 'Testone Holdings Pty Ltd', type: 'COMPANY', acn: '000 000 019', address: FERNTREE }, members: [['DIRECTOR', 'testone']] },
];

/**
 * The onboarding form an intermediary's staff fill in (or their own system
 * posts to the same API). The details go to the platform, never to FrankieOne.
 */
function OnboardForm({ im, people, count, minResponseMs, onClose, onDone }) {
  const [kind, setKind] = useState('INDIVIDUAL');
  const [p, setP] = useState(EMPTY_PERSON);
  const [biz, setBiz] = useState(EMPTY_BUSINESS);
  const [members, setMembers] = useState([{ role: 'TRUSTEE', person: EMPTY_PERSON }]);
  const [clientRef, setClientRef] = useState(`${im.id.slice(0, 2).toUpperCase()}-${1001 + count}`);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const testPerson = (id) => people.find((x) => x.id === id)?.person;

  const fill = (value) => {
    if (value.startsWith('biz:')) {
      const d = DEMO_BUSINESSES.find((x) => x.id === value.slice(4));
      setKind('BUSINESS');
      setBiz(structuredClone(d.business));
      setMembers(d.members.map(([role, id]) => ({ role, person: fromTest(testPerson(id)) })));
    } else {
      setKind('INDIVIDUAL');
      setP(fromTest(testPerson(value)));
    }
    setConsent(true);
  };
  const setB = (path) => (e) => setBiz(setIn(biz, path, e.target.value));

  const ready = consent && (kind === 'INDIVIDUAL'
    ? personComplete(p)
    : biz.legalName && members.length && members.every((m) => personComplete(m.person)));

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const body = kind === 'INDIVIDUAL'
        ? { clientRef, consent, person: toPersonPayload(p) }
        : {
            clientRef, consent,
            business: {
              legalName: biz.legalName.trim(), tradingName: biz.tradingName.trim() || undefined, type: biz.type,
              abn: biz.abn.replace(/\s/g, '') || undefined, acn: biz.acn.replace(/\s/g, '') || undefined,
              address: Object.fromEntries(Object.entries(biz.address).filter(([, v]) => v)),
            },
            people: members.map((m) => ({ role: m.role, person: toPersonPayload(m.person) })),
          };
      onDone(await submitClient(body));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const wait = Math.round((kind === 'BUSINESS' ? 25000 : minResponseMs) / 1000);
  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Onboard a client</h2>
            <p className="text-xs text-slate-500">Sent to {im.platform} for verification. You'll get a status back, not the checks.</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="grid md:grid-cols-[1fr_230px]">
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2">
              <span className="text-xs text-slate-500 shrink-0">Demo helper</span>
              <select value="" onChange={(e) => fill(e.target.value)} className="flex-1 text-sm bg-transparent focus:outline-none">
                <option value="" disabled>Fill with FrankieOne UAT test details…</option>
                <optgroup label="Individuals">
                  {people.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </optgroup>
                <optgroup label="Businesses">
                  {DEMO_BUSINESSES.map((x) => <option key={x.id} value={`biz:${x.id}`}>{x.label}</option>)}
                </optgroup>
              </select>
            </div>

            <div className="inline-flex rounded-lg border border-slate-300 p-0.5 text-sm">
              {[['INDIVIDUAL', 'Individual'], ['BUSINESS', 'Business']].map(([k, label]) => (
                <button key={k} onClick={() => setKind(k)}
                  className={`px-4 py-1.5 rounded-md ${kind === k ? 'text-white' : 'text-slate-600'}`} style={kind === k ? { background: im.colour } : {}}>
                  {label}
                </button>
              ))}
            </div>

            {kind === 'INDIVIDUAL' ? (
              <section>
                <h3 className="text-sm font-semibold text-slate-800">Client</h3>
                <div className="mt-2"><PersonFields p={p} onChange={setP} /></div>
              </section>
            ) : (
              <>
                <section>
                  <h3 className="text-sm font-semibold text-slate-800">Business</h3>
                  <div className="mt-2 grid sm:grid-cols-4 gap-3">
                    <Field label="Legal name" wide><input className={inputCls} value={biz.legalName} onChange={setB('legalName')} /></Field>
                    <Field label="Trading name (optional)"><input className={inputCls} value={biz.tradingName} onChange={setB('tradingName')} /></Field>
                    <Field label="Type">
                      <select className={inputCls} value={biz.type} onChange={(e) => {
                        setBiz({ ...biz, type: e.target.value });
                        setMembers(members.map((m) => ({ ...m, role: DEFAULT_ROLE[e.target.value] })));
                      }}>{BUSINESS_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    </Field>
                    <Field label="ABN (if it has one)"><input className={inputCls} value={biz.abn} onChange={setB('abn')} /></Field>
                    <Field label="ACN (if it has one)"><input className={inputCls} value={biz.acn} onChange={setB('acn')} /></Field>
                    <p className="sm:col-span-2 self-end text-[11px] text-slate-400 pb-2">Many trusts and partnerships have neither. Without one, there's no register to check, so you'll be asked for the document that establishes the business.</p>
                  </div>
                  <div className="mt-3 grid sm:grid-cols-6 gap-3">
                    <Field label="Number"><input className={inputCls} value={biz.address.streetNumber} onChange={setB('address.streetNumber')} /></Field>
                    <Field label="Street name" wide><input className={inputCls} value={biz.address.streetName} onChange={setB('address.streetName')} /></Field>
                    <Field label="Street type"><input className={inputCls} value={biz.address.streetType} onChange={setB('address.streetType')} /></Field>
                    <Field label="Suburb"><input className={inputCls} value={biz.address.locality} onChange={setB('address.locality')} /></Field>
                    <Field label="Postcode"><input className={inputCls} value={biz.address.postalCode} onChange={setB('address.postalCode')} /></Field>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-slate-800">People behind the business</h3>
                  <p className="text-xs text-slate-500">Directors, trustees, partners, beneficial owners and signatories. Each one is verified.</p>
                  <div className="mt-3 space-y-4">
                    {members.map((m, i) => (
                      <div key={i} className="rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 whitespace-nowrap">Person {i + 1}</span>
                            <select className="text-sm border border-slate-300 rounded-md px-2 py-1" value={m.role}
                              onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}>
                              {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                            <select className="text-xs border border-dashed border-slate-300 rounded-md px-2 py-1 text-slate-500" value=""
                              onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, person: fromTest(testPerson(e.target.value)) } : x)))}>
                              <option value="" disabled>Fill with a test person…</option>
                              {people.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                            </select>
                          </div>
                          {members.length > 1 && (
                            <button onClick={() => setMembers(members.filter((_, j) => j !== i))} className="text-xs text-slate-400 hover:text-slate-700">Remove</button>
                          )}
                        </div>
                        <PersonFields compact p={m.person} onChange={(np) => setMembers(members.map((x, j) => (j === i ? { ...x, person: np } : x)))} />
                      </div>
                    ))}
                    <button onClick={() => setMembers([...members, { role: DEFAULT_ROLE[biz.type], person: EMPTY_PERSON }])}
                      className="text-sm text-slate-600 inline-flex items-center gap-1.5 hover:text-slate-900">
                      <UserPlus className="w-4 h-4" /> Add another person
                    </button>
                  </div>
                </section>
              </>
            )}

            <section className="grid sm:grid-cols-2 gap-3 items-end">
              <Field label="Your client reference" hint="Your own ID for this client. It's how you'll find them here.">
                <input className={`${inputCls} font-mono`} value={clientRef} onChange={(e) => setClientRef(e.target.value)} />
              </Field>
              <label className="flex items-start gap-2 text-sm text-slate-700 pb-6">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
                {kind === 'INDIVIDUAL' ? 'The client has consented to their identity being verified.' : 'Each person has consented to their identity being verified.'}
              </label>
            </section>
            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>

          <aside className="bg-slate-50 md:rounded-br-xl p-5 text-xs text-slate-600 space-y-3 border-t md:border-t-0 md:border-l border-slate-100">
            <p className="font-semibold text-slate-800 text-sm">What happens when you submit</p>
            <ol className="space-y-2 list-decimal pl-4">
              <li>The details go to {im.platform}'s onboarding API. You never connect to FrankieOne.</li>
              {kind === 'INDIVIDUAL'
                ? <li>{im.platform} verifies the client's identity and screens them, using the checks set for {im.name}.</li>
                : <>
                    <li>{im.platform} records the business, and checks it against the business register if it has an ABN or ACN.</li>
                    <li>Every person is verified and screened, and linked to the business with their role.</li>
                  </>}
              <li>You get back a status, a risk band and anything you need to do{kind === 'BUSINESS' ? ', with each person’s status' : ''}.</li>
            </ol>
            <p className="text-slate-500">Takes about {wait} seconds, whoever the client is.</p>
          </aside>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">Cancel</button>
          <button onClick={submit} disabled={busy || !ready}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-50" style={{ background: im.colour }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {busy ? 'Verifying…' : 'Submit for verification'}
          </button>
        </div>
      </div>
    </div>
  );
}

const TABS = [['summary', 'Summary'], ['verifications', 'Verifications'], ['risk', 'Risk'], ['documents', 'Documents'], ['history', 'History']];

/**
 * One client: the status the platform returned, and the client file
 * (verifications, risk, documents, history) scoped to this intermediary.
 */
function ClientPanel({ client, imName, onClose, onChanged }) {
  const business = client.kind === 'BUSINESS';
  const [tab, setTab] = useState('summary');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [person, setPerson] = useState(null);

  const loadFile = useCallback(async () => {
    setLoading(true); setError('');
    try { const f = await getClientFile(client.handle); setFile(f); return f; } catch (e) { setError(e.message); return null; } finally { setLoading(false); }
  }, [client.handle]);
  useEffect(() => { if (tab !== 'summary' && !file) loadFile(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async () => {
    setBusy('refresh'); setError('');
    try { onChanged(await getClient(client.handle)); if (file) await loadFile(); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  const remove = async () => {
    setBusy('remove'); setError('');
    try { await removeClient(client.handle); onChanged(null); onClose(); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  const upload = async (body) => { onChanged(await uploadDocument(client.handle, body)); await loadFile(); };
  const download = async () => {
    setBusy('print');
    const f = file || await loadFile();
    setBusy('');
    if (f) printFile(f, { title: `Client file: ${client.name}`, subtitle: `${imName} · your reference ${client.clientRef} · ${client.handle}` });
  };
  const attachmentPath = (personHandle) => (d, a) => `/api/v1/clients/${client.handle}/documents/${d.documentId}/attachments/${a.attachmentId}${personHandle ? `?person=${personHandle}` : ''}`;
  const tabs = business ? [...TABS.slice(0, 1), ['people', 'People'], ...TABS.slice(1)] : TABS;

  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex justify-end">
      <div className="bg-white w-full max-w-2xl h-full overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 px-6 pt-8 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{client.name}</h2>
              <p className="text-sm text-slate-500">{subtitle(client)} · <StatusPill status={client.status} /></p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={download} disabled={!!busy} className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs inline-flex items-center gap-1.5">
                {busy === 'print' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Client file (PDF)
              </button>
              <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
          </div>
          <nav className="mt-4 flex gap-4 text-sm overflow-x-auto">
            {tabs.map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`pb-2 border-b-2 whitespace-nowrap ${tab === k ? 'border-slate-900 text-slate-900 font-medium' : 'border-transparent text-slate-500'}`}>{label}</button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
          {tab !== 'summary' && loading && !file && <p className="text-sm text-slate-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading the client file…</p>}

          {tab === 'summary' && (
            <>
              <dl className="grid grid-cols-2 gap-y-3 text-sm">
                <dt className="text-slate-500">Status</dt><dd><StatusPill status={client.status} /></dd>
                <dt className="text-slate-500">Risk band</dt><dd>{client.riskBand}</dd>
                <dt className="text-slate-500">Your reference</dt><dd className="font-mono text-xs">{client.clientRef}</dd>
                <dt className="text-slate-500">Handle</dt><dd className="font-mono text-xs">{client.handle}</dd>
                <dt className="text-slate-500">Method</dt><dd>{client.method}</dd>
                <dt className="text-slate-500">Completed</dt><dd>{fmt(client.completedAt)}</dd>
              </dl>

              {business && client.people?.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-slate-700">People</h3>
                  <ul className="mt-2 divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    {client.people.map((x, i) => (
                      <li key={i} className="px-3 py-2 flex items-center justify-between text-sm">
                        <span><span className="text-slate-900">{x.name}</span> <span className="text-xs text-slate-500">· {ROLE_LABEL[x.role] || x.role}</span></span>
                        <StatusPill status={x.status} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {client.actions?.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-slate-700">Actions</h3>
                  {client.actions.map((a) => (
                    <div key={a.code} className="mt-2 text-sm bg-slate-50 rounded-lg p-3">
                      <p className="text-slate-700">{a.message}</p>
                      <p className="mt-1 text-xs text-slate-400">{a.owner === 'INTERMEDIARY' ? 'For you to do' : 'With the platform'} · {a.code}</p>
                      {['PROVIDE_ESTABLISHING_DOCUMENT', 'CHECK_REGISTRATION'].includes(a.code) && (
                        <div className="mt-2">
                          <UploadDocument defaultType={ESTABLISHING_FOR[client.businessType] || 'OTHER'}
                            onUpload={async (body) => { onChanged(await uploadDocument(client.handle, body)); setFile(null); }} />
                        </div>
                      )}
                      {['COLLECT_DOCUMENTS', 'PERSON_DOCUMENTS'].includes(a.code) && (
                        <button onClick={() => setTab(business ? 'people' : 'documents')} className="mt-2 text-xs underline text-slate-600">Add a document or send an ID verification link</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex gap-2">
                <button onClick={refresh} disabled={!!busy} className="px-3 py-2 rounded-lg border border-slate-300 text-sm inline-flex items-center gap-1.5">
                  {busy === 'refresh' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Check status
                </button>
                <button onClick={remove} disabled={!!busy} className="px-3 py-2 rounded-lg border border-slate-300 text-sm inline-flex items-center gap-1.5 text-slate-600">
                  {busy === 'remove' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />} Client has left
                </button>
              </div>

              <button onClick={() => setShowJson(!showJson)} className="mt-8 text-xs text-slate-500 inline-flex items-center gap-1.5">
                <Code2 className="w-4 h-4" /> {showJson ? 'Hide' : 'Show'} the API response
              </button>
              {showJson && (
                <>
                  <p className="mt-2 text-xs text-slate-500">Everything this intermediary received for this client. No entity ID, no other intermediary, no score, no data source.</p>
                  <pre className="mt-2 text-[11px] bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto">{JSON.stringify(client, null, 2)}</pre>
                </>
              )}
            </>
          )}

          {file && tab === 'verifications' && <Verifications items={file.verifications} />}
          {file && tab === 'risk' && <Risk risk={file.risk} />}
          {file && tab === 'documents' && (
            <div className="space-y-4">
              <UploadDocument defaultType={business ? ESTABLISHING_FOR[client.businessType] || 'OTHER' : 'OTHER'} onUpload={upload} />
              {!business && <IdvLink who={client.name} onCreate={() => idvLink(client.handle)} />}
              <Documents items={file.documents} attachmentPath={attachmentPath(null)} />
            </div>
          )}
          {file && tab === 'history' && <History items={file.history} />}
          {file && tab === 'people' && (
            <div className="space-y-3">
              {file.people.map((p) => (
                <div key={p.personHandle} className="rounded-lg border border-slate-200">
                  <button onClick={() => setPerson(person === p.personHandle ? null : p.personHandle)} className="w-full px-4 py-3 flex items-center justify-between text-left">
                    <span><span className="font-medium text-slate-900">{p.name}</span> <span className="text-xs text-slate-500">· {p.role}</span></span>
                    <span className="flex items-center gap-2"><StatusPill status={p.status} /><span className="text-xs text-slate-400">{person === p.personHandle ? 'Hide' : 'Open'}</span></span>
                  </button>
                  {person === p.personHandle && (
                    <div className="px-4 pb-4 space-y-5 border-t border-slate-100 pt-4">
                      <section><h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Verifications</h4><Verifications items={p.verifications} /></section>
                      <section><h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Risk</h4><Risk risk={p.risk} /></section>
                      <section className="space-y-3">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Documents</h4>
                        <UploadDocument onUpload={async (body) => { onChanged(await uploadDocument(client.handle, { ...body, person: p.personHandle })); await loadFile(); }} />
                        <IdvLink who={p.name} onCreate={() => idvLink(client.handle, p.personHandle)} />
                        <Documents items={p.documents} attachmentPath={attachmentPath(p.personHandle)} />
                      </section>
                      <section><h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">History</h4><History items={p.history} /></section>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {file && tab !== 'summary' && (
            <p className="mt-6 text-[11px] text-slate-400">
              This file shows your own verifications, the documents you supplied or collected, and the history of your own checks.
              If anyone else on the platform also deals with this client, nothing of theirs appears here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
