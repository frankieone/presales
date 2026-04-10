import { NextRequest, NextResponse } from 'next/server';
import { triggerTrustAnalysis, getTrustAnalysisStatus, getTrustAnalysisResults } from '@/lib/frankieone';

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

    // Step 2: Poll for completion
    let analysisReady = false;
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const statusResult = await getTrustAnalysisStatus(documentId);
      console.log(`[TrustAnalyzer] Poll attempt ${attempt + 1}/${MAX_POLL_ATTEMPTS}:`, statusResult.status, JSON.stringify(statusResult.data));

      if (statusResult.status === 200) {
        const status = statusResult.data?.status || statusResult.data?.analysisStatus;
        if (status === 'COMPLETED' || status === 'completed' || status === 'DONE' || status === 'done') {
          analysisReady = true;
          break;
        }
        if (status === 'FAILED' || status === 'failed' || status === 'ERROR' || status === 'error') {
          return NextResponse.json(
            { error: 'Trust analysis failed', details: statusResult.data },
            { status: 500 }
          );
        }
        // Still in progress — continue polling
      }
      // Non-200 (e.g. 404) means not ready yet
    }

    if (!analysisReady) {
      return NextResponse.json(
        { error: 'Trust analysis timed out. Please try again.' },
        { status: 408 }
      );
    }

    // Step 3: Get results
    const resultsResponse = await getTrustAnalysisResults(entityId, documentId);
    console.log('[TrustAnalyzer] Results response:', resultsResponse.status, JSON.stringify(resultsResponse.data));

    if (resultsResponse.status !== 200) {
      return NextResponse.json(
        { error: resultsResponse.data?.errorMsg || resultsResponse.data?.message || 'Failed to fetch analysis results' },
        { status: resultsResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      analysis: resultsResponse.data,
    });
  } catch (error) {
    console.error('[TrustAnalyzer] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
