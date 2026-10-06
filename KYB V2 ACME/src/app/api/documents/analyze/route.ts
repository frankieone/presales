import { NextRequest, NextResponse } from 'next/server';
import {
  executeTrustAnalysis,
  getDocumentAnalyses,
  TRUST_ANALYSIS_WORKFLOW,
} from '@/lib/frankieone';

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 36; // ~3 minutes

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Resolve an entity reference against the analysis's linked* maps. */
function resolveParty(ref: any, linked: Record<string, any>): { name: string; type?: string } | null {
  if (!ref) return null;
  // some entries carry a literal value rather than an entity reference
  if (ref.value && !ref.entityId) return { name: String(ref.value) };

  const entity = linked[ref.entityId];
  if (!entity) return ref.entityId ? { name: String(ref.entityId) } : null;

  if (entity.entityType === 'INDIVIDUAL' || entity.name?.givenName || entity.name?.displayName) {
    const n = entity.name || {};
    // the analyzer usually fills displayName and leaves the parts empty
    const parts = [n.givenName, n.middleName, n.familyName].filter(Boolean).join(' ').trim();
    return { name: n.displayName || parts || 'Unnamed individual', type: 'Individual' };
  }

  const orgName = entity.details?.name?.value || entity.name?.value || entity.details?.name;
  return { name: orgName || 'Unnamed organisation', type: 'Organisation' };
}

/**
 * Flatten the type-specific block into the beneficiary list the UI shows.
 * Specified beneficiaries are named people; general beneficiaries are a class
 * of persons ("the children of the settlor") and aren't individually verifiable.
 */
function extractBeneficiaries(trust: any, linked: Record<string, any>) {
  const ti = trust?.typeInformation || {};

  // One person can hold several roles (a specified beneficiary who is also an
  // appointor). The API references them from each role but lists them once, so
  // collapse by entityId and merge the role labels.
  const byEntity = new Map<string, { name: string; roles: string[] }>();
  const classes: Array<{ name: string; type?: string; class?: string }> = [];

  function addParty(ref: any, role: string) {
    const party = resolveParty(ref, linked);
    if (!party) return;
    const key = ref?.entityId || party.name;
    const existing = byEntity.get(key);
    if (existing) {
      if (!existing.roles.includes(role)) existing.roles.push(role);
      return;
    }
    byEntity.set(key, { name: party.name, roles: [role] });
  }

  const d = ti.discretionary;
  if (d) {
    (d.specifiedBeneficiaries || []).forEach((b: any) => addParty(b, 'Specified beneficiary'));
    (d.appointors || []).forEach((b: any) => addParty(b, 'Appointor'));
    (d.protectors || []).forEach((b: any) => addParty(b, 'Protector'));
    (d.generalBeneficiaries || []).forEach((b: any) => {
      const name = b?.value || resolveParty(b, linked)?.name;
      if (name) {
        classes.push({
          name: String(name),
          type: 'General beneficiary',
          class: 'Class of beneficiaries',
        });
      }
    });
  }

  const u = ti.unit;
  if (u) {
    (u.unitHolders || u.unitholders || []).forEach((b: any) => {
      const holding = b?.percentage ?? b?.units;
      const label =
        holding != null
          ? `Unit holder · ${holding}${b.percentage != null ? '%' : ' units'}`
          : 'Unit holder';
      addParty(b, label);
    });
  }

  const smsf = ti.selfManagedSuperFund;
  if (smsf) {
    (smsf.members || []).forEach((b: any) => addParty(b, 'Fund member'));
  }

  const people = Array.from(byEntity.values()).map((p) => ({
    name: p.name,
    type: p.roles.join(' · '),
  }));

  return [...people, ...classes];
}

export async function POST(req: NextRequest) {
  try {
    const { entityId, documentId, serviceName } = await req.json();

    if (!entityId || !documentId) {
      return NextResponse.json(
        { error: 'entityId and documentId are required' },
        { status: 400 }
      );
    }

    const service = serviceName || 'DEFAULT';

    // Step 1: execute GLB-Trust-Analysis against the organisation, passing the
    // uploaded deed as an execution variable.
    const exec = await executeTrustAnalysis(entityId, documentId, service);
    console.log('[TrustAnalyzer] Execute:', exec.status, JSON.stringify(exec.data).slice(0, 300));

    if (exec.status !== 200 && exec.status !== 201 && exec.status !== 202) {
      // The Trust Analyzer is opt-in per environment. Surface that clearly
      // rather than leaking a bare 404.
      const issues = JSON.stringify(exec.data?.details || '');
      if (issues.includes(`workflow '${TRUST_ANALYSIS_WORKFLOW}' does not exist`)) {
        return NextResponse.json(
          {
            error:
              'Trust Analyzer is not enabled on this environment. The ' +
              `${TRUST_ANALYSIS_WORKFLOW} workflow needs to be turned on for this ` +
              'tenant — contact your FrankieOne representative.',
            details: exec.data,
          },
          { status: 501 }
        );
      }

      return NextResponse.json(
        {
          error:
            exec.data?.errorMsg ||
            exec.data?.message ||
            `Failed to start trust analysis (${exec.status})`,
          details: exec.data,
        },
        { status: exec.status }
      );
    }

    // Step 2: poll the document's analyses until one lands in a terminal state.
    let analysis: any = null;
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const res = await getDocumentAnalyses(entityId, documentId, 'LATEST');
      if (res.status === 200) {
        const list: any[] = res.data?.analyses || [];
        const latest = list[0];
        const status = latest?.status;
        console.log(`[TrustAnalyzer] Poll ${attempt + 1}/${MAX_POLL_ATTEMPTS}: status=${status}`);

        if (status === 'FAILED') {
          return NextResponse.json(
            { error: 'Trust analysis failed for this document', details: latest },
            { status: 502 }
          );
        }
        // The API returns VALID on success; the docs describe COMPLETE /
        // CONFIRMED. Accept all three.
        if (status === 'VALID' || status === 'COMPLETE' || status === 'CONFIRMED') {
          analysis = latest;
          break;
        }
      } else {
        console.log(`[TrustAnalyzer] Poll ${attempt + 1}: analyses returned ${res.status}`);
      }
    }

    if (!analysis) {
      return NextResponse.json(
        { error: 'Trust analysis timed out. Please try again.' },
        { status: 408 }
      );
    }

    // Step 3: normalise into the shape the wizard renders.
    const trust = analysis.documentInformation?.trust || {};
    const linked: Record<string, any> = {
      ...(trust.linkedIndividuals || {}),
      ...(trust.linkedOrganizations || {}),
      ...(trust.linkedUnknownEntities || {}),
    };

    const normalized = {
      analysisId: analysis.analysisId,
      trustName: trust.name?.value,
      trustType: trust.type?.detected,
      trustees: (trust.trustees || []).map((t: any) => resolveParty(t, linked)).filter(Boolean),
      settlors: (trust.settlors || []).map((t: any) => resolveParty(t, linked)).filter(Boolean),
      beneficiaries: extractBeneficiaries(trust, linked),
    };

    return NextResponse.json({ success: true, analysis: normalized, raw: analysis });
  } catch (error) {
    console.error('Trust analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Trust analysis failed' },
      { status: 500 }
    );
  }
}
