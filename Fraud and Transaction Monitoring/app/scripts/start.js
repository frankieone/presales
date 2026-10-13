#!/usr/bin/env node
/**
 * Start one or all of the demos.
 *
 *   node scripts/start.js <banking|super|smsf|all> [--skip-checks]
 *
 * Runs the pre-flight checks (scripts/preflight.mjs) once, reports any
 * failures, then starts the dev server(s). Each demo is Vite run in a mode
 * named after it (`--mode banking`); Vite loads .env.local in every mode, and
 * the app picks its vertical from the mode. The servers start even if a check
 * fails — the report says what won't work.
 */

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const [which = 'smsf'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const skipChecks = process.argv.includes('--skip-checks');

// One port per vertical, so all three can run side by side.
const PORTS = { banking: 8093, super: 8094, smsf: 8095 };

const verticals = which === 'all' ? Object.keys(PORTS) : [which];
const unknown = verticals.filter((v) => !PORTS[v]);
if (unknown.length) {
  console.error(`Unknown demo "${unknown.join(', ')}". Use one of: ${Object.keys(PORTS).join(', ')}, all`);
  process.exit(1);
}
if (!existsSync(resolve(root, '.env.local'))) {
  console.error('Missing .env.local — copy env.example to .env.local and fill in the account details.');
  process.exit(1);
}

if (!skipChecks) {
  const result = spawnSync(process.execPath, [resolve(here, 'preflight.mjs')], { stdio: 'inherit', cwd: root });
  if (result.status) {
    console.log('\x1b[33mStarting anyway — see the failures above before you present.\x1b[0m\n');
  }
}

const isWindows = process.platform === 'win32';
const children = verticals.map((vertical) => {
  const port = PORTS[vertical];
  console.log(`Starting ${vertical.padEnd(7)} on http://localhost:${port}`);
  return spawn(isWindows ? 'npx.cmd' : 'npx', ['vite', '--mode', vertical, '--port', String(port), '--strictPort'], {
    stdio: verticals.length > 1 ? ['ignore', 'ignore', 'inherit'] : 'inherit',
    cwd: root,
    shell: isWindows,
  });
});

if (verticals.length > 1) console.log('\nAll three running. Press Ctrl+C to stop them.\n');

process.on('SIGINT', () => { children.forEach((c) => c.kill()); process.exit(0); });
children.forEach((c) => c.on('close', (code) => {
  if (verticals.length === 1) process.exit(code ?? 0);
}));
