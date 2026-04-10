import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationWithProfiles } from '@/lib/frankieone';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entityId } = body;

    if (!entityId) {
      return NextResponse.json({ error: 'entityId is required' }, { status: 400 });
    }

    const { data, status } = await getOrganizationWithProfiles(entityId);

    if (status !== 200) {
      return NextResponse.json({ error: data?.errorMsg || 'Failed to fetch org' }, { status });
    }

    const serviceProfiles = data.serviceProfiles || [];
    const sp = serviceProfiles[0];

    if (!sp) {
      return NextResponse.json({ error: 'No service profile found' }, { status: 404 });
    }

    const ws = sp.workflowSummaries?.[0];
    if (!ws) {
      return NextResponse.json({ error: 'No workflow results found' }, { status: 404 });
    }

    const steps = ws.steps || {};
    const passedSteps: string[] = (steps.passed || []).filter((s: string) => s !== 'START' && s !== 'FINISH');
    const failedSteps: string[] = steps.failed || [];
    const incompleteSteps: string[] = steps.incomplete || [];

    const riskAssessment = ws.riskAssessment || {};

    const result = {
      entityId,
      entityName: sp.entityName || data.organization?.name?.registeredName || '',
      workflowName: ws.workflowName || sp.currentWorkflowName || '',
      status: ws.status || 'UNKNOWN',
      riskLevel: riskAssessment.riskLevel || null,
      riskScore: riskAssessment.riskScore || null,
      checks: [
        ...passedSteps.map((s: string) => ({ step: s, result: 'PASS' as const })),
        ...failedSteps.map((s: string) => ({ step: s, result: 'FAIL' as const })),
        ...incompleteSteps.map((s: string) => ({ step: s, result: 'INCOMPLETE' as const })),
      ],
      issues: (ws.issues || []).map((i: { issue?: string; severity?: string; category?: string }) => ({
        issue: i.issue,
        severity: i.severity,
        category: i.category,
      })),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Org AML status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
