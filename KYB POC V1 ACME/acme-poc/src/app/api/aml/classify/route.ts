import { NextRequest, NextResponse } from 'next/server';
import { classifyAmlResult } from '@/lib/frankieone';

export async function PATCH(req: NextRequest) {
  try {
    const { entityId, processResultIds, classification, comment } = await req.json();

    if (!entityId || !processResultIds?.length || !classification) {
      return NextResponse.json(
        { error: 'entityId, processResultIds, and classification are required' },
        { status: 400 }
      );
    }

    const result = await classifyAmlResult(entityId, processResultIds, classification, comment);

    if (result.status !== 200 && result.status !== 204) {
      return NextResponse.json(
        { error: result.data?.errorMsg || 'Classification failed' },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, classification });
  } catch (error) {
    console.error('AML classify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
