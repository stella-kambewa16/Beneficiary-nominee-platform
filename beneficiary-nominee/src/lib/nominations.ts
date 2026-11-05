import type { Role } from '../auth/roles'
import type {
  ApprovalEvent,
  Beneficiary,
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
  if (!user.schemeId) return user.schemeName || user.schemeCode || 'Unassigned'
  return schemeName(schemes, user.schemeId)
}

export function principalOfficerForScheme(
  users: SystemUser[],
  schemeId: string,
): SystemUser | undefined {
  return users.find((user) => user.schemeId === schemeId)
}

export function principalOfficerName(
  users: SystemUser[],
  schemeId: string,
): string {
  return principalOfficerForScheme(users, schemeId)?.name ?? 'Unassigned'
}

export function beneficiaryCount(
  beneficiaries: Beneficiary[],
  refNumber: string,
): number {
  return beneficiaries.filter((item) => item.refNumber === refNumber).length
}

export function canActOnNomination(
  role: Role,
  status: NominationStatus,
): boolean {
  if (status === 'Pending PO Approval') {
    return role === 'Principal Officer' || role === 'Admin'
  }
  if (status === 'Pending PM Approval') {
    return role === 'Pension Manager' || role === 'Admin'
  }
  return false
}

export function nextStageLabel(status: NominationStatus): string {
  if (status === 'Pending PO Approval') return 'Pension Manager review'
  if (status === 'Pending PM Approval') return 'Approved'
  return 'Closed'
}

export interface NominationActivity {
  id: string
  action: string
  subject: string
  detail: string
  date: string
  decision: ApprovalEvent['decision']
  referenceNumber: string
  nominationId: string
}

export function nominationActivity(
  nominations: Nomination[],
): NominationActivity[] {
  return nominations
    .flatMap((nomination) =>
      nomination.approvalHistory.map((event, index) => ({
        id: `${nomination.id}-${index}`,
        action:
          event.decision === 'Submitted'
            ? 'Nomination submitted'
            : `${event.stage} ${event.decision.toLowerCase()}`,
        subject: nomination.memberName,
        detail: `${nomination.referenceNumber || nomination.id} · ${
          event.actor
        }`,
        date: event.date,
        decision: event.decision,
        referenceNumber: nomination.referenceNumber,
        nominationId: nomination.id,
      })),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
}
