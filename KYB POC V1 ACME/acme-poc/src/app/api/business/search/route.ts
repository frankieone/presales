import { NextRequest, NextResponse } from 'next/server';
import { searchBusiness, searchAustralianBusiness } from '@/lib/frankieone';
import { getFrankieCountryCode, isAustralia } from '@/lib/countries';
import type { BusinessSearchResult } from '@/types/business';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { country, organisationName, organisationNumber } = body;

    if (!country) {
      return NextResponse.json({ error: 'Country is required' }, { status: 400 });
    }

    // Australian name searches use the ABR lookup via backend API
    if (isAustralia(country) && organisationName) {
      const { data, status } = await searchAustralianBusiness(organisationName);

      console.log('[ABR Search] Status:', status, 'Raw keys:', JSON.stringify(Object.keys(data || {})));
      console.log('[ABR Search] First result:', JSON.stringify(Array.isArray(data) ? data[0] : 'none'));

      if (status !== 200) {
        return NextResponse.json(
          { error: data?.errorMsg || 'Search failed' },
          { status }
        );
      }

      // ABR returns an array of businesses
      const businesses = Array.isArray(data) ? data : [];
      const results: BusinessSearchResult[] = businesses.map((b: Record<string, unknown>) => ({
        code: (b.abn as string) || (b.acn as string) || '',
        companyId: (b.abn as string) || (b.acn as string) || '',
        name: (b.name as string) || ((b.mainNames as string[])?.[0]) || '',
        address: [b.state, b.postalCode].filter(Boolean).join(' '),
        legalStatus: b.isActive ? 'Active' : 'Inactive',
        source: 'ABR',
      }));

      return NextResponse.json({ results });
    }

    // International search for non-AU countries
    const frankieCountry = getFrankieCountryCode(country);
    const { data, status } = await searchBusiness(frankieCountry, organisationName, organisationNumber);

    if (status !== 200) {
      return NextResponse.json(
        { error: data?.errorMsg || 'Search failed' },
        { status }
      );
    }

    const companies = data?.Companies?.CompanyDTO || data?.companies || [];
    const results: BusinessSearchResult[] = companies.map((c: Record<string, unknown>) => ({
      code: c.CompanyID as string || c.Code as string || '',
      companyId: c.CompanyID as string || c.Code as string || '',
      name: c.Name as string || '',
      address: (c.Addresses as { Addresses?: Array<{ AddressInOneLine?: string }> })?.Addresses?.[0]?.AddressInOneLine || '',
      legalStatus: c.LegalStatus as string || '',
      legalForm: c.LegalForm as string || '',
      registrationAuthority: c.RegistrationAuthority as string || '',
      registrationAuthorityCode: c.RegistrationAuthorityCode as string || '',
      source: c.Source as string || '',
    }));

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
