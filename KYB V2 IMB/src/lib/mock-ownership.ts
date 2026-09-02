/**
 * Mock ownership response for WOMBAT HOLDINGS PTY LTD.
 * Demonstrates a hybrid scenario: individuals + a blocking trust entity.
 *
 * Use ABN 99623456789 or ACN 623456789 to trigger this fixture.
 */

export const MOCK_ABN = '99623456789';
export const MOCK_ACN = '623456789';

export const MOCK_OWNERSHIP_RESPONSE = {
  uboResponse: {
    business_details: {
      ABN: '99623456789',
      ACN: '623456789',
      registered_name: 'WOMBAT HOLDINGS PTY LTD',
      entity_id: '3ecb09f9-8106-1beb-ea47-1766fdedd61b',
      asic_company_type: 'Australian Proprietary Company',
      date_registered_with_asic: '2018-03-15',
    },
    officeholders: [
      {
        name: 'Sarah Chen',
        date_of_birth: '1985-09-14',
        role: 'DR',
        entityId: 'f147e28c-fa76-52fb-7916-57d76696ebd9',
        addresses: [
          {
            country: 'AUS',
            state: 'NSW',
            town: 'SYDNEY',
            streetNumber: '50',
            streetName: 'PITT STREET',
            postalCode: '2000',
            longForm: '50 PITT STREET, SYDNEY, NSW, 2000',
          },
        ],
      },
      {
        name: 'Michael Wong',
        date_of_birth: '1978-03-22',
        role: 'DR',
        entityId: '7628a1e3-d459-d4e6-5b78-4777f9558839',
        addresses: [
          {
            country: 'AUS',
            state: 'VIC',
            town: 'MELBOURNE',
            streetNumber: '200',
            streetName: 'COLLINS STREET',
            postalCode: '3000',
            longForm: '200 COLLINS STREET, MELBOURNE, VIC, 3000',
          },
        ],
      },
      {
        name: 'Sarah Chen',
        date_of_birth: '1985-09-14',
        role: 'SR',
        entityId: 'f147e28c-fa76-52fb-7916-57d76696ebd9',
        addresses: [
          {
            country: 'AUS',
            state: 'NSW',
            town: 'SYDNEY',
            streetNumber: '50',
            streetName: 'PITT STREET',
            postalCode: '2000',
            longForm: '50 PITT STREET, SYDNEY, NSW, 2000',
          },
        ],
      },
    ],
    ultimate_beneficial_owners: [
      {
        name: 'Sarah Chen',
        date_of_birth: '1985-09-14',
        role: 'UBO',
        entityId: 'f147e28c-fa76-52fb-7916-57d76696ebd9',
        percent_owned: 30,
        beneficially_held: true,
        addresses: [
          {
            country: 'AUS',
            state: 'NSW',
            town: 'SYDNEY',
            streetNumber: '50',
            streetName: 'PITT STREET',
            postalCode: '2000',
            longForm: '50 PITT STREET, SYDNEY, NSW, 2000',
          },
        ],
      },
      {
        name: 'Michael Wong',
        date_of_birth: '1978-03-22',
        role: 'UBO',
        entityId: '7628a1e3-d459-d4e6-5b78-4777f9558839',
        percent_owned: 30,
        beneficially_held: true,
        addresses: [
          {
            country: 'AUS',
            state: 'VIC',
            town: 'MELBOURNE',
            streetNumber: '200',
            streetName: 'COLLINS STREET',
            postalCode: '3000',
            longForm: '200 COLLINS STREET, MELBOURNE, VIC, 3000',
          },
        ],
      },
    ],
  },
  ownershipQueryResult: {
    entityId: '3ecb09f9-8106-1beb-ea47-1766fdedd61b',
    blockingEntityIds: ['50430f38-eb1c-dd22-2320-3b244770279b'],
    blockingEntityDetails: {
      '50430f38-eb1c-dd22-2320-3b244770279b': {
        entityId: '50430f38-eb1c-dd22-2320-3b244770279b',
        entityType: 'ORGANISATION',
        percentageOwned: {
          nonBeneficially: 40,
          total: 40,
        },
        reasons: [
          {
            type: 'NON_BENEFICIAL_ORGANISATION',
            description:
              'WOMBAT FAMILY TRUST holds 40% non-beneficially, above the blocking threshold of 25%. Trust ownership cannot be resolved automatically — beneficial owners of the trust must be identified manually.',
          },
        ],
      },
    },
    associatedEntities: {
      '50430f38-eb1c-dd22-2320-3b244770279b': {
        entityId: '50430f38-eb1c-dd22-2320-3b244770279b',
        entityType: 'ORGANISATION',
        organisationData: {
          registeredName: 'WOMBAT FAMILY TRUST',
          registration: { date: '2015-07-01' },
          type: { code: 'TRUST', description: 'Trust' },
          status: { code: 'REGD', description: 'Registered' },
        },
        addresses: [
          {
            addressType: 'REGISTERED_OFFICE',
            country: 'AUS',
            state: 'NSW',
            town: 'SYDNEY',
            streetName: '100 GEORGE STREET',
            postalCode: '2000',
            longForm: '100 GEORGE STREET, SYDNEY, NSW, 2000',
          },
        ],
        extraData: [
          { kvpKey: 'ABN', kvpType: 'id.external', kvpValue: '88555666777' },
        ],
      },
    },
    ownershipPolicy: {
      blockingThreshold: 25,
      uboThreshold: 25,
      blockingDefinitions: [
        'NON_BENEFICIAL_ORGANISATION',
        'NON_BENEFICIAL_INDIVIDUAL',
        'ENTITY_TYPE_UNKNOWN',
        'ORGANISATION_NOT_FOUND',
      ],
    },
  },
  requestId: 'mock-wombat-holdings-001',
};
