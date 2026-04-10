'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RoleBadge } from './RoleBadge';
import type { Individual } from '@/types/individual';

interface IndividualCardProps {
  individual: Individual;
  onEdit?: () => void;
  actionSlot?: React.ReactNode;
}

const kycStatusConfig = {
  pending: { label: 'KYC Pending', variant: 'default' as const },
  submitted: { label: 'KYC Submitted', variant: 'info' as const },
  pass: { label: 'KYC Pass', variant: 'success' as const },
  fail: { label: 'KYC Fail', variant: 'error' as const },
  refer: { label: 'Under Review', variant: 'warning' as const },
  error: { label: 'KYC Error', variant: 'error' as const },
};

function formatDob(dob: string): string {
  // Handle ISO format YYYY-MM-DD or YYYY-MM
  const parts = dob.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  if (parts.length === 2) {
    return `${parts[1]}/${parts[0]}`;
  }
  return dob;
}

function formatFullAddress(address: { streetAddress?: string; city?: string; state?: string; postalCode?: string; country?: string }): string {
  return [address.streetAddress, address.city, address.state, address.postalCode, address.country]
    .filter(Boolean)
    .join(', ');
}

export function IndividualCard({ individual, onEdit, actionSlot }: IndividualCardProps) {
  const fullName = [individual.givenName, individual.middleName, individual.familyName]
    .filter(Boolean)
    .join(' ');

  const statusConfig = kycStatusConfig[individual.kycStatus];

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-wise-navy text-sm">{fullName || 'Unknown'}</h4>
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {individual.roles.map((role) => (
              <RoleBadge key={role} role={role} />
            ))}
            {individual.shareholdingPercentage && (
              <Badge variant="default">{individual.shareholdingPercentage}% beneficial ownership</Badge>
            )}
            {individual.source === 'manual' && (
              <Badge variant="default">Manually Added</Badge>
            )}
          </div>

          <div className="mt-2 text-xs text-wise-gray-500 space-y-0.5">
            {individual.dateOfBirth && <p>DOB: {formatDob(individual.dateOfBirth)}</p>}
            {individual.yearOfBirth && !individual.dateOfBirth && <p>Year of birth: {individual.yearOfBirth}</p>}
            {individual.nationality && <p>Nationality: {individual.nationality}</p>}
            {individual.address && <p>Address: {formatFullAddress(individual.address)}</p>}
          </div>

          {individual.kycStatus === 'refer' && (
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-800">Manual review in progress</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Someone is reviewing the outcome of your checks. This should take up to 4 hours. We will automatically notify you via email of the outcome.
                  </p>
                </div>
              </div>
            </div>
          )}

          {actionSlot && (
            <div className="mt-3">
              {actionSlot}
            </div>
          )}
        </div>

        {onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Edit
          </Button>
        )}
      </div>
    </Card>
  );
}
