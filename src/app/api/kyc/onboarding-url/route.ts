import { NextRequest, NextResponse } from 'next/server';
import { generateHostedOnboardingUrl } from '@/lib/frankieone';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entityId, givenName, familyName, country, phoneNumber, phoneCode, sendSMS } = body;

    if (!givenName || !familyName) {
      return NextResponse.json(
        { error: 'Given name and family name are required' },
        { status: 400 }
      );
    }

    const result = await generateHostedOnboardingUrl({
      entityId,
      givenName,
      familyName,
      country,
      flowId: 'idv',
      phoneNumber,
      phoneCode,
      sendSMS,
    });

    console.log('[Onboarding URL] Status:', result.status, 'Response:', JSON.stringify(result.data));

    if (result.status !== 200 && result.status !== 201) {
      return NextResponse.json(
        { error: result.data?.errorMsg || result.data?.message || result.data?.errorCode || 'Failed to generate onboarding URL' },
        { status: result.status }
      );
    }

    return NextResponse.json({
      url: result.data.url,
      urlExpiry: result.data.urlExpiry,
      entityId: result.data.entityId,
    });
  } catch (error) {
    console.error('Onboarding URL generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
