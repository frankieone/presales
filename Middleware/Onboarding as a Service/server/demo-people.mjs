/**
 * FrankieOne's published UAT test identities
 * (https://docs.frankieone.com/docs/uat-test-data), in the shape the
 * intermediary console submits. Keep them exactly as published: they only
 * produce predictable results in UAT when every detail matches.
 */
export const DEMO_PEOPLE = [
  {
    id: 'testone', label: 'James Testone — verifies (driver licence)',
    person: {
      givenName: 'JAMES', middleName: 'A', familyName: 'TESTONE', dateOfBirth: '1950-01-01',
      address: { unitNumber: 'U 1', streetNumber: '35', streetName: 'CONN', streetType: 'STREET', locality: 'FERNTREE GULLY', subdivision: 'VIC', postalCode: '3156' },
      document: { type: 'DRIVERS_LICENSE', number: '283229690', secondary: 'P5403241', country: 'AUS', subdivision: 'VIC' },
      email: 'james.testone@example.com',
    },
  },
  {
    id: 'testone-medicare', label: 'James Testone — same person, Medicare card instead of licence',
    person: {
      givenName: 'JAMES', middleName: 'A', familyName: 'TESTONE', dateOfBirth: '1950-01-01',
      address: { unitNumber: 'U 1', streetNumber: '35', streetName: 'CONN', streetType: 'STREET', locality: 'FERNTREE GULLY', subdivision: 'VIC', postalCode: '3156' },
      document: { type: 'NATIONAL_HEALTH_ID', number: '6603984391', cardColour: 'G', cardReference: '1', nameOnCard: 'JAMES A TESTONE', expiry: '2030-01-01', country: 'AUS', subdivision: 'VIC' },
    },
  },
  {
    id: 'testseven', label: 'Geoff Testseven — verifies (Medicare)',
    person: {
      givenName: 'GEOFF', middleName: 'E', familyName: 'TESTSEVEN', dateOfBirth: '1956-01-01',
      address: { streetNumber: '31', streetName: 'POYNTON', streetType: 'STREET', locality: 'CEDUNA', subdivision: 'SA', postalCode: '5690' },
      document: { type: 'NATIONAL_HEALTH_ID', number: '2515129631', cardColour: 'G', cardReference: '3', nameOnCard: 'GEOFF E TESTSEVEN', expiry: '2030-01-01', country: 'AUS', subdivision: 'SA' },
    },
  },
  {
    id: 'testeight', label: 'Jenny Testeight — verifies (driver licence)',
    person: {
      givenName: 'JENNY', familyName: 'TESTEIGHT', dateOfBirth: '1957-01-01',
      address: { streetNumber: '56', streetName: 'VICTORIA', streetType: 'STREET', locality: 'FINGAL', subdivision: 'TAS', postalCode: '7214' },
      document: { type: 'DRIVERS_LICENSE', number: 'T56543', secondary: 'T03989853', country: 'AUS', subdivision: 'TAS' },
    },
  },
  {
    id: 'testeleven', label: 'James Testeleven — PEP match, held for review (passport)',
    person: {
      givenName: 'JAMES', middleName: 'G', familyName: 'TESTELEVEN', dateOfBirth: '1960-01-01',
      address: { streetNumber: '23', streetName: 'ISA', streetType: 'STREET', locality: 'FYSHWICK', subdivision: 'ACT', postalCode: '2609' },
      document: { type: 'PASSPORT', number: 'E55173628', country: 'AUS', expiry: '2030-01-01' },
    },
  },
];
