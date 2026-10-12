# Onboarding as a Service

A working example of a platform that sells FrankieOne onboarding to many intermediaries through one FrankieOne account. **Harbourline Clearing** (a placeholder) serves 300 intermediaries, such as advisers and brokers. Each one onboards its own clients in its own console, and none can tell whether another intermediary holds the same person.

```
 Intermediary console ──► Platform layer (this server) ──► One FrankieOne account
 (one per intermediary)    holds the only API key           one record per investor
                           recognises returning investors   one reference per intermediary
                           builds every response from a     one verification per onboarding
                           permitted list of fields
```

## Setup

```bash
npm install
cp env.example .env.local     # fill in the FrankieOne account and a PLATFORM_SECRET
npm run dev                   # start-up checks, then the platform on 8100 and the screens on 8101
```

Open http://localhost:8101. The start page signs you in as one of three intermediaries, or opens the platform's own view. Sign in as two intermediaries in two browser tabs to show them side by side.

`.env.local` is read by the server only. Nothing in it reaches a browser, which is the point of the pattern. `npm test` runs the start-up checks on their own.

## Demo script

1. **Northgate Advisers** → **Onboard a client** → James Testone. He's new to the network: the platform creates his record and runs Northgate's workflow. Northgate sees **Verified**.
2. **Bluewave Brokers** (second tab) → onboard the same James Testone. The platform recognises his licence and adds Bluewave's reference to the same record instead of creating a second one, then runs Bluewave's own workflow (which adds an ID check). Bluewave sees **Verified**, with a different handle from Northgate's. Neither knows the other holds him.
3. Bluewave's API response (`GET /api/v1/clients/{handle}`) holds no entity ID, no other intermediary and no data source.
4. **Kestrel Wealth** → onboard James Testeleven. He's a PEP match, so Kestrel sees **In review** with a neutral message. A compliance officer resolves it in the FrankieOne Portal; **Check status** then shows the outcome.
5. **Platform operations** → James (under **Records**): one record with two relationships, the handle each intermediary sees, which onboarding reused a record already held, and the disclosure log.
6. Back in Bluewave → **Client has left**. Only Bluewave's reference is removed. James's record and Northgate's relationship are untouched.

Every onboarding response takes at least the minimum response time (10 seconds by default), so an intermediary can't tell a recognised investor from a new one by timing.

### When the index misses: duplicate check and merge

7. **Kestrel Wealth** → onboard *James Testone — Medicare card instead of licence*. Same person, different document, so the identity index doesn't recognise him and the platform creates a new record. Its duplicate check finds Northgate's James on name, date of birth and address, but not on a document, so the merge policy isn't met. Kestrel sees **In review**, nothing more.
8. **Platform operations** → **Needs a decision** shows the two records side by side with what matched. **Same person: merge** keeps the record already held, retires the new one, moves Kestrel's reference across and runs Kestrel's verification there. Kestrel's handle doesn't change; **Check status** in Kestrel now shows **Verified**.
9. **Merges** → **Reverse** restores the retired record and re-runs Kestrel's verification on it, for when a merge proves wrong.
10. Automatic merge: open the record under **Records** → **Drop index entry** (a presenter tool, as if that client had never been indexed). Then have another intermediary onboard the same person with the **same** document. The duplicate check matches on the identity document and exact date of birth, which meets the merge policy, so the platform merges without a person. The merge log shows it was the policy, with the reason.

**Different people** on a held review keeps both records and verifies the new one on its own.

### Business clients, with or without an ABN or ACN

Clients can be businesses: companies, trusts, partnerships or other organisations, each with the people behind them (directors, trustees, partners, beneficial owners, signatories). Many trusts and partnerships have no ABN or ACN, so the platform doesn't require one.

11. **Northgate Advisers** → **Onboard a client** → **Business** (or the demo helper's *Testone Family Trust*). No ABN or ACN, two trustees. The platform creates a business record, verifies each trustee (reusing a record if the person is already on the network) and links them with their role. With no register to check, Northgate sees **Action required: provide the document that establishes the business**, with each trustee's status.
12. Upload the trust deed from **Open tasks** on the client's page → the document is attached to the business record and the business is **Verified**.
13. **Bluewave Brokers** → *Testone Holdings Pty Ltd*, with a made-up ACN. The register check runs and can't confirm it, so Bluewave is asked to check the number or provide a document.
14. **Kestrel Wealth** → the same trust, again with no ABN. There's no number to match on, so the platform matches the normalised name and postcode. That's never enough to merge on its own, so the trust is held for a decision under **Needs a decision**, side by side.
15. **Platform operations** → **Records**: the trust is one organisation record, and James is one record held as Northgate's trustee, as Bluewave's director and (if onboarded directly) as Northgate's own client.

### The client file

Open any client to see its file, read live from FrankieOne:

- **Verifications:** every workflow run, with each check passed or failed and the risk level.
- **Risk:** the latest risk assessment and the factors behind it.
- **Documents:** identity documents, uploaded files (bank statements, trust deeds and so on), and the photos and selfie from an ID check, viewable inline.
- **History:** the audit trail of the checks, plus what the platform did (submitted, documents added, links sent).
- **Client file (PDF):** prints the whole file. For a business, each person behind it is included.

From the file, an intermediary can **add a document** (attached to the FrankieOne record) or **create an ID verification link**: a one-time hosted OneSDK link for the client to photograph their ID and take a selfie. The photos and results then appear in the file.

**What each side sees.** An intermediary's file is scoped to its own relationship: only its own verification runs, the documents it supplied or collected, risk factors that don't describe someone else's submission, and audit events from its own runs. Risk shows as a level and the score from its own runs (set `SHARE_RISK_SCORE=false` to show the level only). If another intermediary also holds the client, nothing of theirs appears. The platform's file (any record under **Records**) shows everything on the record: every run and which intermediary it was for, the duplicate checks, scores, every document and the full audit trail.

16. **Bluewave Brokers** → James → **Documents** → add a bank statement. Then **Northgate Advisers** → James → **Documents**: the bank statement isn't there.
17. **Platform operations** → **Records** → James → **Verifications** and **Documents**: both intermediaries' runs, attributed, and the bank statement marked as added by Bluewave.

Business onboarding takes at least 25 seconds (`MIN_BUSINESS_RESPONSE_MS`), long enough to cover a register check.

Test people are FrankieOne's [published UAT test identities](https://docs.frankieone.com/docs/uat-test-data). Keep their details exactly as published.

## How it maps onto FrankieOne

| Platform concept | In FrankieOne |
|---|---|
| Investor (one per person, network-wide) | One individual record |
| An intermediary's client | An external reference on that record, named `INTERMEDIARY_<ID>`, holding the intermediary's client ID |
| An intermediary's onboarding | One workflow execution on the record, using that intermediary's workflow, with `X-Frankie-Channel` naming the intermediary |
| Evidence | Check results held against the record |

| Scenario | Calls |
|---|---|
| New to the network | `POST /v2/individuals/new/serviceprofiles/{service}/workflows/{workflow}/execute`, creating the record with the intermediary's reference |
| Already held by another intermediary | `PATCH /v2/individuals/{entityId}` to add the reference, then `POST /v2/individuals/{entityId}/serviceprofiles/{service}/workflows/{workflow}/execute` |
| Same intermediary submits the same person again | No call. The platform returns the existing relationship |
| Check status | `GET /v2/individuals/{entityId}`, reading that intermediary's own execution |
| Client leaves one intermediary | `DELETE /v2/individuals/{entityId}/externalreferences/{referenceId}` |
| New record, possible duplicate | Created through the duplicate-check workflow; matches come back in the `DUPLICATE` step's process results, with matched fields and rules |
| Same person (merge) | `PATCH /v2/individuals/{newEntityId}/results/duplicate` with `TRUE_POSITIVE_REJECT` (keep the existing record), then the reference moves and the intermediary's workflow runs on the survivor |
| Different people | Same call with `FALSE_POSITIVE`, then the intermediary's workflow runs on the new record |
| Reverse a merge | Same call with `FALSE_POSITIVE` on the confirmed match, which restores the retired record |
| Business client | `POST /v2/organizations` with the intermediary's reference (the record holds the name, type, address and any ABN or ACN) |
| People behind it | Each verified as an individual (above), then `PUT /v2/organizations/{entityId}/relationships` with their role |
| ABN or ACN supplied | `POST /v2/organizations/{entityId}/serviceprofiles/{service}/workflows/{BUSINESS_WORKFLOW}/execute`, then polling `GET .../executions/{executionId}` for the register result |
| Client file | `GET /v2/{individuals\|organizations}/{entityId}/serviceprofiles/{service}` (latest risk assessment), `GET .../workflows/{workflow}/executions` (every run, per workflow), `GET /v2/{individuals\|organizations}/{entityId}/documents`, `GET /v2/audit?entityId=` |
| View a photo or file | `GET /v2/{individuals\|organizations}/{entityId}/documents/{documentId}?level=base64`, streamed through the platform after checking the document is in that intermediary's file |
| Add a document | `POST /v2/{individuals\|organizations}/{entityId}/documents` with the file as an attachment |
| ID verification link | `POST /v2/individuals/hostedUrl` with the OneSDK flow (`IDV_FLOW`) |
| No ABN or ACN | No register call. The intermediary is asked for the establishing document (trust deed, partnership agreement), attached with `POST /v2/organizations/{entityId}/documents` |

## What the platform layer does

All in `server/`:

| Component | File | What it does |
|---|---|---|
| Intermediary access | `tier1.mjs` | One token per intermediary; a token reaches that intermediary's clients only |
| Identity index | `tier1.mjs`, `store.mjs` | HMACs of identity document type, country and number, pointing at FrankieOne records. Email and phone never match on their own. Businesses are keyed by ABN or ACN; without one, by normalised name and postcode, which only ever holds a submission for review |
| Handle derivation | `tier1.mjs` | A one-way handle per intermediary per investor, so two intermediaries comparing lists can't match them |
| Response builder | `tier1.mjs` | Copies only the fields in `PERMITTED_FIELDS` (`config.mjs`). A new field in FrankieOne's response is ignored until it's added (fails closed) |
| Outcome mapping | `tier1.mjs` | Workflow results become `VERIFIED`, `IN_REVIEW`, `ACTION_REQUIRED` or `DECLINED`, with a risk band rather than a score, and neutral messages |
| Duplicate check and merge engine | `tier1.mjs` | Runs FrankieOne's duplicate check on every record the platform creates; merges automatically only on an identity document and exact date of birth with a single candidate; otherwise holds it for compliance. Every merge records its reason and can be reversed. Handles never change through a merge |
| Probing controls | `tier1.mjs` | Consent required per submission, a rate limit per intermediary, a minimum response time, and a record of every submission's outcome |
| Client file | `clientfile.mjs` | Builds the file from FrankieOne's runs, risk, documents and audit trail. Attributes each run to the relationship it was for, and scopes the intermediary's version to its own runs and documents |
| Request queue | `queue.mjs` | A cap on concurrent FrankieOne calls, round robin between intermediaries, one investor at a time, and retry on a rate-limit response |
| Relationship store and disclosure log | `store.mjs` | Which intermediary holds which investor, and what each was shown and when |
| FrankieOne client | `frankie.mjs` | The only code with the API key |

Policies (minimum response time, rate limit, reuse window, concurrency, automatic merging) and the intermediary list are in `server/config.mjs`. The three named intermediaries are the demo; the other 297 show that adding one is a config entry.

## Simplified for the demo

- **Storage** is one JSON file in `data/` (ignored by git). In production these are tables, and the platform's secrets come from a secrets manager.
- **Webhooks**: the server polls FrankieOne when an intermediary checks status, because a laptop can't receive webhooks. In production FrankieOne's webhooks go to the platform, routed by verification, never by client.
- **Reuse window**: whether checks already held satisfy a new onboarding is set in FrankieOne's workflow configuration. The example runs each intermediary's workflow; it doesn't decide reuse itself.
- **The duplicate check** runs as its own workflow (`DUPLICATE_WORKFLOW`) when the platform creates a record, before the intermediary's own workflow. On a dedicated account it can equally be a step inside each intermediary's workflow.
- **Shared demo account**: the demo account holds many copies of the same UAT test people from other demos, and FrankieOne's duplicate check matches them all. With `SHARED_DEMO_ACCOUNT=true` (the default), matches against records that aren't the platform's are set aside. On a dedicated account, set it to `false`: every record is the platform's, so every match is a candidate.
- **FrankieOne's PDF audit report** for an individual is generated in the FrankieOne Portal. The **Client file (PDF)** here is the platform's own report, built from the same data, so it can be scoped per intermediary.
- **The start page** hands out intermediary tokens so a presenter can switch between them. In production, tokens are issued privately and the platform view sits behind staff sign-in on a separate host.

Not built yet, but covered by the same design: an intermediary updating a client's details, routing ongoing monitoring alerts to every intermediary holding a person, a network blocklist, and intermediaries who supply their own KYC under reliance.
