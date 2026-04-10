import { NextRequest, NextResponse } from 'next/server';
import { createIndividual, addOrganizationRelationships } from '@/lib/frankieone';
import { FRANKIE_API_V2_BASE_URL, V2_ENDPOINTS } from '@/lib/constants';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Frankie-CustomerID': process.env.FRANKIE_CUSTOMER_ID || '',
    'api_key': process.env.FRANKIE_API_KEY || '',
  };
  if (process.env.FRANKIE_CUSTOMER_CHILD_ID) {
    headers['X-Frankie-CustomerChildID'] = process.env.FRANKIE_CUSTOMER_CHILD_ID;
  }
  return headers;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { parentEntityId, rootEntityId, entityType, role, individual, organization } = body;

    if (!parentEntityId) {
      return NextResponse.json({ error: 'parentEntityId is required' }, { status: 400 });
    }
    if (!entityType || !['INDIVIDUAL', 'ORGANIZATION'].includes(entityType)) {
      return NextResponse.json({ error: 'entityType must be INDIVIDUAL or ORGANIZATION' }, { status: 400 });
    }
    if (!role?.code) {
      return NextResponse.json({ error: 'role.code is required' }, { status: 400 });
    }

    let entityId: string;

    if (entityType === 'INDIVIDUAL') {
      if (!individual?.givenName || !individual?.familyName) {
        return NextResponse.json({ error: 'givenName and familyName are required for individuals' }, { status: 400 });
      }
      const result = await createIndividual({
        givenName: individual.givenName,
        middleName: individual.middleName,
        familyName: individual.familyName,
        dateOfBirth: individual.dateOfBirth,
      });
      if (result.status !== 200 && result.status !== 201) {
        return NextResponse.json(
          { error: result.data?.errorMsg || 'Failed to create individual' },
          { status: result.status }
        );
      }
      entityId = result.data?.individual?.entityId || result.data?.entityId;
    } else {
      // Create organization entity with name and country
      if (!organization?.name) {
        return NextResponse.json({ error: 'organization.name is required' }, { status: 400 });
      }
      const orgBody: Record<string, unknown> = {
        organization: {
          details: {
            name: { name: organization.name },
            ...(organization.registrationNumber ? {
              registrationDetails: [{
                registrationNumber: organization.registrationNumber,
                registrationNumberType: organization.registrationNumberType || 'ACN',
              }],
            } : {}),
          },
          addresses: [{
            country: organization.country || 'AUS',
            type: 'REGISTERED_OFFICE',
          }],
        },
      };
      const res = await fetch(`${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.ORGANIZATIONS_CREATE}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(orgBody),
      });
      const data = await res.json();
      if (res.status !== 200 && res.status !== 201) {
        return NextResponse.json(
          { error: data?.errorMsg || 'Failed to create organization' },
          { status: res.status }
        );
      }
      entityId = data?.organization?.entityId || data?.entityId;
    }

    if (!entityId) {
      return NextResponse.json({ error: 'Failed to get entityId from created entity' }, { status: 500 });
    }

    // Add the relationship to the parent organization
    const relResult = await addOrganizationRelationships(parentEntityId, [
      {
        entity: { entityId, entityType },
        relationships: [{
          type: 'OFFICIAL',
          role: {
            code: role.code,
            description: role.description || role.code,
          },
        }],
      },
    ]);

    if (relResult.status !== 200 && relResult.status !== 201) {
      return NextResponse.json(
        { error: relResult.data?.errorMsg || 'Failed to add relationship', entityId },
        { status: relResult.status }
      );
    }

    // If adding to a child org, also associate with the root org for portal visibility
    if (rootEntityId && rootEntityId !== parentEntityId) {
      await addOrganizationRelationships(rootEntityId, [
        {
          entity: { entityId, entityType },
          relationships: [{
            type: 'OFFICIAL',
            role: {
              code: role.code,
              description: role.description || role.code,
            },
          }],
        },
      ]).catch(() => {}); // best-effort — don't fail the request if this errors
    }

    return NextResponse.json({
      entityId,
      entityType,
      role,
      parentEntityId,
      name: entityType === 'INDIVIDUAL'
        ? `${individual.givenName} ${individual.familyName}`
        : organization.name,
    });
  } catch (error) {
    console.error('Relationship creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
