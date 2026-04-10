import { NextRequest, NextResponse } from 'next/server';
import { lookupOrganizations } from '@/lib/frankieone';
import { getFrankieCountryCode } from '@/lib/countries';
import type { BusinessSearchResult } from '@/types/business';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { country, organisationName, organisationNumber } = body;

    if (!country) {
      return NextResponse.json({ error: 'Country is required' }, { status: 400 });
    }

    // All countries (including Australia) now use v2 organizations/lookup
    const frankieCountry = getFrankieCountryCode(country);
    const { data, status } = await lookupOrganizations(frankieCountry, organisationName, organisationNumber);

    console.log('[v2 Lookup] Status:', status, 'Raw keys:', JSON.stringify(Object.keys(data || {})));

    if (status !== 200) {
      return NextResponse.json(
        { error: data?.errorMsg || data?.errorCode || 'Search failed' },
        { status }
      );
    }

    // v2 returns { matchedOrganizations: [...], requestId, queryDetails }
    const matchedOrgs = data?.matchedOrganizations || [];

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const results: BusinessSearchResult[] = matchedOrgs.map((org: any) => {
      // Extract name — v2 may nest under details.name or top-level
      const name =
        org.details?.name?.registeredName ||
        org.details?.name?.displayName ||
        org.name?.registeredName ||
        org.name?.displayName ||
        org.organizationName ||
        '';

      // Extract registration number
      const regNumbers = org.registrationDetails?.organizationNumbers ||
        org.organizationNumbers || [];
      const primaryReg = regNumbers[0] || {};
      const code = primaryReg.registrationNumber || org.organizationToken || '';
      const registryCode = primaryReg.registryCode || '';

      // Extract address
      const addresses = org.addresses || [];
      const primaryAddr = addresses[0] || {};
      const addressStr =
        primaryAddr.addressInOneLine ||
        primaryAddr.longForm ||
        [primaryAddr.streetAddress, primaryAddr.town, primaryAddr.state, primaryAddr.postalCode]
          .filter(Boolean).join(', ') ||
        '';

      // Extract status
      const legalStatus = org.status || org.legalStatus || org.details?.status || '';
      const legalForm = org.legalForm || org.details?.legalForm || '';

      return {
        code,
        companyId: code,
        name,
        address: addressStr,
        legalStatus,
        legalForm,
        registrationAuthorityCode: registryCode,
        source: org.source || '',
        // Carry the organizationToken for the profile step
        organizationToken: org.organizationToken,
      } as BusinessSearchResult;
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (organisationName) {
      const query = organisationName.toUpperCase();
      results.sort((a: BusinessSearchResult, b: BusinessSearchResult) => {
        const aName = a.name.toUpperCase();
        const bName = b.name.toUpperCase();
        if (aName === query && bName !== query) return -1;
        if (bName === query && aName !== query) return 1;
        const aStarts = aName.startsWith(query);
        const bStarts = bName.startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return 1;
        const aContains = aName.includes(query);
        const bContains = bName.includes(query);
        if (aContains && !bContains) return -1;
        if (bContains && !aContains) return 1;
        return aName.localeCompare(bName);
      });
    }

    return NextResponse.json({ results, requestId: data?.requestId });
  } catch (error) {
    console.error('Business search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
