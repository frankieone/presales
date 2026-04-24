import { NextRequest, NextResponse } from 'next/server';
import { FRANKIE_API_BASE_URL, FRANKIE_CUSTOMER_ID, FRANKIE_API_KEY, FRANKIE_CUSTOMER_CHILD_ID, ENDPOINTS } from '@/lib/constants';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Frankie-CustomerID': FRANKIE_CUSTOMER_ID,
    'api_key': FRANKIE_API_KEY,
  };
  if (FRANKIE_CUSTOMER_CHILD_ID) {
    headers['X-Frankie-CustomerChildID'] = FRANKIE_CUSTOMER_CHILD_ID;
  }
  return headers;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entityId } = body;

    if (!entityId) {
      return NextResponse.json({ error: 'entityId is required' }, { status: 400 });
    }

    const url = `${FRANKIE_API_BASE_URL}${ENDPOINTS.ENTITY_BASE}/${entityId}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    const data = await res.json();

    if (res.status !== 200) {
      return NextResponse.json(
        { error: data?.errorMsg || 'Failed to fetch entity' },
        { status: res.status }
      );
    }

    // Extract from v1.2 response
    const entity = data?.entity || data;
    const name = entity?.name || {};
    const dob = entity?.dateOfBirth || {};
    const addresses = entity?.addresses || [];
    const addr = addresses[0] || {};

    return NextResponse.json({
      entityId: entity?.entityId || entityId,
      givenName: name.givenName || '',
      middleName: name.middleName || '',
      familyName: name.familyName || '',
      dateOfBirth: dob.dateOfBirth || '',
      address: {
        streetAddress: addr.streetName || addr.longForm || '',
        city: addr.town || addr.suburb || '',
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
