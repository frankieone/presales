'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { BusinessProfile } from '@/types/business';

interface BusinessProfileSummaryProps {
  profile: BusinessProfile;
}

export function BusinessProfileSummary({ profile }: BusinessProfileSummaryProps) {
  return (
    <Card>
      <h3 className="font-bold text-wise-navy text-lg mb-3">{profile.name}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {profile.registrationNumber && (
          <div>
            <span className="text-wise-gray-500">Registration:</span>{' '}
            <span className="font-medium">{profile.registrationNumber}</span>
          </div>
        )}
        {profile.legalForm && (
          <div>
            <span className="text-wise-gray-500">Legal Form:</span>{' '}
            <span className="font-medium">{profile.legalForm}</span>
          </div>
        )}
        {profile.legalStatus && (
          <div>
            <span className="text-wise-gray-500">Status:</span>{' '}
            <Badge variant={profile.legalStatus.toLowerCase().includes('active') ? 'success' : 'default'}>
              {profile.legalStatus}
            </Badge>
          </div>
        )}
        {profile.registrationDate && (
          <div>
            <span className="text-wise-gray-500">Registered:</span>{' '}
            <span className="font-medium">{profile.registrationDate}</span>
          </div>
        )}
        {profile.address?.addressInOneLine && (
          <div className="sm:col-span-2">
            <span className="text-wise-gray-500">Address:</span>{' '}
            <span className="font-medium">{profile.address.addressInOneLine}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
