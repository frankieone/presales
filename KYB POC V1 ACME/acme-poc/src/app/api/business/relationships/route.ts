import { NextRequest, NextResponse } from 'next/server';
import { addUboToOrganisation, associateExistingEntity } from '@/lib/frankieone';

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

    if (entityType === 'INDIVIDUAL') {
      if (!individual?.givenName || !individual?.familyName) {
        return NextResponse.json({ error: 'givenName and familyName are required for individuals' }, { status: 400 });
      }

      // Create and associate entity with the target org (child or root)
      const result = await addUboToOrganisation(parentEntityId, {
        givenName: individual.givenName,
        middleName: individual.middleName,
        familyName: individual.familyName,
        dateOfBirth: individual.dateOfBirth,
      });

      if (result.status !== 200 && result.status !== 201) {
        return NextResponse.json(
          { error: result.data?.errorMsg || 'Failed to add individual' },
          { status: result.status }
        );
      }

      const entityId = result.data?.entity?.entityId || result.data?.entityId;

      // If adding to a child org, also associate with the root org for portal visibility
      if (rootEntityId && rootEntityId !== parentEntityId && entityId) {
        const roleObj = { type: role.code, typeDescription: role.description || role.code };
        await associateExistingEntity(rootEntityId, entityId, [roleObj]).catch(() => {});
      }

      return NextResponse.json({
        entityId,
        entityType,
        role,
        parentEntityId,
        name: `${individual.givenName} ${individual.familyName}`,
      });
    } else {
      return NextResponse.json(
        { error: 'Adding organizations is not supported in v1.2 API' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Relationship creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
