import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/sessions';
import {
  createIndividualWithDocument,
  executeWorkflow,
  type AltDocument,
  type PersonalDetails,
} from '@/lib/frankieone';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, personal, document, workflowName } = body as {
      sessionId: string;
      personal: PersonalDetails;
      document: AltDocument;
      workflowName?: string;
    };

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Build custom attributes from pre-answers
    const customAttributes: Record<string, string> = {};
    if (session.preAnswers?.occupation) customAttributes.occupation = session.preAnswers.occupation;
    if (session.preAnswers?.citizenship) customAttributes.visa_status = session.preAnswers.citizenship;
    if (session.preAnswers?.source_of_funds) customAttributes.source_of_funds = session.preAnswers.source_of_funds;

    console.log('[Create Entity] Personal:', JSON.stringify(personal, null, 2));
    console.log('[Create Entity] Document:', JSON.stringify({ ...document, attachmentBase64: document.attachmentBase64 ? `<${document.attachmentBase64.length} chars>` : undefined }, null, 2));
    console.log('[Create Entity] Custom Attributes:', customAttributes);

    // Create individual with document
    const createResult = await createIndividualWithDocument(personal, document, customAttributes);

    console.log('[Create Entity] FrankieOne response status:', createResult.status);
    console.log('[Create Entity] FrankieOne response:', JSON.stringify(createResult.data, null, 2));

    if (createResult.status !== 200 && createResult.status !== 201) {
      console.error('[Create Entity] FrankieOne error:', createResult.data);
      return NextResponse.json(
        { error: createResult.data?.errorMsg || createResult.data?.message || JSON.stringify(createResult.data), detail: createResult.data },
        { status: createResult.status },
      );
    }

    const entityId = createResult.data?.individual?.entityId;

    // Update session with entityId
    updateSession(sessionId, { entityId, status: 'idv_complete' });

    // Execute workflow if specified
    let workflowResult = null;
    if (workflowName && entityId) {
      workflowResult = await executeWorkflow(entityId, workflowName);
      if (workflowResult.status !== 200 && workflowResult.status !== 201) {
        console.error('[Create Entity] Workflow execution error:', workflowResult.data);
      }
    }

    return NextResponse.json({
      entityId,
      workflowResult: workflowResult?.data,
    });
  } catch (error) {
    console.error('Create entity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
