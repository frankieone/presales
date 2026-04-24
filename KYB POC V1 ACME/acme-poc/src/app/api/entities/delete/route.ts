import { NextRequest, NextResponse } from 'next/server';
import { deleteEntity, disassociateEntity, getParentAssociations } from '@/lib/frankieone';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entityIds, rootEntityId } = body;

    if (!Array.isArray(entityIds) || entityIds.length === 0) {
      return NextResponse.json({ error: 'entityIds array is required' }, { status: 400 });
    }

    const results: Array<{ entityId: string; success: boolean; status: number; step: string }> = [];

    // Step 1: For each entity, discover its parent associations and disassociate
    for (const entityId of entityIds) {
      try {
        // Find all parent orgs this entity is associated with
        const parentOrgIds = new Set<string>();

        // If caller provided the root entity ID, include it
        if (rootEntityId) parentOrgIds.add(rootEntityId);

        // Also discover via the API
        try {
          const pa = await getParentAssociations(entityId);
          if (pa.status === 200 && pa.data?.parentAssociations) {
            for (const entry of pa.data.parentAssociations) {
              if (entry.associations) {
                for (const assoc of entry.associations) {
                  if (assoc.parentId) parentOrgIds.add(assoc.parentId);
                }
              }
            }
          }
        } catch {
          // Non-fatal — proceed with known parents
        }

        // Disassociate from all parent orgs
        for (const parentId of parentOrgIds) {
          if (parentId === entityId) continue;
          try {
            await disassociateEntity(parentId, entityId);
          } catch {
            // Non-fatal — entity may not be associated with this parent
          }
        }
      } catch {
        // Non-fatal — proceed to delete
      }
    }

    // Step 2: Delete all entities (children first — they come first in the array by convention)
    for (const entityId of entityIds) {
      try {
        const { status } = await deleteEntity(entityId);
        results.push({ entityId, success: status === 200 || status === 204, status, step: 'delete' });
      } catch {
        results.push({ entityId, success: false, status: 500, step: 'delete' });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({ results, succeeded, failed, total: entityIds.length });
  } catch (error) {
    console.error('Entity delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
