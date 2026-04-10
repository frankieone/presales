import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationProfile } from '@/lib/frankieone';
import { getFrankieCountryCode } from '@/lib/countries';
import type { BusinessProfile, DirectorDTO, ShareholderDTO, PSCDetail, OfficerDTO, BusinessAddress } from '@/types/business';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { country, companyCode, registrationAuthorityCode, organizationToken } = body;

    if (!country || (!companyCode && !organizationToken)) {
      return NextResponse.json({ error: 'Country and company code (or organizationToken) are required' }, { status: 400 });
    }

    const frankieCountry = getFrankieCountryCode(country);

    // v2: use organizationToken if available, otherwise fall back to registration number
    const { data, status } = await getOrganizationProfile({
      organizationToken,
      registrationNumber: companyCode,
      registryCode: registrationAuthorityCode,
      country: frankieCountry,
    });

    console.log('[v2 Profile] Status:', status, 'Raw keys:', JSON.stringify(Object.keys(data || {})));

    if (status !== 200) {
      return NextResponse.json(
        { error: data?.errorMsg || data?.errorCode || 'Profile retrieval failed' },
        { status }
      );
    }

    const org = data?.organization;
    if (!org) {
      return NextResponse.json({ error: 'No profile data returned' }, { status: 404 });
    }

    // ─── Extract directors from v2 organization.officials ───
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const officials: any[] = org.officials || org.details?.officials || [];
    const directors: DirectorDTO[] = officials
      .filter((o: any) => {
        const role = (o.role || o.type || '').toUpperCase();
        return role.includes('DIRECTOR') || role === 'DR';
      })
      .map((d: any) => {
        const name = d.name?.displayName ||
          [d.name?.givenName, d.name?.middleName, d.name?.familyName].filter(Boolean).join(' ') ||
          d.name || '';
        const addr = d.addresses?.[0] || {};
        return {
          name: typeof name === 'string' ? name : '',
          address1: addr.streetAddress || addr.addressLine1,
          address2: addr.town || addr.city,
          address3: addr.state,
          postcode: addr.postalCode,
          birthdate: d.dateOfBirth?.dateOfBirth || d.dateOfBirth,
          nationality: d.nationality,
        } as DirectorDTO;
      });

    // ─── Extract shareholders from v2 organization.shareholders ───
    const shareholdersList: any[] = org.shareholders || org.details?.shareholders || [];
    const shareholders: ShareholderDTO[] = shareholdersList.map((s: any) => {
      const name = s.name?.displayName ||
        [s.name?.givenName, s.name?.middleName, s.name?.familyName].filter(Boolean).join(' ') ||
        s.name || '';
      return {
        name: typeof name === 'string' ? name : '',
        address: s.addresses?.[0]?.addressInOneLine || s.addresses?.[0]?.longForm,
        nationality: s.nationality,
        percentage: s.shareholding?.percentage?.toString() || s.percentage?.toString(),
        shareCount: s.shareholding?.shareCount || s.shareCount,
        shareType: s.shareholding?.shareType || s.shareType,
        shareholderType: s.shareholderType || s.type,
        totalShares: s.shareholding?.totalShares || s.totalShares,
      } as ShareholderDTO;
    });

    // ─── Extract PSCs (persons of significant control) ───
    const pscList: any[] = org.personsOfSignificantControl || org.pscs || [];
    const pscs: PSCDetail[] = pscList.map((p: any) => {
      const name = p.name?.displayName ||
        [p.name?.givenName, p.name?.middleName, p.name?.familyName].filter(Boolean).join(' ') ||
        p.Name || p.name || '';
      const dob = p.dateOfBirth || {};
      return {
        Name: typeof name === 'string' ? name : '',
        Address: p.addresses?.[0]?.addressInOneLine || p.Address,
        CountryOfResidence: p.countryOfResidence || p.CountryOfResidence,
        DOBDay: dob.day || dob.DOBDay,
        DOBMonth: dob.month || dob.DOBMonth,
        DOBYear: dob.year || dob.DOBYear,
        Nationality: p.nationality || p.Nationality,
        NatureOfControlList: p.natureOfControl || p.NatureOfControlList || [],
        NotifiedOn: p.notifiedOn || p.NotifiedOn,
        CeasedOn: p.ceasedOn || p.CeasedOn,
        Kind: p.kind || p.Kind,
      } as PSCDetail;
    });

    // ─── Extract officers ───
    const officers: OfficerDTO[] = officials
      .filter((o: any) => {
        const role = (o.role || o.type || '').toUpperCase();
        return !role.includes('DIRECTOR');
      })
      .map((o: any) => {
        const name = o.name?.displayName ||
          [o.name?.givenName, o.name?.middleName, o.name?.familyName].filter(Boolean).join(' ') ||
          o.name || '';
        return {
          Name: typeof name === 'string' ? name : '',
          Address: o.addresses?.[0]?.addressInOneLine,
          Title: o.title,
          Type: o.role || o.type,
          Date: o.appointmentDate,
        } as OfficerDTO;
      });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // ─── Extract address ───
    const addresses = org.addresses || [];
    const primaryAddress = addresses[0] || {};

    const address: BusinessAddress = {
      addressInOneLine: primaryAddress.addressInOneLine || primaryAddress.longForm,
      addressLine1: primaryAddress.streetAddress || primaryAddress.addressLine1,
      cityTown: primaryAddress.town || primaryAddress.city,
      postcode: primaryAddress.postalCode,
      regionState: primaryAddress.state,
      country: primaryAddress.country,
    };

    // ─── Extract org details ───
    const orgName = org.details?.name?.registeredName ||
      org.details?.name?.displayName ||
      org.name?.registeredName ||
      org.name?.displayName ||
      org.organizationName || '';

    const orgCode = org.details?.registrationDetails?.organizationNumbers?.[0]?.registrationNumber ||
      org.registrationNumber ||
      org.entityId || '';

    const result: BusinessProfile = {
      name: orgName,
      code: orgCode,
      registrationNumber: orgCode,
      legalForm: org.details?.legalForm || org.legalForm,
      legalStatus: org.details?.status || org.status || org.legalStatus,
      registrationDate: org.details?.registrationDate || org.registrationDate,
      address,
      directors,
      shareholders,
      pscs,
      officers,
      entityId: org.entityId,
    };

    return NextResponse.json({ profile: result, requestId: data?.requestId });
  } catch (error) {
    console.error('Business profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
