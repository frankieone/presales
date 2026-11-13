import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Building2, Loader2, Plus, Sparkles, Trash2, User } from 'lucide-react';
import { submitClient } from '../../api';
import { Field, TopBar, btn, input } from '../../components/ui';

const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
const EMPTY_PERSON = {
  givenName: '', middleName: '', familyName: '', dateOfBirth: '',
  address: { unitNumber: '', streetNumber: '', streetName: '', streetType: '', locality: '', subdivision: 'VIC', postalCode: '' },
  document: { type: 'DRIVERS_LICENSE', number: '', secondary: '', subdivision: 'VIC', expiry: '', cardColour: 'G', cardReference: '1', nameOnCard: '' },
  email: '', phone: '',
};
const BUSINESS_TYPES = [['COMPANY', 'Company'], ['TRUST', 'Trust'], ['PARTNERSHIP', 'Partnership'], ['OTHER', 'Other organisation']];
const ROLE_OPTIONS = [['DIRECTOR', 'Director'], ['TRUSTEE', 'Trustee'], ['PARTNER', 'Partner'], ['BENEFICIAL_OWNER', 'Beneficial owner'], ['SIGNATORY', 'Authorised signatory']];
const DEFAULT_ROLE = { COMPANY: 'DIRECTOR', TRUST: 'TRUSTEE', PARTNERSHIP: 'PARTNER', OTHER: 'SIGNATORY' };
const EMPTY_BUSINESS = { legalName: '', tradingName: '', type: 'TRUST', abn: '', acn: '', address: { streetNumber: '', streetName: '', streetType: '', locality: '', subdivision: 'VIC', postalCode: '' } };
const FERNTREE = { streetNumber: '35', streetName: 'CONN', streetType: 'STREET', locality: 'FERNTREE GULLY', subdivision: 'VIC', postalCode: '3156' };
const DEMO_BUSINESSES = [
  { id: 'trust', label: 'Testone Family Trust: no ABN, two trustees', business: { ...EMPTY_BUSINESS, legalName: 'Testone Family Trust', type: 'TRUST', address: FERNTREE }, members: [['TRUSTEE', 'testone'], ['TRUSTEE', 'testseven']] },
  { id: 'partnership', label: 'Testeight & Testseven Partnership: no ABN, two partners', business: { ...EMPTY_BUSINESS, legalName: 'Testeight & Testseven Partnership', type: 'PARTNERSHIP', address: { streetNumber: '56', streetName: 'VICTORIA', streetType: 'STREET', locality: 'FINGAL', subdivision: 'TAS', postalCode: '7214' } }, members: [['PARTNER', 'testeight'], ['PARTNER', 'testseven']] },
  { id: 'company', label: 'Testone Holdings Pty Ltd: made-up ACN, register check fails', business: { ...EMPTY_BUSINESS, legalName: 'Testone Holdings Pty Ltd', type: 'COMPANY', acn: '000 000 019', address: FERNTREE }, members: [['DIRECTOR', 'testone']] },
];

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

const Sub = ({ children }) => <h3 className="text-[12px] font-semibold text-slate-500 mb-2.5">{children}</h3>;

/** Name, date of birth, address, identity document and contact for one person. */
function PersonFields({ p, onChange, contact = true }) {
  const set = (path) => (e) => onChange(setIn(p, path, e.target.value));
  const doc = p.document;
  return (
    <div className="space-y-6">
      <div>
        <Sub>Name and date of birth</Sub>
        <div className="grid sm:grid-cols-6 gap-3">
          <Field label="Given name" span={2}><input className={input} value={p.givenName} onChange={set('givenName')} /></Field>
          <Field label="Middle name" span={2}><input className={input} value={p.middleName} onChange={set('middleName')} /></Field>
          <Field label="Family name" span={2}><input className={input} value={p.familyName} onChange={set('familyName')} /></Field>
          <Field label="Date of birth" span={2}><input type="date" className={input} value={p.dateOfBirth} onChange={set('dateOfBirth')} /></Field>
        </div>
      </div>
      <div>
        <Sub>Residential address</Sub>
        <div className="grid sm:grid-cols-6 gap-3">
          <Field label="Unit"><input className={input} value={p.address.unitNumber} onChange={set('address.unitNumber')} /></Field>
          <Field label="Number"><input className={input} value={p.address.streetNumber} onChange={set('address.streetNumber')} /></Field>
          <Field label="Street name" span={3}><input className={input} value={p.address.streetName} onChange={set('address.streetName')} /></Field>
          <Field label="Type"><input className={input} value={p.address.streetType} onChange={set('address.streetType')} placeholder="Street" /></Field>
          <Field label="Suburb" span={3}><input className={input} value={p.address.locality} onChange={set('address.locality')} /></Field>
          <Field label="State">
            <select className={input} value={p.address.subdivision} onChange={set('address.subdivision')}>{STATES.map((x) => <option key={x}>{x}</option>)}</select>
          </Field>
          <Field label="Postcode" span={2}><input className={input} value={p.address.postalCode} onChange={set('address.postalCode')} /></Field>
        </div>
      </div>
      <div>
        <Sub>Identity document</Sub>
        <div className="grid sm:grid-cols-6 gap-3">
          <Field label="Document" span={2}>
            <select className={input} value={doc.type} onChange={set('document.type')}>
              <option value="DRIVERS_LICENSE">Driver licence</option>
              <option value="PASSPORT">Australian passport</option>
              <option value="NATIONAL_HEALTH_ID">Medicare card</option>
            </select>
          </Field>
          <Field label={doc.type === 'NATIONAL_HEALTH_ID' ? 'Card number' : doc.type === 'PASSPORT' ? 'Passport number' : 'Licence number'} span={2}>
            <input className={input} value={doc.number} onChange={set('document.number')} />
          </Field>
          {doc.type === 'DRIVERS_LICENSE' && <>
            <Field label="Card number"><input className={input} value={doc.secondary} onChange={set('document.secondary')} /></Field>
            <Field label="State">
              <select className={input} value={doc.subdivision} onChange={set('document.subdivision')}>{STATES.map((x) => <option key={x}>{x}</option>)}</select>
            </Field>
          </>}
          {doc.type === 'PASSPORT' && <Field label="Expiry" span={2}><input type="date" className={input} value={doc.expiry} onChange={set('document.expiry')} /></Field>}
          {doc.type === 'NATIONAL_HEALTH_ID' && <>
            <Field label="Colour">
              <select className={input} value={doc.cardColour} onChange={set('document.cardColour')}><option value="G">Green</option><option value="B">Blue</option><option value="Y">Yellow</option></select>
            </Field>
            <Field label="Position"><input className={input} value={doc.cardReference} onChange={set('document.cardReference')} /></Field>
          </>}
        </div>
      </div>
      {contact && (
        <div>
          <Sub>Contact <span className="font-normal text-slate-500">(optional)</span></Sub>
          <div className="grid sm:grid-cols-6 gap-3">
            <Field label="Email" span={3}><input type="email" className={input} value={p.email} onChange={set('email')} /></Field>
            <Field label="Mobile" span={3}><input className={input} value={p.phone} onChange={set('phone')} /></Field>
          </div>
        </div>
      )}
    </div>
  );
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex p-0.5 rounded-lg bg-slate-100">
      {options.map(([k, label, Icon]) => (
        <button key={k} onClick={() => onChange(k)}
          className={`h-8 px-3.5 rounded-md text-[13px] inline-flex items-center gap-1.5 ${value === k ? 'bg-white text-slate-900 font-medium shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
          <Icon className="w-4 h-4" strokeWidth={1.75} />{label}
        </button>
      ))}
    </div>
  );
}

const Section = ({ title, actions, children }) => (
  <section className="py-6 border-b border-slate-200 last:border-b-0">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[14px] font-semibold text-slate-900">{title}</h2>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
    {children}
  </section>
);

/**
 * Onboarding a client. The details go to the platform, never to FrankieOne;
 * an intermediary's own systems post the same thing to the API.
 */
export default function Onboard() {
  const { im, people, clients, reload, demo } = useOutletContext();
  const navigate = useNavigate();
  const [kind, setKind] = useState('INDIVIDUAL');
  const [p, setP] = useState(EMPTY_PERSON);
  const [biz, setBiz] = useState(EMPTY_BUSINESS);
  const [members, setMembers] = useState([{ role: 'TRUSTEE', person: EMPTY_PERSON }]);
  const [clientRef, setClientRef] = useState(`${im.id.slice(0, 2).toUpperCase()}-${1001 + (clients?.length || 0)}`);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const testPerson = (id) => people.find((x) => x.id === id)?.person;

  const fill = (value) => {
    if (!value) return;
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
  const setMember = (i, change) => setMembers(members.map((x, j) => (j === i ? { ...x, ...change } : x)));

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
      const c = await submitClient(body);
      reload();
      navigate(`/console/clients/${c.handle}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const wait = Math.round((kind === 'BUSINESS' ? 25000 : demo.minResponseMs || 10000) / 1000);
  return (
    <>
      <TopBar crumbs={[{ label: 'Clients', to: '/console' }, { label: 'New client' }]} actions={
        <label className="flex items-center gap-2 h-8 rounded-md border border-dashed border-slate-300 px-2.5 text-[13px]">
          <Sparkles className="w-4 h-4 text-slate-400 shrink-0" />
          <select value="" onChange={(e) => fill(e.target.value)} className="bg-transparent text-slate-600 focus:outline-none max-w-[16rem]">
            <option value="">Demo: fill with test details…</option>
            <optgroup label="Individuals">{people.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</optgroup>
            <optgroup label="Businesses">{DEMO_BUSINESSES.map((x) => <option key={x.id} value={`biz:${x.id}`}>{x.label}</option>)}</optgroup>
          </select>
        </label>
      } />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 pt-6 pb-10">
          <h1 className="text-[20px] font-semibold text-slate-900">New client</h1>
          <p className="mt-1 text-[13px] text-slate-500">Sent for identity verification. Takes about {wait} seconds.</p>
          <div className="mt-5">
            <Segmented value={kind} onChange={setKind} options={[['INDIVIDUAL', 'Individual', User], ['BUSINESS', 'Business', Building2]]} />
          </div>

          {kind === 'INDIVIDUAL' ? (
            <Section title="Client"><PersonFields p={p} onChange={setP} /></Section>
          ) : (
            <>
              <Section title="Business">
                <div className="space-y-6">
                  <div className="grid sm:grid-cols-6 gap-3">
                    <Field label="Legal name" span={4}><input className={input} value={biz.legalName} onChange={setB('legalName')} /></Field>
                    <Field label="Type" span={2}>
                      <select className={input} value={biz.type} onChange={(e) => {
                        setBiz({ ...biz, type: e.target.value });
                        setMembers(members.map((m) => ({ ...m, role: DEFAULT_ROLE[e.target.value] })));
                      }}>{BUSINESS_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    </Field>
                    <Field label="Trading name (optional)" span={2}><input className={input} value={biz.tradingName} onChange={setB('tradingName')} /></Field>
                    <Field label="ABN (if any)" span={2}><input className={input} value={biz.abn} onChange={setB('abn')} /></Field>
                    <Field label="ACN (if any)" span={2}><input className={input} value={biz.acn} onChange={setB('acn')} /></Field>
                  </div>
                  <div>
                    <Sub>Business address</Sub>
                    <div className="grid sm:grid-cols-6 gap-3">
                      <Field label="Number"><input className={input} value={biz.address.streetNumber} onChange={setB('address.streetNumber')} /></Field>
                      <Field label="Street name" span={3}><input className={input} value={biz.address.streetName} onChange={setB('address.streetName')} /></Field>
                      <Field label="Type" span={2}><input className={input} value={biz.address.streetType} onChange={setB('address.streetType')} placeholder="Street" /></Field>
                      <Field label="Suburb" span={3}><input className={input} value={biz.address.locality} onChange={setB('address.locality')} /></Field>
                      <Field label="State">
                        <select className={input} value={biz.address.subdivision} onChange={setB('address.subdivision')}>{STATES.map((x) => <option key={x}>{x}</option>)}</select>
                      </Field>
                      <Field label="Postcode" span={2}><input className={input} value={biz.address.postalCode} onChange={setB('address.postalCode')} /></Field>
                    </div>
                  </div>
                  <p className="text-[12px] text-slate-500">No ABN or ACN? You'll be asked for the trust deed or partnership agreement instead.</p>
                </div>
              </Section>

              {members.map((m, i) => (
                <Section key={i} title={`Person ${i + 1}`} actions={<>
                  <select className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[13px]" value={m.role} onChange={(e) => setMember(i, { role: e.target.value })}>
                    {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <select className="h-8 rounded-md border border-dashed border-slate-300 bg-white px-2 text-[13px] text-slate-500 max-w-[10rem]" value="" onChange={(e) => e.target.value && setMember(i, { person: fromTest(testPerson(e.target.value)) })}>
                    <option value="">Demo: fill…</option>
                    {people.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select>
                  {members.length > 1 && <button onClick={() => setMembers(members.filter((_, j) => j !== i))} title="Remove person" className={btn.ghost}><Trash2 className="w-4 h-4" /></button>}
                </>}>
                  <PersonFields contact={false} p={m.person} onChange={(np) => setMember(i, { person: np })} />
                </Section>
              ))}
              <div className="pt-4">
                <button onClick={() => setMembers([...members, { role: DEFAULT_ROLE[biz.type], person: EMPTY_PERSON }])} className={btn.secondary}>
                  <Plus className="w-4 h-4" /> Add a person
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] text-slate-600">
            Reference
            <input className="h-8 w-28 rounded-md border border-slate-200 px-2 font-mono text-[13px]" value={clientRef} onChange={(e) => setClientRef(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-slate-700 sm:ml-2">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
            {kind === 'INDIVIDUAL' ? 'Client has consented' : 'Each person has consented'}
          </label>
          <div className="sm:ml-auto flex items-center gap-3">
            {error && <span className="text-[13px] text-red-700">{error}</span>}
            <button onClick={submit} disabled={busy || !ready} className={btn.primary}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}{busy ? 'Verifying…' : 'Submit for verification'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
