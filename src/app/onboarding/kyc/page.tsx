'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/store/onboarding-store';
import { IndividualCard } from '@/components/individuals/IndividualCard';
import { IndividualEditForm } from '@/components/individuals/IndividualEditForm';
import { KycSubmitButton } from '@/components/kyc/KycSubmitButton';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { KycResult } from '@/types/kyc';
import type { Individual } from '@/types/individual';

interface OnboardingLinkResult {
  url: string;
  expiry: string;
  smsSent?: boolean;
}

interface OrgAmlResult {
  entityId: string;
  entityName: string;
  workflowName: string;
  status: string;
  riskLevel: string | null;
  riskScore: number | null;
  checks: Array<{ step: string; result: 'PASS' | 'FAIL' | 'INCOMPLETE' }>;
  issues: Array<{ issue: string; severity: string; category: string }>;
}

const STEP_LABELS: Record<string, string> = {
  ORGANIZATION_DATA_FETCH: 'Business Data Verification',
  ORGANIZATIONPERSIST: 'Entity Registration',
  REPORT: 'Business Report',
  AML: 'AML / Sanctions Screening',
  DECISION: 'Risk Decision',
};

const RISK_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'error'; color: string }> = {
  LOW: { label: 'Low Risk', variant: 'success', color: 'text-green-600' },
  MEDIUM: { label: 'Medium Risk', variant: 'warning', color: 'text-amber-600' },
  HIGH: { label: 'High Risk', variant: 'error', color: 'text-red-600' },
  UNACCEPTABLE: { label: 'Unacceptable Risk', variant: 'error', color: 'text-red-600' },
};

function CheckIcon({ result }: { result: string }) {
  if (result === 'PASS') {
    return (
      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (result === 'FAIL') {
    return (
      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
    </svg>
  );
}

function OnboardingLinkBanner({ result, isCopied, onCopy }: { result: OnboardingLinkResult; isCopied: boolean; onCopy: () => void }) {
  return (
    <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2">
      <p className="text-xs font-medium text-green-800 mb-1">
        {result.smsSent ? 'Onboarding link sent via SMS' : 'Onboarding link generated'}
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={result.url}
          className="flex-1 text-xs bg-white border border-green-300 rounded px-2 py-1 text-wise-gray-700 truncate"
        />
        <Button
          size="sm"
          variant={isCopied ? 'secondary' : 'outline'}
          onClick={onCopy}
        >
          {isCopied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      <p className="text-xs text-green-600 mt-1">
        Expires: {new Date(result.expiry).toLocaleString()}
      </p>
    </div>
  );
}

export default function KycPage() {
  const router = useRouter();
  const {
    individuals,
    kycResults,
    updateIndividual,
    addKycResult,
    kycError,
    setKycError,
    australianOwnership,
    selectedBusiness,
  } = useOnboardingStore();

  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [isSubmittingAll, setIsSubmittingAll] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [orgAml, setOrgAml] = useState<OrgAmlResult | null>(null);
  const [orgAmlLoading, setOrgAmlLoading] = useState(false);

  // Onboarding link modal state
  const [linkModalId, setLinkModalId] = useState<string | null>(null);
  const [linkPhone, setLinkPhone] = useState('');
  const [linkGenerating, setLinkGenerating] = useState(false);
  const [linkResults, setLinkResults] = useState<Record<string, OnboardingLinkResult>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const organisationEntityId =
    australianOwnership?.entityId || selectedBusiness?.companyId;

  useEffect(() => {
    if (!organisationEntityId) return;
    setOrgAmlLoading(true);
    fetch('/api/business/aml-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId: organisationEntityId }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setOrgAml(data); })
      .catch(() => {})
      .finally(() => setOrgAmlLoading(false));
  }, [organisationEntityId]);

  async function submitKyc(individualId: string) {
    const individual = individuals.find((i) => i.id === individualId);
    if (!individual) return;

    setSubmittingId(individualId);
    updateIndividual(individualId, { kycStatus: 'submitted' });
    setKycError(null);

    try {
      const res = await fetch('/api/kyc/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          individualId,
          kycEntityId: individual.kycEntityId,
          givenName: individual.givenName,
          middleName: individual.middleName,
          familyName: individual.familyName,
          dateOfBirth: individual.dateOfBirth,
          address: individual.address,
          organisationEntityId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        updateIndividual(individualId, { kycStatus: 'error' });
        setKycError(data.error || 'Verification failed');
        return;
      }

      const result: KycResult = data;
      addKycResult(individualId, result);

      const status = result.overallResult === 'PASS' ? 'pass' :
        result.overallResult === 'FAIL' ? 'fail' :
        result.overallResult === 'REFER' ? 'refer' : 'error';

      updateIndividual(individualId, { kycStatus: status, kycEntityId: result.entityId });
    } catch {
      updateIndividual(individualId, { kycStatus: 'error' });
      setKycError('Network error. Please try again.');
    } finally {
      setSubmittingId(null);
    }
  }

  async function handleEditSave(id: string, updates: Partial<Individual>) {
    updateIndividual(id, { ...updates });
    setEditingId(null);
  }

  function openLinkModal(individualId: string) {
    setLinkModalId(individualId);
    setLinkPhone('');
  }

  async function generateOnboardingUrl(sendSMS: boolean) {
    if (!linkModalId) return;
    const individual = individuals.find((i) => i.id === linkModalId);
    if (!individual) return;

    if (sendSMS && !linkPhone.trim()) {
      setKycError('Please enter a phone number.');
      return;
    }

    setLinkGenerating(true);
    setKycError(null);

    try {
      const res = await fetch('/api/kyc/onboarding-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: individual.kycEntityId,
          givenName: individual.givenName,
          familyName: individual.familyName,
          ...(sendSMS ? { phoneNumber: linkPhone.trim(), sendSMS: true } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setKycError(data.error || 'Failed to generate onboarding URL');
        return;
      }

      if (data.entityId && !individual.kycEntityId) {
        updateIndividual(linkModalId, { kycEntityId: data.entityId });
      }

      setLinkResults((prev) => ({
        ...prev,
        [linkModalId]: { url: data.url, expiry: data.urlExpiry, smsSent: sendSMS },
      }));

      if (!sendSMS) {
        navigator.clipboard.writeText(data.url);
        setCopiedId(linkModalId);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch {
      setKycError('Network error generating onboarding URL.');
    } finally {
      setLinkGenerating(false);
    }
  }

  function copyUrl(individualId: string) {
    const entry = linkResults[individualId];
    if (!entry) return;
    navigator.clipboard.writeText(entry.url);
    setCopiedId(individualId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function submitAll() {
    setIsSubmittingAll(true);
    const pending = individuals.filter((i) => i.kycStatus === 'pending');
    for (const ind of pending) {
      await submitKyc(ind.id);
    }
    setIsSubmittingAll(false);
  }

  const canRetry = (status: string) => ['fail', 'error', 'refer'].includes(status);
  const pendingCount = individuals.filter((i) => i.kycStatus === 'pending').length;
  const completedCount = individuals.filter((i) => ['pass', 'fail', 'refer'].includes(i.kycStatus)).length;

  if (individuals.length === 0) {
    return (
      <div>
        <Alert variant="warning">No individuals to verify. Please go back and review.</Alert>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/onboarding/review')}>
          Back to Review
        </Button>
      </div>
    );
  }

  const riskConfig = orgAml?.riskLevel ? RISK_CONFIG[orgAml.riskLevel] : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-wise-navy">KYC Verification</h1>
        <p className="text-sm text-wise-gray-500 mt-1">
          Reviewing your details to complete the verification process.
          {completedCount > 0 && ` ${completedCount} of ${individuals.length} completed.`}
        </p>
      </div>

      {kycError && (
        <Alert variant="error" className="mb-4">{kycError}</Alert>
      )}

      {/* Organisation AML Results */}
      {orgAmlLoading && (
        <Card className="mb-6">
          <div className="flex items-center gap-3">
            <Spinner size="sm" />
            <span className="text-sm text-wise-gray-500">Loading organisation checks...</span>
          </div>
        </Card>
      )}

      {orgAml && (
        <Card className="mb-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <svg className="w-5 h-5 text-wise-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <h3 className="font-semibold text-wise-navy text-sm">{orgAml.entityName}</h3>
                <Badge variant={orgAml.status === 'COMPLETE' ? 'success' : 'info'}>
                  {orgAml.status === 'COMPLETE' ? 'Complete' : orgAml.status}
                </Badge>
              </div>
              <p className="text-xs text-wise-gray-500 mt-0.5">Organisation AML & Compliance Checks</p>
            </div>
            {riskConfig && (
              <div className="text-right shrink-0">
                <Badge variant={riskConfig.variant}>{riskConfig.label}</Badge>
                {orgAml.riskScore !== null && (
                  <p className={`text-xs mt-1 font-medium ${riskConfig.color}`}>
                    Score: {orgAml.riskScore}/100
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            {orgAml.checks.map((check) => (
              <div key={check.step} className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg bg-wise-gray-50">
                <CheckIcon result={check.result} />
                <span className="text-sm text-wise-gray-700 flex-1">
                  {STEP_LABELS[check.step] || check.step}
                </span>
                <span className={`text-xs font-medium ${
                  check.result === 'PASS' ? 'text-green-600' :
                  check.result === 'FAIL' ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {check.result === 'PASS' ? 'Passed' : check.result === 'FAIL' ? 'Failed' : 'Incomplete'}
                </span>
              </div>
            ))}
          </div>

          {orgAml.issues.length > 0 && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-xs font-medium text-red-800 mb-1">Issues Found</p>
              {orgAml.issues.map((issue, i) => (
                <p key={i} className="text-xs text-red-700">{issue.issue}</p>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Individual KYC Section */}
      <h2 className="text-lg font-semibold text-wise-navy mb-3">Individual Verification</h2>

      {pendingCount > 0 && (
        <div className="mb-6">
          <Button
            size="lg"
            className="w-full"
            onClick={submitAll}
            disabled={isSubmittingAll}
          >
            {isSubmittingAll ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" /> Verifying all individuals...
              </span>
            ) : (
              `Verify All (${pendingCount} remaining)`
            )}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {individuals.map((ind) =>
          editingId === ind.id ? (
            <IndividualEditForm
              key={ind.id}
              individual={ind}
              onSave={(updates) => handleEditSave(ind.id, updates)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <IndividualCard
              key={ind.id}
              individual={ind}
              onEdit={canRetry(ind.kycStatus) ? () => setEditingId(ind.id) : undefined}
              actionSlot={
                ind.kycStatus === 'pending' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <KycSubmitButton
                        individual={ind}
                        isSubmitting={submittingId === ind.id}
                        onSubmit={() => submitKyc(ind.id)}
                      />
                      <span className="text-xs text-wise-gray-400">or</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openLinkModal(ind.id)}
                      >
                        <span className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          Send Onboarding Link
                        </span>
                      </Button>
                    </div>
                    {linkResults[ind.id] && (
                      <OnboardingLinkBanner
                        result={linkResults[ind.id]}
                        isCopied={copiedId === ind.id}
                        onCopy={() => copyUrl(ind.id)}
                      />
                    )}
                  </div>
                ) : canRetry(ind.kycStatus) ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={submittingId === ind.id}
                        onClick={() => {
                          updateIndividual(ind.id, { kycStatus: 'pending' });
                          submitKyc(ind.id);
                        }}
                      >
                        {submittingId === ind.id ? (
                          <span className="flex items-center gap-2">
                            <Spinner size="sm" /> Retrying...
                          </span>
                        ) : (
                          'Retry Verification'
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={submittingId === ind.id}
                        onClick={() => setEditingId(ind.id)}
                      >
                        Edit Details
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openLinkModal(ind.id)}
                      >
                        <span className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          Send Onboarding Link
                        </span>
                      </Button>
                    </div>
                    {linkResults[ind.id] && (
                      <OnboardingLinkBanner
                        result={linkResults[ind.id]}
                        isCopied={copiedId === ind.id}
                        onCopy={() => copyUrl(ind.id)}
                      />
                    )}
                  </div>
                ) : undefined
              }
            />
          )
        )}
      </div>

      <div className="flex items-center justify-between mt-8">
        <Button variant="ghost" onClick={() => router.push('/onboarding/review')}>
          &larr; Back to Review
        </Button>
        <Button
          size="lg"
          variant="secondary"
          disabled={completedCount < individuals.length}
        >
          View Account &rarr;
        </Button>
      </div>

      {/* Onboarding Link Modal */}
      {linkModalId && (() => {
        const ind = individuals.find((i) => i.id === linkModalId);
        const fullName = ind ? [ind.givenName, ind.familyName].filter(Boolean).join(' ') : '';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !linkGenerating && setLinkModalId(null)}>
            <div
              className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-wise-gray-200">
                <h3 className="font-semibold text-wise-navy">Send Onboarding Link</h3>
                <p className="text-xs text-wise-gray-500 mt-0.5">
                  Generate a verification link for {fullName}
                </p>
              </div>

              <div className="px-5 py-4 space-y-4">
                {/* Option 1: Send via SMS */}
                <div className="rounded-lg border border-wise-gray-200 p-4">
                  <label className="text-sm font-medium text-wise-navy">Send via SMS</label>
                  <p className="text-xs text-wise-gray-500 mt-0.5 mb-2">
                    Enter their phone number and we&apos;ll text them the link.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      placeholder="0412 345 678"
                      value={linkPhone}
                      onChange={(e) => setLinkPhone(e.target.value)}
                      className="flex-1 text-sm border border-wise-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wise-green focus:border-transparent"
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={linkGenerating || !linkPhone.trim()}
                      onClick={() => generateOnboardingUrl(true)}
                    >
                      {linkGenerating ? (
                        <span className="flex items-center gap-2">
                          <Spinner size="sm" /> Sending...
                        </span>
                      ) : (
                        'Send SMS'
                      )}
                    </Button>
                  </div>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 border-t border-wise-gray-200" />
                  <span className="text-xs text-wise-gray-400">or</span>
                  <div className="flex-1 border-t border-wise-gray-200" />
                </div>

                {/* Option 2: Copy link */}
                <div className="rounded-lg border border-wise-gray-200 p-4">
                  <label className="text-sm font-medium text-wise-navy">Copy link to clipboard</label>
                  <p className="text-xs text-wise-gray-500 mt-0.5 mb-2">
                    Generate a link and copy it to share manually.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={linkGenerating}
                    className="w-full"
                    onClick={() => generateOnboardingUrl(false)}
                  >
                    {linkGenerating ? (
                      <span className="flex items-center gap-2">
                        <Spinner size="sm" /> Generating...
                      </span>
                    ) : copiedId === linkModalId ? (
                      <span className="flex items-center justify-center gap-1.5 text-green-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied to clipboard!
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        Generate &amp; Copy Link
                      </span>
                    )}
                  </Button>
                </div>

                {/* Show result if already generated */}
                {linkResults[linkModalId] && (
                  <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                    <p className="text-xs font-medium text-green-800 mb-1">
                      {linkResults[linkModalId].smsSent ? 'SMS sent successfully!' : 'Link generated'}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={linkResults[linkModalId].url}
                        className="flex-1 text-xs bg-white border border-green-300 rounded px-2 py-1 text-wise-gray-700 truncate"
                      />
                      <Button
                        size="sm"
                        variant={copiedId === linkModalId ? 'secondary' : 'outline'}
                        onClick={() => copyUrl(linkModalId)}
                      >
                        {copiedId === linkModalId ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                    <p className="text-xs text-green-600 mt-1">
                      Expires: {new Date(linkResults[linkModalId].expiry).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              <div className="px-5 py-3 border-t border-wise-gray-200 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={linkGenerating}
                  onClick={() => setLinkModalId(null)}
                >
                  {linkResults[linkModalId] ? 'Done' : 'Cancel'}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
