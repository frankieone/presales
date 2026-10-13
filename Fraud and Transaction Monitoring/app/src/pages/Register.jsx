import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle, Wand2 } from 'lucide-react';
import { useRisk } from '../context/RiskContext';
import { vertical, storageKey } from '../config';
import Logo from '../components/Logo';
import { createOrganization, createPerson, linkToOrganization, runFraudChecks } from '../services/entities';
import {
  registerDeviceSession, saveRegistration, hashPassword, newApplicationId, PENDING_FUND_NAME,
} from '../services/journey';
import { scenarioAt } from '../services/demoData';

const input =
  'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none';

/**
 * Step 1 — registration on the customer's public website: full name, email,
 * mobile and a password. Creates the primary contact and, where the vertical
 * has one, a container (business or fund) with no name yet, anchored by an
 * application ID. Then runs the onboarding fraud workflow straight away.
 *
 * A date of birth is sent but never asked for: the device workflow used here
 * needs one to run. A configuration change could remove that requirement; a
 * registration form shouldn't have to carry it.
 */
const DEMO_DOB = '1990-01-01';

export default function Register() {
  const [form, setForm] = useState({ fullName: '', dateOfBirth: '', email: '', mobile: '', password: '', confirm: '' });
  const [fillIndex, setFillIndex] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);
  const { demoContact } = useRisk();
  const { site, container } = vertical;

  const scenario = scenarioAt(fillIndex);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const fill = () => {
    const p = scenario.applicant;
    const { email, phone } = demoContact(p);
    setForm({
      fullName: `${p.givenName} ${p.familyName}`, dateOfBirth: p.dateOfBirth, email, mobile: phone,
      password: 'demo1234', confirm: 'demo1234',
    });
    try { localStorage.setItem(storageKey('scenario'), scenario.id); } catch { /* private mode */ }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const names = form.fullName.trim().split(/\s+/);
    if (names.length < 2 || !form.email || !form.mobile) {
      setError('Please enter your full name, email and mobile number.');
      return;
    }
    if (form.password.length < 4 || form.password !== form.confirm) {
      setError('Passwords must match and be at least 4 characters.');
      return;
    }

    setLoading(true);
    try {
      const applicationId = newApplicationId();
      const givenName = names[0].toUpperCase();
      const familyName = names.slice(1).join(' ').toUpperCase();

      const contactId = await createPerson({
        givenName, familyName, dateOfBirth: form.dateOfBirth || DEMO_DOB,
        email: form.email.trim(), phone: form.mobile.replace(/\s/g, ''),
      });

      // The container, before it has a name. Its entity ID and the application
      // ID are the anchors — not the email, which a later application can reuse.
      let containerId = null;
      if (container) {
        containerId = await createOrganization({
          name: PENDING_FUND_NAME,
          organizationType: container.organizationType,
          customerReference: applicationId,
        });
        await linkToOrganization(containerId, {
          entityId: contactId, entityType: 'INDIVIDUAL', role: container.contactRole,
        });
      }

      // Email, phone, device and IP checked by workflow at registration. The
      // result is for the customer's team, never this screen.
      try {
        await registerDeviceSession(contactId, 'registration');
        await runFraudChecks(contactId);
      } catch (fraudErr) {
        console.error('[Register] Fraud workflow failed:', fraudErr);
      }

      saveRegistration({
        contactId, fundId: containerId, applicationId,
        fullName: `${givenName} ${familyName}`,
        email: form.email.trim(), mobile: form.mobile.replace(/\s/g, ''),
        passwordHash: await hashPassword(form.password),
        fundName: '', submitted: false,
      });
      setDone({ email: form.email.trim() });
    } catch (err) {
      console.error('[Register] failed:', err);
      setError('Something went wrong creating your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <nav className="hidden sm:flex items-center gap-6 text-sm text-gray-600">
            {site.nav.map((n) => <span key={n}>{n}</span>)}
            <Link to="/login" className="text-primary-700 font-medium">{site.portalName}</Link>
          </nav>
        </div>
      </header>

      <main className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700">
        <div className="max-w-6xl mx-auto px-4 py-12 lg:py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div className="text-white">
            <h1 className="text-3xl lg:text-4xl font-bold leading-tight">{site.headline}</h1>
            <p className="mt-4 text-primary-100 text-lg">{site.sub}</p>
            <ul className="mt-6 space-y-2 text-primary-100 text-sm">
              {site.bullets.map((b) => <li key={b}>· {b}</li>)}
            </ul>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
            {done ? (
              <div className="text-center py-6">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                <h2 className="text-xl font-semibold text-gray-900 mt-4">Your account is ready</h2>
                <p className="text-sm text-gray-500 mt-2">
                  Log in to {site.portalName.toLowerCase()} with {done.email} to continue your application.
                </p>
                <Link
                  to="/login"
                  state={{ email: done.email }}
                  className="mt-6 inline-flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-primary-700"
                >
                  Go to {site.portalName.toLowerCase()} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Create your account</h2>
                  <p className="text-sm text-gray-500 mt-1">{site.registerSub}</p>
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={fill}
                    className="flex-1 rounded-lg border border-dashed border-primary-300 text-primary-700 py-2 text-xs font-medium hover:bg-primary-50 inline-flex items-center justify-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5" /> Fill with {scenario.applicant.givenName} {scenario.applicant.familyName}
                  </button>
                  {vertical.scenarios.length > 1 && (
                    <button type="button" onClick={() => setFillIndex((i) => i + 1)} title="Use different demo details"
                      className="rounded-lg border border-dashed border-gray-300 text-gray-500 px-3 text-xs hover:bg-gray-50">
                      Switch
                    </button>
                  )}
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <input className={input} placeholder="Full name *" value={form.fullName} onChange={set('fullName')} autoComplete="name" />
                <input className={input} type="email" placeholder="Email address *" value={form.email} onChange={set('email')} autoComplete="email" />
                <input className={input} type="tel" placeholder="Mobile number *" value={form.mobile} onChange={set('mobile')} autoComplete="tel" />
                <div className="grid grid-cols-2 gap-3">
                  <input className={input} type="password" placeholder="Password *" value={form.password} onChange={set('password')} autoComplete="new-password" />
                  <input className={input} type="password" placeholder="Confirm *" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
                </div>

                <button type="submit" disabled={loading}
                  className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50">
                  {loading ? 'Creating your account…' : 'Register'}
                </button>
                <p className="text-xs text-gray-500 text-center">
                  Already registered? <Link to="/login" className="text-primary-700 font-medium">Log in to {site.portalName.toLowerCase()}</Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-gray-400 py-6">
        {vertical.brand.name} is a placeholder brand for demonstration only.
      </footer>
    </div>
  );
}
