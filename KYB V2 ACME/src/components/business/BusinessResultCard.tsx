'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { BusinessSearchResult } from '@/types/business';

interface BusinessResultCardProps {
  business: BusinessSearchResult;
  selected?: boolean;
  onClick?: () => void;
}

export function BusinessResultCard({ business, selected = false, onClick }: BusinessResultCardProps) {
  return (
    <Card hover selected={selected} onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-wise-navy text-sm truncate">{business.name}</h3>
          {business.address && (
            <p className="text-xs text-wise-gray-500 mt-1 truncate">{business.address}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {business.code && (
              <Badge variant="info">Code: {business.code}</Badge>
            )}
            {business.legalStatus && (
              <Badge variant="default">{business.legalStatus}</Badge>
            )}
            {business.legalForm && (
              <Badge variant="default">{business.legalForm}</Badge>
            )}
          </div>
        </div>
        {selected && (
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-wise-green flex items-center justify-center">
            <svg className="w-4 h-4 text-wise-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
    </Card>
  );
}
