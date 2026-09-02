import { NextRequest, NextResponse } from 'next/server';
import { createIndividual, getIndividual, updateIndividual, executeIndividualWorkflow, addOrganizationRelationships } from '@/lib/frankieone';
import { DEFAULT_WORKFLOW_NAME } from '@/lib/constants';
import type { KycResult, KycCheckResult } from '@/types/kyc';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { individualId, kycEntityId, givenName, middleName, familyName, dateOfBirth, address, organisationEntityId } = body;

    if (!givenName || !familyName) {
      return NextResponse.json({ error: 'Given name and family name are required' }, { status: 400 });
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    let data: any;
    let status: number;
    let entityId: string | undefined;

    if (kycEntityId) {
      // Entity already exists — patch updated details + consents, then re-run workflow
      entityId = kycEntityId;
      console.log('[KYC] Patching details on existing entity:', entityId);

      const patchPayload: Record<string, unknown> = {
        name: {
          givenName,
          familyName,
          ...(middleName ? { middleName } : {}),
        },
        consents: [
          { type: 'GENERAL', granted: true },
          { type: 'DOCS', granted: true },
          { type: 'CREDITHEADER', granted: true },
        ],
      };

      if (dateOfBirth) {
        const parts = dateOfBirth.split('-');
        if (parts.length >= 3) {
          patchPayload.dateOfBirth = { year: parts[0], month: parts[1], day: parts[2] };
        }
      }

      if (address) {
        const addr: Record<string, string> = {};
        if (address.streetAddress) addr.streetAddress = address.streetAddress;
        if (address.city) addr.town = address.city;
        if (address.state) addr.state = address.state;
        if (address.postalCode) addr.postalCode = address.postalCode;
        if (address.country) addr.country = address.country;
        if (Object.keys(addr).length > 0) {
          patchPayload.addresses = [addr];
        }
      }

      await updateIndividual(entityId, patchPayload);

      console.log('[KYC] Executing workflow on existing entity:', entityId);
      const execResult = await executeIndividualWorkflow(entityId, DEFAULT_WORKFLOW_NAME);
      console.log('[KYC] Execute status:', execResult.status);
      data = execResult.data;
      status = execResult.status;

      if (status !== 200 && status !== 201) {
        return NextResponse.json(
          { error: data?.errorMsg || data?.errorCode || 'Workflow execution failed', individualId, details: data },
          { status }
        );
      }
    } else {
      // Step 1: Create individual with workflow assigned
      const createResult = await createIndividual(
        { givenName, middleName, familyName, dateOfBirth, address },
        { workflowName: DEFAULT_WORKFLOW_NAME }
      );

      if (createResult.status !== 200 && createResult.status !== 201) {
        return NextResponse.json(
          { error: createResult.data?.errorMsg || createResult.data?.errorCode || 'Failed to create individual', individualId, details: createResult.data },
          { status: createResult.status }
        );
      }

      entityId = createResult.data?.individual?.entityId;
      console.log('[KYC] Created individual:', entityId);

      if (!entityId) {
        return NextResponse.json({ error: 'No entityId returned', individualId }, { status: 500 });
      }

      // Step 1b: Link individual to org if we have the org entity ID
      if (organisationEntityId) {
        console.log('[KYC] Linking individual to org:', organisationEntityId);
        const linkResult = await addOrganizationRelationships(organisationEntityId, [
          {
            entity: { entityId, entityType: 'INDIVIDUAL' },
            relationships: [{ type: 'OFFICIAL', role: { code: 'UBO', description: 'Ultimate Beneficial Owner' } }],
          },
        ]);
        if (linkResult.status !== 200 && linkResult.status !== 201) {
          console.warn('[KYC] Failed to link individual to org:', linkResult.data);
        }
      }

      // Step 2: Execute workflow
      console.log('[KYC] Executing workflow:', DEFAULT_WORKFLOW_NAME);
      const execResult = await executeIndividualWorkflow(entityId, DEFAULT_WORKFLOW_NAME);
      console.log('[KYC] Execute status:', execResult.status);

      data = execResult.data;
      status = execResult.status;

      if (status !== 200 && status !== 201) {
        return NextResponse.json(
          { error: data?.errorMsg || data?.errorCode || 'Workflow execution failed', individualId, details: data },
          { status }
        );
      }
    }

    // ─── Parse v2 execute response ───
    // Execute endpoint returns: { individual, serviceProfile (singular), workflowResult, requestId }
    const individual = data?.individual || {};
    const workflowResult = data?.workflowResult || {};
    // Also check serviceProfile (singular from execute) or serviceProfiles (array from getIndividual)
    const serviceProfile = data?.serviceProfile || data?.serviceProfiles?.[0] || {};
    const workflowSummary = serviceProfile.workflowSummaries?.[0] || {};

    // Overall result — prefer workflowResult.result, fallback to workflowSummary.status
    let overallResult: KycResult['overallResult'] = 'ERROR';
    const wfResult = (workflowResult.result || workflowResult.status || workflowSummary.status || '').toUpperCase();

    if (wfResult === 'PASS' || wfResult === 'CLEAR' || wfResult === 'ACCEPT') {
      overallResult = 'PASS';
    } else if (wfResult === 'FAIL' || wfResult === 'REJECT' || wfResult === 'NO_MATCH') {
      overallResult = 'FAIL';
    } else if (wfResult === 'REFER' || wfResult === 'MANUAL' || wfResult === 'REVIEW') {
      overallResult = 'REFER';
    } else if (wfResult === 'UNCHECKED') {
      overallResult = 'REFER';
    }

    // Build check results from workflow steps
    const checks: KycCheckResult[] = [];
    const steps = workflowResult.steps || workflowSummary.steps || {};
    const passedSteps: string[] = steps.passed || [];
    const failedSteps: string[] = steps.failed || [];
    const incompleteSteps: string[] = steps.incomplete || [];

    for (const step of passedSteps) {
      if (step === 'START') continue;
      checks.push({ type: step, result: 'PASS' });
    }
    for (const step of failedSteps) {
      checks.push({ type: step, result: 'FAIL' });
    }
    for (const step of incompleteSteps) {
      checks.push({ type: step, result: 'UNCHECKED' });
    }

    // Add issues as additional detail
    const issues: any[] = workflowResult.issues || workflowSummary.issues || [];
    for (const issue of issues) {
      const severity = (issue.severity || '').toUpperCase();
      checks.push({
        type: `${issue.category || 'ISSUE'}: ${issue.issue || ''}`,
        result: severity === 'CRITICAL' ? 'FAIL' : 'REFER',
        details: `${issue.issue} (${severity})`,
      });
    }

    if (checks.length === 0) {
      checks.push({
        type: 'Overall Check',
        result: overallResult === 'ERROR' ? 'UNCHECKED' : overallResult,
      });
    }

    // Risk assessment
    const riskAssessment = workflowResult.riskAssessment || workflowSummary.riskAssessment || {};
    const riskLevel = riskAssessment.riskLevel || riskAssessment.workflowRiskLevel;

    entityId = individual?.entityId || kycEntityId;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const result: KycResult = {
      individualId,
      entityId,
      checkId: workflowResult.workflowExecutionId || workflowSummary.workflowExecutionId,
      overallResult,
      riskLevel: riskLevel as KycResult['riskLevel'],
      checks,
      requestId: data?.requestId as string,
    };

    console.log('[KYC] Result:', JSON.stringify({ overallResult, riskLevel, checksCount: checks.length }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('KYC verify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
