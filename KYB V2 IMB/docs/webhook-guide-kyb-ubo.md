# Handling Webhooks for KYB V2 — UBO Lookup

A guide for handling webhook notifications after executing a KYB organization/UBO lookup workflow using the FrankieOne v2 API.

## Overview

When you execute a KYB workflow (e.g. `AUS-Organization-Ownership`), the API returns a `202 Accepted` immediately. The workflow runs asynchronously, and FrankieOne notifies your application via webhook when it completes. You then use the identifiers from the webhook to fetch the full results.

### Flow Diagram

```
Your App                         FrankieOne API                    Your Webhook Endpoint
  │                                    │                                    │
  │  1. Execute Workflow               │                                    │
  │  POST /v2/organizations/           │                                    │
  │    workflows/{workflowName}/       │                                    │
  │    execute                         │                                    │
  │ ──────────────────────────────────>│                                    │
  │                                    │                                    │
  │  2. 202 Accepted                   │                                    │
  │  { entityId,                       │                                    │
  │    workflowExecutionId,            │                                    │
  │    serviceName }                   │                                    │
  │ <──────────────────────────────────│                                    │
  │                                    │                                    │
  │  Store these identifiers           │  3. Workflow processes in          │
  │  for later use                     │     background (UBO discovery,     │
  │                                    │     ownership structure, etc.)     │
  │                                    │                                    │
  │                                    │  4. WorkflowComplete webhook       │
  │                                    │ ──────────────────────────────────>│
  │                                    │                                    │
  │                                    │          200 OK                    │
  │                                    │ <──────────────────────────────────│
  │                                    │                                    │
  │  5. Fetch full results             │                                    │
  │  GET /v2/organizations/            │                                    │
  │    {entityId}/serviceprofiles/     │                                    │
  │    {serviceName}/workflows/        │                                    │
  │    {workflowName}/executions/      │                                    │
  │    {workflowExecutionId}           │                                    │
  │ ──────────────────────────────────>│                                    │
  │                                    │                                    │
  │  6. Full org + workflow results    │                                    │
  │ <──────────────────────────────────│                                    │
```

## Step 1: Execute the KYB Workflow

A single API call creates the organization entity and executes the workflow. No separate "create" call is needed.

### Option A: Using an `organizationToken` (from a prior search/lookup)

```bash
curl -X POST 'https://api.uat.frankie.one/v2/organizations/workflows/AUS-Organization-Ownership/execute' \
  -H 'api_key: YOUR_API_KEY' \
  -H 'X-Frankie-CustomerID: YOUR_CUSTOMER_ID' \
  -H 'Content-Type: application/json' \
  -d '{
    "organizationToken": "eyJ2ZXIiOiIx...",
    "serviceName": "KYB"
  }'
```

### Option B: Using registration details directly (no prior lookup needed)

```bash
curl -X POST 'https://api.uat.frankie.one/v2/organizations/workflows/AUS-Organization-Ownership/execute' \
  -H 'api_key: YOUR_API_KEY' \
  -H 'X-Frankie-CustomerID: YOUR_CUSTOMER_ID' \
  -H 'Content-Type: application/json' \
  -d '{
    "organization": {
      "details": {
        "registrationDetails": [
          {
            "number": "61623506892",
            "type": "ABN",
            "country": "AUS"
          }
        ]
      }
    },
    "serviceName": "KYB"
  }'
```

### Response (202 Accepted)

```json
{
  "entityId": "01993733-cfd5-7594-9e90-ec3ad06dd490",
  "requestId": "01K4VK7KWN6HEA43AQ0F13JZPT",
  "serviceName": "KYB",
  "serviceProfileId": "64ec50f2-5e69-4fee-8d97-7db77f2b71cd",
  "workflowExecutionId": "01K4VK7QDJG631AWFKWYVE85Z5"
}
```

Store `entityId`, `serviceName`, `workflowName` (from your request), and `workflowExecutionId` — you'll need all four to fetch results later.

> **Note:** If an organization with the same registration number already exists, the API runs the workflow against the existing entity rather than creating a duplicate.

## Step 2: Receive the Webhook

When the workflow completes, FrankieOne sends a `WorkflowComplete` event to your configured webhook endpoint.

### Webhook Payload

```json
{
  "workflowExecutionId": "01K4VK7QDJG631AWFKWYVE85Z5",
  "entityId": "01993733-cfd5-7594-9e90-ec3ad06dd490",
  "entityType": "ORGANIZATION",
  "workflowName": "AUS-Organization-Ownership",
  "serviceName": "KYB",
  "function": "WorkflowComplete",
  "functionResult": "SUCCESS",
  "notificationType": "EVENT",
  "message": "Entity profile updated",
  "requestId": "01K4VK7KWN6HEA43AQ0F13JZPT",
  "version": "2.0.0",
  "overallStatus": "COMPLETE",
  "channel": "api"
}
```

### Key Fields to Check

| Field | What to check |
|---|---|
| `function` | Must be `"WorkflowComplete"` |
| `functionResult` | `"SUCCESS"` = workflow ran to completion, `"FAILURE"` = error during execution |
| `overallStatus` | The workflow outcome: `PASS`, `FAIL`, `REVIEW`, `COMPLETE`, etc. |
| `entityId` | The organization entity ID |
| `workflowExecutionId` | Needed to fetch full results |
| `serviceName` | Needed to fetch full results |
| `workflowName` | Needed to fetch full results |

### Example Webhook Handler (Node.js / Express)

```typescript
app.post('/webhooks/frankieone/:requestId', async (req, res) => {
  // 1. Acknowledge immediately
  res.status(200).send('OK');

  const payload = req.body;

  // 2. Only process WorkflowComplete events for organizations
  if (payload.function !== 'WorkflowComplete') return;
  if (payload.entityType !== 'ORGANIZATION') return;

  // 3. Check if the workflow succeeded
  if (payload.functionResult !== 'SUCCESS') {
    console.error(`Workflow failed for entity ${payload.entityId}:`, payload.message);
    // Handle error — notify your team, update your DB, etc.
    return;
  }

  // 4. Fetch the full workflow results
  const results = await fetchWorkflowResults({
    entityId: payload.entityId,
    serviceName: payload.serviceName,
    workflowName: payload.workflowName,
    workflowExecutionId: payload.workflowExecutionId,
  });

  // 5. Process the results (UBOs, shareholders, officeholders, etc.)
  await processKybResults(payload.entityId, results);
});
```

### Important Considerations

- **Respond quickly**: Return `200` or `202` before doing any heavy processing. Process asynchronously after acknowledging.
- **Deduplicate**: Use `requestId` to guard against duplicate deliveries from retries.
- **Retries**: If your endpoint returns a `5xx` or non-`400` `4xx`, FrankieOne retries up to 50 times over ~24 hours with exponential backoff.

## Step 3: Fetch the Full Workflow Results

Use the four identifiers from the webhook payload to retrieve the complete results.

### Request

```bash
curl -X GET 'https://api.uat.frankie.one/v2/organizations/{entityId}/serviceprofiles/{serviceName}/workflows/{workflowName}/executions/{workflowExecutionId}' \
  -H 'api_key: YOUR_API_KEY' \
  -H 'X-Frankie-CustomerID: YOUR_CUSTOMER_ID' \
  -H 'Content-Type: application/json'
```

All four path parameters are **required**:

| Parameter | Source |
|---|---|
| `entityId` | Webhook payload or execute response |
| `serviceName` | Webhook payload or execute response |
| `workflowName` | Webhook payload or your original request |
| `workflowExecutionId` | Webhook payload or execute response |

### Response Structure

The response contains two main objects:

```json
{
  "organization": {
    "entityId": "01993733-cfd5-7594-9e90-ec3ad06dd490",
    "details": {
      "name": { "name": "TOLL PTY LIMITED" },
      "registrationDetails": [
        { "registrationNumberType": "ABN", "registrationNumber": "59000697861" },
        { "registrationNumberType": "ACN", "registrationNumber": "000697861" }
      ],
      "legalForm": "Australian Proprietary Company",
      "registrationDate": "1998-01-01"
    },
    "officials": [ ... ],
    "shareholders": [ ... ],
    "ultimateBeneficialOwners": [ ... ],
    "linkedIndividuals": { ... },
    "linkedOrganizations": { ... },
    "blockingEntities": { ... }
  },
  "workflowResult": {
    "workflowExecutionState": "COMPLETED",
    "status": "COMPLETE",
    "result": "COMPLETE",
    "workflowStepResults": [ ... ]
  }
}
```

## Step 4: Parse the UBO / Ownership Results

### 4a. Check the workflow completed successfully

```typescript
const { organization, workflowResult } = response;

// Always check this first
if (workflowResult.workflowExecutionState !== 'COMPLETED') {
  throw new Error(`Workflow not complete: ${workflowResult.workflowExecutionState}`);
}
```

Possible `workflowExecutionState` values:

| State | Description |
|---|---|
| `COMPLETED` | Workflow ran successfully — safe to read results |
| `IN_PROGRESS` | Still running (shouldn't appear if webhook fired) |
| `ERROR` | Unrecoverable error |
| `TIMEOUT` | Exceeded max execution time |
| `CANCELED` | Manually canceled |

### 4b. Extract officeholders (directors / officers)

Officials are listed with an `entityId` reference. Resolve names from `linkedIndividuals`.

```typescript
const officials = organization.officials || [];
const linkedIndividuals = organization.linkedIndividuals || {};

const officeholders = officials.map((official) => {
  const linked = linkedIndividuals[official.entityId];
  const name = linked?.name?.displayName
    || [linked?.name?.givenName, linked?.name?.familyName].filter(Boolean).join(' ');

  return {
    entityId: official.entityId,
    name,
    role: official.role?.description || official.role?.code || official.role,
    entityType: official.entityType,
  };
});
```

### 4c. Extract shareholders and calculate ownership

```typescript
const shareholders = organization.shareholders || [];
const totalShares = organization.shareCapital?.totalShareCount || 0;

const ownershipList = shareholders.map((sh) => {
  const isIndividual = sh.entityType === 'INDIVIDUAL';
  const linked = isIndividual
    ? linkedIndividuals[sh.entityId]
    : (organization.linkedOrganizations || {})[sh.entityId];

  const name = isIndividual
    ? linked?.name?.displayName || [linked?.name?.givenName, linked?.name?.familyName].filter(Boolean).join(' ')
    : linked?.details?.name?.name || linked?.details?.name?.registeredName;

  const percentOwned = totalShares > 0
    ? Math.round((sh.totalShares / totalShares) * 1000) / 10
    : undefined;

  return {
    entityId: sh.entityId,
    name,
    entityType: sh.entityType,
    percentOwned,
  };
});
```

### 4d. Extract UBOs (Ultimate Beneficial Owners)

```typescript
const ubos = organization.ultimateBeneficialOwners || [];

const uboList = ubos.map((ubo) => {
  const linked = linkedIndividuals[ubo.entityId];
  const name = linked?.name?.displayName
    || [linked?.name?.givenName, linked?.name?.familyName].filter(Boolean).join(' ');

  return {
    entityId: ubo.entityId,
    name,
    percentOwned: ubo.percentageOwned?.total || ubo.percentageOwned?.beneficially,
    ownerEntityId: ubo.ownerEntityId, // the org they own through (if indirect)
  };
});
```

### 4e. Check for blocking entities

Blocking entities are intermediate organizations in the ownership chain that prevent full UBO resolution (e.g. trusts, foreign companies).

```typescript
const blockingEntities = organization.blockingEntities || {};

Object.values(blockingEntities).forEach((entity) => {
  const reasons = entity.blockingReasons || [];
  console.log(`Blocking entity: ${entity.entityId}, type: ${entity.entityType}`);
  reasons.forEach((r) => console.log(`  Reason: ${r.type} — ${r.description}`));
});
```

## Webhook Setup

To configure webhooks for your account, contact **help@frankieone.com** with:

1. Your webhook endpoint URL (must be HTTPS)
2. Your contact email
3. Which notification types you want to receive (e.g. `WorkflowComplete` only)

### Security Options

| Option | Description |
|---|---|
| **HTTPS** | All webhooks are delivered over HTTPS (required) |
| **IP Whitelisting** | Restrict incoming requests to FrankieOne's outbound IPs |
| **JWT Signing** | Optional — FrankieOne signs payloads with RS256. Contact support to enable |

## Quick Reference

| Step | Endpoint | Method |
|---|---|---|
| Search for org | `/v2/organizations/lookup` | POST |
| Execute workflow (creates entity + runs UBO lookup) | `/v2/organizations/workflows/{workflowName}/execute` | POST |
| Fetch results after webhook | `/v2/organizations/{entityId}/serviceprofiles/{serviceName}/workflows/{workflowName}/executions/{workflowExecutionId}` | GET |

## Further Reading

- [Executing Workflows](https://docs.frankieone.com/docs/kyb/executing-workflows)
- [Interpreting Workflow Results](https://docs.frankieone.com/docs/kyb/interpreting-workflows-v2)
- [Event Notifications & Webhooks](https://docs.frankieone.com/docs/reference/webhooks)
- [Creating & Managing Organizations](https://docs.frankieone.com/docs/kyb/managing-organizations)
