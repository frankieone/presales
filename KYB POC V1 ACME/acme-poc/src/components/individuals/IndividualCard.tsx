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
  refer: { label: 'KYC Refer', variant: 'warning' as const },
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

function isPartialAddress(address: { streetAddress?: string; city?: string; state?: string; postalCode?: string }): boolean {
  return !address.streetAddress && !address.city && !!(address.state || address.postalCode);
}

function DataWarnings({ individual }: { individual: Individual }) {
  if (individual.kycStatus !== 'pending') return null;

  const name = [individual.givenName, individual.familyName].filter(Boolean).join(' ') || 'this individual';

  const missingRequired: string[] = [];
  if (!individual.givenName) missingRequired.push('first name');
  if (!individual.familyName) missingRequired.push('last name');
  if (!individual.dateOfBirth) missingRequired.push('date of birth');

  const missingOptimal: string[] = [];
  if (!individual.middleName) missingOptimal.push('middle name');
  if (!individual.address?.streetAddress) missingOptimal.push('address');

  if (missingRequired.length === 0 && missingOptimal.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {missingRequired.length > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2">
          <img src="/exclamation.png" alt="" className="w-5 h-5 shrink-0" />
          <span className="text-xs text-red-700">
            Verification will fail — missing {missingRequired.join(', ')}
          </span>
        </div>
      )}
      {missingOptimal.length > 0 && missingRequired.length === 0 && (
        <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
          <img src="/warning.png" alt="" className="w-5 h-5 shrink-0" />
          <span className="text-xs text-amber-700">
            Adding {missingOptimal.join(' and ')} for {name} could raise the likelihood of them being found during verification checks
          </span>
        </div>
      )}
    </div>
  );
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
            {!individual.dateOfBirth && !individual.yearOfBirth && individual.source !== 'manual' && (
              <p className="text-wise-gray-400 italic">DOB not available from registry — needs to be collected directly</p>
            )}
            {individual.nationality && <p>Nationality: {individual.nationality}</p>}
            {individual.address && (
              <p>
                Address: {formatFullAddress(individual.address)}
                {isPartialAddress(individual.address) && (
                  <span className="text-wise-gray-400 italic"> (postcode/state only — full address needs to be collected directly)</span>
                )}
              </p>
            )}
            {!individual.address && individual.source !== 'manual' && (
              <p className="text-wise-gray-400 italic">Address not available from registry — needs to be collected directly</p>
            )}
          </div>

          <DataWarnings individual={individual} />

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
