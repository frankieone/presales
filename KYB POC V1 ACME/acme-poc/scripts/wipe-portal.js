#!/usr/bin/env node

/**
 * Wipe ALL entities from the FrankieOne portal.
 *
 * The v1.2 API has no "list all entities" endpoint, so we must discover them:
 *   1. Run ownership queries for every known/test org → collects root + associated entity IDs
 *   2. Walk parentAssociations for each entity → finds linked parents/children
 *   3. Disassociate every child from its parent org (DELETE /business/{orgId}/associateEntity/{childId})
 *   4. Delete every entity (DELETE /entity/{entityId})
 *   5. Re-query all orgs to catch newly-created root entities from step 1 and delete those too
 *
 * The ownership query itself creates entities, so the final cleanup pass is essential.
 *
 * Usage: node scripts/wipe-portal.js [--dry-run]
 */

const fs = require("fs");
const path = require("path");

const DRY_RUN = process.argv.includes("--dry-run");

// ── Config ──

const envContent = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const API_BASE = env.FRANKIE_API_BASE_URL || "https://api.demo.frankiefinancial.io/compliance/v1.2";
const CUSTOMER_ID = env.FRANKIE_CUSTOMER_ID;
const API_KEY = env.FRANKIE_API_KEY;
const CHILD_ID = env.FRANKIE_CUSTOMER_CHILD_ID;

function headers() {
  const h = {
    "Content-Type": "application/json",
    "X-Frankie-CustomerID": CUSTOMER_ID,
    "api_key": API_KEY,
  };
  if (CHILD_ID) h["X-Frankie-CustomerChildID"] = CHILD_ID;
  return h;
}

// Known test orgs — add any org you've ever queried here
const KNOWN_ORGS = [
  { name: "FOX PTY. LTD.", abn: "37052121347" },
  { name: "164 GLEBE POINT ROAD PTY LTD", abn: "155228890" },
  { name: "BOOTH CORPORATION PTY LTD", abn: "89060748156" },
  { name: "ULTRA TUNE AUSTRALIA PTY. LTD.", abn: "52065214708" },
  { name: "ALPHABET TECHNOLOGIES PTY LTD", abn: "37615828816" },
  { name: "THE FALCON COMPANY PTY. LTD.", abn: "54154382331" },
  { name: "FLAY INVESTMENTS PTY LIMITED", abn: "39129175506" },
  { name: "MR. FOX CO. PTY. LTD.", abn: "53638148811" },
  { name: "TOLL PTY LIMITED", abn: "59000697861" },
];

// ── API helpers ──

async function poll(requestId) {
  for (let i = 0; i < 15; i++) {
    await sleep(3000);
    const r = await fetch(`${API_BASE}/retrieve/response/${requestId}`, { headers: headers() });
    if (r.status === 200) {
      const raw = await r.json();
      let payload = raw.payload || raw;
      if (typeof payload === "string") payload = JSON.parse(payload);
      return payload;
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ownershipQuery(abn, name) {
  const org = {
    entityType: "ORGANISATION",
    extraData: [{ kvpKey: "ABN", kvpType: "id.external", kvpValue: abn }],
    name: { displayName: name },
  };
  const r = await fetch(`${API_BASE}/business/ownership/query?ownershipMode=full`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ organisation: org }),
  });
  let data = await r.json();
  if (r.status === 202 && data.requestId) {
    data = await poll(data.requestId);
  }
  return data;
}

async function getParentAssociations(entityId) {
  const r = await fetch(`${API_BASE}/business/${entityId}/parentAssociations`, { headers: headers() });
  if (r.status === 200) return r.json();
  return null;
}

async function disassociate(orgEntityId, childEntityId) {
  if (DRY_RUN) { console.log(`  [dry-run] Would disassociate ${childEntityId} from ${orgEntityId}`); return 200; }
  const r = await fetch(`${API_BASE}/business/${orgEntityId}/associateEntity/${childEntityId}`, {
    method: "DELETE",
    headers: headers(),
  });
  return r.status;
}

async function deleteEntity(entityId) {
  if (DRY_RUN) { console.log(`  [dry-run] Would delete ${entityId}`); return 200; }
  const r = await fetch(`${API_BASE}/entity/${entityId}`, { method: "DELETE", headers: headers() });
  return r.status;
}

async function entityExists(entityId) {
  const r = await fetch(`${API_BASE}/entity/${entityId}`, { headers: headers() });
  return r.status === 200;
}

// ── Discovery ──

function collectIds(obj, ids) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) { for (const item of obj) collectIds(item, ids); return; }
  if (obj.entityId && typeof obj.entityId === "string") ids.add(obj.entityId);
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object") collectIds(val, ids);
  }
}

/**
 * Query an org's ownership tree and return:
 *   - all discovered entity IDs
 *   - the root entity ID
 *   - a map of associations: childId -> Set<parentOrgId>
 */
async function discoverOrg(abn, name) {
  const ids = new Set();
  const associations = new Map(); // childId -> Set<parentOrgId>

  const data = await ownershipQuery(abn, name);
  if (!data) return { ids, rootId: null, associations };

  const oqr = data.ownershipQueryResult || {};
  const rootId = oqr.entityId || null;
  collectIds(data, ids);

  // Build association map from ownershipDetails (orgId -> officers[].entityId)
  const ownershipDetails = oqr.ownershipDetails || {};
  for (const [orgId, details] of Object.entries(ownershipDetails)) {
    const officers = details.officers || [];
    for (const off of officers) {
      if (off.entityId && off.entityId !== orgId) {
        if (!associations.has(off.entityId)) associations.set(off.entityId, new Set());
        associations.get(off.entityId).add(orgId);
      }
    }
  }

  // Also check associatedEntities for org-child relationships
  const assocEntities = oqr.associatedEntities || {};
  for (const [id] of Object.entries(assocEntities)) {
    if (id !== rootId) {
      if (!associations.has(id)) associations.set(id, new Set());
      associations.get(id).add(rootId);
    }
  }

  return { ids, rootId, associations };
}

// ── Main ──

async function main() {
  console.log("=== FrankieOne Portal Wipe ===");
  if (DRY_RUN) console.log("*** DRY RUN — no changes will be made ***");
  console.log(`API: ${API_BASE}`);
  console.log(`Customer: ${CUSTOMER_ID}`);
  console.log(`Child: ${CHILD_ID || "(none)"}\n`);

  const allIds = new Set();
  const allAssociations = new Map(); // childId -> Set<parentOrgId>
  const rootIds = new Set();

  // ── Phase 1: Discover all entities via ownership queries ──
  console.log("Phase 1: Discovering entities via ownership queries...");
  for (const org of KNOWN_ORGS) {
    process.stdout.write(`  ${org.name}...`);
    const { ids, rootId, associations } = await discoverOrg(org.abn, org.name);
    const newCount = [...ids].filter((id) => !allIds.has(id)).length;
    for (const id of ids) allIds.add(id);
    if (rootId) rootIds.add(rootId);
    for (const [childId, parentSet] of associations) {
      if (!allAssociations.has(childId)) allAssociations.set(childId, new Set());
      for (const p of parentSet) allAssociations.get(childId).add(p);
    }
    console.log(` ${ids.size} entities (${newCount} new)`);
  }

  // ── Phase 2: Walk parentAssociations to find more linked entities ──
  console.log("\nPhase 2: Walking parentAssociations...");
  const checked = new Set();
  let extraFound = 0;
  const toCheck = [...allIds];
  for (const id of toCheck) {
    if (checked.has(id)) continue;
    checked.add(id);
    const pa = await getParentAssociations(id);
    if (!pa || !pa.parentAssociations) continue;
    for (const entry of pa.parentAssociations) {
      if (entry.associations) {
        for (const assoc of entry.associations) {
          if (assoc.parentId) {
            if (!allIds.has(assoc.parentId)) { allIds.add(assoc.parentId); extraFound++; toCheck.push(assoc.parentId); }
            if (!allAssociations.has(entry.entityId)) allAssociations.set(entry.entityId, new Set());
            allAssociations.get(entry.entityId).add(assoc.parentId);
          }
        }
      }
    }
  }
  console.log(`  Found ${extraFound} additional entities`);

  console.log(`\nTotal discovered: ${allIds.size} entities, ${allAssociations.size} associations\n`);

  if (allIds.size === 0) {
    console.log("Portal appears clean!");
    return;
  }

  // ── Phase 3: Disassociate all child-parent relationships ──
  console.log("Phase 3: Disassociating entities from parent orgs...");
  let disassociated = 0;
  let disassocFailed = 0;
  for (const [childId, parentIds] of allAssociations) {
    for (const parentId of parentIds) {
      const status = await disassociate(parentId, childId);
      if (status === 200 || status === 204) {
        disassociated++;
      } else if (status !== 404) {
        disassocFailed++;
      }
    }
  }
  console.log(`  Disassociated: ${disassociated}, Failed: ${disassocFailed}\n`);

  // ── Phase 4: Delete all entities (children first, then roots) ──
  console.log("Phase 4: Deleting all entities...");
  const childIds = [...allIds].filter((id) => !rootIds.has(id));
  const rootIdList = [...allIds].filter((id) => rootIds.has(id));
  const deleteOrder = [...childIds, ...rootIdList]; // children first

  let deleted = 0;
  let alreadyGone = 0;
  let deleteFailed = 0;
  for (const id of deleteOrder) {
    const status = await deleteEntity(id);
    if (status === 200 || status === 204) {
      deleted++;
    } else if (status === 404) {
      alreadyGone++;
    } else {
      deleteFailed++;
      console.log(`  FAILED ${id} (status ${status})`);
    }
  }
  console.log(`  Deleted: ${deleted}, Already gone: ${alreadyGone}, Failed: ${deleteFailed}\n`);

  // ── Phase 5: Cleanup pass — the ownership queries in Phase 1 created new root entities ──
  // We need to delete those too. Re-query each org ONCE more, but this time
  // we only need the root entityId (no full tree walk needed).
  console.log("Phase 5: Cleaning up entities created by discovery queries...");
  let cleanupDeleted = 0;
  for (const org of KNOWN_ORGS) {
    const data = await ownershipQuery(org.abn, org.name);
    if (!data) continue;
    const oqr = data.ownershipQueryResult || {};
    const rootId = oqr.entityId;
    if (rootId) {
      const status = await deleteEntity(rootId);
      if (status === 200 || status === 204) cleanupDeleted++;
    }
  }
  // Those cleanup queries also created entities — delete those final ones
  console.log(`  Deleted ${cleanupDeleted} root entities from discovery`);

  console.log("\nPhase 6: Final cleanup — deleting entities from Phase 5 queries...");
  let finalDeleted = 0;
  for (const org of KNOWN_ORGS) {
    const data = await ownershipQuery(org.abn, org.name);
    if (!data) continue;
    const rootId = (data.ownershipQueryResult || {}).entityId;
    if (rootId) {
      const status = await deleteEntity(rootId);
      if (status === 200 || status === 204) finalDeleted++;
    }
  }
  console.log(`  Deleted ${finalDeleted} final root entities`);

  // ── Phase 7: Verification ──
  console.log("\nPhase 7: Verifying portal is clean...");
  let survivors = 0;
  for (const id of allIds) {
    if (await entityExists(id)) {
      console.log(`  SURVIVOR: ${id}`);
      survivors++;
    }
  }
  if (survivors === 0) {
    console.log("  All original entities confirmed deleted!");
  } else {
    console.log(`  WARNING: ${survivors} entities still exist`);
  }

  console.log("\n=== Wipe complete ===");
  console.log("Note: The last round of ownership queries created fresh root entities.");
  console.log("These are empty (no associations) and will be auto-cleaned on next wipe.");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
