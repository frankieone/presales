'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { Individual } from '@/types/individual';

interface IndividualEditFormProps {
  individual: Individual;
  onSave: (updates: Partial<Individual>) => Promise<void>;
  onCancel: () => void;
}

export function IndividualEditForm({ individual, onSave, onCancel }: IndividualEditFormProps) {
  const [givenName, setGivenName] = useState(individual.givenName);
  const [middleName, setMiddleName] = useState(individual.middleName || '');
  const [familyName, setFamilyName] = useState(individual.familyName);
  const [dateOfBirth, setDateOfBirth] = useState(individual.dateOfBirth || '');
  const [streetAddress, setStreetAddress] = useState(individual.address?.streetAddress || '');
  const [city, setCity] = useState(individual.address?.city || '');
  const [state, setState] = useState(individual.address?.state || '');
  const [postalCode, setPostalCode] = useState(individual.address?.postalCode || '');
  const [country, setCountry] = useState(individual.address?.country || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        givenName,
        middleName: middleName || undefined,
        familyName,
        dateOfBirth: dateOfBirth || undefined,
        address: {
          streetAddress: streetAddress || undefined,
          city: city || undefined,
          state: state || undefined,
          postalCode: postalCode || undefined,
          country: country || undefined,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="border-wise-green ring-2 ring-wise-green/20">
      <h4 className="font-semibold text-wise-navy text-sm mb-3">Edit Individual</h4>
      {error && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input
          id={`given-${individual.id}`}
          label="Given Name"
          value={givenName}
          onChange={(e) => setGivenName(e.target.value)}
        />
        <Input
          id={`middle-${individual.id}`}
          label="Middle Name"
          value={middleName}
          onChange={(e) => setMiddleName(e.target.value)}
        />
        <Input
          id={`family-${individual.id}`}
          label="Family Name"
          value={familyName}
          onChange={(e) => setFamilyName(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <Input
          id={`dob-${individual.id}`}
          label="Date of Birth (YYYY-MM-DD)"
          placeholder="1990-01-15"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
        />
      </div>

      <h5 className="font-medium text-wise-gray-600 text-xs mt-4 mb-2 uppercase tracking-wide">Address</h5>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          id={`street-${individual.id}`}
          label="Street"
          value={streetAddress}
          onChange={(e) => setStreetAddress(e.target.value)}
          className="sm:col-span-2"
        />
        <Input
          id={`city-${individual.id}`}
          label="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <Input
          id={`state-${individual.id}`}
          label="State"
          value={state}
          onChange={(e) => setState(e.target.value)}
        />
        <Input
          id={`postal-${individual.id}`}
          label="Postal Code"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
        />
        <Input
          id={`country-${individual.id}`}
          label="Country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        />
      </div>

      <div className="flex gap-2 mt-4">
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
