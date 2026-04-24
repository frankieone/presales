import { NextRequest, NextResponse } from 'next/server';
import { confirmTrustAnalysis } from '@/lib/frankieone';

export async function POST(req: NextRequest) {
  try {
    const { entityId, documentId, analysisId, documentInformation } = await req.json();

    if (!entityId || !documentId || !analysisId) {
      return NextResponse.json(
        { error: 'entityId, documentId, and analysisId are required' },
        { status: 400 }
      );
    }

    console.log('[TrustConfirm] Request:', { entityId, documentId, analysisId });
    console.log('[TrustConfirm] Body:', JSON.stringify(documentInformation, null, 2));

    const result = await confirmTrustAnalysis(entityId, documentId, analysisId, documentInformation || {});
    console.log('[TrustConfirm] Response:', result.status, JSON.stringify(result.data));

    if (result.status === 200) {
      return NextResponse.json({ success: true, requestId: result.data?.requestId });
    }

    return NextResponse.json(
      { error: result.data?.errorMsg || result.data?.message || 'Failed to confirm analysis' },
      { status: result.status }
    );
  } catch (error) {
    console.error('[TrustConfirm] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
