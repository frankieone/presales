/**
 * The platform's own records, kept in one JSON file so the example has no
 * database to install. In production each of these is a table:
 *
 *   index          hashed identity keys → FrankieOne entity ID. Holds no
 *                  personal data, only HMACs of document identifiers.
 *   relationships  which intermediary holds which investor: their client
 *                  reference, handle, verification and submitted details.
 *   disclosures    what each intermediary was shown, and when.
 *   submissions    every submission per intermediary, for probing controls.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PLATFORM } from './config.mjs';

const FILE = path.join(PLATFORM.dataDir, 'store.json');
const EMPTY = { index: {}, relationships: [], disclosures: [], submissions: [] };

let db = load();

function load() {
  try {
    return { ...EMPTY, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  } catch {
    return structuredClone(EMPTY);
  }
}

function save() {
  fs.mkdirSync(PLATFORM.dataDir, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

export const store = {
  // identity index
  lookup: (key) => db.index[key] || null,
  remember(key, entityId) { db.index[key] = entityId; save(); },

  // relationships
  relationshipsFor: (intermediaryId) => db.relationships.filter((r) => r.intermediaryId === intermediaryId && !r.removedAt),
  relationshipsOf: (entityId) => db.relationships.filter((r) => r.entityId === entityId && !r.removedAt),
  find: (intermediaryId, handle) => db.relationships.find((r) => r.intermediaryId === intermediaryId && r.handle === handle && !r.removedAt),
  findByEntity: (intermediaryId, entityId) => db.relationships.find((r) => r.intermediaryId === intermediaryId && r.entityId === entityId && !r.removedAt),
  add(rel) { db.relationships.push(rel); save(); return rel; },
  update(rel, changes) { Object.assign(rel, changes, { updatedAt: new Date().toISOString() }); save(); return rel; },
  allRelationships: () => db.relationships,

  // disclosure log
  disclose(intermediaryId, handle, fields, action) {
    db.disclosures.push({ at: new Date().toISOString(), intermediaryId, handle, action, fields });
    if (db.disclosures.length > 2000) db.disclosures = db.disclosures.slice(-2000);
    save();
  },
  disclosures: () => db.disclosures,

  // submissions (for submit-then-abandon and rate limiting)
  submitted(intermediaryId, outcome) {
    db.submissions.push({ at: new Date().toISOString(), intermediaryId, outcome });
    if (db.submissions.length > 5000) db.submissions = db.submissions.slice(-5000);
    save();
  },
  submissions: () => db.submissions,

  stats: () => ({ indexKeys: Object.keys(db.index).length }),
  reset() { db = structuredClone(EMPTY); save(); },
};
