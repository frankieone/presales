'use client';

import { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useOnboardingStore } from '@/store/onboarding-store';
import { DOCUMENT_TYPES } from '@/lib/constants';

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.jpg,.jpeg,.png';

interface AnalysisResult {
  documentId: string;
  trustName?: string;
  trustType?: string;
  trustees: Array<{ name: string; type?: string }>;
  settlors: Array<{ name: string }>;
  beneficiaries: Array<{ name: string; type?: string; class?: string }>;
  rawData?: unknown;
}

export function SupportingDocuments() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { supportingDocuments, addSupportingDocument, removeSupportingDocument, australianOwnership } =
    useOnboardingStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [showRawJson, setShowRawJson] = useState<Record<number, boolean>>({});
  const [uploadResults, setUploadResults] = useState<
    Array<{ index: number; status: 'success' | 'error'; message?: string }>
  >([]);

  const handleFile = useCallback(
    (file: File) => {
      addSupportingDocument(file, selectedDocType);
    },
    [addSupportingDocument, selectedDocType]
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
    setIsUploading(true);
    setUploadResults([]);
    setAnalysisResults([]);

    const results: typeof uploadResults = [];
    const newAnalysisResults: AnalysisResult[] = [];

    for (let i = 0; i < supportingDocuments.length; i++) {
      const doc = supportingDocuments[i];
      try {
        // Step 1: Upload
        setUploadStep(`Uploading ${doc.name}...`);
        const formData = new FormData();
        formData.append('entityId', australianOwnership?.entityId || '');
        formData.append('docType', doc.docType);
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

        // Step 2: If it's a trust deed, trigger analysis
        if (doc.docType === 'TRUST_DEED' && documentId) {
          setUploadStep(`Analyzing ${doc.name} — this may take up to 2 minutes...`);

          const analyzeRes = await fetch('/api/documents/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entityId: australianOwnership?.entityId || '',
              documentId,
            }),
          });

          if (analyzeRes.ok) {
            const analyzeData = await analyzeRes.json();
            const raw = analyzeData.analysis;
            newAnalysisResults.push({
              documentId,
              trustName: raw?.trustName || raw?.trust_details?.trust_name || raw?.trust_name,
              trustType: raw?.trustType || raw?.trust_details?.trust_type || raw?.trust_type,
              trustees: raw?.trustees || raw?.trust_details?.trustees || [],
              settlors: raw?.settlors || raw?.trust_details?.settlors || [],
              beneficiaries: raw?.beneficiaries || raw?.trust_details?.beneficiaries || [],
              rawData: raw,
            });
            results.push({ index: i, status: 'success' });
          } else {
            const err = await analyzeRes.json();
            results.push({ index: i, status: 'error', message: err.error || 'Analysis failed' });
          }
        } else {
          results.push({ index: i, status: 'success' });
        }
      } catch {
        results.push({ index: i, status: 'error', message: 'Network error' });
      }
    }

    setUploadResults(results);
    setAnalysisResults(newAnalysisResults);
    setUploadStep(null);
    setIsUploading(false);
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
                    <p className="text-[10px] text-wise-gray-500">{docTypeLabel(doc.docType)}</p>
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
                {uploadStep || 'Processing...'}
              </>
            ) : (
              'Upload All'
            )}
          </Button>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResults.length > 0 && (
        <div className="mt-4 space-y-3">
          {analysisResults.map((result, idx) => (
            <div key={idx} className="border border-green-200 bg-green-50/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h5 className="text-sm font-semibold text-wise-navy">Trust Analysis Results</h5>
              </div>

              {(result.trustName || result.trustType) && (
                <div className="bg-green-50 rounded-lg px-3 py-2">
                  {result.trustName && <p className="text-sm font-medium text-wise-navy">{result.trustName}</p>}
                  {result.trustType && <p className="text-xs text-wise-gray-500 mt-0.5">Type: {result.trustType}</p>}
                </div>
              )}

              {result.settlors.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-wise-gray-700 mb-1">Settlors</p>
                  <div className="space-y-1">
                    {result.settlors.map((s, i) => (
                      <div key={i} className="text-xs bg-white rounded px-2 py-1.5 border border-wise-gray-200 text-wise-navy">{s.name}</div>
                    ))}
                  </div>
                </div>
              )}

              {result.trustees.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-wise-gray-700 mb-1">Trustees</p>
                  <div className="space-y-1">
                    {result.trustees.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-white rounded px-2 py-1.5 border border-wise-gray-200">
                        <span className="text-wise-navy">{t.name}</span>
                        {t.type && <span className="text-[10px] px-1.5 py-0.5 rounded bg-wise-gray-100 text-wise-gray-500">{t.type}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.beneficiaries.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-wise-gray-700 mb-1">Beneficiaries</p>
                  <div className="space-y-1">
                    {result.beneficiaries.map((b, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-white rounded px-2 py-1.5 border border-wise-gray-200">
                        <span className="text-wise-navy">{b.name}</span>
                        {b.type && <span className="text-[10px] px-1.5 py-0.5 rounded bg-wise-gray-100 text-wise-gray-500">{b.type}</span>}
                        {b.class && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{b.class}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.settlors.length === 0 && result.trustees.length === 0 && result.beneficiaries.length === 0 && (
                <p className="text-xs text-wise-gray-500 italic">No structured findings extracted. Check raw data below.</p>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => setShowRawJson((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                  className="text-[11px] text-wise-gray-500 hover:text-wise-gray-700 underline"
                >
                  {showRawJson[idx] ? 'Hide' : 'Show'} raw analysis data
                </button>
                {showRawJson[idx] && (
                  <pre className="mt-2 text-[10px] bg-wise-gray-50 rounded-lg p-3 overflow-auto max-h-64 text-wise-gray-600 border border-wise-gray-200">
                    {JSON.stringify(result.rawData, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
