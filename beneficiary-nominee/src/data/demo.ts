import type {
  Beneficiary,
  Nomination,
  NominationStatus,
  Scheme,
  SystemUser,
} from './types'

const schemes: Scheme[] = [
  {
    id: 'DEMO-SCH-1',
    name: 'Old Mutual Retirement Fund',
    title: 'OMRF',
    schemeName: 'Old Mutual Retirement Fund',
    status: 'Active',
    sourceStatus: 'Active',
    createdDate: '2024-01-15',
  },
  {
    id: 'DEMO-SCH-2',
    name: 'Public Service Pension Scheme',
    title: 'PSPS',
    schemeName: 'Public Service Pension Scheme',
    status: 'Active',
    sourceStatus: 'Active',
    createdDate: '2024-02-01',
  },
  {
    id: 'DEMO-SCH-3',
    name: 'Unassigned Demo Scheme',
    title: 'UDS',
    schemeName: 'Unassigned Demo Scheme',
    status: 'Active',
    sourceStatus: 'Active',
    createdDate: '2024-03-01',
  },
]

const users: SystemUser[] = [
  {
    id: 'DEMO-PO-1',
    name: 'Thandiwe Moyo',
    email: 'thandiwe.moyo@oldmutual.co.mw',
    phone: '+265 888 000 101',
    role: 'Principal Officer',
    status: 'Active',
    sourceStatus: 'Active',
    schemeId: 'DEMO-SCH-1',
    schemeCode: 'OMRF',
    schemeName: 'Old Mutual Retirement Fund',
    createdDate: '2024-02-10',
  },
  {
    id: 'DEMO-PO-2',
    name: 'Peter Banda',
    email: 'peter.banda@oldmutual.co.mw',
    phone: '+265 888 000 102',
    role: 'Principal Officer',
    status: 'Active',
    sourceStatus: 'Active',
    schemeId: 'DEMO-SCH-2',
    schemeCode: 'PSPS',
    schemeName: 'Public Service Pension Scheme',
    createdDate: '2024-02-10',
  },
]

function makeNomination(
  id: string,
  referenceNumber: string,
  memberNumber: string,
  memberName: string,
  scheme: Scheme,
  status: NominationStatus,
  errors: string,
  modifiedDate: string,
  firstEndorser = '',
  secondEndorser = '',
): Nomination {
  return {
    id,
    referenceNumber,
    memberNumber,
    memberName,
    memberDob: '1984-05-12',
    branchCode: 'BLT-01',
    costCentre: 'CC-204',
    email: `${memberName.toLowerCase().replaceAll(' ', '.')}@example.com`,
    schemeId: scheme.id,
    schemeName: scheme.name,
    fundName: scheme.name,
    submissionDate: '2026-10-12',
    status,
    sourceStatus: status,
    errorStatus: errors === 'Clear'
      ? 'Clear'
      : errors === 'Missing Scheme'
        ? 'Missing Scheme'
        : errors === 'Missing Principal Officer'
          ? 'Missing Principal Officer'
          : errors === 'Missing Information'
            ? 'Missing Information'
            : null,
    sourceErrors: errors,
    comments: '',
    warnings: '',
    sourceFileName: '',
    sourceFileUrl: '',
    pdfDataUri: '',
    nomineeCount: 1,
    totalCurrentPct: 100,
    totalRevisedPct: 100,
    formVersion: '1.0',
    approvalHistory: [
      {
        id: `${id}-submitted`,
        stage: 'Submission',
        actor: 'Employee self-service',
        decision: 'Submitted',
        date: '2026-10-12',
        comments: 'Demo record',
      },
      ...(status === 'Pending PA' || status === 'Approved'
        ? [
            {
              id: `${id}-po`,
              stage: 'Principal Officer',
              actor: firstEndorser || 'Thandiwe Moyo',
              decision: 'Endorsed' as const,
              date: '2026-10-20',
              comments: 'Reviewed and endorsed.',
            },
          ]
        : []),
      ...(status === 'Approved'
        ? [
            {
              id: `${id}-pa`,
              stage: 'Pension Administrator',
              actor: secondEndorser || 'Nyasha Banda',
              decision: 'Approved' as const,
              date: '2026-10-22',
              comments: 'Final approval granted.',
            },
          ]
        : []),
    ],
    endorsement1Name: firstEndorser,
    endorsement1Email: firstEndorser
      ? 'thandiwe.moyo@example.com'
      : '',
    endorsement2Name: secondEndorser,
    endorsement2Email: secondEndorser
      ? 'nyasha.banda@example.com'
      : '',
    createdDate: '2026-10-12',
    modifiedDate,
  }
}

const nominations: Nomination[] = [
  makeNomination(
    'DEMO-NOM-1',
    'DEMO-2026-001',
    'OM-10001',
    'Lydia Phiri',
    schemes[0],
    'Tasks',
    'Missing Information',
    '2026-10-30',
  ),
  makeNomination(
    'DEMO-NOM-2',
    'DEMO-2026-002',
    'PS-20002',
    'James Zulu',
    schemes[2],
    'Tasks',
    'Missing Principal Officer',
    '2026-10-31',
  ),
  {
    ...makeNomination(
      'DEMO-NOM-7',
      'DEMO-2026-007',
      'OM-10007',
      'Aisha Kalua',
      schemes[0],
      'Tasks',
      'Missing Scheme',
      '2026-11-02',
    ),
    schemeId: '',
    schemeName: 'Unmatched Demo Scheme',
    fundName: 'Unmatched Demo Scheme',
    comments:
      '[2026-11-02] Demo Operations: Submitted scheme does not match an active scheme.',
  },
  makeNomination(
    'DEMO-NOM-6',
    'DEMO-2026-006',
    'OM-10006',
    'Chisomo Jere',
    schemes[0],
    'Tasks',
    'Clear',
    '2026-11-02',
  ),
  makeNomination(
    'DEMO-NOM-3',
    'DEMO-2026-003',
    'OM-10003',
    'Martha Chirwa',
    schemes[0],
    'Pending PO',
    'Clear',
    '2026-11-01',
    'Thandiwe Moyo',
  ),
  makeNomination(
    'DEMO-NOM-4',
    'DEMO-2026-004',
    'PS-20004',
    'Daniel Nkhoma',
    schemes[1],
    'Pending PA',
    'Clear',
    '2026-11-02',
    'Peter Banda',
    'Nyasha Banda',
  ),
  makeNomination(
    'DEMO-NOM-5',
    'DEMO-2026-005',
    'OM-10005',
    'Grace Mbewe',
    schemes[0],
    'Approved',
    'Clear',
    '2026-11-03',
    'Thandiwe Moyo',
    'Nyasha Banda',
  ),
]

const beneficiaries: Beneficiary[] = nominations.map((nomination, index) => ({
  id: `DEMO-BEN-${index + 1}`,
  title: [
    'Tadala Phiri',
    'Ruth Zulu',
    'Nia Kalua',
    'Tapiwa Jere',
    'Peter Chirwa',
    'Memory Nkhoma',
    'Esther Mbewe',
  ][index],
  memberNumber: nomination.memberNumber,
  memberItemId: Number(nomination.id.replace('DEMO-NOM-', '')),
  rowNumber: 1,
  dateOfBirth: '2000-03-08',
  relationship: 'Child',
  identityNumber: `DEMO-ID-${String(index + 1).padStart(4, '0')}`,
  benefitCurrentPct: 100,
  benefitRevisedPct: 100,
  fundName: nomination.fundName,
  refNumber: nomination.referenceNumber,
}))

export const demoSnapshot = { schemes, users, nominations, beneficiaries }
