'use client';

import { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { useOnboardingStore } from '@/store/onboarding-store';
import { DOCUMENT_TYPES } from '@/lib/constants';
import type { TrustAnalysisResult, TrustLinkedIndividual } from '@/types/business';

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.jpg,.jpeg,.png';

export function SupportingDocuments() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { supportingDocuments, addSupportingDocument, removeSupportingDocument, australianOwnership, setTrustAnalysisResult, trustAnalysisResults, trustLinkedOrgId, setTrustLinkedOrgId } =
    useOnboardingStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<
    Array<{ index: number; status: 'success' | 'error'; message?: string }>
  >([]);

  const [selectedCountry, setSelectedCountry] = useState<string>('AUS');

  const isTrustDeed = selectedDocType === 'TRUST_DEED';

  const handleFile = useCallback(
    (file: File) => {
      addSupportingDocument(file, selectedDocType, isTrustDeed ? selectedCountry : undefined);
    },
    [addSupportingDocument, selectedDocType, isTrustDeed, selectedCountry]
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(handleFile);
    }
    // Reset so the same file can be selected again
    e.target.value = '';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    Array.from(e.dataTransfer.files).forEach(handleFile);
  }

  async function handleUploadAll() {
    if (supportingDocuments.length === 0) return;

    const entityId = australianOwnership?.entityId;
    if (!entityId) {
      setUploadResults([{ index: 0, status: 'error', message: 'No organization entity ID found. Please complete the business search first.' }]);
      return;
    }

    setIsUploading(true);
    setUploadResults([]);

    const results: typeof uploadResults = [];

    for (let i = 0; i < supportingDocuments.length; i++) {
      const doc = supportingDocuments[i];
      try {
        // Step 1: Upload document
        const formData = new FormData();
        formData.append('entityId', entityId);
        formData.append('docType', doc.docType);
        formData.append('country', doc.country || 'AUS');
        formData.append('file', doc.file);

        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          results.push({ index: i, status: 'error', message: err.error });
          continue;
        }

        const uploadData = await res.json();
        const documentId = uploadData.documentId;

        // Step 2: If it's a trust deed, trigger trust analysis
        if (doc.docType === 'TRUST_DEED' && documentId) {
          const analyzeRes = await fetch('/api/documents/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entityId, documentId }),
          });

          if (analyzeRes.ok) {
            const analyzeData = await analyzeRes.json();
            const raw = analyzeData.analysis;
            const analysis = raw?.analyses?.[0] || raw;
            const trust = analysis?.documentInformation?.trust || {};
            const disc = trust?.typeInformation?.discretionary;
            const trustResult: TrustAnalysisResult = {
              documentId,
              analysisId: analysis?.analysisId,
              status: analysis?.status || 'COMPLETE',
              trustName: trust?.name?.value,
              trustType: trust?.type?.detected,
              establishment: trust?.establishment ? {
                date: trust.establishment.date?.normalized,
                country: trust.establishment.country?.value,
                subdivision: trust.establishment.subdivision?.value,
              } : undefined,
              execution: trust?.execution?.date ? {
                date: trust.execution.date.normalized,
              } : undefined,
              certification: trust?.certification?.date ? {
                date: trust.certification.date.normalized,
              } : undefined,
              linkedIndividuals: trust?.linkedIndividuals || {},
              linkedOrganizations: trust?.linkedOrganizations || {},
              settlors: trust?.settlors || [],
              trustees: trust?.trustees || [],
              appointors: disc?.appointors || [],
              specifiedBeneficiaries: disc?.specifiedBeneficiaries || [],
              generalBeneficiaries: disc?.generalBeneficiaries || [],
              rawData: raw,
            };
            setTrustAnalysisResult(entityId, trustResult);
            results.push({ index: i, status: 'success', message: 'Uploaded & analyzed' });
          } else {
            const err = await analyzeRes.json();
            results.push({ index: i, status: 'error', message: err.error || 'Upload succeeded but analysis failed' });
          }
        } else {
          results.push({ index: i, status: 'success' });
        }
      } catch {
        results.push({ index: i, status: 'error', message: 'Network error' });
      }
    }

    setUploadResults(results);
    setIsUploading(false);

    // Remove successfully uploaded documents from the queue
    const successIndices = new Set(results.filter(r => r.status === 'success').map(r => r.index));
    if (successIndices.size > 0) {
      // Remove in reverse order so indices stay valid
      const sorted = [...successIndices].sort((a, b) => b - a);
      for (const idx of sorted) {
        removeSupportingDocument(idx);
      }
      setUploadResults([]);
    }
  }

  const docTypeLabel = (value: string) =>
    DOCUMENT_TYPES.find((dt) => dt.value === value)?.label || value;

  return (
    <div className="bg-white rounded-xl border border-wise-gray-200 shadow-sm p-5">
      <h3 className="font-bold text-wise-navy text-lg mb-1">Supporting Documents</h3>
      <p className="text-xs text-wise-gray-500 mb-4">
        Upload any additional documents required for compliance review.
      </p>

      {/* Document type selector */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-wise-gray-700 mb-1">Document Type</label>
        <select
          value={selectedDocType}
          onChange={(e) => setSelectedDocType(e.target.value)}
          className="block w-full max-w-xs rounded-lg border border-wise-gray-300 px-3 py-2 text-sm focus:border-wise-green focus:ring-1 focus:ring-wise-green"
        >
          <option value="" disabled>Add a document</option>
          {DOCUMENT_TYPES.map((dt) => (
            <option key={dt.value} value={dt.value}>
              {dt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Country selector — shown for Trust Deed */}
      {isTrustDeed && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-wise-gray-700 mb-1">Country of Trust</label>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="block w-full max-w-xs rounded-lg border border-wise-gray-300 px-3 py-2 text-sm focus:border-wise-green focus:ring-1 focus:ring-wise-green"
          >
            <option value="AUS">Australia</option>
          </select>
          <p className="text-[10px] text-wise-gray-400 mt-1">Only Australian trust deeds are currently supported.</p>
        </div>
      )}

      {/* Drag-and-drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragOver
            ? 'border-wise-green bg-wise-green/5'
            : 'border-wise-gray-300 hover:border-wise-gray-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <svg
          className="w-8 h-8 mx-auto mb-1 text-wise-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className="text-xs text-wise-gray-500">
          Drop files here or <span className="text-wise-green font-medium">browse</span>
        </p>
        <p className="text-[10px] text-wise-gray-400 mt-0.5">PDF, DOC, DOCX, JPG, PNG</p>
      </div>

      {/* Queued documents list */}
      {supportingDocuments.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-wise-gray-700">
            Queued ({supportingDocuments.length})
          </p>
          {supportingDocuments.map((doc, i) => {
            const result = uploadResults.find((r) => r.index === i);
            return (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-lg border border-wise-gray-200 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <svg
                    className="w-4 h-4 text-wise-gray-400 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-wise-gray-700 truncate">{doc.name}</p>
                    <p className="text-[10px] text-wise-gray-500">
                      {docTypeLabel(doc.docType)}
                      {doc.country && <span className="ml-1 text-wise-gray-400">({doc.country})</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {result?.status === 'success' && (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {result?.status === 'error' && (
                    <span className="text-[10px] text-red-600">{result.message || 'Failed'}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeSupportingDocument(i)}
                    className="p-0.5 text-wise-gray-400 hover:text-red-500 transition-colors"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}

          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={handleUploadAll}
            disabled={isUploading}
            className="mt-2"
          >
            {isUploading ? (
              <>
                <Spinner size="sm" className="mr-1.5" />
                Uploading...
              </>
            ) : (
              'Upload All'
            )}
          </Button>
        </div>
      )}
      {/* Trust Analysis Summary Cards */}
      {Object.entries(trustAnalysisResults).map(([key, result]) => (
        <TrustSummaryCard
          key={key}
          result={result}
          orgNodes={australianOwnership?.shareholders?.filter(s => s.entityType === 'ORGANIZATION').map(s => ({ id: s.entityId, name: s.name })) || []}
          rootOrg={australianOwnership?.entityId && australianOwnership?.businessDetails?.registeredName ? { id: australianOwnership.entityId, name: australianOwnership.businessDetails.registeredName } : undefined}
          trustLinkedOrgId={trustLinkedOrgId}
          onLinkOrg={setTrustLinkedOrgId}
        />
      ))}
    </div>
  );
}

function TrustSummaryCard({
  result,
  orgNodes,
  rootOrg,
  trustLinkedOrgId,
  onLinkOrg,
}: {
  result: TrustAnalysisResult;
  orgNodes: Array<{ id: string; name: string }>;
  rootOrg?: { id: string; name: string };
  trustLinkedOrgId?: string | null;
  onLinkOrg?: (orgId: string) => void;
}) {
  const router = useRouter();
  const indCount = Object.keys(result.linkedIndividuals).length;
  const orgCount = Object.keys(result.linkedOrganizations).length;

  const statusColor = result.status === 'CONFIRMED'
    ? 'bg-green-100 text-green-700 border-green-200'
    : result.status === 'COMPLETE'
    ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-gray-100 text-gray-600 border-gray-200';

  const allOrgs = [
    ...(rootOrg ? [rootOrg] : []),
    ...orgNodes,
  ];

  const linkedOrgName = trustLinkedOrgId
    ? allOrgs.find(o => o.id === trustLinkedOrgId)?.name
    : null;

  return (
    <div className="mt-4 rounded-xl border-2 border-yellow-300 bg-yellow-50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-semibold text-wise-navy">{result.trustName || 'Trust Document'}</p>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusColor}`}>
              {result.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-wise-gray-500">
            {result.trustType && <span>Type: <span className="font-medium text-wise-gray-700">{result.trustType}</span></span>}
            <span>{indCount} individual{indCount !== 1 ? 's' : ''}</span>
            {orgCount > 0 && <span>{orgCount} organisation{orgCount !== 1 ? 's' : ''}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/onboarding/review/trust')}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-yellow-600 text-white hover:bg-yellow-700 transition-colors"
        >
          {result.status === 'CONFIRMED' ? 'View Details' : 'Review & Confirm'}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Organisation linking */}
      <div className="mt-3 pt-3 border-t border-yellow-200">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-yellow-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          {trustLinkedOrgId && linkedOrgName ? (
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-yellow-800">Linked to <span className="font-semibold">{linkedOrgName}</span></span>
              <button
                type="button"
                onClick={() => onLinkOrg?.('')}
                className="text-[10px] text-yellow-700 hover:text-yellow-900 underline"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <label className="text-xs text-yellow-800 shrink-0">Link to organisation:</label>
              <select
                value={trustLinkedOrgId || ''}
                onChange={(e) => onLinkOrg?.(e.target.value)}
                className="flex-1 rounded-lg border border-yellow-300 bg-white px-2 py-1 text-xs text-yellow-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
              >
                <option value="">Select...</option>
                {allOrgs.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {result.status !== 'CONFIRMED' && (
        <p className="text-[10px] text-amber-600 mt-2">
          Trust details must be reviewed and confirmed before proceeding to KYC verification.
        </p>
      )}
    </div>
  );
}

export function TrustAnalysisPanel({
  entityId,
  result,
  individuals,
  onAddToIndividuals,
  onAddToTrust,
  onConfirmed,
}: {
  entityId: string;
  result: TrustAnalysisResult;
  individuals: Array<{ id: string; givenName?: string; familyName?: string }>;
  onAddToIndividuals: (ind: TrustLinkedIndividual, roles: string[]) => void | Promise<void>;
  onAddToTrust: (entry: { entityId?: string; entityType: 'INDIVIDUAL' | 'ORGANIZATION'; name: string; role: string }) => void;
  onConfirmed: (result: TrustAnalysisResult) => void;
}) {
  const [showRawJson, setShowRawJson] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [manualEntityType, setManualEntityType] = useState<'INDIVIDUAL' | 'ORGANIZATION'>('INDIVIDUAL');
  const [manualName, setManualName] = useState('');
  const [manualFamilyName, setManualFamilyName] = useState('');
  const [manualRole, setManualRole] = useState('beneficiary');

  // Match trust entities to individuals by ID or by name
  const addedIds = new Set(individuals.map((i) => i.id));
  const addedNames = new Set(
    individuals.map((i) => `${(i.givenName || '').toLowerCase()} ${(i.familyName || '').toLowerCase()}`.trim()).filter(Boolean)
  );

  function isIndividualAdded(trustId: string, ind: TrustLinkedIndividual): boolean {
    if (addedIds.has(trustId)) return true;
    const displayName = (ind.name.displayName || `${ind.name.givenName || ''} ${ind.name.familyName || ''}`).trim().toLowerCase();
    if (displayName && addedNames.has(displayName)) return true;
    // Also check givenName+familyName separately
    const nameKey = `${(ind.name.givenName || '').toLowerCase()} ${(ind.name.familyName || '').toLowerCase()}`.trim();
    if (nameKey && addedNames.has(nameKey)) return true;
    return false;
  }

  function getRolesForEntity(entityId: string): string[] {
    const roles: string[] = [];
    if (result.settlors.some((s) => s.entityId === entityId)) roles.push('settlor');
    if (result.trustees.some((t) => t.entityId === entityId)) roles.push('trustee');
    if (result.appointors.some((a) => a.entityId === entityId)) roles.push('appointor');
    if (result.specifiedBeneficiaries.some((b) => b.entityId === entityId)) roles.push('beneficiary');
    return roles;
  }

  const roleBadgeColor: Record<string, string> = {
    settlor: 'bg-purple-100 text-purple-700',
    trustee: 'bg-blue-100 text-blue-700',
    appointor: 'bg-amber-100 text-amber-700',
    beneficiary: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="mt-6 bg-white rounded-xl border border-green-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="font-bold text-wise-navy text-lg">Trust Analysis Results</h3>
      </div>

      {/* Trust summary */}
      <div className="bg-green-50 rounded-lg px-4 py-3 mb-4">
        {result.trustName && <p className="text-sm font-semibold text-wise-navy">{result.trustName}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 mt-2 text-xs text-wise-gray-600">
          {result.trustType && (
            <div><span className="text-wise-gray-400">Type</span><p className="font-medium">{result.trustType}</p></div>
          )}
          {result.establishment?.date && (
            <div><span className="text-wise-gray-400">Established</span><p className="font-medium">{result.establishment.date}</p></div>
          )}
          {result.establishment?.country && (
            <div><span className="text-wise-gray-400">Country</span><p className="font-medium">{result.establishment.country}{result.establishment.subdivision ? `, ${result.establishment.subdivision}` : ''}</p></div>
          )}
          {result.execution?.date && (
            <div><span className="text-wise-gray-400">Executed</span><p className="font-medium">{result.execution.date}</p></div>
          )}
          {result.certification?.date && (
            <div><span className="text-wise-gray-400">Certified</span><p className="font-medium">{result.certification.date}</p></div>
          )}
          <div><span className="text-wise-gray-400">Status</span><p className="font-medium">{result.status}</p></div>
        </div>
      </div>

      {/* Individuals */}
      {Object.keys(result.linkedIndividuals).length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-wise-gray-700 mb-2">
            Individuals ({Object.keys(result.linkedIndividuals).length})
          </p>
          <div className="space-y-2">
            {Object.entries(result.linkedIndividuals).map(([id, ind]) => {
              const roles = getRolesForEntity(id);
              const alreadyAdded = isIndividualAdded(id, ind);
              return (
                <div
                  key={id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-wise-gray-200 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-wise-navy">
                      {ind.name.displayName || `${ind.name.givenName || ''} ${ind.name.middleName ? ind.name.middleName + ' ' : ''}${ind.name.familyName || ''}`.trim()}
                    </p>
                    {ind.dateOfBirth && (ind.dateOfBirth.normalized || ind.dateOfBirth.year) && (
                      <p className="text-[10px] text-wise-gray-500 mt-0.5">
                        DOB: {ind.dateOfBirth.normalized || [ind.dateOfBirth.day, ind.dateOfBirth.month, ind.dateOfBirth.year].filter(Boolean).join('/')}
                      </p>
                    )}
                    {ind.addresses?.[0] && (
                      <p className="text-[10px] text-wise-gray-400 truncate mt-0.5">
                        {ind.addresses[0].unstructuredLongForm ||
                          [ind.addresses[0].unitNumber, ind.addresses[0].buildingName, ind.addresses[0].streetName, ind.addresses[0].neighborhood, ind.addresses[0].subdivision, ind.addresses[0].postalCode, ind.addresses[0].country].filter(Boolean).join(', ')}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {roles.map((role) => (
                        <span key={role} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${roleBadgeColor[role] || 'bg-gray-100 text-gray-600'}`}>
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {alreadyAdded ? (
                      <Badge variant="success">Added</Badge>
                    ) : addingId === id ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-wise-gray-500">
                        <Spinner size="sm" /> Adding...
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          console.log('[TrustPanel] Add to individuals clicked for:', id, ind.name);
                          setAddingId(id);
                          try {
                            await onAddToIndividuals(ind, roles.length > 0 ? roles.map(r => r === 'beneficiary' ? 'ubo' : r) : ['ubo']);
                          } finally {
                            setAddingId(null);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-wise-green text-white hover:bg-wise-green/90 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Organizations */}
      {Object.keys(result.linkedOrganizations).length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-wise-gray-700 mb-2">
            Organizations ({Object.keys(result.linkedOrganizations).length})
          </p>
          <div className="space-y-2">
            {Object.entries(result.linkedOrganizations).map(([id, org]) => {
              const roles = getRolesForEntity(id);
              return (
                <div
                  key={id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-wise-gray-200 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-wise-navy">{org.details?.name?.value || id}</p>
                    {org.details?.type?.description && (
                      <p className="text-[10px] text-wise-gray-500 mt-0.5">{org.details.type.description}</p>
                    )}
                    {org.details?.registrationDetails && org.details.registrationDetails.length > 0 && (
                      <p className="text-[10px] text-wise-gray-400 mt-0.5">
                        {org.details.registrationDetails.map(r => `${r.registrationNumberType || 'Reg'}: ${r.registrationNumber}`).join(' | ')}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {roles.map((role) => (
                        <span key={role} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${roleBadgeColor[role] || 'bg-gray-100 text-gray-600'}`}>
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* General beneficiaries */}
      {result.generalBeneficiaries.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-wise-gray-700 mb-2">General Beneficiary Classes</p>
          <div className="space-y-1">
            {result.generalBeneficiaries.map((b, i) => (
              <p key={i} className="text-xs text-wise-gray-600 bg-wise-gray-50 rounded px-2.5 py-1.5 border border-wise-gray-100">
                {b.value}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Add to trust manually */}
      <div className="mb-4">
        {!showAddForm ? (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-wise-green hover:text-wise-green/80 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add to trust manually
          </button>
        ) : (
          <div className="rounded-lg border border-wise-gray-200 p-3 space-y-2">
            <p className="text-xs font-semibold text-wise-gray-700">Add to Trust</p>
            <div className="flex gap-2">
              <label className="inline-flex items-center gap-1 text-xs">
                <input
                  type="radio"
                  name="entityType"
                  value="INDIVIDUAL"
                  checked={manualEntityType === 'INDIVIDUAL'}
                  onChange={() => setManualEntityType('INDIVIDUAL')}
                  className="text-wise-green focus:ring-wise-green"
                />
                Individual
              </label>
              <label className="inline-flex items-center gap-1 text-xs">
                <input
                  type="radio"
                  name="entityType"
                  value="ORGANIZATION"
                  checked={manualEntityType === 'ORGANIZATION'}
                  onChange={() => setManualEntityType('ORGANIZATION')}
                  className="text-wise-green focus:ring-wise-green"
                />
                Organisation
              </label>
            </div>
            {manualEntityType === 'INDIVIDUAL' ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Given name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="rounded-lg border border-wise-gray-300 px-2.5 py-1.5 text-xs focus:border-wise-green focus:ring-1 focus:ring-wise-green"
                />
                <input
                  type="text"
                  placeholder="Family name"
                  value={manualFamilyName}
                  onChange={(e) => setManualFamilyName(e.target.value)}
                  className="rounded-lg border border-wise-gray-300 px-2.5 py-1.5 text-xs focus:border-wise-green focus:ring-1 focus:ring-wise-green"
                />
              </div>
            ) : (
              <input
                type="text"
                placeholder="Organisation name"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-full rounded-lg border border-wise-gray-300 px-2.5 py-1.5 text-xs focus:border-wise-green focus:ring-1 focus:ring-wise-green"
              />
            )}
            <select
              value={manualRole}
              onChange={(e) => setManualRole(e.target.value)}
              className="rounded-lg border border-wise-gray-300 px-2.5 py-1.5 text-xs focus:border-wise-green focus:ring-1 focus:ring-wise-green"
            >
              <option value="beneficiary">Beneficiary</option>
              <option value="trustee">Trustee</option>
              <option value="settlor">Settlor</option>
              <option value="appointor">Appointor</option>
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={
                  (manualEntityType === 'INDIVIDUAL' ? (!manualName.trim() || !manualFamilyName.trim()) : !manualName.trim())
                }
                onClick={() => {
                  const displayName = manualEntityType === 'INDIVIDUAL'
                    ? `${manualName.trim()} ${manualFamilyName.trim()}`
                    : manualName.trim();
                  onAddToTrust({
                    entityType: manualEntityType,
                    name: displayName,
                    role: manualRole,
                  });
                  setManualName('');
                  setManualFamilyName('');
                  setShowAddForm(false);
                }}
                className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg bg-wise-green text-white hover:bg-wise-green/90 transition-colors disabled:opacity-50"
              >
                Add to Trust
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setManualName(''); setManualFamilyName(''); }}
                className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg border border-wise-gray-300 text-wise-gray-600 hover:bg-wise-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm / Status */}
      <div className="flex items-center gap-3 mb-4">
        {result.status === 'CONFIRMED' ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 text-green-700 text-xs font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Trust details confirmed
          </div>
        ) : (
          <button
            type="button"
            disabled={isConfirming}
            onClick={async () => {
              setIsConfirming(true);
              setConfirmError(null);
              try {
                // Start from the original analysis, then overlay any additions
                const raw = result.rawData as Record<string, unknown> | undefined;
                const analyses = raw?.analyses as Array<Record<string, unknown>> | undefined;
                const analysis = analyses?.[0] || {};
                // Deep clone so we can mutate safely
                const docInfo = JSON.parse(JSON.stringify(analysis.documentInformation || { type: 'TRUST_DOCUMENT' }));

                // Merge manually-added individuals into the trust structure
                if (docInfo.trust) {
                  // Update linkedIndividuals with any new entries
                  docInfo.trust.linkedIndividuals = {
                    ...docInfo.trust.linkedIndividuals,
                    ...Object.fromEntries(
                      Object.entries(result.linkedIndividuals)
                        .filter(([id]) => !(docInfo.trust.linkedIndividuals?.[id]))
                        .map(([id, ind]) => [id, {
                          entityId: id,
                          entityType: 'INDIVIDUAL',
                          name: ind.name,
                        }])
                    ),
                  };

                  // Update role arrays
                  const trustType = docInfo.trust.typeInformation?.discretionary;
                  if (trustType) {
                    trustType.specifiedBeneficiaries = result.specifiedBeneficiaries;
                    trustType.appointors = result.appointors;
                  }
                  docInfo.trust.settlors = result.settlors;
                  docInfo.trust.trustees = result.trustees;
                }

                const confirmBody = {
                  entityId,
                  documentId: result.documentId,
                  analysisId: result.analysisId,
                  documentInformation: {
                    references: analysis.references || {},
                    documentInformation: docInfo,
                  },
                };
                const res = await fetch('/api/documents/confirm', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(confirmBody),
                });
                if (res.ok) {
                  onConfirmed({ ...result, status: 'CONFIRMED' });
                } else {
                  const err = await res.json();
                  setConfirmError(err.error || 'Failed to confirm');
                }
              } catch {
                setConfirmError('Network error');
              } finally {
                setIsConfirming(false);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isConfirming ? (
              <>
                <Spinner size="sm" className="mr-1" />
                Confirming...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Confirm Trust Details
              </>
            )}
          </button>
        )}
        {confirmError && <span className="text-[10px] text-red-600">{confirmError}</span>}
      </div>

      {/* Raw JSON toggle */}
      <button
        type="button"
        onClick={() => setShowRawJson(!showRawJson)}
        className="text-[11px] text-wise-gray-500 hover:text-wise-gray-700 underline"
      >
        {showRawJson ? 'Hide' : 'Show'} raw analysis data
      </button>
      {showRawJson && (
        <pre className="mt-2 text-[10px] bg-wise-gray-50 rounded-lg p-3 overflow-auto max-h-64 text-wise-gray-600 border border-wise-gray-200">
          {JSON.stringify(result.rawData, null, 2)}
        </pre>
      )}
    </div>
  );
}
