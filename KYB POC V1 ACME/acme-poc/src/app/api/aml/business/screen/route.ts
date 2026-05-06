import { NextRequest, NextResponse } from 'next/server';
import { screenBusinessAml, getBusinessCheckResults } from '@/lib/frankieone';
import type { AmlScreeningResult, AmlMatch } from '@/types/aml';

export async function POST(req: NextRequest) {
  try {
    const { entityId, entityName } = await req.json();

    if (!entityId) {
      return NextResponse.json({ error: 'entityId is required' }, { status: 400 });
    }

    // Run AML screening via POST /business/{entityId}/verify (async, polls for result)
    const screenResult = await screenBusinessAml(entityId);
    console.log('[AML Business Route] screenResult status:', screenResult.status, 'data keys:', Object.keys(screenResult.data || {}));

    if (screenResult.status !== 200 && screenResult.status !== 201) {
      return NextResponse.json(
        { error: screenResult.data?.errorMsg || 'Business AML screening failed' },
        { status: screenResult.status }
      );
    }

    // The polled result already contains check data; also fetch via GET for completeness
    let checkData = screenResult.data;
    const getResult = await getBusinessCheckResults(entityId);
    if (getResult.status === 200) {
      checkData = getResult.data;
    }

    const matches = parseAmlMatches(checkData);
    const hasHits = matches.length > 0;

    const result: AmlScreeningResult = {
      entityId,
      entityName: entityName || 'Business',
      entityType: 'business',
      overallResult: hasHits ? 'HIT' : 'CLEAR',
      matches,
      screenedAt: new Date().toISOString(),
      checkId: (checkData as Record<string, unknown>)?.checkSummary
        ? ((checkData as Record<string, unknown>).checkSummary as Record<string, string>)?.checkId
        : undefined,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Business AML screening error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function parseAmlMatches(data: Record<string, unknown>): AmlMatch[] {
  const matches: AmlMatch[] = [];

  // Parse from organisationCheckResult.entityCheckResults (v1.2 business check format)
  // The match details live in entityResult.amlResultSets[]
  const orgCheckResult = (data as any)?.organisationCheckResult?.entityCheckResults as Record<string, any> | undefined;
  if (orgCheckResult) {
    for (const [, ecr] of Object.entries(orgCheckResult)) {
      const amlResultSets = ecr?.entityResult?.amlResultSets as any[] | undefined;
      if (!amlResultSets) continue;

      for (const resultSet of amlResultSets) {
        const groupBcro = resultSet?.groupDetails?.bcro;
        if (!groupBcro) continue;

        const kvp = kvpMap(groupBcro.checkDetails || []);

        // Skip cleared or empty results (no state or no match data)
        const currentState = groupBcro.currentState as string | undefined;
        if (currentState === 'CLEAR') continue;
        if (!currentState && !kvp['aml.search_name.matched'] && !kvp['aml.search_name']) continue;

        const matchedName = kvp['aml.search_name.matched'] || kvp['aml.search_name'] || 'Unknown';
        const searchName = kvp['aml.search_name'] || '';
        const score = parseFloat(kvp['aml.search_result.score'] || kvp['aml.search_fuzziness'] || '0');
        const matchedCountries = (kvp['aml.search_countries.matched'] || '').split(',').filter(Boolean);
        const searchCountries = (kvp['aml.search_countries'] || '').split(',').filter(Boolean);

        // Collect addresses
        const addresses: string[] = [];
        for (let i = 1; i <= 10; i++) {
          const addr = kvp[`address.${i}`];
          if (addr) addresses.push(addr);
        }

        // Parse PEP/Sanctions/Media details from sub-lists
        const pepDetails: AmlMatch['pepDetails'] = [];
        const pepList = resultSet.checkResultsListPEP || [];
        for (const pep of pepList) {
          const pepKvp = kvpMap(pep?.bcro?.checkDetails || []);
          pepDetails.push({
            sourceName: pepKvp['SOURCE.name'],
            amlTypes: pepKvp['SOURCE.aml_types'],
            listingStarted: pepKvp['SOURCE.listing_started'],
            countryCodes: pepKvp['SOURCE.country_codes'],
          });
        }

        // Determine match type from checkDetails
        const requestedCheckType = kvp['requested_check_type'] || '';
        let matchType = inferMatchTypeFromCheckType(requestedCheckType);
        // Refine from PEP details
        if (pepDetails.length > 0) {
          const amlTypes = pepDetails.map(p => p.amlTypes || '').join(',').toLowerCase();
          if (amlTypes.includes('sanction')) matchType = 'SANCTIONS';
          else if (amlTypes.includes('media') || amlTypes.includes('adverse')) matchType = 'MEDIA';
          else if (amlTypes.includes('pep')) matchType = 'PEP';
        }

        matches.push({
          matchId: resultSet.groupDetails?.id || `match-${Date.now()}`,
          processResultId: resultSet.groupDetails?.id || groupBcro.checkId,
          matchedName,
          searchName,
          matchScore: score,
          matchType,
          source: groupBcro.checkPerformedBy || pepList[0]?.bcro?.checkPerformedBy,
          listName: pepDetails[0]?.sourceName || groupBcro.checkSource,
          details: kvp['aml.search_match_details'] || (currentState === 'ACTIVE_HITS' ? 'Active hit — manual review required' : undefined),
          countries: matchedCountries.length > 0 ? matchedCountries : undefined,
          searchCountries: searchCountries.length > 0 ? searchCountries : undefined,
          addresses: addresses.length > 0 ? addresses : undefined,
          currentState,
          confidenceLevel: groupBcro.confidenceLevel,
          pepDetails: pepDetails.length > 0 ? pepDetails : undefined,
          reportUrl: kvp['aml.search_result.report_url'],
          imageUrl: kvp['aml.search_imageurl'],
        });
      }
    }
  }

  return matches;
}

/** Convert a checkDetails KVP array into a simple key→value map */
function kvpMap(details: Array<{ kvpKey: string; kvpValue: string }>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const d of details) {
    if (d.kvpKey && d.kvpValue) map[d.kvpKey] = d.kvpValue;
  }
  return map;
}

function inferMatchTypeFromCheckType(checkType: string): AmlMatch['matchType'] {
  const t = checkType.toUpperCase();
  if (t.includes('SANCTION')) return 'SANCTIONS';
  if (t.includes('MEDIA')) return 'MEDIA';
  if (t.includes('PEP')) return 'PEP';
  return 'UNKNOWN';
}

