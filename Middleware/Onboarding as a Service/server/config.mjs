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
  // Every intermediary onboarding response takes at least this long, so a
  // reused onboarding can't be told apart from a fresh one by timing. Set it
  // above the slowest normal path (a new record runs two workflows).
  minResponseMs: Number(setting('MIN_RESPONSE_MS', '10000')),
  // The same for business clients, which verify several people.
  minBusinessResponseMs: Number(setting('MIN_BUSINESS_RESPONSE_MS', '25000')),
  // Submissions per intermediary per minute, against probing.
  ratePerMinute: Number(setting('RATE_PER_MINUTE', '30')),
  // How long checks already held count towards another onboarding. Applied in
  // FrankieOne's workflow configuration; shown here so the console can say so.
  reuseWindowDays: Number(setting('REUSE_WINDOW_DAYS', '90')),
  // Concurrent FrankieOne calls across every intermediary (the shared limit).
  maxConcurrent: Number(setting('MAX_CONCURRENT', '4')),
  // Merge without a person only when a duplicate match includes the identity
  // document and an exact date of birth, and there is a single candidate.
  // Everything else is held for compliance.
  autoMergeOnDocumentAndDob: setting('AUTO_MERGE', 'true') !== 'false',
  // On a shared demo account, FrankieOne's duplicate check also matches
  // records that aren't the platform's (other demos' test people). Those are
  // set aside automatically. On a dedicated account, set this to false: every
  // record is the platform's, so every match is a candidate.
  sharedDemoAccount: setting('SHARED_DEMO_ACCOUNT', 'true') !== 'false',
  // Whether an intermediary sees the risk score from its own verifications, or the level only.
  shareRiskScore: setting('SHARE_RISK_SCORE', 'true') !== 'false',
  // Whether an intermediary sees the FrankieOne entity ID. It's the same for every intermediary
  // holding a client, so two intermediaries comparing IDs could tell they share one. Off hides it.
  shareEntityId: setting('SHARE_ENTITY_ID', 'true') !== 'false',
};

/**
 * The fields an intermediary may ever receive. The response builder copies
 * these and nothing else, so a new field in FrankieOne's response can't leak
 * through (a permitted list fails closed).
 */
export const PERMITTED_FIELDS = [
  'kind', 'handle', 'clientRef', 'name', 'dateOfBirth', 'businessType',
  'status', 'riskBand', 'method', 'completedAt',
  'actions', 'people', 'createdAt', 'updatedAt',
];
/** For a business client, each person is reported with these fields only. */
export const PERMITTED_PERSON_FIELDS = ['name', 'role', 'status'];

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

/**
 * The platform's safety net: a workflow with FrankieOne's duplicate check,
 * run once on every record the platform creates, before that intermediary's
 * own verification. It catches the same person the identity index missed,
 * for example someone who used a different document at each intermediary.
 */
export const DUPLICATE_WORKFLOW = setting('DUPLICATE_WORKFLOW', 'AUS-Basic2V-TwoPlus-Duplicate');
/** OneSDK flow for the hosted ID check (document photo and selfie) an intermediary can send a client. */
export const IDV_FLOW = setting('IDV_FLOW', 'idv_daon');

/**
 * The business registry check, run on a business client that has an ABN or
 * ACN. Businesses without either (many trusts and partnerships) have no
 * register to check, so the intermediary is asked for the document that
 * establishes the business instead.
 */
export const BUSINESS_WORKFLOW = setting('BUSINESS_WORKFLOW', 'GLB-Organization-Profile');

/** Roles a person can hold in a business client, as FrankieOne relationship roles. */
export const ROLES = {
  DIRECTOR: { code: 'DR', description: 'Director' },
  TRUSTEE: { code: 'TRUSTEE', description: 'Trustee' },
  PARTNER: { code: 'PARTNER', description: 'Partner' },
  BENEFICIAL_OWNER: { code: 'UBO', description: 'Beneficial owner' },
  SIGNATORY: { code: 'SIGNATORY', description: 'Authorised signatory' },
};
export const NAMED_IDS = NAMED.map((i) => i.id);
export const byId = Object.fromEntries(INTERMEDIARIES.map((i) => [i.id, i]));

/** The external reference name an intermediary's client ID is stored under. */
export const refName = (intermediaryId) => `INTERMEDIARY_${intermediaryId.toUpperCase().replace(/-/g, '_')}`;
