import type {
  Beneficiary,
  Nomination,
  NominationErrorStatus,
  Scheme,
  SystemUser,
} from '../data/types'

export const nominationErrorStatuses: NominationErrorStatus[] = [
  'Missing Scheme',
  'Missing Principal Officer',
  'Missing Information',
  'Clear',
]

export interface NominationEvaluation {
  status: NominationErrorStatus
  findings: string[]
}

export interface NominationEvaluationInput {
  nomination: Nomination
  beneficiaries: Beneficiary[]
  schemes: Scheme[]
  users: SystemUser[]
}

export function usersForScheme(
  users: SystemUser[],
  schemeId: string,
): SystemUser[] {
  return users.filter((user) => user.schemeId === schemeId)
}

export function activePrincipalOfficerForScheme(
  users: SystemUser[],
  schemeId: string,
): SystemUser | undefined {
  return usersForScheme(users, schemeId).find(
    (user) => user.status === 'Active',
  )
}

export function matchScheme(
  schemes: Scheme[],
  label: string,
): Scheme | undefined {
  const needle = label.trim().toLowerCase()
  if (!needle) return undefined
  return schemes.find((scheme) =>
    [scheme.title, scheme.schemeName, scheme.name].some(
      (value) => value.trim().toLowerCase() === needle,
    ),
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

function allocationTotal(beneficiaries: Beneficiary[]): number {
  const revised = beneficiaries.reduce(
    (sum, beneficiary) => sum + beneficiary.benefitRevisedPct,
    0,
  )
  if (revised > 0) return revised
  return beneficiaries.reduce(
    (sum, beneficiary) => sum + beneficiary.benefitCurrentPct,
    0,
  )
}

function beneficiaryLabel(beneficiary: Beneficiary): string {
  const name = beneficiary.title.trim()
  return name || `row ${beneficiary.rowNumber || beneficiary.id}`
}

/**
 * Single source of truth for the Errors gate. The priority order is:
 * Missing Scheme -> Missing Principal Officer -> Missing Information -> Clear.
 * Every finding is returned so operations can resolve a record in one pass.
 */
export function evaluateNominationErrors({
  nomination,
  beneficiaries,
  schemes,
  users,
}: NominationEvaluationInput): NominationEvaluation {
  const findings: string[] = []

  const scheme = matchScheme(schemes, nomination.fundName)
  const schemeValid = Boolean(scheme && scheme.status === 'Active')

  if (!scheme) {
    findings.push(
      nomination.fundName.trim()
        ? `Scheme "${nomination.fundName}" does not match an active scheme.`
        : 'No scheme is linked to this nomination.',
    )
  } else if (scheme.status !== 'Active') {
    findings.push(`Scheme "${scheme.name}" is disabled.`)
  }

  const principalOfficer = scheme
    ? activePrincipalOfficerForScheme(users, scheme.id)
    : undefined

  if (scheme && !principalOfficer) {
    findings.push(
      `Scheme "${scheme.name}" has no active Principal Officer assigned.`,
    )
  }

  const linked = beneficiariesForNomination(nomination, beneficiaries)
  const informationFindings: string[] = []

  if (!nomination.memberNumber.trim()) {
    informationFindings.push('Member number is missing.')
  }
  if (!nomination.memberDob) {
    informationFindings.push('Member date of birth is missing.')
  }
  if (!nomination.email.trim()) {
    informationFindings.push('Member email address is missing.')
  }
  if (linked.length === 0) {
    informationFindings.push('No beneficiaries are linked to this nomination.')
  }
  if (nomination.nomineeCount > 0 && linked.length !== nomination.nomineeCount) {
    informationFindings.push(
      `Nominee count is ${nomination.nomineeCount}, but ${linked.length} beneficiary record(s) are linked.`,
    )
  }

  linked.forEach((beneficiary) => {
    const label = beneficiaryLabel(beneficiary)
    if (!beneficiary.title.trim()) {
      informationFindings.push(`Beneficiary ${label}: full name is missing.`)
    }
    if (!beneficiary.relationship.trim()) {
      informationFindings.push(
        `Beneficiary ${label}: relationship is missing.`,
      )
    }
    if (!beneficiary.identityNumber.trim()) {
      informationFindings.push(
        `Beneficiary ${label}: identity number is missing.`,
      )
    }
    if (!beneficiary.dateOfBirth) {
      informationFindings.push(
        `Beneficiary ${label}: date of birth is missing.`,
      )
    }
    if (
      beneficiary.benefitRevisedPct <= 0 &&
      beneficiary.benefitCurrentPct <= 0
    ) {
      informationFindings.push(
        `Beneficiary ${label}: allocation percentage is missing.`,
      )
    }
  })

  if (linked.length > 0) {
    const total = allocationTotal(linked)
    if (Math.abs(total - 100) > 0.01) {
      informationFindings.push(
        `Beneficiary allocation totals ${total}% (must equal 100%).`,
      )
    }
  }

  findings.push(...informationFindings)

  let status: NominationErrorStatus = 'Clear'
  if (!schemeValid) {
    status = 'Missing Scheme'
  } else if (!principalOfficer) {
    status = 'Missing Principal Officer'
  } else if (informationFindings.length > 0) {
    status = 'Missing Information'
  }

  return { status, findings }
}

/**
 * Returns a copy of the nomination with the latest validation result applied.
 * Used after in-session corrections so the Tasks queue updates immediately.
 */
export function applyEvaluation(
  nomination: Nomination,
  schemes: Scheme[],
  users: SystemUser[],
  beneficiaries: Beneficiary[],
): Nomination {
  const evaluation = evaluateNominationErrors({
    nomination,
    beneficiaries,
    schemes,
    users,
  })
  return {
    ...nomination,
    errorStatus: evaluation.status,
    errorFindings: evaluation.findings,
  }
}
