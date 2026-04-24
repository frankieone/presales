import { NextRequest, NextResponse } from 'next/server';
import { getBusinessProfile } from '@/lib/frankieone';
import { getFrankieCountryCode } from '@/lib/countries';
import type { BusinessProfile, DirectorDTO, ShareholderDTO, PSCDetail, OfficerDTO, BusinessAddress } from '@/types/business';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { country, companyCode, registrationAuthorityCode } = body;

    if (!country || !companyCode) {
      return NextResponse.json({ error: 'Country and company code are required' }, { status: 400 });
    }

    const frankieCountry = getFrankieCountryCode(country);
    const { data, status } = await getBusinessProfile(frankieCountry, companyCode, registrationAuthorityCode);

    if (status !== 200) {
      return NextResponse.json(
        { error: data?.errorMsg || 'Profile retrieval failed' },
        { status }
      );
    }

    const profile = data?.CompanyProfile;
    if (!profile) {
      return NextResponse.json({ error: 'No profile data returned' }, { status: 404 });
    }

    const details = profile.directorAndShareDetails || {};

    const directors: DirectorDTO[] = (details.directors?.Director || []).map((d: Record<string, string>) => ({
      name: d.name || '',
      address1: d.address1,
      address2: d.address2,
      address3: d.address3,
      address4: d.address4,
      address5: d.address5,
      address6: d.address6,
      postcode: d.postcode,
      birthdate: d.birthdate,
      nationality: d.nationality,
      title: d.title,
      directorNumber: d.directorNumber,
    }));

    const shareholders: ShareholderDTO[] = (details.shareHolders?.ShareholderDetails || []).map(
      (s: Record<string, unknown>) => ({
        name: s.name as string || '',
        address: s.address as string,
        nationality: s.nationality as string,
        percentage: s.percentage as string,
        shareCount: s.shareCount as number,
        shareType: s.shareType as string,
        shareholderType: s.shareholderType as string,
        totalShares: s.totalShares as number,
      })
    );

    const pscs: PSCDetail[] = (details.PersonsOfSignificantControl?.PSCDetails || []).map(
      (p: Record<string, unknown>) => ({
        Name: p.Name as string || '',
        Address: p.Address as string,
        CountryOfResidence: p.CountryOfResidence as string,
        DOBDay: p.DOBDay as number,
        DOBMonth: p.DOBMonth as number,
        DOBYear: p.DOBYear as number,
        Nationality: p.Nationality as string,
        NatureOfControlList: (p.NatureOfControlList as string[]) || [],
        NotifiedOn: p.NotifiedOn as string,
        CeasedOn: p.CeasedOn as string,
        Kind: p.Kind as string,
      })
    );

    const officers: OfficerDTO[] = (details.officers?.USOfficerDTO || []).map(
      (o: Record<string, unknown>) => ({
        Name: o.Name as string || '',
        Address: o.Address as string,
        Title: o.Title as string,
        Type: o.Type as string,
        Date: o.Date as string,
      })
    );

    const addresses = profile.Addresses?.Addresses || [];
    const primaryAddress = addresses[0] || {};

    const address: BusinessAddress = {
      addressInOneLine: primaryAddress.AddressInOneLine || primaryAddress.ConcatenatedAddress,
      addressLine1: primaryAddress.AddressLine1,
      cityTown: primaryAddress.CityTown,
      postcode: primaryAddress.Postcode,
      regionState: primaryAddress.RegionState,
      country: primaryAddress.Country,
    };

    const result: BusinessProfile = {
      name: profile.Name || '',
      code: profile.Code || '',
      registrationNumber: profile.RegistrationNumber,
      legalForm: profile.LegalForm || profile.NormalisedLegalForm,
      legalStatus: profile.LegalStatus || profile.NormalisedLegalStatus,
      registrationDate: profile.RegistrationDate || profile.NormalisedRegistrationDate,
      address,
      directors,
      shareholders,
      pscs,
      officers,
      entityId: data?.entityId,
    };

    return NextResponse.json({ profile: result, requestId: data?.requestId });
  } catch (error) {
    console.error('Business profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
