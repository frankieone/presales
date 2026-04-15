import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { generateHostedOnboardingUrl, getMissingCredentials } from '@/lib/frankieone';
import { createSession } from '@/lib/sessions';

export async function POST(_req: NextRequest) {
  try {
    const missing = getMissingCredentials();
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: 'missing_credentials',
          missing,
          message: `FrankieOne API credentials are not configured. Missing: ${missing.join(', ')}`,
        },
        { status: 503 }
      );
    }

    const result = await generateHostedOnboardingUrl({
      flowId: 'idv',
    });

    if (result.status !== 200 && result.status !== 201) {
      console.error('[Generate Link] FrankieOne error:', result.data);
      return NextResponse.json(
        { error: result.data?.errorMsg || 'Failed to generate onboarding URL' },
        { status: result.status }
      );
    }

    const sessionId = uuidv4();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4568';

    createSession({
      id: sessionId,
      hostedUrl: result.data.url,
      urlExpiry: result.data.urlExpiry,
      entityId: result.data.entityId,
      createdAt: new Date().toISOString(),
      status: 'pending',
    });

    return NextResponse.json({
      sessionId,
      customerLink: `${baseUrl}/verify/${sessionId}`,
      hostedUrl: result.data.url,
      urlExpiry: result.data.urlExpiry,
      entityId: result.data.entityId,
    });
  } catch (error) {
    console.error('Generate link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
