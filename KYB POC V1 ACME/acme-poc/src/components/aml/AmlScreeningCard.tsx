'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { AmlMatchRow } from './AmlMatchRow';
import type { AmlScreeningResult } from '@/types/aml';

interface AmlScreeningCardProps {
  entityName: string;
  entityType: 'business' | 'individual';
  result: AmlScreeningResult | null;
  isScreening: boolean;
  onScreen: () => Promise<void>;
}

const RESULT_CONFIG = {
  CLEAR: { variant: 'success' as const, label: 'Clear', bg: 'bg-green-50' },
  HIT: { variant: 'error' as const, label: 'Hits Found', bg: 'bg-red-50' },
  ERROR: { variant: 'error' as const, label: 'Error', bg: 'bg-red-50' },
};

export function AmlScreeningCard({
  entityName,
  entityType,
  result,
  isScreening,
  onScreen,
}: AmlScreeningCardProps) {
  const [showMatches, setShowMatches] = useState(true);

  const config = result ? RESULT_CONFIG[result.overallResult] : null;

  return (
    <Card className={config?.bg || ''}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-wise-navy text-sm">{entityName}</h4>
            <Badge variant={entityType === 'business' ? 'info' : 'default'}>
              {entityType === 'business' ? 'Organisation' : 'Individual'}
            </Badge>
            {result && config && (
              <Badge variant={config.variant}>{config.label}</Badge>
            )}
          </div>

          {result && (
            <p className="text-xs text-wise-gray-500 mt-1">
              Screened at {new Date(result.screenedAt).toLocaleString()}
              {result.matches.length > 0 && ` - ${result.matches.length} match(es)`}
            </p>
          )}
        </div>

        {!result && (
          <Button
            size="sm"
            onClick={onScreen}
            disabled={isScreening}
          >
            {isScreening ? (
              <span className="flex items-center gap-1.5">
                <Spinner size="sm" /> Screening...
              </span>
            ) : (
              'Run AML Screen'
            )}
          </Button>
        )}
      </div>

      {/* Match results */}
      {result && result.matches.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowMatches(!showMatches)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {showMatches ? 'Hide' : 'Show'} {result.matches.length} match(es)
          </button>

          {showMatches && (
            <div className="mt-2 space-y-2">
              {result.matches.map((match) => (
                <AmlMatchRow
                  key={match.matchId}
                  match={match}
                  entityId={result.entityId}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {result && result.overallResult === 'CLEAR' && (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-700">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          No AML matches found
        </div>
      )}
    </Card>
  );
}
