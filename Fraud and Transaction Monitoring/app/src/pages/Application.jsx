import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Landmark, User, Users, PiggyBank, Send, AlertCircle, CheckCircle, ArrowRight, Wand2, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { vertical, storageKey } from '../config';
import { renameOrganization, updatePerson, runFraudChecks } from '../services/entities';
import { readRegistration, saveRegistration, registerDeviceSession, useDraft } from '../services/journey';
import { scenarioById } from '../services/demoData';

const card = 'bg-white rounded-xl border border-gray-200 shadow-sm p-5';
const input =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

/**
 * The application, inside the customer portal. Submitting it is the final
 * step: the container (business or fund) gets its name, the primary contact's
 * record is completed, and the onboarding fraud workflow runs on them again —
 * covering every device session so far. The customer sees only that it was
 * submitted.
 */
export default function Application() {
  const { user, login } = useAuth();
  const { application: app, container, people } = vertical;
  const [reg, setReg] = useState(() => readRegistration());
  const [scenario] = useState(() => {
    let id = null;
    try { id = localStorage.getItem(storageKey('scenario')); } catch { /* private mode */ }
    return scenarioById(id);
  });
  // Kept per application, so a visit to another page doesn't wipe what's typed.
  const draftKey = reg?.applicationId ? storageKey(`application.${reg.applicationId}`) : null;
  const [name, setName] = useDraft(draftKey && `${draftKey}.name`, reg?.fundName || '');
  const [me, setMe] = useDraft(draftKey && `${draftKey}.contact`, {
    streetNumber: '', streetName: '', streetType: 'Street', locality: '', state: 'VIC', postalCode: '',
  });
  const [extra, setExtra] = useDraft(draftKey && `${draftKey}.extra`, { employer: '', consolidate: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const setField = (k) => (e) => setMe((m) => ({ ...m, [k]: e.target.value }));

  const fill = () => {
    const a = scenario.applicant;
    if (container && scenario.container) setName(scenario.container.name);
    setMe({
      streetNumber: a.streetNumber, streetName: a.streetName, streetType: a.streetType,
      locality: a.locality, state: a.state, postalCode: a.postalCode,
    });
    if (app.superSection) setExtra({ employer: 'TESTONE TRADING PTY LTD', consolidate: true });
  };

  if (!reg || !user) {
    return <div className={`${card} max-w-lg text-sm text-gray-600`}>No application on this session.</div>;
  }

  const submit = async () => {
    setError('');
    if ((container && !name.trim()) || !me.streetName || !me.locality || !me.postalCode) {
      setError(container ? `Please complete the ${container.kind} name and your address.` : 'Please complete your address.');
      return;
    }
    setBusy(true);
    try {
      const finalName = container ? name.trim().toUpperCase() : '';
      if (container) await renameOrganization(reg.fundId, finalName);
      await updatePerson(reg.contactId, {
        address: {
          streetNumber: me.streetNumber, streetName: me.streetName.toUpperCase(),
          streetType: me.streetType.toUpperCase(), locality: me.locality.toUpperCase(),
          state: me.state, postalCode: me.postalCode,
        },
      });

      // The onboarding fraud workflow on the primary contact, against a session
      // registered at submission; it evaluates every session so far.
      try {
        await registerDeviceSession(reg.contactId, 'registration');
        await runFraudChecks(reg.contactId);
      } catch (fraudErr) {
        console.error('[Application] Fraud workflow failed:', fraudErr);
      }

      const next = saveRegistration({ ...reg, fundName: finalName, submitted: true });
      setReg(next);
      login(reg.contactId, 'INDIVIDUAL', reg.fullName, {
        fundId: reg.fundId, fundName: finalName, applicationId: reg.applicationId,
      });
    } catch (err) {
      console.error('[Application] submit failed:', err);
      setError('We could not submit your application. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (reg.submitted) {
    return (
      <div className={`${card} max-w-xl text-center py-10`}>
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
        <h1 className="text-xl font-semibold text-gray-900 mt-4">Application submitted</h1>
        <p className="text-sm text-gray-500 mt-2">
          {app.submittedBody.replace('{name}', reg.fundName || 'your application')} Reference {reg.applicationId}.
        </p>
        {container && (
          <Link to="/dashboard"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary-700 hover:text-primary-800">
            Go to {vertical.overview.title.toLowerCase()} <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{app.title}</h1>
        <p className="text-sm text-gray-500 mt-1">Reference {reg.applicationId}</p>
      </div>

      <button type="button" onClick={fill}
        className="w-full rounded-lg border border-dashed border-primary-300 text-primary-700 py-2 text-xs font-medium hover:bg-primary-50 inline-flex items-center justify-center gap-1.5">
        <Wand2 className="w-3.5 h-3.5" /> Fill with demo details
      </button>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {container && (
        <section className={card}>
          <div className="flex items-center gap-2 mb-3">
            <Landmark className="w-4 h-4 text-primary-600" />
            <h2 className="font-semibold text-gray-900">{app.nameSection}</h2>
          </div>
          <label className={labelCls} htmlFor="container-name">{app.nameLabel}</label>
          <input id="container-name" className={input} value={name}
            onChange={(e) => setName(e.target.value)} placeholder={app.namePlaceholder} />
          <p className="text-[11px] text-gray-400 mt-1.5">{app.nameHint}</p>
        </section>
      )}

      <section className={card}>
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-primary-600" />
          <h2 className="font-semibold text-gray-900">{app.detailsSection}</h2>
        </div>
        <p className="text-sm text-gray-700">{reg.fullName}</p>
        <p className="text-xs text-gray-500 mb-4">{reg.email} · {reg.mobile}</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls} htmlFor="sno">Street number</label>
            <input id="sno" className={input} value={me.streetNumber} onChange={setField('streetNumber')} />
          </div>
          <div>
            <label className={labelCls} htmlFor="sname">Street name</label>
            <input id="sname" className={input} value={me.streetName} onChange={setField('streetName')} />
          </div>
          <div>
            <label className={labelCls} htmlFor="stype">Street type</label>
            <input id="stype" className={input} value={me.streetType} onChange={setField('streetType')} />
          </div>
          <div>
            <label className={labelCls} htmlFor="loc">Suburb</label>
            <input id="loc" className={input} value={me.locality} onChange={setField('locality')} />
          </div>
          <div>
            <label className={labelCls} htmlFor="state">State</label>
            <select id="state" className={input} value={me.state} onChange={setField('state')}>
              {AU_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="pc">Postcode</label>
            <input id="pc" className={input} value={me.postalCode} onChange={setField('postalCode')} />
          </div>
        </div>
      </section>

      {/* Super only: the details a member gives when joining. Not sent to FrankieOne. */}
      {app.superSection && (
        <section className={card}>
          <div className="flex items-center gap-2 mb-3">
            <PiggyBank className="w-4 h-4 text-primary-600" />
            <h2 className="font-semibold text-gray-900">{app.superSection}</h2>
          </div>
          <label className={labelCls} htmlFor="employer">Your employer (optional)</label>
          <input id="employer" className={input} value={extra.employer}
            onChange={(e) => setExtra({ ...extra, employer: e.target.value })} placeholder="Who pays your super" />
          <label className="flex items-start gap-2 mt-4 text-sm text-gray-700">
            <input type="checkbox" className="mt-1" checked={extra.consolidate}
              onChange={(e) => setExtra({ ...extra, consolidate: e.target.checked })} />
            <span>Find my other super accounts and combine them into my new account</span>
          </label>
        </section>
      )}

      {people.enabled && (
        <section className={`${card} flex items-center justify-between gap-4`}>
          <div className="flex items-start gap-2">
            <Users className="w-4 h-4 text-primary-600 mt-0.5" />
            <div>
              <h2 className="font-semibold text-gray-900">{app.peopleSection}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{app.peopleBlurb}</p>
            </div>
          </div>
          <Link to="/people"
            className="shrink-0 text-sm font-medium text-primary-700 hover:text-primary-800 inline-flex items-center gap-1">
            Manage {people.navLabel.toLowerCase()} <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      )}

      <div className="flex justify-end">
        <button onClick={submit} disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {busy ? 'Submitting…' : 'Submit application'}
        </button>
      </div>
    </div>
  );
}
