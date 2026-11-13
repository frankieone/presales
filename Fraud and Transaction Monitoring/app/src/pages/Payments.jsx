import { useState } from 'react';
import { ArrowUpRight, CheckCircle, AlertCircle, Loader2, Send, ScanFace } from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { storageKey, vertical } from '../config';
import { generateMemberIdvUrl, recordTransaction } from '../services/api';
import { registerDeviceSession } from '../services/journey';

/**
 * A payment out of the customer's account, for showing transaction
 * monitoring. Each payment registers a fresh device session and goes to
 * FrankieOne as a transaction activity; any alert lands in the Portal only.
 * On the demo account, anything over $10,000 is flagged for review.
 *
 * Step-up: a payment over `payments.stepUpOver` also asks the customer to
 * verify their identity (ID photo and selfie) before it is released. The
 * transaction is still sent first, so monitoring sees the attempt either way.
 */

const input = 'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500';
const aud = (n) => n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 });
const HISTORY = storageKey('payments');

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY) || '[]');
  } catch {
    return [];
  }
}

export default function Payments() {
  const { user } = useAuth();
  const copy = vertical.payments;
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [history, setHistory] = useState(loadHistory);
  const [stepUp, setStepUp] = useState(null); // { url, qr, amount, payee }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setDone('');
    setStepUp(null);
    const value = Number(String(amount).replace(/[^0-9.]/g, ''));
    const to = payee.trim() || copy.payeePlaceholder;
    if (!value || value <= 0) {
      setError('Enter an amount to pay.');
      return;
    }

    setBusy(true);
    try {
      const token = await registerDeviceSession(user.userId, 'payment');
      await recordTransaction(user.userId, token, { amount: value, payee: to });
      const needsId = copy.stepUpOver && value > copy.stepUpOver;
      const entry = { amount: value, payee: to, at: new Date().toISOString(), pending: needsId };
      const next = [entry, ...history].slice(0, 10);
      setHistory(next);
      try { localStorage.setItem(HISTORY, JSON.stringify(next)); } catch { /* private mode */ }
      if (needsId) {
        const { url } = await generateMemberIdvUrl(user.userId);
        const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 });
        setStepUp({ url, qr, amount: value, payee: to });
      } else {
        setDone(copy.done.replace('{amount}', aud(value)).replace('{payee}', to));
      }
      setAmount('');
      setPayee('');
    } catch (err) {
      console.error('Payment failed:', err);
      setError("We couldn't process that payment. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{copy.title}</h1>
        <p className="text-gray-500">{copy.intro}</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {done && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-700">{done}</p>
        </div>
      )}

      {stepUp && (
        <div className="bg-white rounded-xl border border-primary-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <ScanFace className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">Verify it's you</h3>
          </div>
          <p className="text-sm text-gray-600">
            For your security, payments over {aud(copy.stepUpOver)} need a quick identity check before they're released.
            Your payment of {aud(stepUp.amount)} to {stepUp.payee} is on hold until you've photographed your ID and taken a selfie.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row items-start gap-5">
            <img src={stepUp.qr} alt="Scan to verify on your phone" className="w-40 h-40 border border-gray-200 rounded-lg" />
            <div className="text-sm text-gray-600 space-y-3">
              <p>Scan with your phone's camera to continue there.</p>
              <a href={stepUp.url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary-300 text-primary-700 font-medium hover:bg-primary-50">
                <ScanFace className="w-4 h-4" /> Verify on this device instead
              </a>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <p className="block text-sm font-medium text-gray-700 mb-1">From</p>
          <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
            {copy.fromLabel} <span className="text-gray-400">· ******321</span>
          </div>
        </div>
        <div>
          <label htmlFor="pay-payee" className="block text-sm font-medium text-gray-700 mb-1">{copy.payeeLabel}</label>
          <input id="pay-payee" className={input} value={payee} onChange={(e) => setPayee(e.target.value)}
            placeholder={copy.payeePlaceholder} />
        </div>
        <div>
          <label htmlFor="pay-amount" className="block text-sm font-medium text-gray-700 mb-1">Amount (AUD)</label>
          <input id="pay-amount" className={input} inputMode="decimal" value={amount}
            onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <button type="submit" disabled={busy}
          className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {busy ? 'Processing…' : copy.button}
        </button>
      </form>

      {history.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent payments</h3>
          <ul className="divide-y divide-gray-100">
            {history.map((p) => (
              <li key={p.at} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">{p.payee}</p>
                    <p className="text-xs text-gray-500">{new Date(p.at).toLocaleString('en-AU')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-medium text-gray-900">−{aud(p.amount)}</span>
                  {p.pending && <p className="text-xs text-amber-700">Awaiting identity check</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
