import { readFileSync } from 'fs';

const lines = readFileSync('.env.local', 'utf8').split('\n');
const env = {};
for (const line of lines) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const headers = {
  'Content-Type': 'application/json',
  'X-Frankie-CustomerID': env.FRANKIE_CUSTOMER_ID,
  'api_key': env.FRANKIE_API_KEY,
};
if (env.FRANKIE_CUSTOMER_CHILD_ID) {
  headers['X-Frankie-CustomerChildID'] = env.FRANKIE_CUSTOMER_CHILD_ID;
}
const base = env.FRANKIE_API_BASE_URL || 'https://api.uat.frankie.one';

console.log('CustomerID:', env.FRANKIE_CUSTOMER_ID);
console.log('ChildID:', env.FRANKIE_CUSTOMER_CHILD_ID || 'none');

const body = {
  individual: {
    name: { givenName: 'James', middleName: 'A', familyName: 'Testone' },
    dateOfBirth: { year: '1950', month: '01', day: '01' },
    addresses: [{ type: 'RESIDENTIAL', streetNumber: 'U 1/35', streetName: 'Conn', streetType: 'Street', locality: 'Ferntree Gully', subdivision: 'VIC', postalCode: '3156', country: 'AUS' }],
    documents: {
      IDENTITY: [{
        type: 'NATIONAL_HEALTH_ID',
        country: 'AUS',
        primaryIdentifier: '6603984391',
        subtype: 'G',
        subdivision: 'VIC',
        expiryDate: { year: '2030', month: '01', day: '01' },
        supplementaryData: { type: 'NATIONAL_HEALTH_ID', reference: '1', middleNameOnCard: 'A' },
      }],
    },
    consents: [{ type: 'GENERAL' }, { type: 'DOCS' }],
  },
  serviceName: 'KYC',
  workflowName: 'AUS-Basic2V-TwoPlus',
};

// Step 1: Create entity + trigger workflow
const res = await fetch(base + '/v2/individuals', { method: 'POST', headers, body: JSON.stringify(body) });
console.log('\nCreate status:', res.status);
const data = await res.json();

if (data.errorMsg) {
  console.log('Error:', data.errorMsg);
  console.log('Details:', JSON.stringify(data.details, null, 2));
  process.exit(1);
}

const entityId = data.individual?.entityId;
console.log('Entity ID:', entityId);

for (const sp of (data.serviceProfiles || [])) {
  console.log('Service:', sp.serviceName, 'State:', sp.state);
}

// Step 1b: Explicitly execute workflow
console.log('\nExplicitly executing workflow...');
const execRes = await fetch(base + '/v2/individuals/' + entityId + '/serviceprofiles/KYC/workflows/AUS-Basic2V-TwoPlus/execute', {
  method: 'POST', headers, body: JSON.stringify({}),
});
console.log('Execute status:', execRes.status);
const execData = await execRes.json();
console.log('Execute response:', JSON.stringify(execData, null, 2));

// Step 2: Poll for results
console.log('\nWaiting 10s for workflow to complete...');
await new Promise(r => setTimeout(r, 10000));

const res2 = await fetch(base + '/v2/individuals/' + entityId, { headers });
const data2 = await res2.json();

for (const sp of (data2.serviceProfiles || [])) {
  console.log('\nService:', sp.serviceName, 'State:', sp.state);
  const sums = sp.workflowSummaries || [];
  console.log('Workflow summaries:', sums.length);
  for (const ws of sums) {
    console.log('  Workflow:', ws.workflowName);
    console.log('  Execution State:', ws.workflowExecutionState);
    console.log('  Status:', ws.status);
    if (ws.riskAssessment) {
      console.log('  Risk Level:', ws.riskAssessment.riskLevel);
      console.log('  Risk Score:', ws.riskAssessment.riskScore);
    }
    if (ws.issues?.length) {
      console.log('  Issues:', JSON.stringify(ws.issues, null, 2));
    }
  }
}
