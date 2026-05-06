import fs from 'fs';
import path from 'path';

const entityId = '388800d4-53a3-4503-a4da-55dcba54f5b1';
const base = process.env.FRANKIE_API_BASE_URL || 'https://api.uat.frankie.one';
const outDir = path.join('entity-attachments', entityId);
fs.mkdirSync(outDir, { recursive: true });

const headers = {
  'Content-Type': 'application/json',
  'api_key': process.env.FRANKIE_API_KEY,
  'X-Frankie-CustomerID': process.env.FRANKIE_CUSTOMER_ID,
};
if (process.env.FRANKIE_CUSTOMER_CHILD_ID) {
  headers['X-Frankie-CustomerChildID'] = process.env.FRANKIE_CUSTOMER_CHILD_ID;
}

// Step 1: Get all documents for the entity
console.log('Fetching document list for entity:', entityId);
const listRes = await fetch(`${base}/v2/individuals/${entityId}/documents`, { headers });
if (listRes.status !== 200) {
  console.error('Failed to list documents:', listRes.status, await listRes.text());
  process.exit(1);
}
const docList = await listRes.json();

// Collect all document IDs with their types
const docs = [];
for (const [category, items] of Object.entries(docList)) {
  if (Array.isArray(items)) {
    for (const item of items) {
      if (item.documentId && item.attachments?.length > 0) {
        docs.push({ category, type: item.type, documentId: item.documentId });
      }
    }
  }
}
console.log(`Found ${docs.length} document(s) with attachments\n`);

// Step 2: Fetch each document with level=base64 and save attachments
let total = 0;
for (const doc of docs) {
  console.log(`[${doc.category}] ${doc.type} (${doc.documentId})`);
  const url = `${base}/v2/individuals/${entityId}/documents/${doc.documentId}?level=base64`;
  const res = await fetch(url, { headers });

  if (res.status !== 200) {
    console.log(`  ERROR: HTTP ${res.status} — ${await res.text()}`);
    continue;
  }

  const data = await res.json();
  const attachments = data.attachments || [];
  console.log(`  ${attachments.length} attachment(s)`);

  for (const att of attachments) {
    if (!att.data) {
      console.log(`  SKIP: ${att.filename || att.attachmentId} — no data`);
      continue;
    }

    // Handle data as string (base64 or data URI) or object { base64: "..." }
    let b64 = typeof att.data === 'string' ? att.data : (att.data.base64 || '');
    b64 = b64.replace(/^data:[^;]+;base64,/, '');

    if (!b64) {
      console.log(`  SKIP: ${att.filename || att.attachmentId} — empty data`);
      continue;
    }

    const safeName = (att.filename || `${att.attachmentId}.jpg`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const outFile = `${doc.type}_${att.side || 'unknown'}_${safeName}`;
    const outPath = path.join(outDir, outFile);

    fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
    const size = fs.statSync(outPath).size;
    console.log(`  SAVED: ${outFile} (${size} bytes)`);
    total++;
  }
}

console.log(`\nDone! Downloaded ${total} file(s) to ${outDir}/`);
