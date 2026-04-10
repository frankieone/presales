'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';

interface CsvEntity {
  entityId: string;
  entityType: string;
  name: string;
}

function parseCsv(text: string): CsvEntity[] {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Parse header to find column indices
  const header = lines[0];
  const headerCols = parseRow(header);
  const idIdx = headerCols.findIndex((h) => h === 'Entity ID' || h === 'entityId');
  const typeIdx = headerCols.findIndex((h) => h === 'Entity Type' || h === 'entityType');
  const nameIdx = headerCols.findIndex((h) => h === 'Organisation Name' || h === 'entityName');

  if (idIdx === -1) return [];

  const entities: CsvEntity[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseRow(lines[i]);
    const entityId = cols[idIdx]?.trim();
    if (!entityId) continue;
    entities.push({
      entityId,
      entityType: cols[typeIdx]?.trim() || '',
      name: cols[nameIdx]?.trim() || entityId.substring(0, 8) + '...',
    });
  }
  return entities;
}

function parseRow(row: string): string[] {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cols.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

export default function CleanupPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [entities, setEntities] = useState<CsvEntity[]>([]);
  const [fileName, setFileName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{ succeeded: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        setError('No entities found in CSV. Make sure it has an "Entity ID" column.');
        return;
      }
      setEntities(parsed);
    };
    reader.readAsText(file);
  }

  async function handleDeleteAll() {
    if (entities.length === 0) return;
    setIsDeleting(true);
    setResult(null);
    setError(null);

    const batchSize = 5;
    let succeeded = 0;
    let failed = 0;
    const total = entities.length;
    setProgress({ done: 0, total });

    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);
      try {
        const res = await fetch('/api/entities/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityIds: batch.map((e) => e.entityId) }),
        });
        const data = await res.json();
        succeeded += data.succeeded || 0;
        failed += data.failed || 0;
      } catch {
        failed += batch.length;
      }
      setProgress({ done: Math.min(i + batchSize, total), total });
    }

    setResult({ succeeded, failed });
    setIsDeleting(false);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-wise-navy">Clean Up Entities</h1>
        <p className="text-sm text-wise-gray-500 mt-1">
          Upload a CSV export to delete all entities from the account.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-wise-gray-200 shadow-sm p-6 space-y-4">
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={isDeleting}
          >
            Choose CSV file
          </Button>
          {fileName && (
            <span className="ml-3 text-sm text-wise-gray-500">{fileName}</span>
          )}
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        {entities.length > 0 && !result && (
          <>
            <div className="border border-wise-gray-200 rounded-lg max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-wise-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-wise-gray-600">Entity ID</th>
                    <th className="text-left px-3 py-2 font-medium text-wise-gray-600">Type</th>
                    <th className="text-left px-3 py-2 font-medium text-wise-gray-600">Name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wise-gray-100">
                  {entities.map((e) => (
                    <tr key={e.entityId}>
                      <td className="px-3 py-1.5 text-wise-gray-500 font-mono text-xs">{e.entityId}</td>
                      <td className="px-3 py-1.5 text-wise-gray-700">{e.entityType}</td>
                      <td className="px-3 py-1.5 text-wise-gray-700">{e.name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteAll}
                disabled={isDeleting}
                className="!border-red-300 !text-red-600 hover:!bg-red-50 hover:!text-red-700"
              >
                {isDeleting ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" />
                    Deleting {progress.done}/{progress.total}...
                  </span>
                ) : (
                  `Delete all ${entities.length} entities`
                )}
              </Button>
            </div>
          </>
        )}

        {result && (
          <Alert variant={result.failed === 0 ? 'success' : 'warning'}>
            Deleted {result.succeeded} of {result.succeeded + result.failed} entities.
            {result.failed > 0 && ` ${result.failed} failed.`}
          </Alert>
        )}
      </div>

      <div className="mt-6">
        <Button variant="ghost" onClick={() => router.push('/onboarding')}>
          &larr; Back to Search
        </Button>
      </div>
    </div>
  );
}
