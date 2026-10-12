import { useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowLeft, Building2, Loader2, Plus, Sparkles, Trash2, User, UserPlus } from 'lucide-react';
import { submitClient } from '../../api';
import { Card, Field, btn, input } from '../../components/ui';

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

const Sub = ({ children }) => <h3 className="text-[13px] font-semibold text-slate-900 mb-3">{children}</h3>;

/** Name, date of birth, address, identity document and contact for one person. */
function PersonFields({ p, onChange, contact = true }) {
  const set = (path) => (e) => onChange(setIn(p, path, e.target.value));
  const doc = p.document;
  return (
    <div className="space-y-8">
      <div>
        <Sub>Name and date of birth</Sub>
        <div className="grid sm:grid-cols-6 gap-4">
          <Field label="Given name" span={2}><input className={input} value={p.givenName} onChange={set('givenName')} /></Field>
          <Field label="Middle name" span={2}><input className={input} value={p.middleName} onChange={set('middleName')} /></Field>
          <Field label="Family name" span={2}><input className={input} value={p.familyName} onChange={set('familyName')} /></Field>
          <Field label="Date of birth" span={2}><input type="date" className={input} value={p.dateOfBirth} onChange={set('dateOfBirth')} /></Field>
        </div>
      </div>
      <div>
        <Sub>Residential address</Sub>
        <div className="grid sm:grid-cols-6 gap-4">
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
        <div className="grid sm:grid-cols-6 gap-4">
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
          <div className="grid sm:grid-cols-6 gap-4">
            <Field label="Email" span={3}><input type="email" className={input} value={p.email} onChange={set('email')} /></Field>
            <Field label="Mobile" span={3}><input className={input} value={p.phone} onChange={set('phone')} /></Field>
          </div>
        </div>
      )}
    </div>
  );
}

function KindOption({ active, icon: Icon, title, text, onClick, colour }) {
  return (
    <button onClick={onClick} className={`text-left rounded-2xl border-2 p-5 transition ${active ? 'bg-white' : 'bg-white/60 border-slate-200 hover:border-slate-300'}`} style={active ? { borderColor: colour } : {}}>
      <Icon className="w-6 h-6" style={{ color: active ? colour : '#94a3b8' }} strokeWidth={1.75} />
      <p className="mt-3 text-[15px] font-semibold text-slate-900">{title}</p>
      <p className="mt-0.5 text-sm text-slate-500">{text}</p>
    </button>
  );
}

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
      <Link to="/console" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="w-4 h-4" /> Clients</Link>
      <div className="mt-5 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-slate-900">Onboard a client</h1>
          <p className="mt-2 text-[15px] text-slate-500">Sent to {im.platform} for verification. You get back a status, not the checks.</p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm md:w-[420px]">
          <Sparkles className="w-4 h-4 text-slate-400 shrink-0" />
          <select value="" onChange={(e) => fill(e.target.value)} className="flex-1 min-w-0 bg-transparent text-slate-600 focus:outline-none">
            <option value="">Demo: fill with FrankieOne test details…</option>
            <optgroup label="Individuals">{people.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</optgroup>
            <optgroup label="Businesses">{DEMO_BUSINESSES.map((x) => <option key={x.id} value={`biz:${x.id}`}>{x.label}</option>)}</optgroup>
          </select>
        </label>
      </div>

      <div className="grid xl:grid-cols-[1fr_320px] gap-8 items-start">
        <div className="space-y-6 min-w-0">
          <div className="grid sm:grid-cols-2 gap-4">
            <KindOption active={kind === 'INDIVIDUAL'} onClick={() => setKind('INDIVIDUAL')} icon={User} colour={im.colour} title="An individual" text="A person, verified with their ID document." />
            <KindOption active={kind === 'BUSINESS'} onClick={() => setKind('BUSINESS')} icon={Building2} colour={im.colour} title="A business" text="A company, trust or partnership, and the people behind it." />
          </div>

          {kind === 'INDIVIDUAL' ? (
            <Card title="Client details"><PersonFields p={p} onChange={setP} /></Card>
          ) : (
            <>
              <Card title="Business details">
                <div className="space-y-8">
                  <div className="grid sm:grid-cols-6 gap-4">
                    <Field label="Legal name" span={4}><input className={input} value={biz.legalName} onChange={setB('legalName')} /></Field>
                    <Field label="Type" span={2}>
                      <select className={input} value={biz.type} onChange={(e) => {
                        setBiz({ ...biz, type: e.target.value });
                        setMembers(members.map((m) => ({ ...m, role: DEFAULT_ROLE[e.target.value] })));
                      }}>{BUSINESS_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    </Field>
                    <Field label="Trading name" span={2} hint="Optional"><input className={input} value={biz.tradingName} onChange={setB('tradingName')} /></Field>
                    <Field label="ABN" span={2} hint="If it has one"><input className={input} value={biz.abn} onChange={setB('abn')} /></Field>
                    <Field label="ACN" span={2} hint="If it has one"><input className={input} value={biz.acn} onChange={setB('acn')} /></Field>
                  </div>
                  <div>
                    <Sub>Business address</Sub>
                    <div className="grid sm:grid-cols-6 gap-4">
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
                  <p className="text-sm text-slate-500">Many trusts and partnerships have neither an ABN nor an ACN. Without one there's no register to check, so you'll be asked for the document that establishes the business.</p>
                </div>
              </Card>

              {members.map((m, i) => (
                <Card key={i}
                  title={`Person ${i + 1}`}
                  description="Each person is verified and linked to the business in their role."
                  actions={<>
                    <select className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm" value={m.role} onChange={(e) => setMember(i, { role: e.target.value })}>
                      {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <select className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-500 max-w-[11rem]" value="" onChange={(e) => e.target.value && setMember(i, { person: fromTest(testPerson(e.target.value)) })}>
                      <option value="">Demo: fill…</option>
                      {people.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                    {members.length > 1 && <button onClick={() => setMembers(members.filter((_, j) => j !== i))} title="Remove person" className={btn.ghost}><Trash2 className="w-4 h-4" /></button>}
                  </>}>
                  <PersonFields contact={false} p={m.person} onChange={(np) => setMember(i, { person: np })} />
                </Card>
              ))}
              <button onClick={() => setMembers([...members, { role: DEFAULT_ROLE[biz.type], person: EMPTY_PERSON }])}
                className="w-full rounded-2xl border-2 border-dashed border-slate-300 py-4 text-sm font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900 inline-flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add a director, trustee, partner or owner
              </button>
            </>
          )}
        </div>

        <aside className="space-y-6 xl:sticky xl:top-10">
          <Card title="Submit">
            <div className="space-y-5">
              <Field label="Your client reference" hint="Your own ID for this client. It's how you'll find them.">
                <input className={`${input} font-mono`} value={clientRef} onChange={(e) => setClientRef(e.target.value)} />
              </Field>
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-slate-300" />
                {kind === 'INDIVIDUAL' ? 'The client has consented to their identity being verified.' : 'Each person has consented to their identity being verified.'}
              </label>
              <button onClick={submit} disabled={busy || !ready} className={`${btn.primary} w-full py-2.5`} style={{ background: im.colour }}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {busy ? `Verifying… about ${wait} seconds` : 'Submit for verification'}
              </button>
              {error && <p className="text-sm text-red-700">{error}</p>}
            </div>
          </Card>
          <Card title="What happens next">
            <ol className="space-y-4 text-sm text-slate-600">
              {[
                `The details go to ${im.platform}. You never connect to FrankieOne.`,
                kind === 'INDIVIDUAL'
                  ? `${im.platform} verifies their identity and screens them, using the checks set for ${im.name}.`
                  : `${im.platform} records the business, checks the register if there's an ABN or ACN, and verifies each person.`,
                'You get back a status, a risk band and anything you need to do.',
              ].map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="pt-0.5">{t}</span>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-xs text-slate-500">Takes about {wait} seconds, whoever the client is.</p>
          </Card>
        </aside>
      </div>
    </>
  );
}
