'use client';

import { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useOnboardingStore } from '@/store/onboarding-store';
import { DOCUMENT_TYPES } from '@/lib/constants';

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.jpg,.jpeg,.png';

export function SupportingDocuments() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { supportingDocuments, addSupportingDocument, removeSupportingDocument, australianOwnership } =
    useOnboardingStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
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

    const results: typeof uploadResults = [];

    for (let i = 0; i < supportingDocuments.length; i++) {
      const doc = supportingDocuments[i];
      try {
        const formData = new FormData();
        // Use a placeholder entity ID — in a real flow this would be the org entity ID
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
        } else {
          results.push({ index: i, status: 'success' });
        }
      } catch {
        results.push({ index: i, status: 'error', message: 'Network error' });
      }
    }

    setUploadResults(results);
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
                Uploading...
              </>
            ) : (
              'Upload All'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
