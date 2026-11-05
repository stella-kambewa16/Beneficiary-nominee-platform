import type {
  Beneficiary,
  Nomination,
  SystemUser,
  UserRole,
} from '../data/types'

export function assignedSchemeId(
  email: string,
  users: SystemUser[],
): string | null {
  const needle = email.trim().toLowerCase()
  return (
    users.find((user) => user.email.trim().toLowerCase() === needle)?.schemeId ??
    null
  )
}

export function scopedNominations(
  role: UserRole,
  email: string,
  nominations: Nomination[],
  users: SystemUser[],
): Nomination[] {
  if (role !== 'Principal Officer') return nominations
  const schemeId = assignedSchemeId(email, users)
  if (!schemeId) return nominations
  return nominations.filter((item) => item.schemeId === schemeId)
}

export function scopedBeneficiaries(
  role: UserRole,
  email: string,
  nominations: Nomination[],
  beneficiaries: Beneficiary[],
  users: SystemUser[],
): Beneficiary[] {
  const visible = scopedNominations(role, email, nominations, users)
  const references = new Set(
    visible.map((item) => item.referenceNumber).filter(Boolean),
  )
  const nominationIds = new Set(visible.map((item) => item.id))

  return beneficiaries.filter(
    (item) =>
      (item.refNumber !== '' && references.has(item.refNumber)) ||
      (item.memberItemId !== null &&
        nominationIds.has(String(item.memberItemId))),
  )
}
