import { NextRequest, NextResponse } from 'next/server';
import { updateIndividual } from '@/lib/frankieone';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entityId, givenName, middleName, familyName, dateOfBirth, address } = body;

    if (!entityId) {
      return NextResponse.json({ error: 'entityId is required' }, { status: 400 });
    }

    if (!givenName || !familyName) {
      return NextResponse.json({ error: 'Given name and family name are required' }, { status: 400 });
    }

    // Build the v2 PATCH payload
    const individualPayload: Record<string, unknown> = {
      name: {
        givenName,
        familyName,
        ...(middleName ? { middleName } : {}),
      },
    };

    if (dateOfBirth) {
      const parts = dateOfBirth.split('-');
      if (parts.length >= 3) {
        individualPayload.dateOfBirth = { year: parts[0], month: parts[1], day: parts[2] };
      } else if (parts.length === 2) {
        individualPayload.dateOfBirth = { year: parts[0], month: parts[1] };
      }
    }

    if (address) {
      const addr: Record<string, string> = {};
      if (address.streetAddress) addr.streetAddress = address.streetAddress;
      if (address.city) addr.town = address.city;
      if (address.state) addr.state = address.state;
      if (address.postalCode) addr.postalCode = address.postalCode;
      if (address.country) addr.country = address.country;
      if (Object.keys(addr).length > 0) {
        individualPayload.addresses = [addr];
      }
    }

    const { data, status } = await updateIndividual(entityId, individualPayload);

    if (status !== 200) {
      return NextResponse.json(
        { error: data?.errorMsg || data?.errorCode || 'Failed to update entity' },
        { status }
      );
    }

    return NextResponse.json({ entityId, success: true });
  } catch (error) {
    console.error('Entity update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
