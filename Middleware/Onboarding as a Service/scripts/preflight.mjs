// Start-up checks: does the FrankieOne account in .env.local support this
// example? Prints pass or fail per check; exit code is the number of failures.
// Creates a throwaway record named PREFLIGHT CHECK in the account.
import { FRANKIE, INTERMEDIARIES, NAMED_IDS, SECRET, byId, refName } from '../server/config.mjs';
import * as frankie from '../server/frankie.mjs';

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const results = [];
async function check(name, fn) {
  const t = Date.now();
  try {
    const note = await fn();
    results.push(true);
    console.log(`  ${green('✓')} ${name}${note ? dim(` — ${note}`) : ''} ${dim(`${Date.now() - t}ms`)}`);
  } catch (err) {
    results.push(false);
    console.log(`  ${red('✗')} ${name}\n      ${red(err.message)}`);
  }
}
const assert = (c, m) => { if (!c) throw new Error(m); };

console.log(`\nStart-up checks · ${FRANKIE.server}\n`);

await check('Credentials present', async () => {
  const missing = [['FRANKIE_CUSTOMER_ID', FRANKIE.customerId], ['FRANKIE_API_KEY', FRANKIE.apiKey]].filter(([, v]) => !v).map(([k]) => k);
  assert(!missing.length, `missing in .env.local: ${missing.join(', ')}`);
  assert(SECRET !== 'change-me-in-env-local', 'set PLATFORM_SECRET in .env.local to a long random string');
});

await check(`Network configured`, async () => `${INTERMEDIARIES.length} intermediaries, ${NAMED_IDS.length} named for the demo`);

await check('Each named intermediary\'s workflow exists on the account', async () => {
  const names = new Set(((await frankie.listWorkflows()).workflows || []).map((w) => w.workflowName));
  const missing = [...new Set(NAMED_IDS.map((id) => byId[id].workflow))].filter((w) => !names.has(w));
  assert(!missing.length, `not on the account: ${missing.join(', ')}`);
  return [...new Set(NAMED_IDS.map((id) => byId[id].workflow))].join(', ');
});

await check('A second intermediary can be added to one record, and removed', async () => {
  const a = byId[NAMED_IDS[0]], b = byId[NAMED_IDS[1]];
  const created = await frankie.createIndividual({
    name: { givenName: 'PREFLIGHT', familyName: 'CHECK' },
    dateOfBirth: { year: '1990', month: '01', day: '01' },
    externalReferences: [{ name: refName(a.id), value: 'PREFLIGHT-A', type: 'CUSTOMER' }],
  });
  const entityId = created.individual?.entityId;
  assert(entityId, 'could not create a test record');
  const patched = await frankie.addReference(entityId, { name: refName(b.id), value: 'PREFLIGHT-B', type: 'CUSTOMER' });
  const ref = (patched.individual?.externalReferences || []).find((r) => r.name === refName(b.id));
  assert(ref?.referenceId, 'second reference was not added');
  await frankie.removeReference(entityId, ref.referenceId);
  return 'add and remove both work';
});

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${red(`${failed} of ${results.length} checks failed.`)}\n` : `\n${green(`All ${results.length} checks passed.`)}\n`);
process.exit(failed);
