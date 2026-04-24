import { NextRequest, NextResponse } from 'next/server';
import { triggerTrustAnalysis, getTrustAnalysisResults } from '@/lib/frankieone';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40;

export async function POST(req: NextRequest) {
  try {
    const { entityId, documentId } = await req.json();

    if (!entityId || !documentId) {
      return NextResponse.json(
        { error: 'entityId and documentId are required' },
        { status: 400 }
      );
    }

    // Step 1: Trigger analysis
    const triggerResult = await triggerTrustAnalysis(entityId, documentId);
    console.log('[TrustAnalyzer] Trigger response:', triggerResult.status, JSON.stringify(triggerResult.data));

    if (triggerResult.status !== 200 && triggerResult.status !== 201 && triggerResult.status !== 202) {
      return NextResponse.json(
        { error: triggerResult.data?.errorMsg || triggerResult.data?.message || 'Failed to trigger analysis' },
        { status: triggerResult.status }
      );
    }

    // Step 2: Poll the results endpoint until analysis is complete
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const resultsResponse = await getTrustAnalysisResults(entityId, documentId);
      console.log(`[TrustAnalyzer] Poll attempt ${attempt + 1}/${MAX_POLL_ATTEMPTS}:`, resultsResponse.status, JSON.stringify(resultsResponse.data));

      if (resultsResponse.status === 200) {
        const analyses = resultsResponse.data?.analyses || resultsResponse.data?.analysis;
        const latestAnalysis = Array.isArray(analyses) ? analyses[0] : analyses;
        const status = latestAnalysis?.status || latestAnalysis?.analysisStatus;

        if (status === 'COMPLETE' || status === 'COMPLETED' || status === 'completed' || status === 'CONFIRMED' || status === 'DONE' || status === 'done') {
          return NextResponse.json({
            success: true,
            analysis: resultsResponse.data,
          });
        }
        if (status === 'FAILED' || status === 'failed' || status === 'ERROR' || status === 'error') {
          return NextResponse.json(
            { error: 'Trust analysis failed', details: resultsResponse.data },
            { status: 500 }
          );
        }
        // Still in progress — continue polling
      }
      // Non-200 (e.g. 404) means not ready yet
    }

    return NextResponse.json(
      { error: 'Trust analysis timed out. Please try again.' },
      { status: 408 }
    );
  } catch (error) {
    console.error('[TrustAnalyzer] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
