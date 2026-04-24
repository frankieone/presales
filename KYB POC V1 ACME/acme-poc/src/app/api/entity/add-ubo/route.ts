import { NextRequest, NextResponse } from 'next/server';
import { addUboToOrganisation } from '@/lib/frankieone';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organisationEntityId, givenName, middleName, familyName, dateOfBirth, address, shareholdingPercentage } = body;

    if (!organisationEntityId) {
      return NextResponse.json({ error: 'organisationEntityId is required' }, { status: 400 });
    }
    if (!givenName || !familyName) {
      return NextResponse.json({ error: 'Given name and family name are required' }, { status: 400 });
    }

    const { data, status } = await addUboToOrganisation(organisationEntityId, {
      givenName,
      middleName,
      familyName,
      dateOfBirth,
      address,
      shareholdingPercentage,
    });

    if (status !== 200 && status !== 201) {
      return NextResponse.json(
        { error: data?.errorMsg || 'Failed to add UBO' },
        { status }
      );
    }

    // Extract the new individual's entityId from the response
    const newEntityId =
      data?.associations?.[0]?.entity?.entityId ||
      data?.entity?.entityId ||
      data?.entityId;

    return NextResponse.json({ entityId: newEntityId, success: true });
  } catch (error) {
    console.error('Add UBO error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
