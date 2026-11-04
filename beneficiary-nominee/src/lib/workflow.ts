import type { Role } from '../auth/roles'
import type { NominationStatus } from '../data/types'

export function canApproveNomination(
  role: Role,
  status: NominationStatus,
): boolean {
  if (role === 'Admin') {
    return status === 'Pending PO Approval' || status === 'Pending PM Approval'
  }
  if (role === 'Principal Officer') return status === 'Pending PO Approval'
  if (role === 'Pension Manager') return status === 'Pending PM Approval'
  return false
}

export function canRejectNomination(
  role: Role,
  status: NominationStatus,
): boolean {
  return canApproveNomination(role, status)
}
