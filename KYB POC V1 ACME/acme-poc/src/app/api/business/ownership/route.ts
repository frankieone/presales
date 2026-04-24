import { NextRequest, NextResponse } from 'next/server';
import { queryAustralianOwnership, getParentAssociations } from '@/lib/frankieone';
import { MOCK_ABN, MOCK_ACN, MOCK_OWNERSHIP_RESPONSE } from '@/lib/mock-ownership';
import type { AustralianOwnershipResponse, AustralianOfficeholder, BlockingEntity } from '@/types/business';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { acn, abn, companyName } = body;

    console.log('[Ownership] Request body:', JSON.stringify({ acn, abn, companyName }));

    if (!acn && !abn && !companyName) {
      return NextResponse.json({ error: 'ACN, ABN, or business name is required' }, { status: 400 });
    }

    // Mock fixture for WOMBAT HOLDINGS PTY LTD (trust blocking entity demo)
    const isMock = abn === MOCK_ABN || acn === MOCK_ACN;

    let data: Record<string, unknown>;
    let status: number;

    if (isMock) {
      data = MOCK_OWNERSHIP_RESPONSE as unknown as Record<string, unknown>;
      status = 200;
    } else {
      const result = await queryAustralianOwnership(acn, abn, companyName);
      data = result.data;
      status = result.status;
    }

    if (status === 408) {
      return NextResponse.json(
        { error: data?.errorMsg || 'Ownership query timed out. Please try again.' },
        { status: 408 }
      );
    }

    if (status !== 200) {
      return NextResponse.json(
        { error: data?.errorMsg || 'Ownership query failed' },
        { status }
      );
    }

    const uboResponse = data?.uboResponse as Record<string, unknown> | undefined;

    const ownershipQueryResult = data?.ownershipQueryResult as Record<string, unknown> | undefined;

    const officeholders: AustralianOfficeholder[] = ((uboResponse?.officeholders ?? []) as Record<string, unknown>[]).map(
      (oh) => ({
        name: oh.name as string || '',
        dateOfBirth: oh.date_of_birth as string,
        role: oh.role as string,
        entityId: oh.entityId as string,
        addresses: oh.addresses as AustralianOfficeholder['addresses'],
        percentOwned: oh.percent_owned as number,
      })
    );

    const ubos: AustralianOfficeholder[] = ((uboResponse?.ultimate_beneficial_owners ?? []) as Record<string, unknown>[]).map(
      (ubo) => ({
        name: ubo.name as string || '',
        dateOfBirth: ubo.date_of_birth as string,
        role: ubo.role as string,
        entityId: ubo.entityId as string,
        addresses: ubo.addresses as AustralianOfficeholder['addresses'],
        percentOwned: ubo.percent_owned as number,
      })
    );

    // Extract blocking entities
    const ownershipResult = data?.ownershipQueryResult as Record<string, unknown> | undefined;
    const blockingEntityIds: string[] = (ownershipResult?.blockingEntityIds as string[]) || [];
    const blockingEntityDetails = (ownershipResult?.blockingEntityDetails || {}) as Record<string, Record<string, unknown>>;
    const associatedEntities = (ownershipResult?.associatedEntities || {}) as Record<string, Record<string, unknown>>;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const blockingEntities: BlockingEntity[] = blockingEntityIds.map((id: string) => {
      const details: any = blockingEntityDetails[id] || {};
      const associated: any = associatedEntities[id] || {};
      const orgData: any = associated.organisationData || {};
      const personalData: any = associated.name || {};
      const extraData: Array<{ kvpKey: string; kvpValue: string }> = associated.extraData || [];

      const abnEntry = extraData.find((e) => e.kvpKey === 'ABN');
      const acnEntry = extraData.find((e) => e.kvpKey === 'ACN');

      const addresses: any[] = associated.addresses || orgData.addresses || [];
      const firstAddr = addresses[0];
      const addressStr = firstAddr?.longForm || firstAddr?.addressInOneLine || undefined;

      // Resolve name: try org name first, then individual name fields
      const individualName = [personalData.givenName, personalData.middleName, personalData.familyName]
        .filter(Boolean)
        .join(' ');
      const entityName =
        orgData.registeredName ||
        orgData.name?.displayName ||
        personalData.displayName ||
        individualName ||
        associated.displayName ||
        details.name ||
        'Entity';

      // Clean up reason descriptions: strip raw entity IDs (UUIDs and bracket notation)
      const reasons = ((details.reasons || []) as Array<{ type: string; description: string }>).map((r) => {
        let desc = r.description || '';
        // Remove UUIDs
        desc = desc.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '').trim();
        // Remove leftover bracket references like "from [] due to" → "due to"
        desc = desc.replace(/\s*from\s*\[\s*\]\s*/g, ' ');
        // Remove "Individual  is blocking" → "Blocking"
        desc = desc.replace(/Individual\s+is blocking/i, 'Blocking');
        // Clean up extra whitespace
        desc = desc.replace(/\s{2,}/g, ' ').trim();
        return { type: r.type || '', description: desc };
      });

      return {
        entityId: id,
        name: entityName,
        entityType: (details.entityType as string) || 'ORGANISATION',
        abn: abnEntry?.kvpValue,
        acn: acnEntry?.kvpValue,
        address: addressStr,
        percentageOwned: details.percentageOwned || { total: 0 },
        reasons,
        registrationDate: orgData.dateRegistered,
        status: orgData.status,
      };
    }).filter((e) => e.entityType !== 'INDIVIDUAL');
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const businessDetails = uboResponse?.business_details as Record<string, unknown> | undefined;

    // Build shareholders list for the ownership tree
    // v1.2 data sources:
    //   associatedEntities: flat map of ALL entities (orgs + individuals) keyed by entityId
    //   otherOwners: object keyed by entityId with { percentageHeld: { beneficially, nonBeneficially, total } }
    //   ownershipDetails: object keyed by child-org entityId with { officers: [...], organisation: {...} }
    //     — this tells us which individuals are officers/shareholders of which child org

    const blockingIdSet = new Set(blockingEntityIds);
    const otherOwnersMap = (ownershipResult?.otherOwners || {}) as Record<string, any>;
    const ownershipDetailsMap = (ownershipResult?.ownershipDetails || {}) as Record<string, any>;
    const rootEntityId = ownershipResult?.entityId as string;

    // UBO lookup
    const uboMap = new Map<string, AustralianOfficeholder>();
    for (const ubo of ubos) {
      if (ubo.entityId) uboMap.set(ubo.entityId, ubo);
    }

    // Build a set of entity IDs that are children of a child org (via ownershipDetails.officers)
    // so we can attach them as children rather than as top-level shareholders
    const childOfOrg = new Map<string, string>(); // entityId -> parent org entityId
    for (const [orgId, details] of Object.entries(ownershipDetailsMap)) {
      const det = details as any;
      const officers: any[] = det.officers || [];
      for (const off of officers) {
        if (off.entityId && off.entityId !== orgId) {
          childOfOrg.set(off.entityId, orgId);
        }
      }
    }

    // Helper: resolve name from associatedEntities
    function resolveName(entityId: string): string {
      const assoc = associatedEntities[entityId] as any;
      if (!assoc) return 'Unknown';
      const orgData = assoc.organisationData || {};
      const personalData = assoc.name || {};
      const individualName = [personalData.givenName, personalData.middleName, personalData.familyName]
        .filter(Boolean)
        .join(' ');
      return orgData.registeredName || orgData.name?.displayName || personalData.displayName || individualName || assoc.displayName || 'Entity';
    }

    // Helper: get percentage for an entity
    function getPct(entityId: string) {
      const oo = otherOwnersMap[entityId];
      if (oo?.percentageHeld) {
        return {
          total: oo.percentageHeld.total,
          beneficially: oo.percentageHeld.beneficially,
          nonBeneficially: oo.percentageHeld.nonBeneficially,
        };
      }
      // Fallback to blocking details
      const bd = (blockingEntityDetails[entityId] || {}) as any;
      if (bd.percentageOwned) return bd.percentageOwned;
      // Fallback to UBO
      const ubo = uboMap.get(entityId);
      if (ubo?.percentOwned != null) return { total: ubo.percentOwned, beneficially: ubo.percentOwned };
      return {};
    }

    // Helper: get roles for an entity
    function getRoles(entityId: string): string[] {
      const roles: string[] = [];
      const ubo = uboMap.get(entityId);
      if (ubo) roles.push(ubo.role || 'UBO');
      for (const oh of officeholders) {
        if (oh.entityId === entityId && oh.role && !roles.includes(oh.role)) {
          roles.push(oh.role);
        }
      }
      return roles;
    }

    // Helper: build children for a child org from ownershipDetails
    function buildChildrenForOrg(orgEntityId: string): import('@/types/business').OwnershipShareholder[] {
      const det = ownershipDetailsMap[orgEntityId] as any;
      if (!det) return [];
      const officers: any[] = det.officers || [];
      const children: import('@/types/business').OwnershipShareholder[] = [];
      const seenIds = new Set<string>();

      for (const off of officers) {
        if (!off.entityId || seenIds.has(off.entityId)) continue;
        seenIds.add(off.entityId);

        const assoc = associatedEntities[off.entityId] as any;
        const isOrg = assoc?.entityType === 'ORGANISATION' || assoc?.entityType === 'ORGANIZATION';
        const name = resolveName(off.entityId);
        const pct = getPct(off.entityId);
        const roles = getRoles(off.entityId);
        if (off.type) roles.push(off.typeDescription || off.type);

        const child: import('@/types/business').OwnershipShareholder = {
          entityId: off.entityId,
          name,
          entityType: isOrg ? 'ORGANIZATION' : 'INDIVIDUAL',
          percentOwned: pct.total,
          percentBeneficially: pct.beneficially,
          percentNonBeneficially: pct.nonBeneficially,
          isBlocking: blockingIdSet.has(off.entityId),
          roles: [...new Set(roles)],
        };

        // Recurse for nested orgs
        if (isOrg) {
          const grandchildren = buildChildrenForOrg(off.entityId);
          if (grandchildren.length > 0) child.children = grandchildren;
        }

        children.push(child);
      }
      return children;
    }

    // Build top-level shareholders: entities that are NOT children of a child org
    const shareholders: import('@/types/business').OwnershipShareholder[] = [];
    const addedShareholderIds = new Set<string>();

    for (const [entityId, associated] of Object.entries(associatedEntities)) {
      if (entityId === rootEntityId) continue;
      if (addedShareholderIds.has(entityId)) continue;
      // Skip entities that are children of a child org — they'll be nested
      if (childOfOrg.has(entityId)) continue;
      addedShareholderIds.add(entityId);

      const assoc = associated as any;
      const entityType = assoc.entityType || 'INDIVIDUAL';
      const isOrg = entityType === 'ORGANISATION' || entityType === 'ORGANIZATION';
      const isBlocking = blockingIdSet.has(entityId);
      const name = resolveName(entityId);
      const pct = getPct(entityId);
      const roles = getRoles(entityId);
      if (roles.length === 0) roles.push('Shareholder');

      const sh: import('@/types/business').OwnershipShareholder = {
        entityId,
        name,
        entityType: isOrg ? 'ORGANIZATION' : 'INDIVIDUAL',
        percentOwned: pct.total,
        percentBeneficially: pct.beneficially,
        percentNonBeneficially: pct.nonBeneficially,
        isBlocking,
        roles: [...new Set(roles)],
      };

      // Attach children for org entities
      if (isOrg) {
        const children = buildChildrenForOrg(entityId);
        // Also attach UBOs from blocking entities
        if (isBlocking) {
          const be = blockingEntities.find(b => b.entityId === entityId);
          if (be?.ubos) {
            for (const u of be.ubos) {
              const uid = u.entityId || u.name;
              if (!children.some(c => c.entityId === uid)) {
                children.push({
                  entityId: uid,
                  name: u.name,
                  entityType: 'INDIVIDUAL',
                  percentOwned: u.percentOwned,
                  percentBeneficially: u.percentOwned,
                  roles: [u.role || 'UBO'],
                });
              }
            }
          }
        }
        if (children.length > 0) sh.children = children;
      }

      shareholders.push(sh);
    }

    // Also add UBOs not in associatedEntities
    for (const ubo of ubos) {
      const id = ubo.entityId || ubo.name;
      if (addedShareholderIds.has(id) || childOfOrg.has(id)) continue;
      addedShareholderIds.add(id);

      shareholders.push({
        entityId: id,
        name: ubo.name,
        entityType: 'INDIVIDUAL',
        percentOwned: ubo.percentOwned,
        percentBeneficially: ubo.percentOwned,
        roles: [ubo.role || 'UBO'],
      });
    }

    // Resolve manually-added entities: use parentAssociations to find which child org they belong to
    // Collect child org IDs (orgs that are shareholders of the root)
    const childOrgIds = new Set(
      shareholders
        .filter(sh => sh.entityType === 'ORGANIZATION' && sh.entityId !== rootEntityId)
        .map(sh => sh.entityId)
    );

    // Find "orphan" top-level entities that aren't in ownershipDetails (likely manually added)
    const orphanEntities = shareholders.filter(sh => {
      if (sh.entityType === 'ORGANIZATION') return false; // orgs stay top-level
      if (childOfOrg.has(sh.entityId)) return false; // already nested
      // Check if this entity has percentage data from otherOwners — if so, it's ASIC-sourced
      if (otherOwnersMap[sh.entityId]) return false;
      return true;
    });

    if (orphanEntities.length > 0 && childOrgIds.size > 0) {
      // Call parentAssociations for each orphan to find their true parent
      const moveToChild = new Map<string, string>(); // entityId -> childOrgId
      await Promise.all(
        orphanEntities.map(async (orphan) => {
          try {
            const paResult = await getParentAssociations(orphan.entityId);
            if (paResult.status === 200 && paResult.data?.parentAssociations) {
              for (const pa of paResult.data.parentAssociations) {
                if (pa.entityId === orphan.entityId && pa.associations) {
                  for (const assoc of pa.associations) {
                    if (assoc.parentId && childOrgIds.has(assoc.parentId)) {
                      moveToChild.set(orphan.entityId, assoc.parentId);
                      // Update roles from the association data
                      if (assoc.roleDescriptions?.length) {
                        orphan.roles = [...new Set([...orphan.roles || [], ...assoc.roleDescriptions])];
                      }
                      break;
                    }
                  }
                }
              }
            }
          } catch {
            // Skip on error — entity stays top-level
          }
        })
      );

      // Move orphans from top-level into their parent org's children
      if (moveToChild.size > 0) {
        const movedIds = new Set<string>();
        for (const [entityId, parentOrgId] of moveToChild) {
          const parentSh = shareholders.find(sh => sh.entityId === parentOrgId);
          const childEntity = shareholders.find(sh => sh.entityId === entityId);
          if (parentSh && childEntity) {
            if (!parentSh.children) parentSh.children = [];
            parentSh.children.push(childEntity);
            movedIds.add(entityId);
          }
        }
        // Remove moved entities from top level
        const finalShareholders = shareholders.filter(sh => !movedIds.has(sh.entityId));
        shareholders.length = 0;
        shareholders.push(...finalShareholders);
      }
    }

    const result: AustralianOwnershipResponse = {
      businessDetails: businessDetails
        ? {
            ABN: businessDetails.ABN as string,
            ACN: businessDetails.ACN as string,
            registeredName: businessDetails.registered_name as string,
            entityId: businessDetails.entity_id as string,
            asicCompanyType: businessDetails.asic_company_type as string,
            dateRegistered: businessDetails.date_registered_with_asic as string,
          }
        : undefined,
      officeholders,
      ubos,
      shareholders,
      blockingEntities,
      requestId: data?.requestId as string,
      entityId: ownershipResult?.entityId as string,
      isAsync: false,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Ownership query error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
