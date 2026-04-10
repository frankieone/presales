import { NextRequest, NextResponse } from 'next/server';
import { executeOrganizationWorkflow, lookupOrganizations, getOrganizationWithProfiles, getOrganizationRelationships } from '@/lib/frankieone';
import { MOCK_ABN, MOCK_ACN, MOCK_OWNERSHIP_RESPONSE } from '@/lib/mock-ownership';
import type { AustralianOwnershipResponse, AustralianOfficeholder, BlockingEntity, OwnershipShareholder } from '@/types/business';

const DEFAULT_KYB_WORKFLOW = process.env.FRANKIE_KYB_WORKFLOW_NAME || 'AUS-Organization-Ownership';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { acn, abn, companyName, organizationToken, entityId: requestedEntityId } = body;

    console.log('[Ownership] Request body:', JSON.stringify({ acn, abn, companyName, organizationToken, entityId: requestedEntityId }));

    if (!acn && !abn && !companyName && !organizationToken && !requestedEntityId) {
      return NextResponse.json({ error: 'ACN, ABN, business name, organizationToken, or entityId is required' }, { status: 400 });
    }

    // Mock fixture for WOMBAT HOLDINGS PTY LTD (trust blocking entity demo)
    const isMock = abn === MOCK_ABN || acn === MOCK_ACN;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    let data: any;
    let status: number;

    if (isMock) {
      data = MOCK_OWNERSHIP_RESPONSE as unknown as Record<string, unknown>;
      status = 200;
    } else if (requestedEntityId) {
      // Fetch existing entity — get the latest workflow execution result
      console.log('[Ownership] Using existing entityId:', requestedEntityId);
      const orgResult = await getOrganizationWithProfiles(requestedEntityId);
      console.log('[Ownership] getOrganizationWithProfiles status:', orgResult.status, 'error:', orgResult.data?.errorMsg || orgResult.data?.errorCode || 'none');
      if (orgResult.status !== 200) {
        return NextResponse.json(
          { error: orgResult.data?.errorMsg || orgResult.data?.errorCode || 'Entity not found' },
          { status: orgResult.status }
        );
      }
      // Find the latest workflow execution
      const sp = orgResult.data?.serviceProfiles?.[0] || {};
      const serviceName = sp.serviceName || 'DEFAULT';
      const latestExecId = sp.latestWorkflowExecutionId;
      const wfName = sp.currentWorkflowName || DEFAULT_KYB_WORKFLOW;

      if (latestExecId) {
        console.log(`[Ownership] Fetching execution result: ${latestExecId}`);
        const encodedWf = encodeURIComponent(wfName);
        const execUrl = `${process.env.FRANKIE_API_V2_BASE_URL || 'https://api.uat.frankie.one'}/v2/organizations/${requestedEntityId}/serviceprofiles/${serviceName}/workflows/${encodedWf}/executions/${latestExecId}`;
        const execRes = await fetch(execUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Frankie-CustomerID': process.env.FRANKIE_CUSTOMER_ID || '',
            'api_key': process.env.FRANKIE_API_KEY || '',
            ...(process.env.FRANKIE_CUSTOMER_CHILD_ID ? { 'X-Frankie-CustomerChildID': process.env.FRANKIE_CUSTOMER_CHILD_ID } : {}),
          },
        });
        if (execRes.ok) {
          data = await execRes.json();
          status = 200;
          console.log('[Ownership] Execution result keys:', JSON.stringify(Object.keys(data || {})));
        } else {
          console.log('[Ownership] Execution result failed:', execRes.status);
          data = orgResult.data;
          status = orgResult.status;
        }
      } else {
        data = orgResult.data;
        status = orgResult.status;
      }
    } else {
      // Step 1: If we have a token, use it directly. Otherwise, lookup first to get one.
      let token = organizationToken;

      if (!token) {
        const regNumber = abn || acn;
        const lookupResult = await lookupOrganizations('AUS', companyName, regNumber);
        console.log('[Ownership] Lookup status:', lookupResult.status);

        if (lookupResult.status !== 200) {
          return NextResponse.json(
            { error: lookupResult.data?.errorMsg || 'Business lookup failed' },
            { status: lookupResult.status }
          );
        }

        const matched = lookupResult.data?.matchedOrganizations || [];
        if (matched.length === 0) {
          return NextResponse.json(
            { error: 'No matching business found' },
            { status: 404 }
          );
        }

        token = matched[0].organizationToken;
      }

      // Step 2: Execute KYB workflow — don't pass serviceName, let API default
      const result = await executeOrganizationWorkflow({
        organizationToken: token,
        workflowName: DEFAULT_KYB_WORKFLOW,
      });
      data = result.data;
      status = result.status;

      console.log('[Ownership] Workflow status:', status, 'Keys:', JSON.stringify(Object.keys(data || {})));
      // If org is missing enrichment data, check workflowStepResults supplementaryData
      const _org = data?.organization || {};
      const hasShareholders = (_org.shareholders?.length || 0) > 0;
      const hasOfficials = (_org.officials?.length || 0) > 0;
      if (!hasShareholders && !hasOfficials) {
        const stepResults: any[] = data?.workflowResult?.workflowStepResults || [];
        for (const step of stepResults) {
          const prs: any[] = step.processResults || [];
          for (const pr of prs) {
            if (pr.stepType === 'ORGANIZATION_OWNERSHIP' && pr.supplementaryData?.organization) {
              const enrichedOrg = pr.supplementaryData.organization;
              console.log('[Ownership] Found enrichment in supplementaryData, merging...');
              console.log('[Ownership] Enriched keys:', JSON.stringify(Object.keys(enrichedOrg)));
              // Merge enrichment data into the organization object
              data.organization = { ..._org, ...enrichedOrg };
              break;
            }
          }
        }
      }
    }

    if (status === 408) {
      return NextResponse.json(
        { error: data?.errorMsg || 'Ownership query timed out. Please try again.' },
        { status: 408 }
      );
    }

    if (status !== 200 && status !== 201 && status !== 202) {
      return NextResponse.json(
        { error: data?.errorMsg || data?.errorCode || 'Ownership query failed' },
        { status }
      );
    }

    // ─── Parse v2 workflow response ───
    const org = data?.organization || {};
    const details = org.details || {};
    const regDetails: any[] = details.registrationDetails || [];

    // Build lookup maps for linked entities (names live here, not on officials/shareholders)
    const linkedIndividuals: Record<string, any> = org.linkedIndividuals || {};
    const linkedOrganizations: Record<string, any> = org.linkedOrganizations || {};

    // Helper: resolve name for an entity by its entityId
    function resolveName(entityId: string, entityType?: string): string {
      if (entityType === 'ORGANIZATION' || entityType === 'ORGANISATION') {
        const linked = linkedOrganizations[entityId];
        if (linked) {
          return linked.details?.name?.name || linked.details?.name?.registeredName || linked.name || '';
        }
      }
      const linked = linkedIndividuals[entityId];
      if (linked) {
        return linked.name?.displayName ||
          [linked.name?.givenName, linked.name?.middleName, linked.name?.familyName].filter(Boolean).join(' ') ||
          '';
      }
      return '';
    }

    // Helper: resolve addresses for a linked individual
    function resolveAddresses(entityId: string): AustralianOfficeholder['addresses'] {
      const linked = linkedIndividuals[entityId] || linkedOrganizations[entityId];
      const addrs = linked?.addresses || [];
      if (addrs.length === 0) return undefined;
      return addrs.map((a: any) => ({
        streetName: a.streetName,
        streetNumber: a.streetNumber,
        suburb: a.locality || a.town,
        state: a.subdivision || a.state,
        postalCode: a.postalCode,
        country: a.country,
        longForm: a.longForm || a.unstructuredLongForm,
      }));
    }

    // Extract registration numbers
    const abnEntry = regDetails.find((r: any) =>
      (r.registrationNumberType || r.type || '').toUpperCase() === 'ABN'
    );
    const acnEntry = regDetails.find((r: any) =>
      (r.registrationNumberType || r.type || '').toUpperCase() === 'ACN'
    );

    // Extract officials (directors + officers) — resolve names from linkedIndividuals
    const officials: any[] = org.officials || [];
    const officeholders: AustralianOfficeholder[] = officials.map((o: any) => {
      const name = resolveName(o.entityId, o.entityType);
      const roleStr = typeof o.role === 'string' ? o.role : (o.role?.description || o.role?.code || '');

      return {
        name,
        dateOfBirth: o.appointmentDate?.normalized,
        role: roleStr,
        entityId: o.entityId,
        addresses: resolveAddresses(o.entityId),
      };
    });

    // Extract shareholders — resolve names and compute ownership
    const shareholdersList: any[] = org.shareholders || [];
    const otherOwners: any[] = org.otherOwners || [];
    const rootShareCapital = org.shareCapital?.totalShareCount || 0;

    // Build ownership percentage map from otherOwners
    const ownershipMap: Record<string, { beneficially: number; nonBeneficially: number; total: number }> = {};
    for (const oo of otherOwners) {
      if (oo.entityId && oo.percentageOwned) {
        ownershipMap[oo.entityId] = oo.percentageOwned;
      }
    }

    // For shareholders not in otherOwners, calculate % from their totalShares
    for (const s of shareholdersList) {
      if (!ownershipMap[s.entityId] && s.totalShares && rootShareCapital > 0) {
        const pct = Math.round((s.totalShares / rootShareCapital) * 1000) / 10;
        ownershipMap[s.entityId] = { beneficially: pct, nonBeneficially: 0, total: pct };
      }
    }

    // Build joint holder group map from shareInterests
    const jointHolderGroupMap: Record<string, string> = {};
    const shareInterests: any[] = org.shareInterests || [];
    let jointGroupIdx = 0;
    for (const si of shareInterests) {
      if (si.isJointlyHeld) {
        const members: any[] = si.members || [];
        if (members.length >= 2) {
          const groupId = `joint-${jointGroupIdx++}`;
          for (const m of members) {
            if (m.entityId) jointHolderGroupMap[m.entityId] = groupId;
          }
        }
      }
    }

    // UBOs: individuals from shareholders + otherOwners with beneficial ownership
    const uboEntityIds = new Set<string>();
    const ubos: AustralianOfficeholder[] = [];

    // Check shareholders that are individuals
    for (const s of shareholdersList) {
      if (s.entityType === 'INDIVIDUAL') {
        const name = resolveName(s.entityId, s.entityType);
        const pct = ownershipMap[s.entityId];
        uboEntityIds.add(s.entityId);
        ubos.push({
          name,
          role: 'UBO',
          entityId: s.entityId,
          addresses: resolveAddresses(s.entityId),
          percentOwned: pct?.total || pct?.beneficially,
        });
      }
    }

    // Also check ultimateBeneficialOwners if present
    const uboList: any[] = org.ultimateBeneficialOwners || [];
    for (const u of uboList) {
      if (!uboEntityIds.has(u.entityId)) {
        const name = resolveName(u.entityId, u.entityType);
        const pct = u.percentageOwned || ownershipMap[u.entityId];
        ubos.push({
          name,
          role: 'UBO',
          entityId: u.entityId,
          addresses: resolveAddresses(u.entityId),
          percentOwned: pct?.total || pct?.beneficially || u.ownershipPercentage,
        });
      }
    }

    // Extract blocking entities — v2 returns a map keyed by entityId
    const blockingEntityMap: Record<string, any> = org.blockingEntities || {};
    const blockingEntities: BlockingEntity[] = Object.values(blockingEntityMap)
      .filter((e: any) => (e.entityType || '').toUpperCase() !== 'INDIVIDUAL')
      .map((e: any) => {
        const entityName = resolveName(e.entityId, e.entityType) || 'Entity';
        const linkedOrg = linkedOrganizations[e.entityId];
        const eRegDetails: any[] = linkedOrg?.details?.registrationDetails || [];
        const eAbn = eRegDetails.find((r: any) => (r.registrationNumberType || '').toUpperCase() === 'ABN');
        const eAcn = eRegDetails.find((r: any) => (r.registrationNumberType || '').toUpperCase() === 'ACN');
        const eAddr = linkedOrg?.addresses?.[0];

        const reasons = (e.blockingReasons || e.reasons || []).map((r: any) => ({
          type: r.type || '',
          description: (r.description || '')
            .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '')
            .replace(/\s*from\s*\[\s*\]\s*/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim(),
        }));

        // Attach UBOs that belong to this blocking entity
        // Check ultimateBeneficialOwners for entries with ownerEntityId matching this blocking entity
        const beUbos = uboList
          .filter((u: any) => u.ownerEntityId === e.entityId)
          .map((u: any) => {
            const uName = resolveName(u.entityId, u.entityType);
            const uPct = u.percentageOwned || ownershipMap[u.entityId];
            return {
              name: uName,
              role: 'UBO',
              entityId: u.entityId,
              addresses: resolveAddresses(u.entityId),
              percentOwned: uPct?.total || uPct?.beneficially || u.ownershipPercentage,
            };
          });

        return {
          entityId: e.entityId || '',
          name: entityName,
          entityType: e.entityType || 'ORGANISATION',
          abn: eAbn?.registrationNumber,
          acn: eAcn?.registrationNumber,
          address: eAddr?.longForm || eAddr?.unstructuredLongForm,
          percentageOwned: e.percentageOwned || { total: 0 },
          reasons,
          registrationDate: linkedOrg?.details?.registrationDate,
          status: linkedOrg?.details?.status,
          ubos: beUbos.length > 0 ? beUbos : undefined,
        };
      });

    // Build full shareholders list (individuals + organisations) for ownership tree
    const blockingEntityIds = new Set(Object.keys(blockingEntityMap));
    const officialRolesMap: Record<string, string[]> = {};
    for (const o of officials) {
      const roleStr = typeof o.role === 'string' ? o.role : (o.role?.description || o.role?.code || '');
      if (o.entityId && roleStr) {
        if (!officialRolesMap[o.entityId]) officialRolesMap[o.entityId] = [];
        officialRolesMap[o.entityId].push(roleStr);
      }
    }

    // ─── Build multi-level children from linkedOrganizations ───
    // For each org shareholder, linkedOrganizations[entityId] contains its own
    // .shareholders and .officials — these are the org's children in the tree.
    // We also support ultimateBeneficialOwners[].ownerEntityId as a fallback.

    // Recursively build children for an org entity from its linkedOrganizations entry
    const visitedOrgs = new Set<string>(); // prevent infinite loops
    function buildChildrenForOrg(orgEntityId: string): OwnershipShareholder[] {
      if (visitedOrgs.has(orgEntityId)) return [];
      visitedOrgs.add(orgEntityId);

      const linkedOrg = linkedOrganizations[orgEntityId];
      if (!linkedOrg) return [];

      const orgShareholders: any[] = linkedOrg.shareholders || [];
      const orgOfficials: any[] = linkedOrg.officials || [];
      const orgShareCapital = linkedOrg.shareCapital?.totalShareCount || 0;

      // Deduplicate: merge shareholders and officials by entityId
      const childMap = new Map<string, OwnershipShareholder>();

      for (const s of orgShareholders) {
        const isOrg = s.entityType === 'ORGANIZATION' || s.entityType === 'ORGANISATION';
        const name = resolveName(s.entityId, s.entityType);
        // Calculate ownership % within this org based on shares
        const shares = s.totalShares || 0;
        const pctOfOrg = orgShareCapital > 0 ? Math.round((shares / orgShareCapital) * 1000) / 10 : undefined;
        // Also check if otherOwners has an effective % for this entity
        const effectivePct = ownershipMap[s.entityId];

        const child: OwnershipShareholder = {
          entityId: s.entityId,
          name,
          entityType: isOrg ? 'ORGANIZATION' as const : 'INDIVIDUAL' as const,
          percentOwned: effectivePct?.total ?? pctOfOrg,
          percentBeneficially: effectivePct?.beneficially,
          percentNonBeneficially: effectivePct?.nonBeneficially,
          isBlocking: blockingEntityIds.has(s.entityId),
          roles: [],
        };

        // Recurse if this child is itself an org
        if (isOrg) {
          const grandchildren = buildChildrenForOrg(s.entityId);
          if (grandchildren.length > 0) child.children = grandchildren;
        }

        childMap.set(s.entityId, child);
      }

      // Add roles from officials
      for (const o of orgOfficials) {
        const roleStr = typeof o.role === 'string' ? o.role : (o.role?.description || o.role?.code || '');
        const existing = childMap.get(o.entityId);
        if (existing) {
          if (roleStr && !existing.roles?.includes(roleStr)) {
            existing.roles = [...(existing.roles || []), roleStr];
          }
        } else {
          // Official who isn't a shareholder — still a child of the org
          const name = resolveName(o.entityId, o.entityType);
          const isOrg = o.entityType === 'ORGANIZATION' || o.entityType === 'ORGANISATION';
          childMap.set(o.entityId, {
            entityId: o.entityId,
            name,
            entityType: isOrg ? 'ORGANIZATION' as const : 'INDIVIDUAL' as const,
            isBlocking: false,
            roles: roleStr ? [roleStr] : [],
          });
        }
      }

      return Array.from(childMap.values());
    }

    // Also gather children from ultimateBeneficialOwners[].ownerEntityId (if present)
    const uboChildrenByOwner: Record<string, OwnershipShareholder[]> = {};
    for (const u of uboList) {
      if (u.ownerEntityId) {
        if (!uboChildrenByOwner[u.ownerEntityId]) uboChildrenByOwner[u.ownerEntityId] = [];
        const uName = resolveName(u.entityId, u.entityType);
        const uPct = u.percentageOwned || ownershipMap[u.entityId];
        const isOrg = u.entityType === 'ORGANIZATION' || u.entityType === 'ORGANISATION';
        uboChildrenByOwner[u.ownerEntityId].push({
          entityId: u.entityId,
          name: uName,
          entityType: isOrg ? 'ORGANIZATION' as const : 'INDIVIDUAL' as const,
          percentOwned: uPct?.total || uPct?.beneficially || u.ownershipPercentage,
          percentBeneficially: uPct?.beneficially,
          percentNonBeneficially: uPct?.nonBeneficially,
          isBlocking: false,
          roles: officialRolesMap[u.entityId] || ['UBO'],
        });
      }
    }

    // Build the shareholders list with children attached
    const allShareholders: OwnershipShareholder[] = shareholdersList.map((s: any) => {
      const name = resolveName(s.entityId, s.entityType);
      const pct = ownershipMap[s.entityId] || blockingEntityMap[s.entityId]?.percentageOwned;
      const isOrg = s.entityType === 'ORGANIZATION' || s.entityType === 'ORGANISATION';
      const sh: OwnershipShareholder = {
        entityId: s.entityId,
        name,
        entityType: isOrg ? 'ORGANIZATION' as const : 'INDIVIDUAL' as const,
        percentOwned: pct?.total || pct?.beneficially,
        percentBeneficially: pct?.beneficially,
        percentNonBeneficially: pct?.nonBeneficially,
        isBlocking: blockingEntityIds.has(s.entityId),
        roles: officialRolesMap[s.entityId] || [],
        ...(jointHolderGroupMap[s.entityId] ? { jointHolderGroup: jointHolderGroupMap[s.entityId] } : {}),
      };

      // Attach children for org shareholders
      if (isOrg) {
        // Primary source: linkedOrganizations[entityId].shareholders/.officials
        const linkedChildren = buildChildrenForOrg(s.entityId);
        // Secondary source: UBOs with ownerEntityId pointing here
        const uboChildren = uboChildrenByOwner[s.entityId] || [];

        // Merge: linkedChildren take priority, add any uboChildren not already present
        const childIds = new Set(linkedChildren.map(c => c.entityId));
        const merged = [...linkedChildren];
        for (const uc of uboChildren) {
          if (!childIds.has(uc.entityId)) merged.push(uc);
        }
        if (merged.length > 0) sh.children = merged;
      }

      return sh;
    });

    // Also include blocking entities that might not be in shareholders list
    for (const be of blockingEntities) {
      if (!allShareholders.some((s) => s.entityId === be.entityId)) {
        const sh: OwnershipShareholder = {
          entityId: be.entityId,
          name: be.name,
          entityType: 'ORGANIZATION',
          percentOwned: be.percentageOwned?.total,
          percentBeneficially: be.percentageOwned?.beneficially,
          percentNonBeneficially: be.percentageOwned?.nonBeneficially,
          isBlocking: true,
          roles: [],
        };
        const linkedChildren = buildChildrenForOrg(be.entityId);
        const uboChildren = uboChildrenByOwner[be.entityId] || [];
        const childIds = new Set(linkedChildren.map(c => c.entityId));
        const merged = [...linkedChildren];
        for (const uc of uboChildren) {
          if (!childIds.has(uc.entityId)) merged.push(uc);
        }
        if (merged.length > 0) sh.children = merged;
        allShareholders.push(sh);
      }
    }

    // Resolve manually-added entities: fetch relationships for child orgs
    // and nest any entities that were manually associated but aren't in the tree yet
    const childOrgShareholders = allShareholders.filter(
      sh => sh.entityType === 'ORGANIZATION' && sh.entityId !== org.entityId
    );
    const allKnownIds = new Set<string>();
    function collectIds(items: OwnershipShareholder[]) {
      for (const s of items) {
        allKnownIds.add(s.entityId);
        if (s.children) collectIds(s.children);
      }
    }
    collectIds(allShareholders);

    if (childOrgShareholders.length > 0) {
      await Promise.all(
        childOrgShareholders.map(async (childOrg) => {
          try {
            const relResult = await getOrganizationRelationships(childOrg.entityId);
            if (relResult.status === 200 && relResult.data?.entityRelationships) {
              const rels: any[] = relResult.data.entityRelationships;
              for (const rel of rels) {
                const eid = rel.entity?.entityId;
                if (!eid || allKnownIds.has(eid)) continue;
                allKnownIds.add(eid);

                const roles = (rel.relationships || []).map((r: any) =>
                  r.role?.description || r.role?.code || 'Associated'
                );
                const entType = rel.entity?.entityType || 'INDIVIDUAL';
                const name = resolveName(eid, entType) ||
                  (linkedIndividuals[eid]?.name?.displayName) ||
                  `Entity ${eid.slice(0, 8)}`;

                if (!childOrg.children) childOrg.children = [];
                childOrg.children.push({
                  entityId: eid,
                  name,
                  entityType: entType === 'ORGANIZATION' || entType === 'ORGANISATION' ? 'ORGANIZATION' : 'INDIVIDUAL',
                  isBlocking: false,
                  roles,
                });
              }
            }
          } catch {
            // Skip on error
          }
        })
      );
    }

    // Build business details
    const registeredName = details.name?.name ||
      details.name?.registeredName ||
      details.name?.displayName || '';

    /* eslint-enable @typescript-eslint/no-explicit-any */

    const result: AustralianOwnershipResponse = {
      businessDetails: {
        ABN: abnEntry?.registrationNumber || abn,
        ACN: acnEntry?.registrationNumber || acn,
        registeredName,
        entityId: org.entityId,
        asicCompanyType: details.legalForm || org.legalForm,
        dateRegistered: details.registrationDate || org.registrationDate,
      },
      officeholders,
      ubos,
      shareholders: allShareholders,
      blockingEntities,
      requestId: data?.requestId,
      entityId: org.entityId,
      isAsync: false,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Ownership query error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
