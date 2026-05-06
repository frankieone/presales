'use client';

import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/Badge';
import type { AmlMatch, AmlClassification } from '@/types/aml';

interface AmlMatchRowProps {
  match: AmlMatch;
  entityId: string;
  onClassify: (matchId: string, processResultId: string | undefined, classification: AmlClassification) => Promise<void>;
}

const TYPE_CONFIG = {
  PEP: { variant: 'warning' as const, label: 'PEP' },
  SANCTIONS: { variant: 'error' as const, label: 'Sanctions' },
  MEDIA: { variant: 'info' as const, label: 'Media' },
  UNKNOWN: { variant: 'default' as const, label: 'Unknown' },
};

const CLASSIFICATION_OPTIONS: { value: AmlClassification; label: string }[] = [
  { value: 'FALSE_POSITIVE', label: 'False Positive' },
  { value: 'TRUE_POSITIVE_REJECT', label: 'True Positive - Reject' },
  { value: 'TRUE_POSITIVE_ACCEPT', label: 'True Positive - Accept' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

export function AmlMatchRow({ match, entityId, onClassify }: AmlMatchRowProps) {
  const [isClassifying, setIsClassifying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const typeConfig = TYPE_CONFIG[match.matchType] || TYPE_CONFIG.UNKNOWN;

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  async function handleClassify(classification: AmlClassification) {
    setIsClassifying(true);
    try {
      await onClassify(match.matchId, match.processResultId, classification);
    } finally {
      setIsClassifying(false);
    }
  }

  // Score is already a percentage (e.g. 96.5) from the API
  const scorePercent = Math.round(match.matchScore);

  return (
    <div className="border border-wise-gray-200 rounded-lg p-3 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Search details */}
          {match.searchName && (
            <div className="mb-2 pb-2 border-b border-wise-gray-100">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-wise-gray-400 mb-1">Search Details</p>
              <p className="text-xs text-wise-gray-600">
                <span className="font-medium">Name:</span> {match.searchName}
              </p>
              {match.searchCountries && match.searchCountries.length > 0 && (
                <p className="text-xs text-wise-gray-600">
                  <span className="font-medium">Countries:</span> {match.searchCountries.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Returned match details */}
          <p className="text-[10px] uppercase tracking-wider font-semibold text-wise-gray-400 mb-1">Returned Details</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-wise-navy truncate">{match.matchedName}</span>
            <Badge variant={typeConfig.variant}>{typeConfig.label}</Badge>
            {match.currentState && (
              <Badge variant={match.currentState === 'ACTIVE_HITS' ? 'error' : 'default'}>
                {match.currentState === 'ACTIVE_HITS' ? 'Possible Match' : match.currentState.replace(/_/g, ' ')}
              </Badge>
            )}
            {match.classification && (
              <Badge
                variant={
                  match.classification === 'FALSE_POSITIVE' ? 'success' :
                  match.classification.includes('REJECT') ? 'error' :
                  match.classification.includes('ACCEPT') ? 'warning' : 'default'
                }
              >
                {match.classification.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>

          {match.countries && match.countries.length > 0 && (
            <p className="text-xs text-wise-gray-500 mt-1">
              <span className="font-medium">Countries:</span> {match.countries.join(', ')}
            </p>
          )}

          {match.matchScore > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-medium text-wise-gray-500">Match Strength:</span>
              <div className="flex-1 max-w-[200px] h-2 bg-wise-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    scorePercent >= 80 ? 'bg-red-500' :
                    scorePercent >= 50 ? 'bg-amber-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(scorePercent, 100)}%` }}
                />
              </div>
              <span className="text-xs text-wise-gray-500">{scorePercent}%</span>
            </div>
          )}

          {(match.source || match.listName) && (
            <p className="text-xs text-wise-gray-500 mt-1">
              <span className="font-medium">Source:</span> {match.listName || match.source}
            </p>
          )}

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:text-blue-800 mt-2"
          >
            {expanded ? 'Hide details' : 'Show details'}
          </button>

          {expanded && (
            <div className="mt-2 space-y-1.5 text-xs text-wise-gray-600 bg-wise-gray-50 rounded-lg p-3">
              {match.addresses && match.addresses.length > 0 && (
                <div>
                  <span className="font-medium">Addresses:</span>
                  <ul className="ml-3 mt-0.5 list-disc">
                    {match.addresses.map((addr, i) => (
                      <li key={i}>{addr}</li>
                    ))}
                  </ul>
                </div>
              )}
              {match.details && (
                <div>
                  <span className="font-medium">Details:</span> {match.details}
                </div>
              )}
              {match.pepDetails && match.pepDetails.length > 0 && (
                <div>
                  <span className="font-medium">Listing Details:</span>
                  {match.pepDetails.map((pep, i) => (
                    <div key={i} className="ml-3 mt-0.5">
                      {pep.sourceName && <p><span className="font-medium">Source:</span> {pep.sourceName}</p>}
                      {pep.amlTypes && <p><span className="font-medium">AML Types:</span> {pep.amlTypes}</p>}
                      {pep.listingStarted && <p><span className="font-medium">Listed Since:</span> {new Date(pep.listingStarted).toLocaleDateString()}</p>}
                      {pep.countryCodes && <p><span className="font-medium">Country Codes:</span> {pep.countryCodes.split(',').filter(Boolean).join(', ')}</p>}
                    </div>
                  ))}
                </div>
              )}
              {match.positions && match.positions.length > 0 && (
                <div>
                  <span className="font-medium">Positions:</span>{' '}
                  {match.positions.join(', ')}
                </div>
              )}
              {match.aliases && match.aliases.length > 0 && (
                <div>
                  <span className="font-medium">Aliases:</span>{' '}
                  {match.aliases.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Classification dropdown — top right */}
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            type="button"
            disabled={isClassifying}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
          >
            {isClassifying ? 'Updating...' : 'Change Match Status'}
            <svg className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 mt-1 z-10 bg-white border border-wise-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]">
              {CLASSIFICATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    handleClassify(opt.value);
                  }}
                  className="w-full text-left text-xs px-3 py-2 hover:bg-wise-gray-50 text-wise-gray-700 transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
