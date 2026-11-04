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
  return users.find((user) => user.email === email)?.schemeId ?? null
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
  const references = new Set(visible.map((item) => item.referenceNumber))
  return beneficiaries.filter((item) => references.has(item.refNumber))
}
