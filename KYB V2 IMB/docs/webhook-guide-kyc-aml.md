# Handling Webhooks for Individual KYC (2+2) with AML Screening

A guide for verifying UBO individuals using the FrankieOne v2 API — covering electronic identity verification (KYC 2+2), AML/PEP/Sanctions screening, and handling webhook notifications.

## Overview

After your KYB workflow identifies UBOs (Ultimate Beneficial Owners), each individual needs to be verified through a KYC workflow that typically includes:

- **KYC (2+2)**: Electronic identity verification against government data sources (e.g. match name + DOB against 2+ sources)
- **AML Screening**: Checks against PEP, Sanctions, and Adverse Media watchlists

For workflows with only KYC + AML steps (no IDV/biometrics), the response is **synchronous** — you get the full result immediately. However, if your workflow includes IDV or other async steps, you'll need to handle webhooks.

### Flow Diagram

```
Your App                         FrankieOne API                    Your Webhook Endpoint
  │                                    │                                    │
  │  1. Create Individual + Execute    │                                    │
  │  POST /v2/individuals/new/         │                                    │
  │    serviceprofiles/{serviceName}/  │                                    │
  │    workflows/{workflowName}/       │                                    │
  │    execute                         │                                    │
  │ ──────────────────────────────────>│                                    │
  │                                    │                                    │
  │  [Sync workflows]                  │                                    │
  │  200 OK — full result inline       │                                    │
  │ <──────────────────────────────────│                                    │
  │                                    │                                    │
  │  — OR —                            │                                    │
  │                                    │                                    │
  │  [Async workflows / background]    │                                    │
  │  202 Accepted                      │                                    │
  │  { entityId,                       │                                    │
  │    workflowExecutionId }           │                                    │
  │ <──────────────────────────────────│                                    │
  │                                    │                                    │
  │                                    │  2. WorkflowComplete webhook       │
  │                                    │ ──────────────────────────────────>│
  │                                    │                                    │
  │  3. Fetch full results             │          200 OK                    │
  │  GET /v2/individuals/{entityId}/   │ <──────────────────────────────────│
  │    serviceprofiles/{serviceName}/  │                                    │
  │    workflows/{workflowName}/       │                                    │
  │    executions/                     │                                    │
  │    {workflowExecutionId}           │                                    │
  │ ──────────────────────────────────>│                                    │
  │                                    │                                    │
  │  4. Full individual + workflow     │                                    │
  │     results                        │                                    │
  │ <──────────────────────────────────│                                    │
```

## Step 1: Create the Individual and Execute the Workflow

A single API call creates the individual entity and runs the KYC + AML workflow. This is the "Create and Execute" pattern.

### Endpoint

```
POST /v2/individuals/new/serviceprofiles/{serviceName}/workflows/{workflowName}/execute
```

### Request

```bash
curl -X POST 'https://api.uat.frankie.one/v2/individuals/new/serviceprofiles/KYC/workflows/Standard-KYC-AU/execute' \
  -H 'api_key: YOUR_API_KEY' \
  -H 'X-Frankie-CustomerID: YOUR_CUSTOMER_ID' \
  -H 'Content-Type: application/json' \
  -d '{
    "individual": {
      "name": {
        "givenName": "Jane",
        "familyName": "Chopper"
      },
      "dateOfBirth": {
        "year": "1985",
        "month": "03",
        "day": "15"
      },
      "addresses": [
        {
          "streetAddress": "710 Collins Street",
          "town": "Docklands",
          "state": "VIC",
          "postalCode": "3008",
          "country": "AUS"
        }
      ],
      "consents": [
        { "type": "GENERAL", "granted": true },
        { "type": "DOCS", "granted": true },
        { "type": "CREDITHEADER", "granted": true }
      ]
    }
  }'
```

> **Note on consents**: The `GENERAL` and `CREDITHEADER` consents are required for Australian KYC checks. `DOCS` is needed if document verification is involved.

### For an Existing Individual (e.g. already created during KYB)

If the individual already exists from the UBO discovery, use their `entityId` directly:

```bash
curl -X POST 'https://api.uat.frankie.one/v2/individuals/{entityId}/serviceprofiles/{serviceName}/workflows/{workflowName}/execute' \
  -H 'api_key: YOUR_API_KEY' \
  -H 'X-Frankie-CustomerID: YOUR_CUSTOMER_ID' \
  -H 'Content-Type: application/json'
```

No request body is needed — the individual's data is already on file from the KYB workflow.

### Response: Synchronous (KYC + AML only)

If your workflow only contains synchronous steps (KYC data source checks, AML screening), you get the full result immediately with a `200 OK`:

```json
{
  "individual": {
    "entityId": "99f16410-2613-4181-8cf1-048625900013",
    "name": { "displayName": "JANE CHOPPER", "givenName": "Jane", "familyName": "Chopper" },
    "dateOfBirth": { "year": "1985", "month": "03", "day": "15" }
  },
  "requestId": "01JZHEX0WX2QEM6EY139D5NNP1",
  "workflowResult": {
    "workflowExecutionId": "01JZHEX5FQA4DJB0MMJFZR26JS",
    "workflowExecutionState": "COMPLETED",
    "status": "PASS",
    "result": "PASS",
    "steps": {
      "passed": ["START", "KYC", "AML", "DECISION", "FINISH"],
      "failed": [],
      "order": ["START", "KYC", "AML", "DECISION", "FINISH"]
    },
    "workflowStepResults": [ ... ]
  }
}
```

### Response: Asynchronous (includes IDV/biometrics)

If your workflow includes async steps, or you send the `X-Frankie-Background: 1` header, you get a `202 Accepted`:

```json
{
  "entityId": "99f16410-2613-4181-8cf1-048625900013",
  "requestId": "01JZHEX0WX2QEM6EY139D5NNP1",
  "serviceName": "KYC",
  "workflowExecutionId": "01JZHEX5FQA4DJB0MMJFZR26JS"
}
```

Store these identifiers and wait for the webhook.

## Step 2: Receive the Webhook

When the workflow completes, FrankieOne sends a `WorkflowComplete` event.

### Webhook Payload

```json
{
  "workflowExecutionId": "01JZHEX5FQA4DJB0MMJFZR26JS",
  "entityId": "99f16410-2613-4181-8cf1-048625900013",
  "entityType": "INDIVIDUAL",
  "workflowName": "Standard-KYC-AU",
  "serviceName": "KYC",
  "function": "WorkflowComplete",
  "functionResult": "SUCCESS",
  "notificationType": "EVENT",
  "message": "Entity profile updated",
  "requestId": "01JZHEX0WX2QEM6EY139D5NNP1",
  "version": "2.0.0",
  "overallStatus": "PASS",
  "channel": "api"
}
```

### Key Fields

| Field | What to check |
|---|---|
| `function` | Must be `"WorkflowComplete"` |
| `functionResult` | `"SUCCESS"` or `"FAILURE"` |
| `overallStatus` | `PASS`, `FAIL`, `REVIEW`, `URGENT` — drives your business logic |
| `entityId` | The individual entity ID |
| `workflowExecutionId` | Needed to fetch full results |
| `serviceName` | Needed to fetch full results |
| `workflowName` | Needed to fetch full results |

### Example Webhook Handler

```typescript
app.post('/webhooks/frankieone/:requestId', async (req, res) => {
  // 1. Acknowledge immediately
  res.status(200).send('OK');

  const payload = req.body;

  // 2. Only handle individual workflow completions
  if (payload.function !== 'WorkflowComplete') return;
  if (payload.entityType !== 'INDIVIDUAL') return;

  // 3. Check if the workflow succeeded
  if (payload.functionResult !== 'SUCCESS') {
    console.error(`Workflow failed for ${payload.entityId}:`, payload.message);
    return;
  }

  // 4. Route based on overall status
  switch (payload.overallStatus) {
    case 'PASS':
      await markIndividualVerified(payload.entityId);
      break;

    case 'FAIL':
      await markIndividualFailed(payload.entityId);
      break;

    case 'REVIEW':
      // AML hit or partial KYC match — needs manual review
      const results = await fetchWorkflowResults(payload);
      await flagForComplianceReview(payload.entityId, results);
      break;

    case 'URGENT':
      // Sanctions match — immediate escalation
      const urgentResults = await fetchWorkflowResults(payload);
      await escalateToCompliance(payload.entityId, urgentResults);
      break;
  }
});

async function fetchWorkflowResults(payload: {
  entityId: string;
  serviceName: string;
  workflowName: string;
  workflowExecutionId: string;
}) {
  const { entityId, serviceName, workflowName, workflowExecutionId } = payload;
  const url = `https://api.uat.frankie.one/v2/individuals/${entityId}/serviceprofiles/${serviceName}/workflows/${workflowName}/executions/${workflowExecutionId}`;

  const res = await fetch(url, {
    headers: {
      'api_key': process.env.FRANKIE_API_KEY,
      'X-Frankie-CustomerID': process.env.FRANKIE_CUSTOMER_ID,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}
```

## Step 3: Fetch Full Results

### Request

```
GET /v2/individuals/{entityId}/serviceprofiles/{serviceName}/workflows/{workflowName}/executions/{workflowExecutionId}
```

All four path parameters are **required**. All are provided in the webhook payload.

## Step 4: Parse the Results

### 4a. Check the overall outcome

```typescript
const { individual, workflowResult } = response;

// Must be COMPLETED before trusting the status
if (workflowResult.workflowExecutionState !== 'COMPLETED') {
  throw new Error(`Workflow not complete: ${workflowResult.workflowExecutionState}`);
}

// The authoritative verdict
const status = workflowResult.status; // PASS, FAIL, REVIEW, URGENT
```

Possible `workflowExecutionState` values:

| State | Description |
|---|---|
| `COMPLETED` | Workflow ran successfully — safe to read results |
| `IN_PROGRESS` | Still running |
| `ERROR` | Unrecoverable error |
| `TIMEOUT` | Exceeded max execution time |
| `CANCELED` | Manually canceled |

### 4b. Parse the KYC step (2+2 verification)

Find the KYC step in `workflowStepResults` and check which matching rules were satisfied.

```typescript
const kycStep = workflowResult.workflowStepResults.find(
  (step) => step.stepName === 'KYC'
);

if (kycStep) {
  console.log('KYC result:', kycStep.result);
  // MATCH = verified, NO_MATCH = not verified, PARTIAL = partial match

  // Check which rules were matched (e.g. "gov_id_only", "2plus2")
  const matchedRules = kycStep.summary?.matchedRules || [];
  matchedRules.forEach((rule) => {
    console.log(`Rule: ${rule.ruleName}, Verified: ${rule.isVerified}`);

    // See which data sources contributed
    rule.matchDetails?.forEach((match) => {
      console.log(`  Source: ${match.source}`);
      console.log(`  Attributes matched: ${match.attributesMatched.join(', ')}`);
    });
  });

  // Detailed process results — one per data source check
  kycStep.processResults?.forEach((pro) => {
    console.log(`Provider: ${pro.providerResult?.source}, Result: ${pro.result}`);

    // Match strength scores (if available)
    const matchStrengths = pro.supplementaryData?.matchStrengths;
    if (matchStrengths) {
      console.log(`  Name match: ${matchStrengths.fullName}%`);
      console.log(`  DOB match: ${matchStrengths.dateOfBirth}%`);
    }
  });
}
```

#### KYC Step Results

| Result | Meaning |
|---|---|
| `MATCH` | Identity verified — enough data sources matched per the rule configuration |
| `NO_MATCH` | Identity could not be verified |
| `PARTIAL` | Some sources matched but not enough to satisfy the rule |
| `MISSING_DATA` | Insufficient data provided (e.g. no DOB) |

### 4c. Parse the AML step (PEP / Sanctions / Watchlist screening)

```typescript
const amlStep = workflowResult.workflowStepResults.find(
  (step) => step.stepName === 'AML'
);

if (amlStep) {
  console.log('AML result:', amlStep.result);
  // CLEAR = no matches, HIT = potential matches found

  if (amlStep.result === 'HIT') {
    // Check the summary for a quick overview
    const summary = amlStep.summary || {};
    console.log(`Total hits: ${summary.totalHits}`);
    console.log(`Unresolved: ${summary.totalUnresolved}`);
    console.log(`PEP hits: ${summary.numUnresolvedPEP || 0}`);
    console.log(`Sanctions hits: ${summary.numUnresolvedSanction || 0}`);
    console.log(`Watchlist hits: ${summary.numUnresolvedWatchlist || 0}`);
    console.log(`Adverse media: ${summary.numUnresolvedAdverseMedia || 0}`);

    // Drill into each hit for details
    amlStep.processResults
      ?.filter((pro) => pro.result === 'HIT')
      .forEach((pro) => {
        const data = pro.supplementaryData || {};

        // PEP data
        if (data.pepData?.length > 0) {
          data.pepData.forEach((pep) => {
            console.log(`PEP: ${pep.position}, Level ${pep.level}, Country: ${pep.countryCode}`);
          });
        }

        // Sanctions data
        if (data.sanctionData?.length > 0) {
          data.sanctionData.forEach((sanction) => {
            console.log(`Sanction: ${sanction.source}, Reason: ${sanction.reason}`);
          });
        }

        // Watchlist data
        if (data.watchlistData?.length > 0) {
          data.watchlistData.forEach((wl) => {
            console.log(`Watchlist: ${wl.source}, Category: ${wl.category}`);
          });
        }

        // Adverse media
        if (data.mediaData?.length > 0) {
          data.mediaData.forEach((media) => {
            console.log(`Media: ${media.snippet}`);
          });
        }

        // Manual review status
        console.log(`Review status: ${pro.manualStatus}`);
        // UNRESOLVED, TRUE_POSITIVE, FALSE_POSITIVE
      });
  }
}
```

#### AML Step Results

| Result | Meaning | Typical Workflow Status |
|---|---|---|
| `CLEAR` | No matches against any watchlists | `PASS` |
| `HIT` | Potential match(es) found — needs review | `REVIEW` or `URGENT` |

#### AML Issue Categories

| Category | Issue | Severity | When it triggers |
|---|---|---|---|
| AML | PEP | WARNING | Match against Politically Exposed Persons list |
| AML | SANCTIONS | WARNING | Match against sanctions list |
| AML | MEDIA | WARNING | Match against adverse media |
| AML | WATCHLIST | WARNING | Match against regulatory/law enforcement watchlists |

### 4d. Check the risk assessment

```typescript
const risk = workflowResult.riskAssessment;
if (risk) {
  console.log(`Risk level: ${risk.riskLevel}`);   // LOW, MEDIUM, HIGH, UNACCEPTABLE
  console.log(`Risk score: ${risk.riskScore}`);

  // Individual risk factors
  risk.riskFactors?.forEach((factor) => {
    console.log(`  ${factor.factor}: ${factor.value} (score: ${factor.score})`);
  });
}
```

### 4e. Check for issues requiring review

```typescript
const issues = workflowResult.issues || [];
if (issues.length > 0) {
  issues.forEach((issue) => {
    console.log(`Issue: ${issue.category} / ${issue.issue} — Severity: ${issue.severity}`);
  });
}
```

## Step 5: Resolving AML Hits

When AML screening returns a `HIT`, the workflow status will be `REVIEW`. A compliance officer must classify each hit before the status can progress.

### Classification Options

| `manualStatus` | Meaning |
|---|---|
| `UNRESOLVED` | Not yet reviewed (default) |
| `TRUE_POSITIVE` | Confirmed match — this is the same person |
| `FALSE_POSITIVE` | Not a match — different person with similar details |

### After Classifying All Hits

Once all process results have been classified, **re-execute the workflow** for the entity:

```bash
curl -X POST 'https://api.uat.frankie.one/v2/individuals/{entityId}/serviceprofiles/{serviceName}/workflows/{workflowName}/execute' \
  -H 'api_key: YOUR_API_KEY' \
  -H 'X-Frankie-CustomerID: YOUR_CUSTOMER_ID'
```

The re-execution will:
- Re-evaluate the AML step with the updated classifications
- Clear issues where all hits were marked `FALSE_POSITIVE`
- Update the `status` from `REVIEW` to `PASS` (if all resolved) or `FAIL` (if true positives remain)

## Putting It All Together: KYB + KYC Flow

Here's how the full end-to-end flow works for verifying a business and its UBOs:

```
1. Search for business
   POST /v2/organizations/lookup

2. Execute KYB workflow (creates org + discovers UBOs)
   POST /v2/organizations/workflows/{workflowName}/execute
   → Webhook: WorkflowComplete (ORGANIZATION)
   → Fetch results: ownership structure, UBOs identified

3. For each UBO individual:
   a. If UBO already has an entityId from KYB:
      POST /v2/individuals/{entityId}/serviceprofiles/KYC/workflows/{workflowName}/execute

   b. If creating a new individual:
      POST /v2/individuals/new/serviceprofiles/KYC/workflows/{workflowName}/execute

   → Sync: 200 with full result (KYC + AML only)
   → Async: 202 + Webhook: WorkflowComplete (INDIVIDUAL)

4. Check results:
   - KYC MATCH + AML CLEAR → PASS → Individual verified
   - KYC MATCH + AML HIT  → REVIEW → Flag for compliance
   - KYC NO_MATCH          → FAIL → Request more information
```

## Webhook Setup

To configure webhooks, contact **help@frankieone.com** with:

1. Your HTTPS webhook endpoint URL
2. Your contact email
3. Which events you want: `WorkflowComplete`, `EntityStatusChanged`, etc.

### Security Options

| Option | Description |
|---|---|
| **HTTPS** | Required for all webhook endpoints |
| **IP Whitelisting** | Restrict to FrankieOne's outbound IPs |
| **JWT Signing** | RS256 signed payloads — contact support to enable |

### Retry Behaviour

- Initial retry immediately after first failure
- Exponential backoff for subsequent retries
- Up to 50 attempts over ~24 hours
- `400` response stops retries; `5xx` / other `4xx` triggers retries

## Quick Reference

| Step | Endpoint | Method |
|---|---|---|
| Create individual + execute workflow | `/v2/individuals/new/serviceprofiles/{serviceName}/workflows/{workflowName}/execute` | POST |
| Execute workflow (existing individual) | `/v2/individuals/{entityId}/serviceprofiles/{serviceName}/workflows/{workflowName}/execute` | POST |
| Fetch execution results | `/v2/individuals/{entityId}/serviceprofiles/{serviceName}/workflows/{workflowName}/executions/{workflowExecutionId}` | GET |

## Further Reading

- [Executing Workflows (Individuals)](https://docs.frankieone.com/docs/executing-workflows)
- [Interpreting Workflow Results](https://docs.frankieone.com/docs/interpreting-workflows-v2)
- [Interpreting AML Screening Results](https://docs.frankieone.com/docs/anti-money-laundering-results)
- [Event Notifications & Webhooks](https://docs.frankieone.com/docs/reference/webhooks)
