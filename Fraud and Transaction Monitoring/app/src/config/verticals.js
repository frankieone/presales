/**
 * The three demos this app runs as. Everything that differs between them —
 * brand, wording, what the application creates in FrankieOne, who else is
 * added, and the demo data — lives here. Pure data: no imports from the app,
 * so the start-up checks (scripts/preflight.mjs) can load it under Node too.
 *
 * Brands are placeholders. Pick a vertical with VITE_VERTICAL (the npm scripts
 * do this): banking, super or smsf.
 *
 * Demo people. Applicants are FrankieOne's published UAT test identities
 * (https://docs.frankieone.com/docs/uat-test-data), so they pass KYC in UAT —
 * keep their names, dates of birth and addresses exactly as published.
 * Related people are fictional; the fraud checks they get need no KYC match.
 * The email and phone values carry the fraud examples, given matching rules
 * in Sardine (see the folder README):
 *   - an address at highrisk.com → email rated high risk
 *   - 0403 666 666 → phone rated high risk
 */

// Published UAT test identities: https://docs.frankieone.com/docs/uat-test-data
const TESTONE = {
  givenName: 'JAMES', familyName: 'TESTONE', dateOfBirth: '1950-01-01',
  email: 'james.testone@example.com', phone: '0412000001',
  unitNumber: 'U 1', streetNumber: '35', streetName: 'Conn', streetType: 'Street',
  locality: 'Ferntree Gully', state: 'VIC', postalCode: '3156',
};
const TESTSEVEN = {
  givenName: 'GEOFF', familyName: 'TESTSEVEN', dateOfBirth: '1956-01-01',
  email: 'geoff.testseven@example.com', phone: '0412000005',
  streetNumber: '31', streetName: 'Poynton', streetType: 'Street',
  locality: 'Ceduna', state: 'SA', postalCode: '5690',
};

// The same three related people show each outcome in every vertical that has
// related people: one flagged on email, one on phone, one clean.
// Fictional: only their email and phone are checked when they're added.
const flaggedEmailPerson = {
  givenName: 'ALEX', familyName: 'HARPER', dateOfBirth: '1985-03-14',
  email: 'alex.harper@highrisk.com', phone: '0412000002',
};
const flaggedPhonePerson = {
  givenName: 'JORDAN', familyName: 'REED', dateOfBirth: '1979-11-02',
  email: 'jordan.reed@example.com', phone: '0403666666',
};
const cleanPerson = {
  givenName: 'CASEY', familyName: 'MORGAN', dateOfBirth: '1992-05-14',
  email: 'casey.morgan@example.com', phone: '0412000004',
};

/** SMSF trustee structures, per the ATO: every member is a trustee or a director of the corporate trustee. */
export const TRUSTEE_STRUCTURES = {
  INDIVIDUAL: {
    id: 'INDIVIDUAL',
    label: 'Individual trustees',
    blurb: 'Every member is a trustee of the fund, and every trustee is a member.',
    memberRole: { code: 'TRUSTEE', description: 'Individual Trustee' },
    needsCompany: false,
  },
  CORPORATE: {
    id: 'CORPORATE',
    label: 'Corporate trustee',
    blurb: 'A company acts as trustee. Every member must be a director of it.',
    memberRole: { code: 'DR', description: 'Director' },
    needsCompany: true,
  },
};

export const VERTICALS = {
  banking: {
    id: 'banking',
    brand: {
      name: 'Harbour Bank',
      mark: 'H',
      theme: 'teal',
      product: 'Business banking',
    },
    site: {
      nav: ['Business', 'Personal', 'Rates'],
      headline: 'Open a business account online, in minutes.',
      sub: "Register your interest, then complete your business's application in online banking, at your own pace.",
      bullets: [
        'Everyday business accounts and cards',
        'Add directors and signatories online',
        'One login for the business\'s primary contact',
      ],
      registerSub: "For the business's primary contact.",
      portalName: 'Online banking',
    },
    // What registration creates in FrankieOne besides the person.
    container: {
      kind: 'business',
      organizationType: 'COMPANY',
      contactRole: { code: 'DR', description: 'Primary Contact' },
      pendingLabel: 'Your new business account (name to come)',
      sidebarLabel: 'Business',
      sidebarFallback: 'Your business',
    },
    application: {
      title: 'Your business account application',
      nameSection: '1. The business',
      nameLabel: 'Registered business name',
      namePlaceholder: 'ACME TRADING PTY LTD',
      nameHint: 'The company that will hold the account.',
      detailsSection: '2. Your details',
      peopleSection: '3. Directors and signatories',
      peopleBlurb: 'Add everyone who will be a director or signatory on the account. Each one is sent a link to verify their identity.',
      submittedBody: "Thanks — we'll review the application for {name} and be in touch.",
    },
    people: {
      enabled: true,
      navLabel: 'Directors',
      heading: 'Who else is on the account?',
      intro: 'Tell us about the other directors and signatories, so each one can be verified.',
      listTitle: 'Directors and signatories',
      listBlurb: 'You only need a name to add someone — their record is created now and their details can follow.',
      max: 6,
      structures: null,
      role: { code: 'DR', description: 'Director' },
      applicantLabel: 'Primary contact',
    },
    member: {
      addedAs: 'a director and signatory on the business account for',
      declarationTitle: 'Signatory declaration',
      declaration: "I confirm I'm a director of the business and authorised to operate its accounts, and that the information I've provided is true and complete.",
      accept: 'I confirm my details are correct and accept the signatory declaration.',
      fallbackName: 'a new business account',
    },
    overview: { title: 'Your business', structureTitle: 'Your business', structureBlurb: 'The business and each of its directors and signatories.' },
    scenarios: [
      {
        id: 'testone-trading',
        container: { name: 'TESTONE TRADING PTY LTD' },
        applicant: TESTONE,
        members: [flaggedEmailPerson, flaggedPhonePerson, cleanPerson],
      },
    ],
  },

  super: {
    id: 'super',
    brand: {
      name: 'Summit Super',
      mark: 'S',
      theme: 'indigo',
      product: 'Superannuation',
    },
    site: {
      nav: ['Join', 'Investments', 'Insurance'],
      headline: 'Join a super fund that works as hard as you do.',
      sub: 'Join online in a few minutes, then bring your super together in member online.',
      bullets: [
        'Low fees and award-winning investment options',
        'Find and combine your other super',
        'Manage everything in member online',
      ],
      registerSub: 'Become a member.',
      portalName: 'Member online',
    },
    container: null,
    application: {
      title: 'Complete your membership',
      nameSection: null,
      detailsSection: '1. Your details',
      peopleSection: null,
      superSection: '2. Your super',
      submittedBody: "Thanks — your membership is being set up. We'll be in touch.",
    },
    people: { enabled: false },
    member: null,
    overview: { title: 'Your membership' },
    scenarios: [
      {
        id: 'testone',
        container: null,
        applicant: TESTONE,
        members: [],
      },
      {
        id: 'testseven',
        container: null,
        applicant: TESTSEVEN,
        members: [],
      },
    ],
  },

  smsf: {
    id: 'smsf',
    brand: {
      name: 'Keystone SMSF',
      mark: 'K',
      theme: 'blue',
      product: 'SMSF setup & administration',
    },
    site: {
      nav: ['How it works', 'Pricing', 'Investments'],
      headline: 'Set up your SMSF online, for a fixed annual fee.',
      sub: "Register in a minute. You'll complete your fund application in the client portal, at your own pace.",
      bullets: [
        'New self managed super funds, set up end to end',
        'Individual or corporate trustee structures',
        "One login for the fund's primary contact",
      ],
      registerSub: "For the fund's primary contact.",
      portalName: 'Client portal',
    },
    container: {
      kind: 'fund',
      organizationType: 'TRUST',
      contactRole: { code: 'TRUSTEE', description: 'Primary Contact' },
      pendingLabel: 'Your new fund (name to come)',
      sidebarLabel: 'Fund',
      sidebarFallback: 'Your new fund',
    },
    application: {
      title: 'Your fund application',
      nameSection: '1. The fund',
      nameLabel: 'Fund name',
      namePlaceholder: 'SMITH FAMILY SUPERANNUATION FUND',
      nameHint: 'A new SMSF — its ABN is applied for once the fund is established.',
      detailsSection: '2. Your details',
      peopleSection: '3. Members and trustees',
      peopleBlurb: "Choose the trustee structure and add the fund's other members. Each one is sent a link to verify their identity.",
      submittedBody: "Thanks — we'll review the application for {name} and be in touch.",
    },
    people: {
      enabled: true,
      navLabel: 'Members',
      heading: 'Who is in the fund?',
      intro: 'Your fund record is created. Now tell us about the other members, so each one can be verified.',
      listTitle: 'Fund members',
      listBlurb: 'An SMSF can have up to six members. You only need a name to add someone — their record is created now and their details can follow.',
      max: 6,
      structures: TRUSTEE_STRUCTURES,
      role: null,
      applicantLabel: 'Primary contact',
    },
    member: {
      addedAs: 'a member and trustee of',
      declarationTitle: 'Trustee declaration',
      declaration: "I understand my obligations as a trustee of a self managed super fund, including acting in the best interests of all members and keeping the fund's assets separate from my own.",
      accept: 'I confirm my details are correct and accept the trustee declaration.',
      fallbackName: 'your new self managed super fund',
    },
    overview: { title: 'Your fund', structureTitle: 'Your fund', structureBlurb: 'The fund, its trustee company and each of its members.' },
    scenarios: [
      {
        id: 'testone',
        container: { name: 'TESTONE FAMILY SUPERANNUATION FUND' },
        // No ACN or ABN: real registration numbers belong to real companies.
        company: { name: 'TESTONE SUPER PTY LTD', acn: '', abn: '' },
        applicant: TESTONE,
        members: [flaggedEmailPerson, flaggedPhonePerson, cleanPerson],
      },
    ],
  },
};

/** Fields every vertical must define — checked by the start-up tests. */
export const REQUIRED_KEYS = ['id', 'brand', 'site', 'application', 'people', 'overview', 'scenarios'];
