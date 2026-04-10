'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useOnboardingStore } from '@/store/onboarding-store';
import type { Individual } from '@/types/individual';

export function AddUboForm() {
  const { addManualUbo, australianOwnership, selectedBusiness } = useOnboardingStore();
  const [isOpen, setIsOpen] = useState(false);
  const [givenName, setGivenName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('AU');
  const [shareholding, setShareholding] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setGivenName('');
    setMiddleName('');
    setFamilyName('');
    setDateOfBirth('');
    setStreetAddress('');
    setCity('');
    setState('');
    setPostalCode('');
    setCountry('AU');
    setShareholding('');
    setError(null);
  }

  async function handleSave() {
    if (!givenName.trim() || !familyName.trim()) return;

    const hasAddress = streetAddress || city || state || postalCode;
    const address = hasAddress
      ? {
          streetAddress: streetAddress || undefined,
          city: city || undefined,
          state: state || undefined,
          postalCode: postalCode || undefined,
          country: country || undefined,
        }
      : undefined;

    const organisationEntityId =
      australianOwnership?.entityId || selectedBusiness?.companyId;

    setIsSaving(true);
    setError(null);

    let kycEntityId: string | undefined;

    if (organisationEntityId) {
      try {
        const res = await fetch('/api/entity/add-ubo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organisationEntityId,
            givenName: givenName.trim(),
            middleName: middleName.trim() || undefined,
            familyName: familyName.trim(),
            dateOfBirth: dateOfBirth || undefined,
            address,
            shareholdingPercentage: shareholding || undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || 'Failed to add UBO');
          setIsSaving(false);
          return;
        }

        const data = await res.json();
        kycEntityId = data.entityId;
        if (data.linkingError) {
          console.warn('Individual created but linking failed:', data.linkingError);
        }
      } catch {
        setError('Network error. Please try again.');
        setIsSaving(false);
        return;
      }
    }

    const individual: Individual = {
      id: uuidv4(),
      givenName: givenName.trim(),
      middleName: middleName.trim() || undefined,
      familyName: familyName.trim(),
      dateOfBirth: dateOfBirth || undefined,
      address,
      roles: ['ubo'],
      shareholdingPercentage: shareholding || undefined,
      kycStatus: 'pending',
      kycEntityId,
      source: 'manual',
    };

    addManualUbo(individual);
    resetForm();
    setIsSaving(false);
    setIsOpen(false);
  }

  function handleCancel() {
    resetForm();
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        + Add Additional UBO
      </Button>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <h4 className="font-semibold text-wise-navy text-sm mb-3">Add Ultimate Beneficial Owner</h4>
      {error && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            id="ubo-given"
            label="Given Name *"
            value={givenName}
            onChange={(e) => setGivenName(e.target.value)}
            placeholder="First name"
          />
          <Input
            id="ubo-middle"
            label="Middle Name"
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            placeholder="Middle name"
          />
          <Input
            id="ubo-family"
            label="Family Name *"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            placeholder="Last name"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="ubo-dob"
            label="Date of Birth"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
          />
          <Input
            id="ubo-shareholding"
            label="Shareholding %"
            type="number"
            min="0"
            max="100"
            value={shareholding}
            onChange={(e) => setShareholding(e.target.value)}
            placeholder="e.g. 25"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="ubo-street"
            label="Street Address"
            value={streetAddress}
            onChange={(e) => setStreetAddress(e.target.value)}
            placeholder="123 Main St"
          />
          <Input
            id="ubo-city"
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            id="ubo-state"
            label="State"
            value={state}
            onChange={(e) => setState(e.target.value)}
          />
          <Input
            id="ubo-postal"
            label="Postal Code"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
          />
          <Input
            id="ubo-country"
            label="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" onClick={handleSave} disabled={!givenName.trim() || !familyName.trim() || isSaving}>
            {isSaving ? 'Saving…' : 'Save UBO'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}
