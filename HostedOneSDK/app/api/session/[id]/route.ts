import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/sessions';
import { updateEntityCustomAttributes } from '@/lib/frankieone';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(id);

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: session.id,
    hostedUrl: session.hostedUrl,
    urlExpiry: session.urlExpiry,
    status: session.status,
    entityId: session.entityId,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const updates: Partial<typeof session> & Record<string, unknown> = {};

  if (body.preAnswers) {
    updates.preAnswers = body.preAnswers;
    updates.status = 'pre_complete';

    // Send custom risk attributes to FrankieOne
    if (session.entityId) {
      const riskAttributes: Record<string, string> = {};
      if (body.preAnswers.occupation) riskAttributes.occupation = body.preAnswers.occupation;
      if (body.preAnswers.citizenship) riskAttributes.visa_status = body.preAnswers.citizenship;
      if (body.preAnswers.source_of_funds) riskAttributes.source_of_funds = body.preAnswers.source_of_funds;

      if (Object.keys(riskAttributes).length > 0) {
        const result = await updateEntityCustomAttributes(session.entityId, riskAttributes);
        if (result.status !== 200) {
          console.error('[Session PATCH] Failed to update custom attributes:', result.data);
        }
      }
    }
  }
  if (body.postAnswers) {
    updates.postAnswers = body.postAnswers;
    updates.status = 'complete';
  }
  if (body.status) {
    updates.status = body.status;
  }

  const updated = updateSession(id, updates);
  return NextResponse.json(updated);
}
