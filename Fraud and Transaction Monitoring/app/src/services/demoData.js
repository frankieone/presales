/**
 * Demo data helpers. The people and companies for each vertical live in
 * src/config/verticals.js; the presenter's fraud email and phone options here
 * are shared by all three.
 */

import { vertical } from '../config';

/**
 * Test email addresses for the presenter panel. Each flags only if a matching
 * rule is Live (not Shadow) in the account's Sardine configuration — see the
 * folder README for the rules the demo expects.
 */
export const FRAUD_EMAILS = [
  {
    // The demo's main email example: a rule rating highrisk.com as high risk.
    label: 'highrisk.com — flags in workflows',
    email: (given, family) => `${given}.${family}@highrisk.com`.toLowerCase(),
    expect: 'HIGH',
    rule: 'High-risk email domain',
  },
  {
    label: 'Clean — nothing flagged',
    email: (given, family) => `${given}.${family}@gmail.com`.toLowerCase(),
    expect: 'LOW',
    rule: null,
  },
  {
    label: 'Name mismatch',
    email: () => 'qz88x1@gmail.com',
    expect: 'HIGH',
    rule: 'Email Name Mismatch',
  },
  {
    label: 'Domain flagged very high',
    email: (given, family) => `${given}.${family}@fraudalertveryhigh.com`.toLowerCase(),
    expect: 'HIGH',
    rule: 'Email Domain Very High',
  },
  {
    label: 'Domain under 7 days old',
    email: (given, family) => `${given}.${family}@fraudalerthigh.com`.toLowerCase(),
    expect: 'HIGH',
    rule: 'Email Under 7 Days Old',
  },
];

/**
 * Phone numbers for the demo.
 *
 * Six sixes is the demo's "obviously suspicious" number. It only produces an
 * alert once a matching rule is Live in Sardine, for example:
 *
 *   Phone.Number in ["+61403666666", "0403666666", "+61466666666", "0466666666"]
 *     -> riskLevel=high
 *
 * or, if the editor supports it, Contains(Phone.Number, "666666").
 */
export const DEMO_PHONES = [
  { label: 'Ordinary mobile', value: '0412345678', expect: 'LOW' },
  { label: 'Six sixes — suspicious', value: '0403666666', expect: 'HIGH', needsRule: true },
];

export function scenarioAt(index = 0) {
  const list = vertical.scenarios;
  return list[((index % list.length) + list.length) % list.length];
}

export function scenarioById(id) {
  return vertical.scenarios.find((s) => s.id === id) || vertical.scenarios[0];
}

/** The scenario's next related person not already added, so repeated fills walk the list. */
export function nextMember(scenario, alreadyAdded = []) {
  const taken = new Set(alreadyAdded.map((m) => `${m.givenName} ${m.familyName}`.toUpperCase()));
  return (scenario.members || []).find((m) => !taken.has(`${m.givenName} ${m.familyName}`.toUpperCase())) || null;
}
