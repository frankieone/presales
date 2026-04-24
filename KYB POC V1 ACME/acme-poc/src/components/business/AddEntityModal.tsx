'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

interface AddEntityModalProps {
  parentEntityId: string;
  parentName: string;
  rootEntityId?: string;
  onClose: () => void;
  onAdded: (entity: {
    entityId: string;
    entityType: 'INDIVIDUAL' | 'ORGANIZATION';
    name: string;
    role: string;
  }) => void;
}

const ROLE_OPTIONS = [
  { value: '', label: 'Select a role...' },
  { value: 'DR', label: 'Director' },
  { value: 'SR', label: 'Secretary' },
  { value: 'SH', label: 'Shareholder' },
  { value: 'UBO', label: 'Ultimate Beneficial Owner' },
  { value: 'TR', label: 'Trustee' },
  { value: 'BN', label: 'Beneficiary' },
  { value: 'AR', label: 'Alternate Director' },
];

export function AddEntityModal({ parentEntityId, parentName, rootEntityId, onClose, onAdded }: AddEntityModalProps) {
  const [entityType, setEntityType] = useState<'INDIVIDUAL' | 'ORGANIZATION'>('INDIVIDUAL');
  const [roleCode, setRoleCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Individual fields
  const [givenName, setGivenName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  // Organization fields
  const [orgName, setOrgName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');

  const canSubmit = roleCode && (
    entityType === 'INDIVIDUAL' ? (givenName && familyName) : orgName
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError('');

    try {
      const payload: Record<string, unknown> = {
        parentEntityId,
        rootEntityId,
        entityType,
        role: {
          code: roleCode,
          description: ROLE_OPTIONS.find(r => r.value === roleCode)?.label || roleCode,
        },
      };

      if (entityType === 'INDIVIDUAL') {
        payload.individual = {
          givenName,
          middleName: middleName || undefined,
          familyName,
          dateOfBirth: dateOfBirth || undefined,
        };
      } else {
        payload.organization = {
          name: orgName,
          registrationNumber: registrationNumber || undefined,
          registrationNumberType: 'ACN',
          country: 'AUS',
        };
      }

      const res = await fetch('/api/business/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to add entity');
        return;
      }

      onAdded({
        entityId: data.entityId,
        entityType,
        name: data.name,
        role: roleCode,
      });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-wise-gray-200">
          <h3 className="font-bold text-wise-navy text-lg">Add Entity</h3>
          <p className="text-xs text-wise-gray-500 mt-0.5">
            Adding to <span className="font-medium">{parentName}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Entity Type Toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEntityType('INDIVIDUAL')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                entityType === 'INDIVIDUAL'
                  ? 'bg-wise-navy text-white border-wise-navy'
                  : 'bg-white text-wise-gray-500 border-wise-gray-200 hover:bg-wise-gray-50'
              }`}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => setEntityType('ORGANIZATION')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                entityType === 'ORGANIZATION'
                  ? 'bg-wise-navy text-white border-wise-navy'
                  : 'bg-white text-wise-gray-500 border-wise-gray-200 hover:bg-wise-gray-50'
              }`}
            >
              Organisation
            </button>
          </div>

          {/* Role */}
          <Select
            id="role"
            label="Role"
            value={roleCode}
            onChange={(e) => setRoleCode(e.target.value)}
            options={ROLE_OPTIONS}
          />

          {entityType === 'INDIVIDUAL' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="givenName"
                  label="Given Name *"
                  value={givenName}
                  onChange={(e) => setGivenName(e.target.value)}
                  placeholder="e.g. Jane"
                />
                <Input
                  id="familyName"
                  label="Family Name *"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="e.g. Smith"
                />
              </div>
              <Input
                id="middleName"
                label="Middle Name"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="Optional"
              />
              <Input
                id="dob"
                label="Date of Birth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </>
          ) : (
            <>
              <Input
                id="orgName"
                label="Organisation Name *"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Holdings Pty Ltd"
              />
              <Input
                id="regNumber"
                label="ACN / Registration Number"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="Optional"
              />
            </>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={!canSubmit || loading}>
              {loading ? 'Adding...' : 'Add Entity'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
