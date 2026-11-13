// Start the platform server and the screens together, after the start-up
// checks. Usage: npm run dev   (add -- --skip-checks to skip the checks)
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
if (!fs.existsSync(path.join(root, '.env.local'))) {
  console.error('Missing .env.local — copy env.example to .env.local and fill it in.');
  process.exit(1);
}
if (!process.argv.includes('--skip-checks')) {
  spawnSync(process.execPath, [path.join(root, 'scripts/preflight.mjs')], { stdio: 'inherit', cwd: root });
}

const children = [
  spawn(process.execPath, [path.join(root, 'server/index.mjs')], { stdio: 'inherit', cwd: root }),
  spawn('npx', ['vite'], { stdio: 'inherit', cwd: root, shell: process.platform === 'win32' }),
];
const stop = () => { for (const c of children) c.kill(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
console.log('\nOpen http://localhost:8101 — the platform server runs on 8100.\n');
