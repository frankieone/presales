import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/sessions';
import { getWorkflowResult } from '@/lib/frankieone';

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!session.entityId) {
      return NextResponse.json({ error: 'No entity found for this session' }, { status: 400 });
    }

    const result = await getWorkflowResult(session.entityId);

    if (result.status !== 200) {
      return NextResponse.json(
        { error: 'Failed to fetch workflow result', detail: result.data },
        { status: result.status },
      );
    }

    // Extract the latest workflow execution status
    const serviceProfile = result.data;
    const summaries = serviceProfile?.workflowSummaries || [];
    const latest = summaries[0];

    if (!latest) {
      return NextResponse.json({ status: 'pending', message: 'No workflow execution found yet' });
    }

    const executionState = latest.workflowExecutionState;
    const executionResult = latest.workflowExecutionResult;

    return NextResponse.json({
      status: executionResult || 'UNKNOWN',
      executionState: executionState || 'UNKNOWN',
      workflowName: latest.workflowName,
      entityId: session.entityId,
    });
  } catch (error) {
    console.error('Workflow result error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
