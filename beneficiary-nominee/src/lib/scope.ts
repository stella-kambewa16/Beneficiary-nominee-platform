import type {
  Beneficiary,
  Nomination,
  SystemUser,
  UserRole,
} from '../data/types'

function assignedSchemeIds(
  email: string,
  users: SystemUser[],
): string[] {
  const needle = email.trim().toLowerCase()
  const user = users.find(
    (item) =>
      item.email.trim().toLowerCase() === needle &&
      (item.role === 'Principal Officer' ||
        item.role === 'Pension Adminstration') &&
      item.status === 'Active',
  )
  if (!user) return []
  return [
    ...new Set(
      user.schemeIds.length
        ? user.schemeIds
        : user.schemeId
          ? [user.schemeId]
          : [],
    ),
  ]
}

export function scopedNominations(
  role: UserRole,
  email: string,
  nominations: Nomination[],
  users: SystemUser[],
): Nomination[] {
  if (role === 'Employee') return []
  const normalizedEmail = email.trim().toLowerCase()
  if (role === 'Principal Officer') {
    const schemeIds = assignedSchemeIds(email, users)
    return nominations.filter((item) => {
      if (!schemeIds.includes(item.schemeId)) return false
      return (
        item.status !== 'Pending PO' ||
        !item.endorsement1Email ||
        item.endorsement1Email.trim().toLowerCase() === normalizedEmail
      )
    })
  }
  if (role === 'Pension Adminstration') {
    const schemeIds = assignedSchemeIds(email, users)
    return nominations.filter(
      (item) => {
        if (item.status === 'Tasks' || item.status === 'Submitted') {
          return true
        }
        if (item.status === 'Pending PA') {
          return (
            item.endorsement2Email.trim().toLowerCase() === normalizedEmail
          )
        }
        if (!schemeIds.includes(item.schemeId)) return false
        return (
          item.status !== 'Pending PO' ||
          item.endorsement1Email.trim().toLowerCase() === normalizedEmail ||
          !item.endorsement1Email
        )
      },
    )
  }
  return nominations
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
