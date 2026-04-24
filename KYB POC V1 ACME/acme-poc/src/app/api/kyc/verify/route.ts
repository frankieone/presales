import { NextRequest, NextResponse } from 'next/server';
import { verifyEntity, verifyExistingEntity } from '@/lib/frankieone';
import type { KycResult, KycCheckResult } from '@/types/kyc';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { individualId, kycEntityId, givenName, middleName, familyName, dateOfBirth, address } = body;

    if (!givenName || !familyName) {
      return NextResponse.json({ error: 'Given name and family name are required' }, { status: 400 });
    }

    let data: Record<string, unknown>;
    let status: number;

    console.log('[KYC Verify] Request:', { individualId, kycEntityId, givenName, familyName });

    if (kycEntityId) {
      console.log('[KYC Verify] Using EXISTING entity:', kycEntityId);
      const result = await verifyExistingEntity(kycEntityId);
      data = result.data;
      status = result.status;
    } else {
      console.log('[KYC Verify] Creating NEW entity for:', givenName, familyName);
      const result = await verifyEntity({
        givenName,
        middleName,
        familyName,
        dateOfBirth,
        address,
      });
      data = result.data;
      status = result.status;
    }

    if (status !== 200 && status !== 201) {
      return NextResponse.json(
        { error: data?.errorMsg || 'Verification failed', individualId },
        { status }
      );
    }

    console.log('[KYC Verify] Response status:', status, 'actionRecommended:', (data?.entityProfileResult as Record<string, unknown>)?.actionRecommended);

    // Profile-based checks return entityProfileResult
    const profileResult = data?.entityProfileResult as Record<string, unknown> | undefined;
    const checkSummary = data?.checkSummary as Record<string, unknown> | undefined;
    const entityResult = data?.entityResult as Record<string, unknown> | undefined;
    const entity = data?.entity as Record<string, unknown> | undefined;

    // Determine overall result — prefer entityProfileResult.actionRecommended
    let overallResult: KycResult['overallResult'] = 'ERROR';
    const actionRecommended = (profileResult?.actionRecommended as string) || '';

    if (!actionRecommended && checkSummary) {
      // Fallback to checkSummary for non-profile checks
      const resultState = (checkSummary.resultState as string) || '';
      const actionNote = ((checkSummary.resultNotes as Array<Record<string, string>>) || [])
        .find((n) => n.kvpKey === 'Action.Recommended');
      const fallbackAction = actionNote?.kvpValue || '';

      if (fallbackAction === 'PASS' || resultState.includes('CLEAR')) {
        overallResult = 'PASS';
      } else if (fallbackAction === 'FAIL' || resultState.includes('FAIL')) {
        overallResult = 'FAIL';
      } else if (fallbackAction === 'REFER' || resultState.includes('REVIEW')) {
        overallResult = 'REFER';
      }
    } else if (actionRecommended === 'PASS') {
      overallResult = 'PASS';
    } else if (actionRecommended === 'FAIL') {
      overallResult = 'FAIL';
    } else if (actionRecommended === 'REFER' || actionRecommended === 'MANUAL') {
      overallResult = 'REFER';
    }

    // Build individual check results from entityProfileResult.checkResults
    const checks: KycCheckResult[] = [];
    const checkResults = (profileResult?.checkResults as Array<Record<string, string>>) || [];

    for (const cr of checkResults) {
      const result = cr.result?.toUpperCase() || '';
      let mappedResult: KycCheckResult['result'] = 'UNCHECKED';
      if (result === 'PASS' || result === 'CLEAR') mappedResult = 'PASS';
      else if (result === 'FAIL') mappedResult = 'FAIL';
      else if (result === 'REFER' || result === 'MANUAL') mappedResult = 'REFER';
      else if (result === 'NA' || result === 'N/A') mappedResult = 'PASS'; // Not applicable = OK

      checks.push({
        type: cr.name || cr.checkType || 'Unknown',
        result: mappedResult,
        details: cr.message || undefined,
      });
    }

    // Fallback if no profile check results
    if (checks.length === 0 && checkSummary) {
      checks.push({
        type: 'Overall Check',
        result: overallResult === 'ERROR' ? 'UNCHECKED' : overallResult,
      });
    }

    // Risk level from entityProfileResult or checkRisk
    const riskLevel = (profileResult?.riskLevel as string) ||
      (data?.checkRisk as Record<string, unknown>)?.resultNotes &&
      (((data?.checkRisk as Record<string, unknown>)?.resultNotes as Array<Record<string, string>>) || [])
        .find((n) => n.kvpKey === 'Risk.Level')?.kvpValue;

    const entityId = (entityResult?.entityId as string) || (entity?.entityId as string) || kycEntityId;

    const result: KycResult = {
      individualId,
      entityId,
      checkId: (profileResult?.checkId as string) || (checkSummary?.checkId as string),
      overallResult,
      riskLevel: riskLevel as KycResult['riskLevel'],
      checks,
      requestId: data?.requestId as string,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('KYC verify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
