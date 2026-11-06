import type {
  Beneficiary,
  Nomination,
  NominationErrorStatus,
  SystemUser,
} from '../data/types'

export const nominationErrorStatuses: NominationErrorStatus[] = [
  'Missing Scheme',
  'Missing Principal Officer',
  'Missing Information',
  'Clear',
]

export function normalizeNominationErrorStatus(
  value: string | undefined,
): NominationErrorStatus | null {
  const raw = value?.trim().toLowerCase() ?? ''
  if (!raw) return null
  if (/^(clear|no errors?)$/.test(raw)) return 'Clear'
  if (/missing\s+scheme|scheme\s+(is\s+)?missing/.test(raw)) {
    return 'Missing Scheme'
  }
  if (
    /missing\s+principal\s+officer|principal\s+officer\s+(is\s+)?missing/.test(
      raw,
    )
  ) {
    return 'Missing Principal Officer'
  }
  if (/missing\s+information|information\s+(is\s+)?missing/.test(raw)) {
    return 'Missing Information'
  }
  return null
}

export function isReadyForPrincipalOfficer(nomination: Nomination): boolean {
  return (
    (nomination.status === 'Submitted' || nomination.status === 'Tasks') &&
    normalizeNominationErrorStatus(nomination.sourceErrors) === 'Clear' &&
    nomination.errorStatus === 'Clear'
  )
}

export function activePrincipalOfficerForScheme(
  users: SystemUser[],
  schemeId: string,
): SystemUser | undefined {
  return users.filter((user) => user.schemeId === schemeId).find(
    (user) => user.status === 'Active',
  )
}

export function beneficiariesForNomination(
  nomination: Nomination,
  beneficiaries: Beneficiary[],
): Beneficiary[] {
  return beneficiaries.filter(
    (beneficiary) =>
      (nomination.referenceNumber !== '' &&
        beneficiary.refNumber === nomination.referenceNumber) ||
      (beneficiary.memberItemId !== null &&
        String(beneficiary.memberItemId) === nomination.id),
  )
}

export function applyRecordedErrors(nomination: Nomination): Nomination {
  return {
    ...nomination,
    errorStatus: normalizeNominationErrorStatus(nomination.sourceErrors),
  }
}
