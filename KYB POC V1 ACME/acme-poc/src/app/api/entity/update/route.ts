import { NextRequest, NextResponse } from 'next/server';
import { updateEntity } from '@/lib/frankieone';

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

    const { data, status } = await updateEntity(entityId, {
      givenName,
      middleName,
      familyName,
      dateOfBirth,
      address,
    });

    if (status !== 200 && status !== 201) {
      return NextResponse.json(
        { error: data?.errorMsg || 'Failed to update entity' },
        { status }
      );
    }

    return NextResponse.json({ entityId, success: true });
  } catch (error) {
    console.error('Entity update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
