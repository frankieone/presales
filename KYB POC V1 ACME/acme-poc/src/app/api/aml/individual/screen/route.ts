import { NextRequest, NextResponse } from 'next/server';
import { screenIndividualAml, screenExistingIndividualAml } from '@/lib/frankieone';
import type { AmlScreeningResult, AmlMatch } from '@/types/aml';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { individualId, kycEntityId, givenName, middleName, familyName, dateOfBirth, address } = body;

    if (!givenName || !familyName) {
      return NextResponse.json({ error: 'Given name and family name are required' }, { status: 400 });
    }

    let data: Record<string, unknown>;
    let status: number;

    if (kycEntityId) {
      console.log('[AML Individual Screen] Using EXISTING entity:', kycEntityId);
      const result = await screenExistingIndividualAml(kycEntityId);
      data = result.data;
      status = result.status;
    } else {
      console.log('[AML Individual Screen] Creating NEW entity for:', givenName, familyName);
      const result = await screenIndividualAml({
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
        { error: (data as Record<string, string>)?.errorMsg || 'Individual AML screening failed' },
        { status }
      );
    }

    const entityResult = data?.entityResult as Record<string, unknown> | undefined;
    const entity = data?.entity as Record<string, unknown> | undefined;
    const entityId = (entityResult?.entityId as string) || (entity?.entityId as string) || kycEntityId;

    const matches = parseIndividualAmlMatches(data);
    const hasHits = matches.length > 0;

    const fullName = [givenName, middleName, familyName].filter(Boolean).join(' ');

    const result: AmlScreeningResult = {
      entityId: entityId || individualId,
      entityName: fullName,
      entityType: 'individual',
      overallResult: hasHits ? 'HIT' : 'CLEAR',
      matches,
      screenedAt: new Date().toISOString(),
      checkId: (data?.checkSummary as Record<string, unknown>)?.checkId as string,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Individual AML screening error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function parseIndividualAmlMatches(data: Record<string, unknown>): AmlMatch[] {
  const matches: AmlMatch[] = [];

  // Parse from checkResults in entityProfileResult or top-level
  const profileResult = data?.entityProfileResult as Record<string, unknown> | undefined;
  const checkResults = (profileResult?.checkResults as Array<Record<string, unknown>>) || [];

  for (const cr of checkResults) {
    if (cr.name === 'PEP & Sanctions' || cr.name === 'Watchlist AML' || (cr.checkType as string)?.includes('pep')) {
      const resultData = cr.resultData as Record<string, unknown> | undefined;
      const matchList = (resultData?.matchResults as Array<Record<string, unknown>>) || [];
      for (const mr of matchList) {
        matches.push(extractMatch(mr));
      }
    }
  }

  // Try checkSummary matchResults
  const checkSummary = data?.checkSummary as Record<string, unknown> | undefined;
  const summaryMatches = (checkSummary?.matchResults as Array<Record<string, unknown>>) || [];
  for (const mr of summaryMatches) {
    matches.push(extractMatch(mr));
  }

  // Try top-level matchResults
  const topMatchResults = (data?.matchResults as Array<Record<string, unknown>>) || [];
  for (const mr of topMatchResults) {
    matches.push(extractMatch(mr));
  }

  // Fallback: check for match count in resultNotes
  const resultNotes = (checkSummary?.resultNotes as Array<Record<string, string>>) || [];
  const matchCount = parseInt(resultNotes.find(n => n.kvpKey === 'Match.Count')?.kvpValue || '0', 10);
  if (matches.length === 0 && matchCount > 0) {
    matches.push({
      matchId: 'unknown-match',
      matchedName: 'Potential match detected',
      matchScore: 0,
      matchType: 'UNKNOWN',
      details: `${matchCount} potential match(es) found. Check the FrankieOne portal for details.`,
    });
  }

  return matches;
}

function extractMatch(mr: Record<string, unknown>): AmlMatch {
  const matchedEntity = mr.matchedEntity as Record<string, unknown> | undefined;
  const name = matchedEntity?.name as Record<string, string> | undefined;
  const matchedName = name?.displayName || name?.fullName ||
    [name?.givenName, name?.familyName].filter(Boolean).join(' ') ||
    (mr.matchName as string) || 'Unknown';

  const matchType = inferMatchType(mr);
  const positions = ((matchedEntity?.positions as Array<Record<string, string>>) || [])
    .map(p => p.title || p.position).filter(Boolean);
  const countries = ((matchedEntity?.countries as string[]) || []);
  const aliases = ((matchedEntity?.aliases as Array<Record<string, string>>) || [])
    .map(a => a.displayName || a.fullName).filter(Boolean);

  return {
    matchId: (mr.matchId as string) || (mr.resultId as string) || `match-${Date.now()}`,
    processResultId: mr.processResultId as string,
    matchedName,
    matchScore: (mr.matchScore as number) || (mr.score as number) || 0,
    matchType,
    source: (mr.source as string) || (mr.listName as string),
    listName: (mr.listName as string) || (mr.sourceName as string),
    details: mr.details as string,
    positions,
    countries,
    aliases,
  };
}

function inferMatchType(mr: Record<string, unknown>): AmlMatch['matchType'] {
  const type = ((mr.matchType as string) || (mr.category as string) || '').toUpperCase();
  if (type.includes('PEP') || type.includes('POLITICAL')) return 'PEP';
  if (type.includes('SANCTION')) return 'SANCTIONS';
  if (type.includes('MEDIA') || type.includes('ADVERSE')) return 'MEDIA';

  const listName = ((mr.listName as string) || '').toUpperCase();
  if (listName.includes('PEP')) return 'PEP';
  if (listName.includes('SANCTION') || listName.includes('OFAC') || listName.includes('SDN')) return 'SANCTIONS';
  if (listName.includes('MEDIA')) return 'MEDIA';

  return 'UNKNOWN';
}
