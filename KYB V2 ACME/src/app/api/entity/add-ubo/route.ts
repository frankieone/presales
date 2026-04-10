import { NextRequest, NextResponse } from 'next/server';
import { createIndividual, addOrganizationRelationships } from '@/lib/frankieone';

// Role code mapping for UBO relationship types
const ROLE_CODES: Record<string, { code: string; description: string }> = {
  ubo: { code: 'UBO', description: 'Ultimate Beneficial Owner' },
  director: { code: 'DR', description: 'Director' },
  secretary: { code: 'SC', description: 'Secretary' },
  shareholder: { code: 'SH', description: 'Shareholder' },
  trustee: { code: 'TR', description: 'Trustee' },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organisationEntityId, givenName, middleName, familyName, dateOfBirth, address, shareholdingPercentage, role } = body;

    if (!organisationEntityId) {
      return NextResponse.json({ error: 'organisationEntityId is required' }, { status: 400 });
    }
    if (!givenName || !familyName) {
      return NextResponse.json({ error: 'Given name and family name are required' }, { status: 400 });
    }

    // Step 1: Create the individual entity via v2
    const { data, status } = await createIndividual({
      givenName,
      middleName,
      familyName,
      dateOfBirth,
      address,
    });

    if (status !== 200 && status !== 201) {
      return NextResponse.json(
        { error: data?.errorMsg || data?.errorCode || 'Failed to create individual' },
        { status }
      );
    }

    const newEntityId = data?.individual?.entityId || data?.entityId;

    if (!newEntityId) {
      return NextResponse.json(
        { error: 'Individual created but no entityId returned' },
        { status: 500 }
      );
    }

    // Step 2: Link the individual to the organization via PUT /v2/organizations/{entityId}/relationships
    const roleInfo = ROLE_CODES[role || 'ubo'] || ROLE_CODES.ubo;

    const { data: relData, status: relStatus } = await addOrganizationRelationships(
      organisationEntityId,
      [
        {
          entity: {
            entityId: newEntityId,
            entityType: 'INDIVIDUAL',
          },
          relationships: [
            {
              type: 'OFFICIAL',
              role: roleInfo,
            },
          ],
        },
      ]
    );

    if (relStatus !== 200 && relStatus !== 201) {
      console.error('Failed to link individual to organization:', relData);
      // Return success for individual creation but warn about linking failure
      return NextResponse.json({
        entityId: newEntityId,
        success: true,
        linkingError: relData?.errorMsg || relData?.errorCode || 'Failed to link individual to organization',
      });
    }

    return NextResponse.json({ entityId: newEntityId, success: true, linked: true });
  } catch (error) {
    console.error('Add UBO error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
