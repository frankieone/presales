import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Clock, Loader2, ShieldCheck } from 'lucide-react';
import { getPerson, getOrganization, runFraudChecks, isFraudFlagged } from '../services/entities';
import { startEmbeddedDevice } from '../services/onesdk';
import { generateMemberIdvUrl } from '../services/api';
import { PENDING_FUND_NAME } from '../services/journey';
import { vertical } from '../config';
import Logo from '../components/Logo';

/**
 * /m/:entityId — what a member sees on their own phone after the primary
 * contact adds them. One session, one device, start to finish:
 *
 *   1. Embedded OneSDK collects the device while they read the page.
 *   2. They confirm their details and accept the declaration.
 *   3. The device workflow runs on them, with the device just collected. A
 *      flag — a risky device, an overseas IP, a bad email or phone — stops
 *      them here, before an ID check is paid for.
 *   4. Otherwise the same browser goes straight on to the hosted ID photo and
 *      selfie. Doing both in one sitting is the point: a device check passed
 *      by someone other than the person whose ID follows is what this blocks.
 *
 * Embedded for the device because the hosted flow returned no device data on
 * in our testing; hosted for the ID because phone cameras need HTTPS, which the
 * local dev server doesn't have.
 */

const DEVICE_WAIT_MS = 15000;

export default function MemberConfirm() {
  const { entityId } = useParams();
  const [params] = useSearchParams();
  const fundId = params.get('f');

  const [person, setPerson] = useState(null);
  const [fundName, setFundName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [stage, setStage] = useState('loading'); // loading | ready | checking | held | handoff | error
  const deviceReady = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode mounts twice
    started.current = true;

    // Resolves once OneSDK reports the device collected, or after a timeout —
    // the workflow can otherwise reach the server before the device does.
    let resolveDevice;
    deviceReady.current = new Promise((r) => { resolveDevice = r; });
    setTimeout(() => resolveDevice(false), DEVICE_WAIT_MS);
    startEmbeddedDevice(entityId, (name) => {
      if (name === 'device_characteristics_extracted' || name === 'completed') resolveDevice(true);
    }).catch((err) => {
      console.error('[MemberConfirm] OneSDK device module failed:', err);
      resolveDevice(false);
    });

    (async () => {
      try {
        setPerson(await getPerson(entityId));
        if (fundId) {
          const org = await getOrganization(fundId).catch(() => null);
          if (org && org.name !== PENDING_FUND_NAME) setFundName(org.name);
        }
        setStage('ready');
      } catch (err) {
        console.error('[MemberConfirm] Could not load member:', err);
        setStage('error');
      }
    })();
  }, [entityId, fundId]);

  const confirm = async () => {
    setStage('checking');
    try {
      const collected = await deviceReady.current;
      console.info('[MemberConfirm] Device collected before check:', collected);
      const summary = await runFraudChecks(entityId);
      console.info('[MemberConfirm] Fraud result:', summary);
      const overseas = summary.ipCountry && summary.ipCountry !== 'AU';
      if (isFraudFlagged(summary) || overseas) {
        setStage('held');
        return;
      }
      setStage('handoff');
      const { url } = await generateMemberIdvUrl(entityId);
      window.location.assign(url);
    } catch (err) {
      console.error('[MemberConfirm] Confirmation failed:', err);
      setStage('error');
    }
  };

  const firstName = person?.name?.split(' ')[0] || '';
  const { member } = vertical;
  const fund = fundName || member?.fallbackName || '';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-5 py-4">
        <Logo size="sm" />
      </header>

      <main className="flex-1 px-5 py-6 max-w-md w-full mx-auto">
        {stage === 'loading' && (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-10 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        )}

        {stage === 'ready' && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Hi {firstName.charAt(0) + firstName.slice(1).toLowerCase()},</h1>
              <p className="text-gray-600 mt-2">
                You've been added as {member?.addedAs} <strong className="text-gray-900">{fund}</strong>.
                Please confirm your details and verify your identity to continue.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Your details</p>
              <p className="font-medium text-gray-900">{person?.name}</p>
              {person?.dateOfBirth && <p className="text-sm text-gray-600">Born {person.dateOfBirth}</p>}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-600 space-y-2">
              <p className="font-medium text-gray-900">{member?.declarationTitle}</p>
              <p>
                {member?.declaration}
              </p>
              <label className="flex items-start gap-2 pt-1">
                <input type="checkbox" className="mt-1" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                <span>{member?.accept}</span>
              </label>
            </div>

            <button
              onClick={confirm}
              disabled={!accepted}
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              Continue to verify my identity
            </button>
            <p className="text-xs text-gray-400 text-center">
              Next, you'll take a photo of your driver's licence or passport and a quick selfie.
            </p>
          </div>
        )}

        {(stage === 'checking' || stage === 'handoff') && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto" />
            <p className="text-gray-700 mt-4">
              {stage === 'checking' ? 'Checking your details…' : 'Taking you to identity verification…'}
            </p>
          </div>
        )}

        {/* Neutral on purpose: the reason is for the customer's team. */}
        {stage === 'held' && (
          <div className="text-center py-12">
            <Clock className="w-10 h-10 text-amber-500 mx-auto" />
            <h1 className="text-xl font-semibold text-gray-900 mt-4">Thanks — we'll be in touch</h1>
            <p className="text-sm text-gray-500 mt-2">
              We need to review a few details before you can continue. Our team will contact you shortly.
            </p>
          </div>
        )}

        {stage === 'error' && (
          <div className="text-center py-12">
            <ShieldCheck className="w-10 h-10 text-gray-400 mx-auto" />
            <h1 className="text-xl font-semibold text-gray-900 mt-4">Something went wrong</h1>
            <p className="text-sm text-gray-500 mt-2">Please try the link again, or contact {vertical.brand.name}.</p>
          </div>
        )}
      </main>
    </div>
  );
}

