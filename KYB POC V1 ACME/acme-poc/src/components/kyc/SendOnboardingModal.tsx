'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import type { Individual } from '@/types/individual';

const FLOW_OPTIONS = [
  { value: 'idv', label: 'IDV — Full identity verification (OCR + biometrics)' },
  { value: 'idv_review', label: 'IDV Review — IDV with user editing' },
  { value: 'manual_kyc', label: 'Manual KYC — eKYC only' },
  { value: 'ocr_only', label: 'OCR Only — Document scanning only' },
  { value: 'individual_doc_upload', label: 'Document Upload — Individual documents' },
  { value: 'doc_upload', label: 'Business Doc Upload — Business documents' },
];

const COUNTRY_CODES = [
  { value: '+61', label: 'AU (+61)' },
  { value: '+64', label: 'NZ (+64)' },
  { value: '+1', label: 'US (+1)' },
  { value: '+44', label: 'UK (+44)' },
  { value: '+65', label: 'SG (+65)' },
  { value: '+852', label: 'HK (+852)' },
];

interface SendOnboardingModalProps {
  individual: Individual;
  onClose: () => void;
}

export function SendOnboardingModal({ individual, onClose }: SendOnboardingModalProps) {
  const [flowId, setFlowId] = useState('idv');
  const [phoneCode, setPhoneCode] = useState('+61');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; smsSent: boolean } | null>(null);

  const fullName = [individual.givenName, individual.middleName, individual.familyName]
    .filter(Boolean)
    .join(' ');

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setError('Phone number is required');
      return;
    }

    setSending(true);
    setError('');

    try {
      const res = await fetch('/api/kyc/onboarding-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: individual.kycEntityId,
          givenName: individual.givenName,
          familyName: individual.familyName,
          flowId,
          phoneNumber: phoneNumber.trim(),
          phoneCode,
          sendSMS: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send onboarding link');
        return;
      }

      setResult({ url: data.url, smsSent: data.smsSent });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-wise-gray-200 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-wise-navy text-lg">Send Onboarding Link</h3>
              <p className="text-xs text-wise-gray-500 mt-0.5">{fullName}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-wise-gray-100 transition-colors"
            >
              <svg className="w-4 h-4 text-wise-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {result ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-emerald-800">
                  {result.smsSent ? 'Onboarding link sent via SMS' : 'Onboarding link generated'}
                </p>
                <p className="text-xs text-emerald-600 mt-1">
                  {result.smsSent
                    ? `A text message has been sent to ${phoneCode} ${phoneNumber}`
                    : 'Copy the link below and share it with the user'}
                </p>
              </div>

              <div>
                <label className="text-[11px] text-wise-gray-400 block mb-1">Onboarding URL</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={result.url}
                    className="flex-1 text-xs font-mono bg-wise-gray-50 border border-wise-gray-200 rounded-lg px-3 py-2 text-wise-gray-600 select-all"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigator.clipboard.writeText(result.url)}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={onClose}>
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-4">
              <Select
                id="onboarding-flow"
                label="Verification Flow"
                value={flowId}
                onChange={(e) => setFlowId(e.target.value)}
                options={FLOW_OPTIONS}
              />

              <div>
                <label className="text-sm font-medium text-wise-navy block mb-1.5">Phone Number</label>
                <div className="flex gap-2">
                  <select
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    className="border border-wise-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-wise-green"
                  >
                    {COUNTRY_CODES.map((cc) => (
                      <option key={cc.value} value={cc.value}>{cc.label}</option>
                    ))}
                  </select>
                  <Input
                    id="onboarding-phone"
                    placeholder="412 345 678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={sending}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={sending || !phoneNumber.trim()}>
                  {sending ? (
                    <span className="flex items-center gap-2">
                      <Spinner size="sm" /> Sending...
                    </span>
                  ) : (
                    'Send SMS Link'
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
