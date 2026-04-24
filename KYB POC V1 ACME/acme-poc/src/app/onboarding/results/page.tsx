'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/store/onboarding-store';
import { BusinessResultCard } from '@/components/business/BusinessResultCard';
import { OnboardingQuestionnaire } from '@/components/business/OnboardingQuestionnaire';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import {
  extractDirectors,
  extractShareholders,
  extractPSCs,
  extractOfficers,
  extractAustralianIndividuals,
  deduplicateIndividuals,
} from '@/lib/transformers';
import { isAustralia } from '@/lib/countries';

export default function ResultsPage() {
  const router = useRouter();
  const {
    searchResults,
    searchCountry,
    selectedBusiness,
    individuals,
    setSelectedBusiness,
    setBusinessProfile,
    setAustralianOwnership,
    setBlockingEntities,
    setIndividuals,
    setIsSearching,
    isSearching,
    isLoadingProfile,
    setIsLoadingProfile,
    profileError,
    setProfileError,
  } = useOnboardingStore();

  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [selectedName, setSelectedName] = useState('');

  async function handleSelect(business: typeof searchResults[number]) {
    setIsLoadingProfile(true);
    setProfileError(null);

    try {
      if (isAustralia(searchCountry)) {
        // Show the questionnaire while ownership lookup runs
        // Don't set selectedBusiness yet — questionnaire uses it to detect completion
        setSelectedName(business.name);
        setShowQuestionnaire(true);
        setIsSearching(true);

        // Clean up entities from any previous ownership lookup
        const staleEntityIds = individuals
          .map((ind) => ind.ownershipEntityId || ind.kycEntityId)
          .filter((id): id is string => !!id);
        if (staleEntityIds.length > 0) {
          await fetch('/api/entities/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entityIds: staleEntityIds }),
          }).catch(() => {}); // best-effort cleanup
        }

        // Determine if code is ABN (11+ digits) or ACN (9 digits)
        const digits = (business.code || '').replace(/\s/g, '');
        const ownershipBody: Record<string, string> = {};
        if (/^\d+$/.test(digits)) {
          if (digits.length >= 11) {
            ownershipBody.abn = digits;
          } else {
            ownershipBody.acn = digits;
          }
        } else {
          ownershipBody.companyName = business.name;
        }

        const res = await fetch('/api/business/ownership', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ownershipBody),
        });

        const data = await res.json();

        if (res.status === 202) {
          setProfileError('The ownership query is being processed asynchronously. Please try again in a moment.');
          setIsLoadingProfile(false);
          setIsSearching(false);
          return;
        }

        if (!res.ok) {
          setProfileError(data.error || 'Failed to retrieve ownership details');
          setIsLoadingProfile(false);
          setIsSearching(false);
          return;
        }

        setAustralianOwnership(data);
        setBlockingEntities(data.blockingEntities || []);
        const extractedIndividuals = extractAustralianIndividuals(data.officeholders || [], data.ubos || []);
        setIndividuals(extractedIndividuals);
        // Now mark selected — questionnaire sees this as "results ready"
        setSelectedBusiness(business);
        setIsLoadingProfile(false);
        return;
      } else {
        setSelectedBusiness(business);
        const res = await fetch('/api/business/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country: searchCountry,
            companyCode: business.code,
            registrationAuthorityCode: business.registrationAuthorityCode,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setProfileError(data.error || 'Failed to retrieve business profile');
          setIsLoadingProfile(false);
          return;
        }

        const profile = data.profile;
        setBusinessProfile(profile);

        const directors = extractDirectors(profile.directors || []);
        const shareholders = extractShareholders(profile.shareholders || []);
        const pscs = extractPSCs(profile.pscs || []);
        const officers = extractOfficers(profile.officers || []);

        const allIndividuals = [...directors, ...shareholders, ...pscs, ...officers];
        const deduplicated = deduplicateIndividuals(allIndividuals);
        setIndividuals(deduplicated);
      }

      router.push('/onboarding/review');
    } catch {
      setProfileError('Network error. Please try again.');
    } finally {
      setIsLoadingProfile(false);
    }
  }

  if (showQuestionnaire) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-wise-navy">Setting up your account</h1>
          <p className="text-sm text-wise-gray-500 mt-1">
            A few quick questions while we look up {selectedName || 'your business'}.
          </p>
        </div>
        <OnboardingQuestionnaire />
      </div>
    );
  }

  if (searchResults.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-wise-navy mb-2">Search Results</h1>
        <Alert variant="warning">
          No businesses found. Please go back and try a different search.
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/onboarding')}>
          Back to Search
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-wise-navy">Select a Business</h1>
        <p className="text-sm text-wise-gray-500 mt-1">
          {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found.
          Select the correct business to continue.
        </p>
      </div>

      {profileError && (
        <Alert variant="error" className="mb-4">{profileError}</Alert>
      )}

      {isLoadingProfile && (
        <div className="flex items-center justify-center gap-3 py-8 text-wise-gray-500">
          <Spinner size="lg" />
          <span className="text-sm">Loading business profile...</span>
        </div>
      )}

      {!isLoadingProfile && (
        <div className="space-y-3">
          {searchResults.map((business, i) => (
            <BusinessResultCard
              key={`${business.code}-${i}`}
              business={business}
              selected={selectedBusiness?.code === business.code}
              onClick={() => handleSelect(business)}
            />
          ))}
        </div>
      )}

      <div className="mt-6">
        <Button variant="ghost" onClick={() => router.push('/onboarding')}>
          &larr; Back to Search
        </Button>
      </div>
    </div>
  );
}
