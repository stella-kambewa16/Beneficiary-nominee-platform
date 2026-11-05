import type { Role } from '../auth/roles'
import type { NominationStatus } from '../data/types'

export function canApproveNomination(
  role: Role,
  status: NominationStatus,
): boolean {
  if (role === 'Admin') {
    return status === 'Pending PO' || status === 'Pending PA'
  }
  if (role === 'Principal Officer') return status === 'Pending PO'
  if (role === 'Pension Manager') return status === 'Pending PA'
  return false
}

export function canRejectNomination(
  role: Role,
  status: NominationStatus,
): boolean {
  return canApproveNomination(role, status)
}
