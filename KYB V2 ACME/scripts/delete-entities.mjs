#!/usr/bin/env node

/**
 * Delete all entities from a FrankieOne portal CSV export.
 *
 * Usage:
 *   node scripts/delete-entities.mjs <path-to-csv>
 *
 * The CSV is expected to have headers:
 *   entityName,customerReference,entityId,latestEventStatus,...
 *
 * It determines entity type (individual vs organization) from the
 * latestWorkflow column or entity name heuristics, and calls the
 * appropriate v2 DELETE endpoint.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const API_BASE = process.env.FRANKIE_API_V2_BASE_URL || 'https://api.uat.frankie.one';
const CUSTOMER_ID = process.env.FRANKIE_CUSTOMER_ID || '';
const API_KEY = process.env.FRANKIE_API_KEY || '';
const CUSTOMER_CHILD_ID = process.env.FRANKIE_CUSTOMER_CHILD_ID || '';

const headers = {
  'Content-Type': 'application/json',
  'X-Frankie-CustomerID': CUSTOMER_ID,
  'api_key': API_KEY,
};
if (CUSTOMER_CHILD_ID) {
  headers['X-Frankie-CustomerChildID'] = CUSTOMER_CHILD_ID;
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headerLine = lines[0];
  const colNames = parseCSVLine(headerLine);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const row = {};
    for (let j = 0; j < colNames.length; j++) {
      row[colNames[j].trim()] = (vals[j] || '').trim();
    }
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function isOrganization(row) {
  const workflow = (row.latestWorkflow || '').toLowerCase();
  if (workflow.includes('organization') || workflow.includes('kyb') || workflow.includes('business')) {
    return true;
  }
  const name = (row.entityName || '').toUpperCase();
  if (name.includes('PTY') || name.includes('LTD') || name.includes('LIMITED') || name.includes('CORP') || name.includes('INC')) {
    return true;
  }
  return false;
}

async function deleteEntity(entityId, isOrg) {
  const basePath = isOrg ? '/v2/organizations' : '/v2/individuals';
  const url = `${API_BASE}${basePath}/${entityId}`;
  const res = await fetch(url, { method: 'DELETE', headers });
  const body = await res.text();
  return { status: res.status, body };
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: node scripts/delete-entities.mjs <path-to-csv>');
    process.exit(1);
  }

  const fullPath = resolve(csvPath);
  const text = readFileSync(fullPath, 'utf-8');
  const rows = parseCSV(text);

  console.log(`Found ${rows.length} entities in CSV\n`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const entityId = row.entityId;
    if (!entityId) {
      skipped++;
      continue;
    }

    const isOrg = isOrganization(row);
    const type = isOrg ? 'ORG ' : 'IND ';
    const name = row.entityName || '(unnamed)';

    try {
      const { status, body } = await deleteEntity(entityId, isOrg);
      if (status === 200 || status === 204) {
        console.log(`  OK  ${type} ${name} (${entityId})`);
        success++;
      } else if (status === 404) {
        console.log(`  SKIP ${type} ${name} (${entityId}) — not found`);
        skipped++;
      } else {
        console.log(`  FAIL ${type} ${name} (${entityId}) — ${status}: ${body.slice(0, 120)}`);
        failed++;
      }
    } catch (err) {
      console.log(`  ERR  ${type} ${name} (${entityId}) — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} deleted, ${failed} failed, ${skipped} skipped`);
}

main();
