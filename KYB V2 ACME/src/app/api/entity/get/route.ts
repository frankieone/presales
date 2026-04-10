import { NextRequest, NextResponse } from 'next/server';
import { getIndividual } from '@/lib/frankieone';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entityId } = body;

    if (!entityId) {
      return NextResponse.json({ error: 'entityId is required' }, { status: 400 });
    }

    const { data, status } = await getIndividual(entityId);

    if (status !== 200) {
      return NextResponse.json(
        { error: data?.errorMsg || data?.errorCode || 'Failed to fetch entity' },
        { status }
      );
    }

    // Extract the relevant fields from the v2 response
    const individual = data?.individual || data;
    const name = individual?.name || {};
    const dob = individual?.dateOfBirth || {};
    const addresses = individual?.addresses || [];
    const addr = addresses[0] || {};

    return NextResponse.json({
      entityId: individual?.entityId || entityId,
      givenName: name.givenName || '',
      middleName: name.middleName || '',
      familyName: name.familyName || '',
      dateOfBirth: dob.year && dob.month && dob.day
        ? `${dob.year}-${String(dob.month).padStart(2, '0')}-${String(dob.day).padStart(2, '0')}`
        : '',
      address: {
        streetAddress: addr.streetAddress || addr.longForm || '',
        city: addr.town || '',
        state: addr.state || '',
        postalCode: addr.postalCode || '',
        country: addr.country || '',
      },
    });
  } catch (error) {
    console.error('Entity get error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
