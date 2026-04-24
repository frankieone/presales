'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Combobox } from '@/components/ui/Combobox';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { COUNTRIES, isAustralia } from '@/lib/countries';
import { useOnboardingStore } from '@/store/onboarding-store';
import { extractAustralianIndividuals } from '@/lib/transformers';
import { OnboardingQuestionnaire } from './OnboardingQuestionnaire';

export function BusinessSearchForm() {
  const router = useRouter();
  const {
    searchCountry,
    searchQuery,
    isSearching,
    searchError,
    setSearchCountry,
    setSearchQuery,
    setSearchResults,
    setIsSearching,
    setSearchError,
    setSelectedBusiness,
    setAustralianOwnership,
    setBlockingEntities,
    setIndividuals,
  } = useOnboardingStore();

  const [searchNumber, setSearchNumber] = useState('');
  const [isOwnershipSearch, setIsOwnershipSearch] = useState(false);

  const countryOptions = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));
  const isAU = isAustralia(searchCountry);

  const TEST_COMPANIES = [
    { name: 'FOX PTY. LTD.', abn: '37052121347', notes: '2 UBOs pass KYC' },
    { name: '164 GLEBE POINT ROAD PTY LTD', abn: '155228890', notes: 'org 155228890' },
    { name: 'BOOTH CORPORATION PTY LTD', abn: '89060748156', notes: 'UBO is sanctioned' },
    { name: 'ULTRA TUNE AUSTRALIA PTY. LTD.', abn: '52065214708', notes: '1 UBO + 3 directors' },
    { name: 'ALPHABET TECHNOLOGIES PTY LTD', abn: '37615828816', notes: '3+ directors' },
    { name: 'THE FALCON COMPANY PTY. LTD.', abn: '54154382331', notes: '5 directors, blocking test' },
  ];

  async function handleAustralianSearch(input: string): Promise<boolean> {
    const digitsOnly = input.replace(/\s/g, '');
    const isNumeric = /^\d+$/.test(digitsOnly);

    // Name search → use the search endpoint (ASIC lookup), show results list
    if (!isNumeric) {
      const res = await fetch('/api/business/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: 'AU',
          organisationName: input,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error || 'Search failed');
        return false;
      }

      setSearchResults(data.results || []);
      setIsSearching(false);
      router.push('/onboarding/results');
      return true;
    }

    // Numeric input → ownership query with ABN/ACN
    const body: Record<string, string> = {};
    if (digitsOnly.length >= 11) {
      body.abn = digitsOnly;
    } else {
      body.acn = digitsOnly;
    }

    const res = await fetch('/api/business/ownership', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (res.status === 202) {
      setSearchError(
        'The ownership query is being processed asynchronously. This can take up to a minute. Please try again shortly.'
      );
      return false;
    }

    if (!res.ok) {
      setSearchError(data.error || 'Ownership query failed');
      return false;
    }

    setSelectedBusiness({
      code: data.businessDetails?.ACN || input,
      companyId: data.entityId || input,
      name: data.businessDetails?.registeredName || `Australian Business (${input})`,
    });

    setAustralianOwnership(data);
    setBlockingEntities(data.blockingEntities || []);
    const individuals = extractAustralianIndividuals(data.officeholders || [], data.ubos || []);
    setIndividuals(individuals);
    // Don't navigate here — the questionnaire handles navigation
    return true;
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setIsSearching(true);
    setSearchError(null);
    setSelectedBusiness(null);

    if (isAU) {
      const input = searchNumber.trim();
      if (!input) {
        setSearchError('Please enter a business name, ABN, or ACN');
        setIsSearching(false);
        return;
      }
      try {
        const isNumeric = /^\d+$/.test(input.replace(/\s/g, ''));
        if (isNumeric) {
          setIsOwnershipSearch(true);
        }
        const success = await handleAustralianSearch(input);
        if (!success) {
          setIsSearching(false);
          setIsOwnershipSearch(false);
        }
      } catch {
        setSearchError('Network error. Please try again.');
        setIsSearching(false);
      }
      return;
    }

    // Non-AU search
    try {
      if (!searchQuery.trim()) {
        setSearchError('Please enter a business name');
        setIsSearching(false);
        return;
      }

      const body: Record<string, string> = {
        country: searchCountry,
        organisationName: searchQuery.trim(),
      };
      if (searchNumber.trim()) {
        body.organisationNumber = searchNumber.trim();
      }

      const res = await fetch('/api/business/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setSearchError(data.error || 'Search failed');
        setIsSearching(false);
        return;
      }

      setSearchResults(data.results || []);
      router.push('/onboarding/results');
    } catch {
      setSearchError('Network error. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }

  if (isSearching && isAU && isOwnershipSearch) {
    return <OnboardingQuestionnaire />;
  }

  return (
    <form onSubmit={handleSearch} className="space-y-5">
      <Combobox
        id="country"
        label="Country"
        options={countryOptions}
        value={searchCountry}
        onChange={(val) => setSearchCountry(val)}
        placeholder="Type to search countries..."
      />

      {isAU ? (
        <Input
          id="auSearch"
          label="Business Name, ABN, or ACN"
          placeholder="e.g. FOX PTY. LTD. or 37052121347"
          value={searchNumber}
          onChange={(e) => setSearchNumber(e.target.value)}
        />
      ) : (
        <>
          <Input
            id="businessName"
            label="Business Name"
            placeholder="e.g. RESTAURANT CREPES LE PHARE LIMITED"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Input
            id="registrationNumber"
            label="Registration Number (optional)"
            placeholder="e.g. 650214"
            value={searchNumber}
            onChange={(e) => setSearchNumber(e.target.value)}
          />
        </>
      )}

      {isAU && (
        <div>
          <p className="text-xs font-medium text-wise-gray-500 mb-2">Quick Demo</p>
          <div className="flex flex-wrap gap-1.5">
            {TEST_COMPANIES.map((co) => (
              <button
                key={co.abn}
                type="button"
                title={co.notes}
                onClick={() => setSearchNumber(co.abn)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  searchNumber === co.abn
                    ? 'bg-wise-green/20 border-wise-green text-wise-navy font-medium'
                    : 'bg-white border-wise-gray-200 text-wise-gray-600 hover:border-wise-green hover:bg-wise-green/10'
                }`}
              >
                {co.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {searchError && (
        <Alert variant="error">{searchError}</Alert>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isSearching}>
        {isSearching ? (
          <span className="flex items-center gap-2">
            <Spinner size="sm" /> Searching...
          </span>
        ) : (
          'Search Business Registry'
        )}
      </Button>
    </form>
  );
}
