'use client';

import { useRef, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useOnboardingStore } from '@/store/onboarding-store';
import { SAMPLE_TRUST_PDFS } from '@/lib/constants';
import type { BlockingEntity, TrustAnalysisResult } from '@/types/business';

type SubmitStep = 'idle' | 'uploading' | 'analyzing' | 'success' | 'error';

interface BlockingEntityCardProps {
  entity: BlockingEntity;
}

export function BlockingEntityCard({ entity }: BlockingEntityCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { trustDocuments, setTrustDocument, trustAnalysisResults, setTrustAnalysisResult } = useOnboardingStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState<string | null>(null);
  const [submitStep, setSubmitStep] = useState<SubmitStep>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const trustDoc = trustDocuments[entity.entityId];
  const analysisResult = trustAnalysisResults[entity.entityId];

  const handleFile = useCallback(
    (file: File) => {
      setTrustDocument(entity.entityId, file);
      setSubmitStep('idle');
      setSubmitError(null);
    },
    [entity.entityId, setTrustDocument]
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
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
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.pdf') || file.name.endsWith('.doc') || file.name.endsWith('.docx'))) {
      handleFile(file);
    }
  }

  async function handleQuickSelect(filename: string) {
    setIsLoadingSample(filename);
    try {
      const res = await fetch(`/assets/${filename}`);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: 'application/pdf' });
      handleFile(file);
    } catch {
      setSubmitError('Failed to load sample PDF');
    } finally {
      setIsLoadingSample(null);
    }
  }

  async function handleSubmitToTrustReader() {
    if (!trustDoc) return;
    setSubmitStep('uploading');
    setSubmitError(null);

    try {
      // Step 1: Upload document
      const formData = new FormData();
      formData.append('entityId', entity.entityId);
      formData.append('docType', 'TRUST_DEED');
      formData.append('file', trustDoc.file);

      const uploadRes = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || 'Upload failed');
      }

      const uploadData = await uploadRes.json();
      const documentId = uploadData.documentId;

      if (!documentId) {
        throw new Error('No documentId returned from upload');
      }

      // Step 2: Trigger analysis + poll + get results
      setSubmitStep('analyzing');

      const analyzeRes = await fetch('/api/documents/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: entity.entityId, documentId }),
      });

      if (!analyzeRes.ok) {
        const err = await analyzeRes.json();
        throw new Error(err.error || 'Analysis failed');
      }

      const analyzeData = await analyzeRes.json();
      const raw = analyzeData.analysis;

      // Normalize the analysis result
      const result: TrustAnalysisResult = {
        documentId,
        status: 'completed',
        trustees: raw?.trustees || raw?.trust_details?.trustees || [],
        settlors: raw?.settlors || raw?.trust_details?.settlors || [],
        beneficiaries: raw?.beneficiaries || raw?.trust_details?.beneficiaries || [],
        trustType: raw?.trustType || raw?.trust_details?.trust_type || raw?.trust_type,
        trustName: raw?.trustName || raw?.trust_details?.trust_name || raw?.trust_name,
        rawData: raw,
      };

      setTrustAnalysisResult(entity.entityId, result);
      setSubmitStep('success');
    } catch (err) {
      setSubmitStep('error');
      setSubmitError(err instanceof Error ? err.message : 'Failed');
    }
  }

  const isProcessing = submitStep === 'uploading' || submitStep === 'analyzing';

  return (
    <Card className="border-amber-300 bg-amber-50/30">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-semibold text-wise-navy text-sm">{entity.name}</h4>
          </div>
          <Badge variant="warning">More info needed</Badge>
        </div>

        <p className="text-xs text-wise-gray-600">
          We weren&apos;t able to automatically identify the beneficial owners of <span className="font-medium">{entity.name}</span> ({entity.percentageOwned.total}% ownership).
          To continue, please upload a supporting document so we can verify who the owners are.
        </p>

        <div className="border-t border-amber-200 pt-3">
          <p className="text-xs font-medium text-wise-gray-700 mb-2">
            Upload Supporting Document
          </p>

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
              accept=".pdf,.doc,.docx"
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
              Drop trust deed here or <span className="text-wise-green font-medium">browse</span>
            </p>
            <p className="text-[10px] text-wise-gray-400 mt-0.5">PDF, DOC, DOCX</p>
          </div>

          {/* Quick-select sample PDFs */}
          <div className="mt-2">
            <p className="text-[10px] text-wise-gray-500 mb-1">Quick select sample trust deed:</p>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_TRUST_PDFS.map((pdf) => (
                <button
                  key={pdf.filename}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickSelect(pdf.filename);
                  }}
                  disabled={isLoadingSample !== null}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-wise-gray-200 bg-white hover:bg-wise-gray-50 text-wise-gray-700 transition-colors disabled:opacity-50"
                >
                  {isLoadingSample === pdf.filename ? (
                    <Spinner size="sm" />
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  {pdf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Submit + status */}
          {trustDoc && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs text-green-700 font-medium truncate">{trustDoc.name}</span>
              </div>

              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={handleSubmitToTrustReader}
                disabled={isProcessing || submitStep === 'success'}
              >
                {submitStep === 'uploading' ? (
                  <>
                    <Spinner size="sm" className="mr-1.5" />
                    Uploading...
                  </>
                ) : submitStep === 'analyzing' ? (
                  <>
                    <Spinner size="sm" className="mr-1.5" />
                    Analyzing trust deed...
                  </>
                ) : submitStep === 'success' ? (
                  <>
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Analysis Complete
                  </>
                ) : (
                  'Submit to Trust Reader'
                )}
              </Button>

              {submitStep === 'error' && (
                <p className="text-xs text-red-600">{submitError}</p>
              )}
              {submitStep === 'analyzing' && (
                <p className="text-xs text-wise-gray-500">This may take up to 2 minutes...</p>
              )}
            </div>
          )}
        </div>

        {/* Trust Analysis Findings */}
        {analysisResult && <TrustFindings result={analysisResult} showRawJson={showRawJson} onToggleRaw={() => setShowRawJson(!showRawJson)} />}
      </div>
    </Card>
  );
}

function TrustFindings({
  result,
  showRawJson,
  onToggleRaw,
}: {
  result: TrustAnalysisResult;
  showRawJson: boolean;
  onToggleRaw: () => void;
}) {
  return (
    <div className="border-t border-green-200 pt-3 space-y-3">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h5 className="text-sm font-semibold text-wise-navy">Trust Analysis Findings</h5>
      </div>

      {(result.trustName || result.trustType) && (
        <div className="bg-green-50 rounded-lg px-3 py-2">
          {result.trustName && (
            <p className="text-sm font-medium text-wise-navy">{result.trustName}</p>
          )}
          {result.trustType && (
            <p className="text-xs text-wise-gray-500 mt-0.5">Type: {result.trustType}</p>
          )}
        </div>
      )}

      {result.settlors.length > 0 && (
        <FindingsSection title="Settlors" items={result.settlors.map((s) => s.name)} />
      )}

      {result.trustees.length > 0 && (
        <div>
          <p className="text-xs font-medium text-wise-gray-700 mb-1">Trustees</p>
          <div className="space-y-1">
            {result.trustees.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-white rounded px-2 py-1.5 border border-wise-gray-200">
                <span className="text-wise-navy">{t.name}</span>
                {t.type && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-wise-gray-100 text-wise-gray-500">
                    {t.type}
                  </span>
                )}
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
                {b.type && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-wise-gray-100 text-wise-gray-500">
                    {b.type}
                  </span>
                )}
                {b.class && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                    {b.class}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {result.settlors.length === 0 && result.trustees.length === 0 && result.beneficiaries.length === 0 && (
        <p className="text-xs text-wise-gray-500 italic">No structured findings extracted. Check raw data below.</p>
      )}

      {/* Collapsible raw JSON */}
      <div>
        <button
          type="button"
          onClick={onToggleRaw}
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
    </div>
  );
}

function FindingsSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-wise-gray-700 mb-1">{title}</p>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="text-xs bg-white rounded px-2 py-1.5 border border-wise-gray-200 text-wise-navy">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
