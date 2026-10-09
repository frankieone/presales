/**
 * Everything the platform layer decides by configuration rather than code.
 *
 * The platform (a placeholder clearing house, "Harbourline Clearing") runs
 * one FrankieOne account for every intermediary that sells its onboarding.
 * Adding an intermediary is an entry here; nothing changes in FrankieOne.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

// ── settings from .env.local (server-side only; never sent to a browser) ──
const envFile = path.join(ROOT, '.env.local');
const envText = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
export function setting(name, fallback = '') {
  const m = envText.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : fallback;
}

export const FRANKIE = {
  server: setting('FRANKIE_API_URL', 'https://api.uat.frankie.one'),
  customerId: setting('FRANKIE_CUSTOMER_ID'),
  customerChildId: setting('FRANKIE_CUSTOMER_CHILD_ID'),
  apiKey: setting('FRANKIE_API_KEY'),
  serviceName: setting('FRANKIE_SERVICE_NAME', 'DEFAULT'),
};

// Keys the platform derives handles, index keys and tokens from. In production
// these come from a secrets manager; one per purpose, rotated independently.
export const SECRET = setting('PLATFORM_SECRET', 'change-me-in-env-local');

export const PLATFORM = {
  name: setting('PLATFORM_NAME', 'Harbourline Clearing'),
  envLabel: setting('ENV_LABEL', 'FrankieOne UAT'),
  port: Number(setting('PORT', '8100')),
  dataDir: path.join(ROOT, 'data'),
};

/**
 * Policies the platform owns (the "decisions" in the design). Changing one is
 * a config edit, not a build.
 */
export const POLICY = {
  // Every intermediary response takes at least this long, so a reused
  // onboarding can't be told apart from a fresh one by timing.
  minResponseMs: Number(setting('MIN_RESPONSE_MS', '6000')),
  // Submissions per intermediary per minute, against probing.
  ratePerMinute: Number(setting('RATE_PER_MINUTE', '30')),
  // How long checks already held count towards another onboarding. Applied in
  // FrankieOne's workflow configuration; shown here so the console can say so.
  reuseWindowDays: Number(setting('REUSE_WINDOW_DAYS', '90')),
  // Concurrent FrankieOne calls across every intermediary (the shared limit).
  maxConcurrent: Number(setting('MAX_CONCURRENT', '4')),
};

/**
 * The fields an intermediary may ever receive. The response builder copies
 * these and nothing else, so a new field in FrankieOne's response can't leak
 * through (a permitted list fails closed).
 */
export const PERMITTED_FIELDS = [
  'handle', 'clientRef', 'name', 'dateOfBirth',
  'status', 'riskBand', 'method', 'completedAt',
  'actions', 'createdAt', 'updatedAt',
];

/**
 * The named intermediaries the demo is presented with, each on its own
 * workflow: an adviser runs identity plus PEP and sanctions; an app broker
 * adds an ID document check. Both run against the same investor record.
 */
const NAMED = [
  { id: 'northgate', name: 'Northgate Advisers', kind: 'Financial adviser', colour: '#2563EB', workflow: 'AUS-Basic2V-TwoPlus' },
  { id: 'bluewave', name: 'Bluewave Brokers', kind: 'App-based broker', colour: '#0D9488', workflow: 'AUS-Basic2V-TwoPlusID' },
  { id: 'kestrel', name: 'Kestrel Wealth', kind: 'Private wealth', colour: '#7C3AED', workflow: 'AUS-Basic2V-TwoPlus' },
];

// The rest of the network, to show that 300 intermediaries is configuration.
const PREFIXES = ['Anchor', 'Banksia', 'Coastal', 'Drummond', 'Eastwood', 'Fairhaven', 'Granite', 'Highline', 'Ironbark', 'Juniper', 'Kingfisher', 'Lighthouse', 'Mariner', 'Norfolk', 'Oakridge', 'Pinnacle', 'Quayside', 'Redgum', 'Summit', 'Tasman', 'Unity', 'Vantage', 'Wattle', 'Yarra', 'Zenith'];
const SUFFIXES = ['Advisory', 'Securities', 'Partners', 'Private', 'Capital', 'Investing', 'Wealth', 'Broking', 'Financial', 'Planning', 'Trading', 'Equities'];
const GENERATED = [];
for (let i = 0; GENERATED.length < 300 - NAMED.length; i++) {
  const p = PREFIXES[i % PREFIXES.length];
  const s = SUFFIXES[Math.floor(i / PREFIXES.length) % SUFFIXES.length];
  GENERATED.push({
    id: `im-${String(i + 1).padStart(3, '0')}`,
    name: `${p} ${s}`,
    kind: i % 3 ? 'Financial adviser' : 'Broker',
    colour: '#475569',
    workflow: i % 3 ? 'AUS-Basic2V-TwoPlus' : 'AUS-Basic2V-TwoPlusID',
  });
}

export const INTERMEDIARIES = [...NAMED, ...GENERATED];
export const NAMED_IDS = NAMED.map((i) => i.id);
export const byId = Object.fromEntries(INTERMEDIARIES.map((i) => [i.id, i]));

/** The external reference name an intermediary's client ID is stored under. */
export const refName = (intermediaryId) => `INTERMEDIARY_${intermediaryId.toUpperCase().replace(/-/g, '_')}`;
