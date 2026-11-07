import type { Role } from '../auth/roles'
import type {
  Nomination,
  NominationStatus,
  Scheme,
  SystemUser,
} from '../data/types'

export function schemeName(schemes: Scheme[], id: string): string {
  if (!id) return '—'
  return schemes.find((scheme) => scheme.id === id)?.name ?? '—'
}

export function nominationSchemeName(
  schemes: Scheme[],
  nomination: Nomination,
): string {
  const matched = schemeName(schemes, nomination.schemeId)
  return matched === '—'
    ? nomination.schemeName || nomination.fundName || '—'
    : matched
}

export function userSchemeLabel(user: SystemUser, schemes: Scheme[]): string {
  const assignedSchemeIds = user.schemeIds.length
    ? user.schemeIds
    : user.schemeId
      ? [user.schemeId]
      : []
  const labels = assignedSchemeIds
    .map((id) => schemeName(schemes, id))
    .filter((name) => name !== '—')
  return labels.length
    ? labels.join(', ')
    : user.schemeName || user.schemeCode || 'Unassigned'
}

export function userHasScheme(user: SystemUser, schemeId: string): boolean {
  return user.schemeIds.includes(schemeId) || user.schemeId === schemeId
}

function isPendingStatus(status: NominationStatus): boolean {
  return status === 'Pending PO' || status === 'Pending PA'
}

export function isTaskNomination(nomination: Nomination): boolean {
  if (nomination.status === 'Submitted' || nomination.status === 'Tasks') {
    return true
  }
  return (
    isPendingStatus(nomination.status) && nomination.errorStatus !== 'Clear'
  )
}

export function canActOnNomination(
  role: Role,
  status: NominationStatus,
): boolean {
  if (status === 'Pending PO') {
    return (
      role === 'Principal Officer' ||
      role === 'Pension Adminstration' ||
      role === 'Adminstration'
    )
  }
  if (status === 'Pending PA') {
    return role === 'Pension Adminstration' || role === 'Adminstration'
  }
  return false
}

export function nextStageLabel(status: NominationStatus): string {
  if (status === 'Pending PO') return 'Pending PA (Pension Administrator review)'
  if (status === 'Pending PA') return 'Approved'
  return 'Closed'
}
