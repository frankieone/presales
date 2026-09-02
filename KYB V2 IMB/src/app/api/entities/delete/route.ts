import { NextRequest, NextResponse } from 'next/server';
import { deleteIndividual, deleteOrganization } from '@/lib/frankieone';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entityIds } = body;

    if (!Array.isArray(entityIds) || entityIds.length === 0) {
      return NextResponse.json({ error: 'entityIds array is required' }, { status: 400 });
    }

    const results: Array<{ entityId: string; success: boolean; status: number }> = [];

    for (const entityId of entityIds) {
      try {
        // Try individual first, then organization if that fails
        const { status } = await deleteIndividual(entityId);
        if (status === 200) {
          results.push({ entityId, success: true, status });
        } else {
          const orgResult = await deleteOrganization(entityId);
          results.push({ entityId, success: orgResult.status === 200, status: orgResult.status });
        }
      } catch {
        results.push({ entityId, success: false, status: 500 });
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
