'use client';

import { create } from 'zustand';
import type { BusinessSearchResult, BusinessProfile, AustralianOwnershipResponse, BlockingEntity, TrustAnalysisResult } from '@/types/business';
import type { Individual } from '@/types/individual';
import type { KycResult } from '@/types/kyc';

interface BusinessQuestionnaire {
  employeeCount?: string;
  referralSource?: string;
  businessPurpose?: string;
  expectedVolume?: string;
}

interface OnboardingState {
  // Step 1: Search
  searchCountry: string;
  searchQuery: string;
  searchResults: BusinessSearchResult[];
  isSearching: boolean;
  searchError: string | null;
  businessQuestionnaire: BusinessQuestionnaire;

  // Step 2: Selected business
  selectedBusiness: BusinessSearchResult | null;

  // Step 3: Profile + Individuals
  businessProfile: BusinessProfile | null;
  australianOwnership: AustralianOwnershipResponse | null;
  individuals: Individual[];
  isLoadingProfile: boolean;
  profileError: string | null;

  // Blocking entities
  blockingEntities: BlockingEntity[];
  trustDocuments: Record<string, { file: File; name: string }>;
  blockingEntitiesAcknowledged: boolean;

  // Trust analysis
  trustAnalysisResults: Record<string, TrustAnalysisResult>;
  trustLinkedOrgId: string | null; // which org node the trust is associated with on the tree

  // Supporting documents
  supportingDocuments: Array<{ file: File; name: string; docType: string; country?: string }>;

  // Step 4-5: KYC
  kycResults: Map<string, KycResult>;
  isSubmittingKyc: boolean;
  kycError: string | null;

  // Actions
  setSearchCountry: (country: string) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: BusinessSearchResult[]) => void;
  setIsSearching: (searching: boolean) => void;
  setSearchError: (error: string | null) => void;
  setSelectedBusiness: (business: BusinessSearchResult | null) => void;
  setBusinessProfile: (profile: BusinessProfile | null) => void;
  setAustralianOwnership: (ownership: AustralianOwnershipResponse | null) => void;
  setBlockingEntities: (entities: BlockingEntity[]) => void;
  setTrustDocument: (entityId: string, file: File) => void;
  setBlockingEntitiesAcknowledged: (acknowledged: boolean) => void;
  addSupportingDocument: (file: File, docType: string, country?: string) => void;
  removeSupportingDocument: (index: number) => void;
  setIndividuals: (individuals: Individual[]) => void;
  addManualUbo: (individual: Individual) => void;
  removeManualUbo: (id: string) => void;
  updateIndividual: (id: string, updates: Partial<Individual>) => void;
  setIsLoadingProfile: (loading: boolean) => void;
  setProfileError: (error: string | null) => void;
  addKycResult: (individualId: string, result: KycResult) => void;
  setIsSubmittingKyc: (submitting: boolean) => void;
  setKycError: (error: string | null) => void;
  setTrustAnalysisResult: (entityId: string, result: TrustAnalysisResult) => void;
  setTrustLinkedOrgId: (orgId: string | null) => void;
  setBusinessQuestionnaire: (answers: Partial<BusinessQuestionnaire>) => void;
  reset: () => void;
}

const initialState = {
  searchCountry: 'AU',
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  searchError: null,
  businessQuestionnaire: {},
  selectedBusiness: null,
  businessProfile: null,
  australianOwnership: null,
  blockingEntities: [],
  trustDocuments: {} as Record<string, { file: File; name: string }>,
  trustAnalysisResults: {} as Record<string, TrustAnalysisResult>,
  trustLinkedOrgId: null as string | null,
  blockingEntitiesAcknowledged: false,
  supportingDocuments: [] as Array<{ file: File; name: string; docType: string; country?: string }>,
  individuals: [],
  isLoadingProfile: false,
  profileError: null,
  kycResults: new Map<string, KycResult>(),
  isSubmittingKyc: false,
  kycError: null,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,

  setSearchCountry: (country) => set({ searchCountry: country }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  setIsSearching: (searching) => set({ isSearching: searching }),
  setSearchError: (error) => set({ searchError: error }),
  setSelectedBusiness: (business) => set({ selectedBusiness: business }),
  setBusinessProfile: (profile) => set({ businessProfile: profile }),
  setAustralianOwnership: (ownership) => set({ australianOwnership: ownership }),
  setBlockingEntities: (entities) => set({ blockingEntities: entities, blockingEntitiesAcknowledged: false }),
  setTrustDocument: (entityId, file) =>
    set((state) => ({
      trustDocuments: { ...state.trustDocuments, [entityId]: { file, name: file.name } },
    })),
  setBlockingEntitiesAcknowledged: (acknowledged) => set({ blockingEntitiesAcknowledged: acknowledged }),
  addSupportingDocument: (file, docType, country) =>
    set((state) => ({
      supportingDocuments: [...state.supportingDocuments, { file, name: file.name, docType, country }],
    })),
  removeSupportingDocument: (index) =>
    set((state) => ({
      supportingDocuments: state.supportingDocuments.filter((_, i) => i !== index),
    })),
  setIndividuals: (individuals) => set({ individuals, kycResults: new Map(), kycError: null }),
  addManualUbo: (individual) =>
    set((state) => ({
      individuals: [...state.individuals, individual],
    })),
  removeManualUbo: (id) =>
    set((state) => ({
      individuals: state.individuals.filter((ind) => ind.id !== id),
    })),
  updateIndividual: (id, updates) =>
    set((state) => ({
      individuals: state.individuals.map((ind) =>
        ind.id === id ? { ...ind, ...updates } : ind
      ),
    })),
  setIsLoadingProfile: (loading) => set({ isLoadingProfile: loading }),
  setProfileError: (error) => set({ profileError: error }),
  addKycResult: (individualId, result) =>
    set((state) => {
      const newResults = new Map(state.kycResults);
      newResults.set(individualId, result);
      return { kycResults: newResults };
    }),
  setIsSubmittingKyc: (submitting) => set({ isSubmittingKyc: submitting }),
  setKycError: (error) => set({ kycError: error }),
  setTrustAnalysisResult: (entityId, result) =>
    set((state) => ({
      trustAnalysisResults: { ...state.trustAnalysisResults, [entityId]: result },
    })),
  setTrustLinkedOrgId: (orgId) => set({ trustLinkedOrgId: orgId }),
  setBusinessQuestionnaire: (answers) =>
    set((state) => ({
      businessQuestionnaire: { ...state.businessQuestionnaire, ...answers },
    })),
  reset: () => set(initialState),
}));
