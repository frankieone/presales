import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Loader2, ShieldCheck } from 'lucide-react';
import { runFraudChecks, isFraudFlagged } from '../services/entities';
import { startEmbeddedDevice } from '../services/onesdk';
import { generateMemberIdvUrl } from '../services/api';
import { vertical } from '../config';
import Logo from '../components/Logo';

/**
 * /v/:entityId — the step-up ID check for a held payment, opened from the QR
 * code (or "verify on this device") on the Payments page.
 *
 * The hosted ID flow on its own sends FrankieOne no device data, so this page
 * does what the member page does first: embedded OneSDK collects the device,
 * the device workflow runs on it, and only then does the same browser go on to
 * the hosted ID photo and selfie. A flagged device or an overseas IP is held
 * here instead.
 */

const DEVICE_WAIT_MS = 15000;

export default function StepUpVerify() {
  const { entityId } = useParams();
  const [stage, setStage] = useState('device'); // device | checking | handoff | held | error
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode mounts twice
    started.current = true;

    (async () => {
      try {
        const collected = await new Promise((resolve) => {
          setTimeout(() => resolve(false), DEVICE_WAIT_MS);
          startEmbeddedDevice(entityId, (name) => {
            if (name === 'device_characteristics_extracted' || name === 'completed') resolve(true);
          }).catch((err) => {
            console.error('[StepUp] OneSDK device module failed:', err);
            resolve(false);
          });
        });
        console.info('[StepUp] Device collected:', collected);

        setStage('checking');
        const summary = await runFraudChecks(entityId);
        console.info('[StepUp] Fraud result:', summary);
        if (isFraudFlagged(summary) || (summary.ipCountry && summary.ipCountry !== 'AU')) {
          setStage('held');
          return;
        }

        setStage('handoff');
        const { url } = await generateMemberIdvUrl(entityId);
        window.location.assign(url);
      } catch (err) {
        console.error('[StepUp] Step-up failed:', err);
        setStage('error');
      }
    })();
  }, [entityId]);

  const message = {
    device: 'Preparing your identity check…',
    checking: 'Checking your details…',
    handoff: 'Taking you to identity verification…',
  }[stage];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-5 py-4">
        <Logo size="sm" />
      </header>

      <main className="flex-1 px-5 py-6 max-w-md w-full mx-auto">
        {message && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto" />
            <p className="text-gray-700 mt-4">{message}</p>
            <p className="text-xs text-gray-400 mt-2">
              Next, you'll take a photo of your driver's licence or passport and a quick selfie.
            </p>
          </div>
        )}

        {/* Neutral on purpose: the reason is for the customer's team. */}
        {stage === 'held' && (
          <div className="text-center py-12">
            <Clock className="w-10 h-10 text-amber-500 mx-auto" />
            <h1 className="text-xl font-semibold text-gray-900 mt-4">Thanks — we'll be in touch</h1>
            <p className="text-sm text-gray-500 mt-2">
              We need to review a few details before your payment can be released. Our team will contact you shortly.
            </p>
          </div>
        )}

        {stage === 'error' && (
          <div className="text-center py-12">
            <ShieldCheck className="w-10 h-10 text-gray-400 mx-auto" />
            <h1 className="text-xl font-semibold text-gray-900 mt-4">Something went wrong</h1>
            <p className="text-sm text-gray-500 mt-2">Please scan the code again, or contact {vertical.brand.name}.</p>
          </div>
        )}
      </main>
    </div>
  );
}
