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
  value: unknown,
): NominationErrorStatus | null {
  const raw =
    typeof value === 'string'
      ? value.trim().toLowerCase()
      : value && typeof value === 'object'
        ? normalizeNominationErrorStatus(
            (value as Record<string, unknown>).Value ??
              (value as Record<string, unknown>).value ??
              (value as Record<string, unknown>).Label ??
              (value as Record<string, unknown>).label,
          )?.toLowerCase() ?? ''
        : ''
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

export function activePrincipalOfficerForScheme(
  users: SystemUser[],
  schemeId: string,
): SystemUser | undefined {
  return (
    activeUserForRoleAndScheme(users, 'Principal Officer', schemeId) ??
    activeUserForRoleAndScheme(users, 'Pension Adminstration', schemeId)
  )
}

export function activeUserForRoleAndScheme(
  users: SystemUser[],
  role: SystemUser['role'],
  schemeId: string,
): SystemUser | undefined {
  if (!schemeId) return undefined
  return users.find(
    (user) =>
      user.role === role &&
      user.status === 'Active' &&
      (user.schemeIds.includes(schemeId) || user.schemeId === schemeId),
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
  const errorStatus = normalizeNominationErrorStatus(nomination.sourceErrors)
  return {
    ...nomination,
    errorStatus,
    status:
      nomination.status !== 'Rejected' && errorStatus !== 'Clear'
        ? 'Tasks'
        : nomination.status,
  }
}
