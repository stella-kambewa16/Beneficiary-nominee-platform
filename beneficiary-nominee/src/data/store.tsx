import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { DataContext } from './context'
import { demoSnapshot } from './demo'
import {
  assignOfficerSchemes,
  createOfficerRecord,
  createSchemeRecord,
  fetchSharePointSnapshot,
  mapBeneficiary,
  mapNomination,
  mapScheme,
  mapUser,
  setOfficerStatus,
  setSchemeStatusRecord,
  updateNominationComments,
  updateNominationRecord,
  updateNomineeRecord,
  updateOfficerRecord,
  updateSchemeRecord,
  writeNominationDecision,
  writeNominationValidation,
} from './sharepoint'
import type { DecisionStage } from './sharepoint'
import type {
  ActivityItem,
  Beneficiary,
  BeneficiaryCorrection,
  Nomination,
  NominationCorrection,
  NominationErrorStatus,
  NominationStatus,
  Scheme,
  SchemeDraft,
  SystemUser,
  UserDraft,
  UserRole,
  UserStatus,
} from './types'
import { appendComment } from '../lib/comments'
import { nowIso } from '../lib/format'
import {
  activeUserForRoleAndScheme,
  activePrincipalOfficerForScheme,
  applyRecordedErrors,
} from '../lib/validation'
import {
  prepareNominationStageEmail,
  sendNominationStageEmail,
} from '../lib/nomination-notifications'
import { userHasScheme } from '../lib/nominations'
import { useAuth } from '../auth/auth-context'
import { hasPermission } from '../auth/roles'
import type { Permission } from '../auth/roles'

interface Snapshot {
  schemes: Scheme[]
  users: SystemUser[]
  nominations: Nomination[]
  beneficiaries: Beneficiary[]
}

const EMPTY_SNAPSHOT: Snapshot = {
  schemes: [],
  users: [],
  nominations: [],
  beneficiaries: [],
}

let activitySequence = 0

function nextActivityId(): string {
  activitySequence += 1
  return `ACT-${Date.now()}-${activitySequence}`
}

function describeLoadError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ''

  if (
    !message.trim() ||
    /host|connector|power apps|not available|unauthor|forbidden|network|fetch|failed/i.test(
      message,
    )
  ) {
    return [
      'Could not read the SharePoint lists.',
      'Open this app through the Power Apps Local Play URL printed by `pa app run` so the SharePoint connection is available.',
      message.trim(),
    ]
      .filter(Boolean)
      .join(' ')
  }

  return message
}

/**
 * Mutations are authorised from the provider's resolved role, not from the
 * role string a caller passes in for display or audit purposes.
 */
function requirePermission(
  role: UserRole,
  permission: Permission,
  message: string,
): void {
  if (!hasPermission(role, permission)) throw new Error(message)
}

function requireAuthenticatedActor(
  suppliedRole: UserRole,
  suppliedActor: string,
  role: UserRole,
  user: { name: string; email: string },
  suppliedEmail?: string,
): void {
  const identity = user.name || user.email
  if (
    suppliedRole !== role ||
    suppliedActor.trim().toLowerCase() !== identity.trim().toLowerCase() ||
    (suppliedEmail !== undefined &&
      suppliedEmail.trim().toLowerCase() !== user.email.trim().toLowerCase())
  ) {
    throw new Error('The action does not match the signed-in user context.')
  }
}

function activeAdminCount(users: SystemUser[]): number {
  return users.filter(
    (user) => user.role === 'Adminstration' && user.status === 'Active',
  ).length
}

function decisionStage(
  role: UserRole,
  status: NominationStatus,
): DecisionStage | null {
  if (
    status === 'Pending PO' &&
    (role === 'Principal Officer' ||
      role === 'Pension Adminstration' ||
      role === 'Adminstration')
  ) {
    return 'PO'
  }
  if (
    status === 'Pending PA' &&
    (role === 'Pension Adminstration' || role === 'Adminstration')
  ) {
    return 'PA'
  }
  return null
}

function stageMessage(role: UserRole, status: NominationStatus): string {
  if (status === 'Approved' || status === 'Rejected') {
    return 'This nomination has already been decided.'
  }
  if (status === 'Tasks' || status === 'Submitted') {
    return 'This nomination is still in the Tasks queue and must be cleared before it can be endorsed.'
  }
  if (status === 'Pending PO') {
    return 'This nomination is awaiting Principal Officer endorsement.'
  }
  return `This nomination is awaiting Pension Administrator approval, not ${role}.`
}

function requireClear(
  nomination: Nomination,
): asserts nomination is Nomination & { errorStatus: 'Clear' } {
  if (nomination.errorStatus !== 'Clear') {
    throw new Error(
      `This nomination cannot be endorsed while its Errors status is "${nomination.errorStatus}". Clear the validation issues in Tasks first.`,
    )
  }
}

function requireTaskEditAccess(
  nomination: Nomination,
  role: UserRole,
): void {
  if (role !== 'Pension Adminstration' && role !== 'Adminstration') {
    throw new Error('Only Pension Adminstration can edit task details.')
  }
  if (nomination.status !== 'Tasks' && nomination.status !== 'Submitted') {
    throw new Error('Only nominations in the Tasks queue can be edited here.')
  }
}

function requireAssignedStageAccess(
  nomination: Nomination,
  stage: DecisionStage,
  role: UserRole,
  email: string,
  users: SystemUser[],
): void {
  if (role === 'Adminstration') return

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    throw new Error('The signed-in email is unavailable for endorsement.')
  }

  if (stage === 'PA') {
    if (
      nomination.endorsement2Email.trim().toLowerCase() !== normalizedEmail
    ) {
      throw new Error(
        'Only the Pension Administrator assigned as Second Endorser can act on this nomination.',
      )
    }
    return
  }

  const assignedEmail = nomination.endorsement1Email.trim().toLowerCase()
  if (assignedEmail) {
    if (assignedEmail !== normalizedEmail) {
      throw new Error(
        'Only the Pension Officer assigned as First Endorser can act on this nomination.',
      )
    }
    return
  }

  const assignedOfficer = activePrincipalOfficerForScheme(
    users,
    nomination.schemeId,
  )
  if (assignedOfficer?.email.trim().toLowerCase() !== normalizedEmail) {
    throw new Error(
      'Only the active Pension Officer assigned to this scheme can act on this nomination.',
    )
  }
}

function withDemoDecision(
  nomination: Nomination,
  status: NominationStatus,
  stage: DecisionStage,
  actor: string,
  actorEmail: string,
  role: UserRole,
  comment: string,
  secondEndorser?: { name: string; email: string },
): Nomination {
  const timestamp = nowIso()
  const wasRejected =
    status === 'Rejected' || (stage === 'PA' && status === 'Pending PO')
  const next = {
    ...nomination,
    status,
    sourceStatus: status,
    warnings: wasRejected ? comment : nomination.warnings,
    comments: appendComment(nomination.comments, actor, role, comment),
    approvalHistory: [
      ...nomination.approvalHistory,
      {
        id: `DEMO-EVENT-${Date.now()}`,
        stage: stage === 'PO' ? 'Principal Officer' : 'Pension Administrator',
        actor,
        decision: wasRejected
          ? 'Rejected' as const
          : stage === 'PO'
            ? 'Endorsed' as const
            : 'Approved' as const,
        date: timestamp.slice(0, 10),
        comments: comment,
      },
    ],
    modifiedDate: timestamp.slice(0, 10),
  }
  return stage === 'PO'
    ? {
        ...next,
        endorsement1Name: actor,
        endorsement1Email: actorEmail,
        ...(status === 'Pending PA'
          ? secondEndorser
            ? {
                endorsement2Name: secondEndorser.name,
                endorsement2Email: secondEndorser.email,
              }
            : {}
          : {}),
      }
    : {
        ...next,
        endorsement2Name: actor,
        endorsement2Email: actorEmail,
      }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { role: authRole, user: authUser } = useAuth()
  const demoMode = new URLSearchParams(
    window.location.hash.split('?')[1] ?? '',
  ).get('demo') === 'seed'
  const [snapshot, setSnapshot] = useState<Snapshot>(
    demoMode ? demoSnapshot : EMPTY_SNAPSHOT,
  )
  const [sessionActivity, setSessionActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(!demoMode)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadInFlight = useRef(false)

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (demoMode) return
    if (loadInFlight.current) return
    loadInFlight.current = true
    if (mode === 'refresh') {
      setRefreshing(true)
    }

    try {
      const raw = await fetchSharePointSnapshot()
      const schemes = raw.schemeRecords.map(mapScheme)
      const users = raw.officerRecords.map((record) =>
        mapUser(record, schemes),
      )
      const beneficiaries = raw.nomineeRecords.map(mapBeneficiary)
      const nominations = raw.nominationRecords.map((record) =>
        mapNomination(record, schemes, users, beneficiaries),
      )

      setSnapshot({ schemes, users, nominations, beneficiaries })
      setError(null)
    } catch (loadError) {
      setError(describeLoadError(loadError))
    } finally {
      loadInFlight.current = false
      if (mode === 'initial') {
        setLoading(false)
      } else {
        setRefreshing(false)
      }
    }
  }, [demoMode])

  useEffect(() => {
    if (demoMode) return
    // Defer the initial read so the provider mounts before state updates.
    const timer = window.setTimeout(() => {
      void load('initial')
    }, 0)
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load('refresh')
      }
    }, 60_000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(refreshTimer)
    }
  }, [demoMode, load])

  const refresh = useCallback(
    () => (demoMode ? Promise.resolve() : load('refresh')),
    [demoMode, load],
  )

  const pushActivity = useCallback(
    (entry: Omit<ActivityItem, 'id' | 'time'>) => {
      setSessionActivity((current) => [
        { ...entry, id: nextActivityId(), time: nowIso() },
        ...current,
      ])
    },
    [],
  )

  const activity = useMemo(() => {
    const derived: ActivityItem[] = snapshot.nominations.flatMap(
      (nomination) =>
        nomination.approvalHistory.map((event) => ({
          id: `ACT-${nomination.id}-${event.id}`,
          action:
            event.decision === 'Submitted'
              ? 'Nomination submitted'
              : `${event.stage} ${event.decision.toLowerCase()}`,
          subject: nomination.memberName,
          detail: [
            nomination.referenceNumber || `Nomination ${nomination.id}`,
            event.actor,
            event.comments,
          ]
            .filter(Boolean)
            .join(' · '),
          actor: event.actor,
          time: event.date,
          referenceNumber: nomination.referenceNumber,
          nominationId: nomination.id,
        })),
    )

    return [...sessionActivity, ...derived].sort((a, b) =>
      b.time.localeCompare(a.time),
    )
  }, [sessionActivity, snapshot.nominations])

  const approveNomination = useCallback(
    async (
      nominationId: string,
      role: UserRole,
      actor: string,
      actorEmail: string,
      comments = '',
    ) => {
      const nomination = snapshot.nominations.find(
        (item) => item.id === nominationId,
      )
      if (!nomination) {
        throw new Error('The selected nomination could not be found.')
      }
      requireAuthenticatedActor(role, actor, authRole, authUser, actorEmail)

      const stage = decisionStage(authRole, nomination.status)
      if (!stage) {
        throw new Error(stageMessage(authRole, nomination.status))
      }
      requirePermission(
        authRole,
        stage === 'PO' ? 'nominations:approve:po' : 'nominations:approve:pa',
        'Your role cannot endorse nominations at this stage.',
      )
      requireClear(nomination)
      requireAssignedStageAccess(
        nomination,
        stage,
        authRole,
        authUser.email,
        snapshot.users,
      )

      const nextStatus: NominationStatus =
        stage === 'PO' ? 'Pending PA' : 'Approved'
      const comment =
        comments.trim() ||
        (stage === 'PO'
          ? 'Principal Officer endorsed the nomination.'
          : 'Pension Administrator approved the nomination.')
      const secondEndorser =
        stage === 'PO'
          ? activeUserForRoleAndScheme(
              snapshot.users,
              'Pension Adminstration',
              nomination.schemeId,
            ) ??
            (demoMode
              ? snapshot.users.find(
                  (user) =>
                    user.role === 'Pension Adminstration' &&
                    user.status === 'Active' &&
                    user.email.trim().toLowerCase() !==
                      authUser.email.trim().toLowerCase(),
                )
              : undefined)
          : undefined
      if (stage === 'PO' && !secondEndorser) {
        throw new Error(
          'Assign an active Pension Adminstration user to this scheme before endorsing nominations.',
        )
      }
      const stageEmail =
        stage === 'PO' && secondEndorser && !demoMode
          ? prepareNominationStageEmail(
              'PA',
              nomination,
              secondEndorser,
              snapshot.users,
            )
          : null

      const mapped = demoMode
        ? withDemoDecision(
            nomination,
            nextStatus,
            stage,
            authUser.name || authUser.email,
            authUser.email,
            authRole,
            comment,
            secondEndorser,
          )
        : mapNomination(
            await writeNominationDecision(nomination.id, {
              status: nextStatus,
              stage,
              actor: authUser.name || authUser.email,
              actorEmail: authUser.email,
              actorRole: authRole,
              comment,
              previousComments: nomination.comments,
              errors: nomination.errorStatus,
              secondEndorser:
                secondEndorser
                  ? {
                      name: secondEndorser.name,
                      email: secondEndorser.email,
                    }
                  : undefined,
            }),
            snapshot.schemes,
            snapshot.users,
            snapshot.beneficiaries,
          )

      setSnapshot((current) => ({
        ...current,
        nominations: current.nominations.map((item) =>
          item.id === mapped.id ? mapped : item,
        ),
      }))

      pushActivity({
        action:
          stage === 'PO'
            ? 'Principal Officer endorsed'
            : 'Nomination approved',
        subject: nomination.memberName,
        detail: `${
          nomination.referenceNumber || `Nomination ${nomination.id}`
        } was ${stage === 'PO' ? 'endorsed' : 'approved'} by ${
          authUser.name || authUser.email
        }.`,
        actor: authUser.name || authUser.email,
        referenceNumber: nomination.referenceNumber,
        nominationId: nomination.id,
      })
      if (stageEmail) {
        try {
          await sendNominationStageEmail(stageEmail)
        } catch (error) {
          const detail =
            error instanceof Error ? error.message : 'Unknown Outlook error.'
          throw new Error(
            `The nomination moved to ${nextStatus}, but its email notification could not be sent: ${detail}`,
          )
        }
      }
    },
    [
      authRole,
      authUser,
      snapshot.beneficiaries,
      snapshot.nominations,
      snapshot.schemes,
      snapshot.users,
      demoMode,
      pushActivity,
    ],
  )

  const rejectNomination = useCallback(
    async (
      nominationId: string,
      role: UserRole,
      actor: string,
      actorEmail: string,
      reason: string,
    ) => {
      const nomination = snapshot.nominations.find(
        (item) => item.id === nominationId,
      )
      if (!nomination) {
        throw new Error('The selected nomination could not be found.')
      }
      requireAuthenticatedActor(role, actor, authRole, authUser, actorEmail)
      if (!reason.trim()) {
        throw new Error('A rejection reason is required.')
      }

      const stage = decisionStage(authRole, nomination.status)
      if (!stage) {
        throw new Error(stageMessage(authRole, nomination.status))
      }
      requirePermission(
        authRole,
        'nominations:reject',
        'Your role cannot reject nominations.',
      )
      requireClear(nomination)
      requireAssignedStageAccess(
        nomination,
        stage,
        authRole,
        authUser.email,
        snapshot.users,
      )

      const returnedToPO = stage === 'PA'
      const nextStatus: NominationStatus = returnedToPO
        ? 'Pending PO'
        : 'Rejected'
      const mapped = demoMode
        ? withDemoDecision(
            nomination,
            nextStatus,
            stage,
            authUser.name || authUser.email,
            authUser.email,
            authRole,
            reason.trim(),
          )
        : mapNomination(
            await writeNominationDecision(nomination.id, {
              status: nextStatus,
              rejection: true,
              stage,
              actor: authUser.name || authUser.email,
              actorEmail: authUser.email,
              actorRole: authRole,
              comment: reason.trim(),
              previousComments: nomination.comments,
              errors: nomination.errorStatus,
            }),
            snapshot.schemes,
            snapshot.users,
            snapshot.beneficiaries,
          )

      setSnapshot((current) => ({
        ...current,
        nominations: current.nominations.map((item) =>
          item.id === mapped.id ? mapped : item,
        ),
      }))

      pushActivity({
        action: returnedToPO
          ? 'PA rejection returned to PO'
          : 'Nomination rejected',
        subject: nomination.memberName,
        detail: returnedToPO
          ? `${
              nomination.referenceNumber || `Nomination ${nomination.id}`
            } was returned to Principal Officer review by ${
              authUser.name || authUser.email
            }: ${reason.trim()}`
          : `${
              nomination.referenceNumber || `Nomination ${nomination.id}`
            } was rejected by ${authUser.name || authUser.email}: ${reason.trim()}`,
        actor: authUser.name || authUser.email,
        referenceNumber: nomination.referenceNumber,
        nominationId: nomination.id,
      })
    },
    [
      authRole,
      authUser,
      snapshot.beneficiaries,
      snapshot.nominations,
      snapshot.schemes,
      snapshot.users,
      demoMode,
      pushActivity,
    ],
  )

  const validateNomination = useCallback(
    async (
      nominationId: string,
      errors: NominationErrorStatus,
      role: UserRole,
      actor: string,
    ): Promise<NominationErrorStatus> => {
      const nomination = snapshot.nominations.find(
        (item) => item.id === nominationId,
      )
      if (!nomination) {
        throw new Error('The selected nomination could not be found.')
      }
      requireAuthenticatedActor(role, actor, authRole, authUser)
      requirePermission(
        authRole,
        'tasks:manage',
        'Only Pension Adminstration or Adminstration can review the Errors column and move a nomination to Pending PO.',
      )
      if (
        errors === 'Clear' &&
        nomination.status !== 'Tasks' &&
        nomination.status !== 'Submitted'
      ) {
        throw new Error(
          'Only nominations in the Tasks queue can be promoted to Pending PO.',
        )
      }

      let nextStatus: NominationStatus = nomination.status
      let firstEndorser: SystemUser | undefined

      if (
        errors !== 'Clear' &&
        (nomination.status === 'Pending PO' ||
          nomination.status === 'Pending PA')
      ) {
        nextStatus = 'Tasks'
      } else if (
        nomination.status === 'Tasks' ||
        nomination.status === 'Submitted'
      ) {
        const scheme = snapshot.schemes.find(
          (item) => item.id === nomination.schemeId,
        )
        const officer = scheme
          ? demoMode
            ? activePrincipalOfficerForScheme(snapshot.users, scheme.id)
            : activeUserForRoleAndScheme(
                snapshot.users,
                'Principal Officer',
                scheme.id,
              )
          : undefined
        if (!officer) {
          throw new Error(
            'An active Principal Officer must be assigned to this scheme before this nomination can be promoted.',
          )
        }
        nextStatus = 'Pending PO'
        firstEndorser = officer
      }

      const promoted = nextStatus === 'Pending PO' && nomination.status !== 'Pending PO'
      const stageEmail =
        promoted && firstEndorser && !demoMode
          ? prepareNominationStageEmail(
              'PO',
              nomination,
              firstEndorser,
              snapshot.users,
            )
          : null
      const message = errors === 'Clear'
        ? promoted
          ? `Errors column set to Clear. Moved to Pending PO and assigned ${
              firstEndorser?.name ?? 'Pension Adminstration'
            } as First Endorser.`
          : 'Errors column updated to Clear.'
        : `Errors column updated to "${errors}". The nomination remains in Tasks.`

      const comments = appendComment(
        nomination.comments,
        authUser.name || authUser.email,
        authRole,
        message,
      )
      const mapped = demoMode
        ? {
            ...nomination,
            status: nextStatus,
            sourceStatus: nextStatus,
            sourceErrors: errors,
            errorStatus: errors,
            comments,
            ...(firstEndorser
              ? {
                  endorsement1Name: firstEndorser.name,
                  endorsement1Email: firstEndorser.email,
                }
              : {}),
          }
        : mapNomination(
            await writeNominationValidation(nomination.id, {
              status: nextStatus,
              errors,
              comments,
              firstEndorser: firstEndorser
                ? {
                    name: firstEndorser.name,
                    email: firstEndorser.email,
                  }
                : undefined,
            }),
            snapshot.schemes,
            snapshot.users,
            snapshot.beneficiaries,
          )

      setSnapshot((current) => ({
        ...current,
        nominations: current.nominations.map((item) =>
          item.id === mapped.id ? mapped : item,
        ),
      }))

      pushActivity({
        action: errors === 'Clear' ? 'Errors cleared' : 'Errors status updated',
        subject: nomination.memberName,
        detail: `${
          nomination.referenceNumber || `Nomination ${nomination.id}`
        }: ${message}`,
        actor: authUser.name || authUser.email,
        referenceNumber: nomination.referenceNumber,
        nominationId: nomination.id,
      })

      if (stageEmail) {
        try {
          await sendNominationStageEmail(stageEmail)
        } catch (error) {
          const detail =
            error instanceof Error ? error.message : 'Unknown Outlook error.'
          throw new Error(
            `The nomination moved to ${nextStatus}, but its email notification could not be sent: ${detail}`,
          )
        }
      }

      return errors
    },
    [
      authRole,
      authUser,
      snapshot.beneficiaries,
      snapshot.nominations,
      snapshot.schemes,
      snapshot.users,
      demoMode,
      pushActivity,
    ],
  )

  const addNominationComment = useCallback(
    async (
      nominationId: string,
      comment: string,
      actor: string,
      role: UserRole,
    ) => {
      const nomination = snapshot.nominations.find(
        (item) => item.id === nominationId,
      )
      if (!nomination) {
        throw new Error('The selected nomination could not be found.')
      }
      requireAuthenticatedActor(role, actor, authRole, authUser)
      requirePermission(
        authRole,
        'tasks:manage',
        'Only Pension Adminstration or Adminstration can add validation comments.',
      )
      requireTaskEditAccess(nomination, authRole)
      if (!comment.trim()) {
        throw new Error('Enter a comment before saving.')
      }

      const comments = appendComment(
        nomination.comments,
        authUser.name || authUser.email,
        authRole,
        comment,
      )
      const mapped = demoMode
        ? { ...nomination, comments }
        : mapNomination(
            await updateNominationComments(nominationId, comments),
            snapshot.schemes,
            snapshot.users,
            snapshot.beneficiaries,
          )
      setSnapshot((current) => ({
        ...current,
        nominations: current.nominations.map((item) =>
          item.id === mapped.id ? mapped : item,
        ),
      }))
      pushActivity({
        action: 'Nomination comment added',
        subject: nomination.memberName,
        detail: `${nomination.referenceNumber || `Nomination ${nomination.id}`} received a Tasks comment from ${authUser.name || authUser.email}.`,
        actor: authUser.name || authUser.email,
        referenceNumber: nomination.referenceNumber,
        nominationId: nomination.id,
      })
    },
    [
      authRole,
      authUser,
      snapshot.beneficiaries,
      snapshot.nominations,
      snapshot.schemes,
      snapshot.users,
      demoMode,
      pushActivity,
    ],
  )

  const updateNominationDetails = useCallback(
    async (
      nominationId: string,
      correction: NominationCorrection,
      actor: string,
      role: UserRole,
    ) => {
      const nomination = snapshot.nominations.find(
        (item) => item.id === nominationId,
      )
      if (!nomination) {
        throw new Error('The selected nomination could not be found.')
      }
      requireAuthenticatedActor(role, actor, authRole, authUser)
      requireTaskEditAccess(nomination, authRole)

      const changedFields = Object.entries(correction)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key)
      if (changedFields.length === 0) {
        throw new Error('Change at least one nomination field before saving.')
      }
      const comment = appendComment(
        nomination.comments,
        authUser.name || authUser.email,
        authRole,
        `Corrected nomination details (${changedFields.join(', ') || 'no fields'}).`,
      )

      const scheme = correction.fundName
        ? snapshot.schemes.find((item) =>
            [item.title, item.schemeName, item.name].some(
              (label) =>
                label.trim().toLowerCase() ===
                correction.fundName?.trim().toLowerCase(),
            ),
          )
        : undefined
      const mapped = demoMode
        ? applyRecordedErrors({
            ...nomination,
            ...correction,
            fundName: correction.fundName ?? nomination.fundName,
            schemeName: correction.fundName ?? nomination.schemeName,
            schemeId: scheme?.id ?? nomination.schemeId,
            comments: comment,
          })
        : mapNomination(
            await updateNominationRecord(nominationId, correction, comment),
            snapshot.schemes,
            snapshot.users,
            snapshot.beneficiaries,
          )

      setSnapshot((current) => ({
        ...current,
        nominations: current.nominations.map((item) =>
          item.id === mapped.id ? mapped : item,
        ),
      }))

      pushActivity({
        action: 'Nomination details updated',
        subject: nomination.memberName,
        detail: `${
          nomination.referenceNumber || `Nomination ${nomination.id}`
        } was corrected in Tasks.`,
        actor: authUser.name || authUser.email,
        referenceNumber: nomination.referenceNumber,
        nominationId: nomination.id,
      })
    },
    [
      authRole,
      authUser,
      snapshot.beneficiaries,
      snapshot.nominations,
      snapshot.schemes,
      snapshot.users,
      demoMode,
      pushActivity,
    ],
  )

  const updateBeneficiaryDetails = useCallback(
    async (
      beneficiaryId: string,
      correction: BeneficiaryCorrection,
      actor: string,
      role: UserRole,
    ) => {
      const existing = snapshot.beneficiaries.find(
        (item) => item.id === beneficiaryId,
      )
      if (!existing) {
        throw new Error('The selected beneficiary could not be found.')
      }
      requireAuthenticatedActor(role, actor, authRole, authUser)

      const parent = snapshot.nominations.find(
        (nomination) =>
          (existing.refNumber !== '' &&
            nomination.referenceNumber === existing.refNumber) ||
          (existing.memberItemId !== null &&
            String(existing.memberItemId) === nomination.id),
      )
      if (!parent) {
        throw new Error(
          'This beneficiary is not linked to a nomination in the Tasks queue.',
        )
      }
      requireTaskEditAccess(parent, authRole)
      const changedFields = Object.entries(correction)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key)
      if (changedFields.length === 0) {
        throw new Error('Change at least one beneficiary field before saving.')
      }

      const mapped = demoMode
        ? { ...existing, ...correction }
        : mapBeneficiary(await updateNomineeRecord(beneficiaryId, correction))
      const updatedParent = parent
        ? demoMode
          ? {
              ...parent,
              comments: appendComment(
                parent.comments,
                authUser.name || authUser.email,
                authRole,
                `Corrected beneficiary ${
                  existing.title || existing.id
                } (${changedFields.join(', ') || 'no fields'}).`,
              ),
            }
          : mapNomination(
              await updateNominationComments(
                parent.id,
                appendComment(
                  parent.comments,
                  authUser.name || authUser.email,
                  authRole,
                  `Corrected beneficiary ${
                    existing.title || existing.id
                  } (${changedFields.join(', ') || 'no fields'}).`,
                ),
              ),
              snapshot.schemes,
              snapshot.users,
              snapshot.beneficiaries,
            )
        : null

      setSnapshot((current) => {
        const beneficiaries = current.beneficiaries.map((item) =>
          item.id === mapped.id ? mapped : item,
        )
        const nominations = current.nominations.map((nomination) => {
          const source =
            updatedParent && updatedParent.id === nomination.id
              ? updatedParent
              : nomination
          return applyRecordedErrors(source)
        })
        return { ...current, beneficiaries, nominations }
      })

      pushActivity({
        action: 'Beneficiary details updated',
        subject: existing.title || `Beneficiary ${existing.id}`,
        detail: `Beneficiary ${existing.refNumber || existing.id} was corrected in Tasks.`,
        actor: authUser.name || authUser.email,
        referenceNumber: existing.refNumber,
      })
    },
    [
      authRole,
      authUser,
      snapshot.beneficiaries,
      snapshot.nominations,
      snapshot.schemes,
      snapshot.users,
      demoMode,
      pushActivity,
    ],
  )

  const createUser = useCallback(
    async (draft: UserDraft, actor: string) => {
      requirePermission(
        authRole,
        'users:manage',
        'Only Adminstration can create principal officer accounts.',
      )
      const name = draft.name.trim()
      const email = draft.email.trim()
      if (!name) throw new Error('Enter the user name.')
      if (!email) throw new Error('Enter the user email address.')

      const schemeIds = [...new Set(draft.schemeIds)]
      const schemes = schemeIds.map((id) =>
        snapshot.schemes.find((item) => item.id === id),
      )
      if (schemes.some((scheme) => !scheme)) {
        throw new Error('One or more selected schemes could not be found.')
      }
      const assignedSchemes = schemes.filter(
        (scheme): scheme is Scheme => Boolean(scheme),
      )

      const created = await createOfficerRecord({
        name,
        email,
        phone: draft.phone.trim(),
        role: draft.role,
        status: draft.status,
        schemes: assignedSchemes,
      })
      const mapped = mapUser(created.record, snapshot.schemes)

      setSnapshot((current) => ({
        ...current,
        users: [mapped, ...current.users.filter((user) => user.id !== mapped.id)],
      }))

      pushActivity({
        action: 'User created',
        subject: name,
        detail: `${name} was added${
          assignedSchemes.length
            ? ` for ${assignedSchemes.map((scheme) => scheme.name).join(', ')}`
            : ''
        }.${
          created.rolesSaved
            ? ''
            : ' The SharePoint PrincipalOfficersRole column did not save the workflow role.'
        }`,
        actor,
        referenceNumber: '',
      })

      return { rolesSaved: created.rolesSaved }
    },
    [authRole, snapshot.schemes, pushActivity],
  )

  const updateUser = useCallback(
    async (id: string, draft: UserDraft, actor: string) => {
      requirePermission(
        authRole,
        'users:manage',
        'Only Adminstration can update principal officer accounts.',
      )
      const existing = snapshot.users.find((user) => user.id === id)
      if (!existing) {
        throw new Error('The selected user could not be found.')
      }

      const removesActiveAdmin =
        existing.role === 'Adminstration' &&
        existing.status === 'Active' &&
        (draft.role !== 'Adminstration' || draft.status !== 'Active')
      if (removesActiveAdmin && activeAdminCount(snapshot.users) <= 1) {
        throw new Error(
          'At least one active Adminstration account must remain.',
        )
      }

      const name = draft.name.trim()
      const email = draft.email.trim()
      if (!name) throw new Error('Enter the user name.')
      if (!email) throw new Error('Enter the user email address.')

      const schemeIds = [...new Set(draft.schemeIds)]
      const schemes = schemeIds.map((schemeId) =>
        snapshot.schemes.find((scheme) => scheme.id === schemeId),
      )
      if (schemes.some((scheme) => !scheme)) {
        throw new Error('One or more selected schemes could not be found.')
      }
      const assignedSchemes = schemes.filter(
        (scheme): scheme is Scheme => Boolean(scheme),
      )

      const updated = await updateOfficerRecord(id, {
        name,
        email,
        phone: draft.phone.trim(),
        role: draft.role,
        status: draft.status,
        schemes: assignedSchemes,
      })
      const mapped = mapUser(updated.record, snapshot.schemes)

      setSnapshot((current) => ({
        ...current,
        users: current.users.map((user) =>
          user.id === mapped.id ? mapped : user,
        ),
      }))

      pushActivity({
        action: 'User updated',
        subject: name,
        detail: `${name}'s account was updated${
          assignedSchemes.length
            ? ` for ${assignedSchemes.map((scheme) => scheme.name).join(', ')}`
            : ''
        }.${
          updated.rolesSaved
            ? ''
            : ' The SharePoint PrincipalOfficersRole column did not save the workflow role.'
        }`,
        actor,
        referenceNumber: '',
      })

      return { rolesSaved: updated.rolesSaved }
    },
    [authRole, snapshot.schemes, snapshot.users, pushActivity],
  )

  const toggleUserStatus = useCallback(
    async (id: string, actor: string) => {
      requirePermission(
        authRole,
        'users:manage',
        'Only Adminstration can enable or disable principal officer accounts.',
      )
      const existing = snapshot.users.find((user) => user.id === id)
      if (!existing) {
        throw new Error('The selected principal officer could not be found.')
      }

      const nextStatus: UserStatus =
        existing.status === 'Active' ? 'Disabled' : 'Active'
      if (
        existing.role === 'Adminstration' &&
        existing.status === 'Active' &&
        nextStatus === 'Disabled' &&
        activeAdminCount(snapshot.users) <= 1
      ) {
        throw new Error(
          'At least one active Adminstration account must remain.',
        )
      }
      const updated = await setOfficerStatus(id, nextStatus)
      const mapped = mapUser(updated, snapshot.schemes)

      setSnapshot((current) => ({
        ...current,
        users: current.users.map((user) =>
          user.id === mapped.id ? mapped : user,
        ),
      }))

      pushActivity({
        action: nextStatus === 'Disabled' ? 'User disabled' : 'User enabled',
        subject: existing.name,
        detail: `${existing.name}'s account was ${nextStatus.toLowerCase()}.`,
        actor,
        referenceNumber: '',
      })
    },
    [authRole, snapshot.schemes, snapshot.users, pushActivity],
  )

  const createScheme = useCallback(
    async (draft: SchemeDraft, actor: string) => {
      requirePermission(
        authRole,
        'schemes:manage',
        'Only Adminstration can create schemes.',
      )
      const name = draft.name.trim()
      if (!name) throw new Error('Enter a scheme name.')

      const created = await createSchemeRecord(name)
      const mapped = mapScheme(created)
      const nextSchemes = [...snapshot.schemes, mapped]

      let officer: SystemUser | undefined
      if (draft.principalOfficerId) {
        const existingOfficer = snapshot.users.find(
          (user) => user.id === draft.principalOfficerId,
        )
        if (!existingOfficer) {
          throw new Error('The selected principal officer could not be found.')
        }
        const officerSchemeIds = existingOfficer.schemeIds.length
          ? existingOfficer.schemeIds
          : existingOfficer.schemeId
            ? [existingOfficer.schemeId]
            : []
        const assignedSchemes = [...new Set([...officerSchemeIds, mapped.id])]
          .map((schemeId) =>
            schemeId === mapped.id
              ? mapped
              : nextSchemes.find((scheme) => scheme.id === schemeId),
          )
          .filter((scheme): scheme is Scheme => Boolean(scheme))
        const record = await assignOfficerSchemes(
          existingOfficer.id,
          assignedSchemes,
        )
        officer = mapUser(record, nextSchemes)
      }

      setSnapshot((current) => ({
        ...current,
        schemes: [...current.schemes.filter((item) => item.id !== mapped.id), mapped],
        users: officer
          ? current.users.map((user) =>
              user.id === officer.id ? officer : user,
            )
          : current.users,
      }))

      pushActivity({
        action: 'Scheme created',
        subject: mapped.name,
        detail: `${mapped.name} was created${
          officer ? ` with ${officer.name} as Principal Officer` : ''
        }.`,
        actor,
        referenceNumber: '',
      })
    },
    [authRole, snapshot.schemes, snapshot.users, pushActivity],
  )

  const updateScheme = useCallback(
    async (id: string, draft: SchemeDraft, actor: string) => {
      requirePermission(
        authRole,
        'schemes:manage',
        'Only Adminstration can update schemes.',
      )
      const existing = snapshot.schemes.find((scheme) => scheme.id === id)
      if (!existing) {
        throw new Error('The selected scheme could not be found.')
      }

      const name = draft.name.trim()
      if (!name) throw new Error('Enter a scheme name.')

      const updated = await updateSchemeRecord(id, name)
      const mapped = mapScheme(updated)
      const nextSchemes = snapshot.schemes.map((scheme) =>
        scheme.id === id ? mapped : scheme,
      )
      const officerUpdates = new Map<string, SystemUser>()
      const selectedOfficer = draft.principalOfficerId
        ? snapshot.users.find((user) => user.id === draft.principalOfficerId)
        : undefined
      if (draft.principalOfficerId && !selectedOfficer) {
        throw new Error('The selected principal officer could not be found.')
      }

      const affectedOfficers = snapshot.users.filter(
        (user) =>
          userHasScheme(user, id) || user.id === draft.principalOfficerId,
      )
      for (const officer of affectedOfficers) {
        const currentSchemeIds = officer.schemeIds.length
          ? officer.schemeIds
          : officer.schemeId
            ? [officer.schemeId]
            : []
        const nextSchemeIds = currentSchemeIds.filter(
          (schemeId) => schemeId !== id,
        )
        if (officer.id === draft.principalOfficerId) {
          nextSchemeIds.push(id)
        }
        const assignedSchemes = [...new Set(nextSchemeIds)]
          .map((schemeId) =>
            schemeId === id
              ? mapped
              : nextSchemes.find((scheme) => scheme.id === schemeId),
          )
          .filter((scheme): scheme is Scheme => Boolean(scheme))
        const record = await assignOfficerSchemes(
          officer.id,
          assignedSchemes,
        )
        officerUpdates.set(officer.id, mapUser(record, nextSchemes))
      }

      setSnapshot((current) => ({
        ...current,
        schemes: current.schemes.map((scheme) =>
          scheme.id === id ? mapped : scheme,
        ),
        users: current.users.map(
          (user) =>
            officerUpdates.get(user.id) ?? user,
        ),
      }))

      pushActivity({
        action: 'Scheme updated',
        subject: mapped.name,
        detail: `${existing.name} was updated${
          draft.principalOfficerId
            ? ` and reassigned to a principal officer`
            : ''
        }.`,
        actor,
        referenceNumber: '',
      })
    },
    [authRole, snapshot.schemes, snapshot.users, pushActivity],
  )

  const toggleSchemeStatus = useCallback(
    async (id: string, actor: string) => {
      requirePermission(
        authRole,
        'schemes:manage',
        'Only Adminstration can enable or disable schemes.',
      )
      const existing = snapshot.schemes.find((scheme) => scheme.id === id)
      if (!existing) {
        throw new Error('The selected scheme could not be found.')
      }

      const nextStatus =
        existing.status === 'Active' ? 'Disabled' : 'Active'
      const updated = await setSchemeStatusRecord(id, nextStatus)
      const mapped = mapScheme(updated)

      setSnapshot((current) => ({
        ...current,
        schemes: current.schemes.map((scheme) =>
          scheme.id === mapped.id ? mapped : scheme,
        ),
      }))

      pushActivity({
        action: nextStatus === 'Disabled' ? 'Scheme disabled' : 'Scheme enabled',
        subject: existing.name,
        detail: `${existing.name} was ${
          nextStatus === 'Disabled' ? 'disabled' : 'enabled'
        }.`,
        actor,
        referenceNumber: '',
      })
    },
    [authRole, snapshot.schemes, pushActivity],
  )

  const getBeneficiariesForNomination = useCallback(
    (nominationId: string) => {
      const nomination = snapshot.nominations.find(
        (item) => item.id === nominationId,
      )
      if (!nomination) return []
      return snapshot.beneficiaries.filter(
        (beneficiary) =>
          (nomination.referenceNumber !== '' &&
            beneficiary.refNumber === nomination.referenceNumber) ||
          (beneficiary.memberItemId !== null &&
            String(beneficiary.memberItemId) === nomination.id),
      )
    },
    [snapshot.beneficiaries, snapshot.nominations],
  )

  const value = useMemo(
    () => ({
      schemes: snapshot.schemes,
      users: snapshot.users,
      nominations: snapshot.nominations,
      beneficiaries: snapshot.beneficiaries,
      activity,
      loading,
      refreshing,
      error,
      demoMode,
      refresh,
      approveNomination,
      rejectNomination,
      validateNomination,
      addNominationComment,
      updateNominationDetails,
      updateBeneficiaryDetails,
      createUser,
      updateUser,
      toggleUserStatus,
      createScheme,
      updateScheme,
      toggleSchemeStatus,
      getBeneficiariesForNomination,
    }),
    [
      activity,
      addNominationComment,
      approveNomination,
      createScheme,
      createUser,
      demoMode,
      error,
      getBeneficiariesForNomination,
      loading,
      refresh,
      refreshing,
      rejectNomination,
      snapshot.beneficiaries,
      snapshot.nominations,
      snapshot.schemes,
      snapshot.users,
      toggleSchemeStatus,
      toggleUserStatus,
      updateBeneficiaryDetails,
      updateNominationDetails,
      updateScheme,
      updateUser,
      validateNomination,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
