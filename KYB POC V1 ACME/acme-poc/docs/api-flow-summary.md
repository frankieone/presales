# Business Onboarding API Flow Summary

This document describes the complete sequence of FrankieOne API calls used in the business onboarding flow. All calls use the v1.2 compliance API unless noted otherwise.

## Authentication

All API calls include these headers:
- `Content-Type: application/json`
- `X-Frankie-CustomerID: {customer_id}`
- `api_key: {api_key}`
- `X-Frankie-CustomerChildID: {child_id}` (optional, if multi-tenant)

The Australian business search (Step 1b) uses a separate backend token obtained via machine session auth.

---

## Step 1: Business Search

The user enters a business name or registration number. Two search paths exist depending on country.

### Step 1a: International Business Search (non-AU)

**`POST /compliance/v1.2/business/international/search`**

Request body:
```json
{
  "country": "GB",
  "organisation_name": "Acme Ltd",
  "organisation_number": "12345678"
}
```

Returns a list of matching businesses with name, registration code, jurisdiction, and status.

### Step 1b: Australian Business Search

Uses the backend data API (not the compliance API).

First, obtain a machine session token:

**`POST {backend_url}/auth/v2/machine-session`**

Headers: `authorization: machine {base64(customer_id:api_key)}`

Request body:
```json
{
  "permissions": { "preset": "smart-ui" }
}
```

Returns: `{ "token": "..." }`

Then search:

**`GET {backend_url}/data/v2/businesses?search={query}`**

Headers: `authorization: {token}`

Returns a list of Australian businesses matching the search query (by name, ABN, or ACN).

---

## Step 2: Select Business

The user selects the correct business from the search results. No API call here -- this is a UI-only step that captures the business code (ABN/ACN) for the next step.

---

## Step 3: UBO / Ownership Lookup (Australian)

Queries the full ownership structure of the business, including officeholders, ultimate beneficial owners (UBOs), and blocking entities (e.g. trusts that prevent full ownership transparency).

**`POST /compliance/v1.2/business/ownership/query?ownershipMode=full`**

Request body:
```json
{
  "organisation": {
    "entityType": "ORGANISATION",
    "extraData": [
      { "kvpKey": "ACN", "kvpType": "id.external", "kvpValue": "052121347" },
      { "kvpKey": "ABN", "kvpType": "id.external", "kvpValue": "37052121347" }
    ]
  }
}
```

**Important:** This call may return synchronously (200) or asynchronously (202).

If **202**, the response contains a `requestId`. Poll for the result:

**`GET /compliance/v1.2/retrieve/response/{requestId}`**

Poll every 3 seconds, up to 20 attempts. Returns 404 while processing, 200 when ready.

### Response contains:
- `uboResponse.officeholders[]` -- directors, secretaries, officers (each with `name`, `entityId`, `role`, `date_of_birth`, `addresses`)
- `uboResponse.ultimate_beneficial_owners[]` -- UBOs (same shape as officeholders, with `percent_owned`)
- `uboResponse.business_details` -- ABN, ACN, registered name, ASIC company type
- `ownershipQueryResult.blockingEntityIds[]` -- entity IDs of organisations (e.g. trusts) blocking full UBO resolution
- `ownershipQueryResult.blockingEntityDetails` -- reasons each entity is blocking
- `ownershipQueryResult.associatedEntities` -- details of all associated entities
- `ownershipQueryResult.entityId` -- the organisation entity ID created by FrankieOne

**Key detail:** The `ownershipMode=full` call creates INDIVIDUAL entities in FrankieOne for each officeholder/UBO. These entity IDs are returned in the response and are reused for KYC verification in Step 7. These entities are created **without** running any KYC/AML checks -- checks are only triggered explicitly later.

---

## Step 4: Business Profile (International, non-AU)

For non-Australian businesses, a separate profile call retrieves directors, shareholders, PSCs, and officers.

**`POST /compliance/v1.2/business/international/profile`**

Request body:
```json
{
  "country": "GB",
  "company_code": "12345678",
  "registration_authority_code": "companies-house"
}
```

Returns structured business profile with directors, shareholders, PSCs (persons of significant control), and officers.

---

## Step 5: Add Manual UBO (optional)

If the user identifies additional UBOs not returned by the ownership query, they can be manually added and associated with the organisation.

**`POST /compliance/v1.2/business/{orgEntityId}/associateEntity/new`**

Request body:
```json
{
  "entity": {
    "entityType": "INDIVIDUAL",
    "name": {
      "givenName": "John",
      "middleName": "Michael",
      "familyName": "Smith"
    },
    "dateOfBirth": { "dateOfBirth": "1985-03-15" },
    "addresses": [{
      "streetName": "123 Main St",
      "town": "Sydney",
      "state": "NSW",
      "postalCode": "2000",
      "country": "AU"
    }]
  },
  "roles": [{ "type": "UBO", "typeDescription": "Ultimate Beneficial Owner" }],
  "percentageHeld": {
    "beneficially": 25,
    "total": 25
  }
}
```

Returns the newly created entity with its `entityId`. This entity is automatically associated with the organisation.

---

## Step 6: Update UBO Details (optional)

If the user edits an individual's details (name, DOB, address) before verification, the entity is updated in FrankieOne without triggering any checks.

**`POST /compliance/v1.2/entity/{entityId}/evaluate`**

Request body:
```json
{
  "entity": {
    "entityId": "{entityId}",
    "entityType": "INDIVIDUAL",
    "name": {
      "givenName": "Jane",
      "familyName": "Chopper"
    },
    "dateOfBirth": { "dateOfBirth": "1980-01-01" },
    "addresses": [{
      "streetName": "456 High St",
      "town": "Melbourne",
      "state": "VIC",
      "postalCode": "3000",
      "country": "AU"
    }]
  }
}
```

---

## Step 7: Trigger KYC/AML Verification on Each UBO

When the user clicks "Verify All", a KYC + AML check is triggered for each individual. The entity profile used is **`safe_harbour`**.

### For individuals with an existing entity (from ownership lookup or manual add):

**`POST /compliance/v1.2/entity/{entityId}/verify/profile/summary`**

Request body:
```json
{
  "entity": {
    "entityId": "{entityId}",
    "entityType": "INDIVIDUAL",
    "entityProfile": "safe_harbour",
    "extraData": [
      { "kvpKey": "kyc.method", "kvpValue": "electronic" },
      { "kvpKey": "consent.general", "kvpValue": "true" },
      { "kvpKey": "consent.docs", "kvpValue": "true" },
      { "kvpKey": "consent.creditHeader", "kvpValue": "true" }
    ]
  }
}
```

### For individuals without an existing entity (fallback):

**`POST /compliance/v1.2/entity/new/verify/profile/summary`**

Request body:
```json
{
  "entity": {
    "entityType": "INDIVIDUAL",
    "entityProfile": "safe_harbour",
    "name": {
      "givenName": "Tracy",
      "familyName": "Isbrandt"
    },
    "dateOfBirth": { "dateOfBirth": "1975-06-20" },
    "addresses": [{
      "streetName": "789 Oak Ave",
      "town": "Brisbane",
      "state": "QLD",
      "postalCode": "4000",
      "country": "AU"
    }],
    "extraData": [
      { "kvpKey": "kyc.method", "kvpValue": "electronic" },
      { "kvpKey": "consent.general", "kvpValue": "true" },
      { "kvpKey": "consent.docs", "kvpValue": "true" },
      { "kvpKey": "consent.creditHeader", "kvpValue": "true" }
    ]
  }
}
```

### Response (both paths):

```json
{
  "entityProfileResult": {
    "actionRecommended": "PASS | FAIL | REFER | MANUAL",
    "riskLevel": "LOW | MEDIUM | HIGH",
    "checkId": "...",
    "checkResults": [
      { "name": "KYC Check", "result": "PASS", "message": "..." },
      { "name": "AML/PEP Check", "result": "PASS", "message": "..." }
    ]
  },
  "entityResult": { "entityId": "..." },
  "requestId": "..."
}
```

The `actionRecommended` field determines the overall outcome:
- **PASS** -- individual passed all checks
- **FAIL** -- individual failed verification
- **REFER / MANUAL** -- requires manual review

---

## Step 8: Receive Results via Webhook

For production use, results for each individual UBO and the overall business should be delivered via webhook rather than polling.

**Webhook payload (per individual):**

The webhook fires when a check completes on an entity. The payload includes:
- `entityId` -- the individual entity that was checked
- `checkId` -- the specific check run
- `entityProfileResult` -- same structure as the synchronous response (actionRecommended, riskLevel, checkResults)
- `requestId` -- correlation ID

**Webhook payload (business-level):**

A separate webhook fires for organisation-level events (e.g. ownership query completion, overall business AML check).

Configure webhooks in the FrankieOne portal to point at your endpoint. The webhook includes a signature header for verification.

---

## Supporting Calls

### Upload Document to Entity

Used for trust deeds and supporting documents (e.g. for blocking entities).

**`POST /compliance/v1.2/entity/{entityId}`**

Request body:
```json
{
  "identityDocs": [{
    "idType": "TRUST_DEED",
    "docScan": [{
      "scanData": "{base64_encoded_file}",
      "scanFilename": "trust-deed.pdf",
      "scanMIME": "application/pdf",
      "scanSide": "F",
      "scanType": "PDF"
    }]
  }]
}
```

### Trigger Trust Deed Analysis (v2 API)

**`POST {v2_url}/v2/organizations/{entityId}/documents/{documentId}/analysis`**

### Get Trust Analysis Status (v2 API)

**`GET {v2_url}/data/v2/business/trust-deeds/{documentId}/analyse`**

### Get Trust Analysis Results (v2 API)

**`GET {v2_url}/data/v2/business/trust-deeds/{entityId}/analysis-result/{documentId}`**

---

## Flow Diagram

```
1. Search Business
   POST /business/international/search  OR  GET /data/v2/businesses?search=...

2. User selects business from results

3. Ownership/UBO Lookup
   POST /business/ownership/query?ownershipMode=full
   (poll GET /retrieve/response/{requestId} if async)
   -> Returns officeholders, UBOs, blocking entities
   -> Creates individual entities in FrankieOne (no checks run)

4. (Optional) Add manual UBO
   POST /business/{orgEntityId}/associateEntity/new

5. (Optional) Edit UBO details
   POST /entity/{entityId}/evaluate

6. (Optional) Upload trust deed for blocking entity
   POST /entity/{entityId}  (with document)
   POST /v2/organizations/{entityId}/documents/{documentId}/analysis

7. Trigger KYC/AML (user clicks "Verify All")
   POST /entity/{entityId}/verify/profile/summary  (safe_harbour profile)
   -> Per individual, returns actionRecommended: PASS/FAIL/REFER

8. Receive results via webhook (production)
   -> Per-individual check results
   -> Business-level results
```
