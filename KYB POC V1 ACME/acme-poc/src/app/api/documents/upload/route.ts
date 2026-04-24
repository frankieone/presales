import { NextRequest, NextResponse } from 'next/server';
import { uploadDocumentToEntity } from '@/lib/frankieone';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const entityId = formData.get('entityId') as string;
    const docType = (formData.get('docType') as string) || 'TRUST_DEED';
    const country = (formData.get('country') as string) || 'AUS';
    const file = formData.get('file') as File | null;

    if (!entityId) {
      return NextResponse.json({ error: 'entityId is required' }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    console.log('[DocUpload] entityId:', entityId, 'docType:', docType, 'country:', country, 'file:', file.name, 'size:', file.size);

    const { data, status } = await uploadDocumentToEntity(
      entityId,
      {
        data: base64Data,
        filename: file.name,
        mimeType: file.type || 'application/pdf',
      },
      docType,
      country
    );

    console.log('[DocUpload] FrankieOne response:', status, JSON.stringify(data));

    if (status !== 200 && status !== 201) {
      return NextResponse.json(
        { error: data?.errorMsg || data?.message || JSON.stringify(data) || 'Failed to upload document' },
        { status }
      );
    }

    // Extract documentId from the response
    const documentId =
      data?.entity?.identityDocs?.[0]?.documentId ||
      data?.identityDocs?.[0]?.documentId ||
      data?.documentId ||
      null;

    return NextResponse.json({ success: true, data, documentId });
  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
