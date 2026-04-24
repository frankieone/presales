import { NextRequest, NextResponse } from 'next/server';
import { generateOnboardingUrl } from '@/lib/frankieone';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entityId, givenName, familyName, flowId, phoneNumber, phoneCode, sendSMS } = body;

    if (!flowId || !phoneNumber || !phoneCode) {
      return NextResponse.json(
        { error: 'Flow, phone number, and phone code are required' },
        { status: 400 }
      );
    }

    const recipientName = [givenName, familyName].filter(Boolean).join(' ') || undefined;

    const { data, status } = await generateOnboardingUrl({
      entityId,
      givenName,
      familyName,
      flowId,
      phoneNumber,
      phoneCode,
      sendSMS: sendSMS !== false,
      recipientName,
    });

    if (status !== 200 && status !== 201) {
      return NextResponse.json(
        { error: data?.errorMsg || data?.message || 'Failed to generate onboarding URL' },
        { status }
      );
    }

    return NextResponse.json({
      url: data.url,
      urlExpiry: data.urlExpiry,
      entityId: data.entityId,
      smsSent: sendSMS !== false,
    });
  } catch (error) {
    console.error('Onboarding URL error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
