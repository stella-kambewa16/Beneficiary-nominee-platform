import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { DataContext } from './context'
import {
  assignOfficerScheme,
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
import { pensionAdministrator } from '../auth/roles'
import { appendComment } from '../lib/comments'
import { nowIso } from '../lib/format'
import {
  activePrincipalOfficerForScheme,
  applyEvaluation,
  evaluateNominationErrors,
} from '../lib/validation'

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

function decisionStage(
  role: UserRole,
  status: NominationStatus,
): DecisionStage | null {
  if (
    status === 'Pending PO' &&
    (role === 'Principal Officer' || role === 'Admin')
  ) {
    return 'PO'
  }
  if (
    status === 'Pending PA' &&
    (role === 'Pension Manager' || role === 'Admin')
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
  return role === 'Principal Officer'
    ? 'This nomination is awaiting Pension Administrator approval.'
    : 'This nomination is awaiting Pension Administrator approval.'
}

function requireClear(nomination: Nomination): void {
  if (nomination.errorStatus !== 'Clear') {
    throw new Error(
      `This nomination cannot be endorsed while its Errors status is "${nomination.errorStatus}". Clear the validation issues in Tasks first.`,
    )
  }
}

function validationComment(
  evaluation: { status: NominationErrorStatus; findings: string[] },
): string {
  if (evaluation.status === 'Clear') {
    return 'Validation passed; Errors set to Clear.'
  }
  return `Validation failed (${evaluation.status}): ${evaluation.findings.join(
    ' ',
  )}`
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT)
  const [sessionActivity, setSessionActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
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
      if (mode === 'initial') {
        setLoading(false)
      } else {
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    // Defer the initial read so the provider mounts before state updates.
    const timer = window.setTimeout(() => {
      void load('initial')
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const refresh = useCallback(() => load('refresh'), [load])

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

      const stage = decisionStage(role, nomination.status)
      if (!stage) {
        throw new Error(stageMessage(role, nomination.status))
      }
      requireClear(nomination)

      const nextStatus: NominationStatus =
        stage === 'PO' ? 'Pending PA' : 'Approved'
      const comment =
        comments.trim() ||
        (stage === 'PO'
          ? 'Endorsed and forwarded to the Pension Administrator.'
          : 'Final approval granted.')

      const updated = await writeNominationDecision(nomination.id, {
        status: nextStatus,
        stage,
        actor,
        actorEmail,
        actorRole: role,
        comment,
        previousComments: nomination.comments,
        errors: nomination.errorStatus,
        secondEndorser: stage === 'PO' ? pensionAdministrator() : undefined,
      })
      const mapped = mapNomination(
        updated,
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
        } was ${stage === 'PO' ? 'endorsed' : 'approved'} by ${actor}.`,
        actor,
        referenceNumber: nomination.referenceNumber,
        nominationId: nomination.id,
      })
    },
    [
      snapshot.beneficiaries,
      snapshot.nominations,
      snapshot.schemes,
      snapshot.users,
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
      if (!reason.trim()) {
        throw new Error('A rejection reason is required.')
      }

      const stage = decisionStage(role, nomination.status)
      if (!stage) {
        throw new Error(stageMessage(role, nomination.status))
      }

      const updated = await writeNominationDecision(nomination.id, {
        status: 'Rejected',
        stage,
        actor,
        actorEmail,
        actorRole: role,
        comment: reason.trim(),
        previousComments: nomination.comments,
        errors: nomination.errorStatus,
      })
      const mapped = mapNomination(
        updated,
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
        action: 'Nomination rejected',
        subject: nomination.memberName,
        detail: `${
          nomination.referenceNumber || `Nomination ${nomination.id}`
        } was rejected by ${actor}: ${reason.trim()}`,
        actor,
        referenceNumber: nomination.referenceNumber,
        nominationId: nomination.id,
      })
    },
    [
      snapshot.beneficiaries,
      snapshot.nominations,
      snapshot.schemes,
      snapshot.users,
      pushActivity,
    ],
  )

  const validateNomination = useCallback(
    async (
      nominationId: string,
      role: UserRole,
      actor: string,
    ): Promise<{ status: NominationErrorStatus; findings: string[] }> => {
      const nomination = snapshot.nominations.find(
        (item) => item.id === nominationId,
      )
      if (!nomination) {
        throw new Error('The selected nomination could not be found.')
      }

      const evaluation = evaluateNominationErrors({
        nomination,
        beneficiaries: snapshot.beneficiaries,
        schemes: snapshot.schemes,
        users: snapshot.users,
      })

      let nextStatus: NominationStatus = nomination.status
      let firstEndorser: { name: string; email: string } | undefined

      if (evaluation.status !== 'Clear') {
        if (nomination.status === 'Pending PO' || nomination.status === 'Pending PA') {
          nextStatus = 'Tasks'
        }
      } else if (
        nomination.status === 'Tasks' ||
        nomination.status === 'Submitted'
      ) {
        const scheme = snapshot.schemes.find(
          (item) => item.id === nomination.schemeId,
        )
        const officer = scheme
          ? activePrincipalOfficerForScheme(snapshot.users, scheme.id)
          : undefined
        if (!officer) {
          throw new Error(
            'A Principal Officer must be assigned to the scheme before this nomination can be promoted.',
          )
        }
        nextStatus = 'Pending PO'
        firstEndorser = { name: officer.name, email: officer.email }
      }

      const promoted = nextStatus === 'Pending PO' && nomination.status !== 'Pending PO'
      const message =
        evaluation.status === 'Clear'
          ? promoted
            ? `Validation passed. Moved to Pending PO and assigned ${
                firstEndorser?.name ?? 'the Principal Officer'
              } as First Endorser.`
            : 'Validation re-run; all checks passed.'
          : validationComment(evaluation)

      const updated = await writeNominationValidation(nomination.id, {
        status: nextStatus,
        errors: evaluation.status,
        comments: appendComment(nomination.comments, actor, role, message),
        firstEndorser,
      })
      const mapped = mapNomination(
        updated,
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
          evaluation.status === 'Clear'
            ? 'Validation cleared'
            : 'Nomination returned to Tasks',
        subject: nomination.memberName,
        detail: `${
          nomination.referenceNumber || `Nomination ${nomination.id}`
        }: ${message}`,
        actor,
        referenceNumber: nomination.referenceNumber,
        nominationId: nomination.id,
      })

      return evaluation
    },
    [
      snapshot.beneficiaries,
      snapshot.nominations,
      snapshot.schemes,
      snapshot.users,
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

      const changedFields = Object.entries(correction)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key)
      const comment = appendComment(
        nomination.comments,
        actor,
        role,
        `Corrected nomination details (${changedFields.join(', ') || 'no fields'}).`,
      )

      const updated = await updateNominationRecord(
        nominationId,
        correction,
        comment,
      )
      const mapped = mapNomination(
        updated,
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
        actor,
        referenceNumber: nomination.referenceNumber,
        nominationId: nomination.id,
      })
    },
    [
      snapshot.beneficiaries,
      snapshot.nominations,
      snapshot.schemes,
      snapshot.users,
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

      const parent = snapshot.nominations.find(
        (nomination) =>
          (existing.refNumber !== '' &&
            nomination.referenceNumber === existing.refNumber) ||
          (existing.memberItemId !== null &&
            String(existing.memberItemId) === nomination.id),
      )
      const changedFields = Object.entries(correction)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key)

      const updated = await updateNomineeRecord(beneficiaryId, correction)
      const mapped = mapBeneficiary(updated)
      const updatedParent = parent
        ? mapNomination(
            await updateNominationComments(
              parent.id,
              appendComment(
                parent.comments,
                actor,
                role,
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
          return applyEvaluation(
            source,
            current.schemes,
            current.users,
            beneficiaries,
          )
        })
        return { ...current, beneficiaries, nominations }
      })

      pushActivity({
        action: 'Beneficiary details updated',
        subject: existing.title || `Beneficiary ${existing.id}`,
        detail: `Beneficiary ${existing.refNumber || existing.id} was corrected in Tasks.`,
        actor,
        referenceNumber: existing.refNumber,
      })
    },
    [
      snapshot.beneficiaries,
      snapshot.nominations,
      snapshot.schemes,
      snapshot.users,
      pushActivity,
    ],
  )

  const createUser = useCallback(
    async (draft: UserDraft, actor: string) => {
      const name = draft.name.trim()
      const email = draft.email.trim()
      if (!name) throw new Error('Enter the principal officer name.')
      if (!email) throw new Error('Enter the principal officer email address.')

      const scheme = draft.schemeId
        ? (snapshot.schemes.find((item) => item.id === draft.schemeId) ?? null)
        : null

      const created = await createOfficerRecord({
        name,
        email,
        phone: draft.phone.trim(),
        status: draft.status,
        scheme,
      })
      const mapped = mapUser(created, snapshot.schemes)

      setSnapshot((current) => ({
        ...current,
        users: [mapped, ...current.users.filter((user) => user.id !== mapped.id)],
      }))

      pushActivity({
        action: 'Principal officer created',
        subject: name,
        detail: `${name} was added${scheme ? ` for ${scheme.name}` : ''}.`,
        actor,
        referenceNumber: '',
      })
    },
    [snapshot.schemes, pushActivity],
  )

  const updateUser = useCallback(
    async (id: string, draft: UserDraft, actor: string) => {
      const existing = snapshot.users.find((user) => user.id === id)
      if (!existing) {
        throw new Error('The selected principal officer could not be found.')
      }

      const name = draft.name.trim()
      const email = draft.email.trim()
      if (!name) throw new Error('Enter the principal officer name.')
      if (!email) throw new Error('Enter the principal officer email address.')

      const scheme = draft.schemeId
        ? (snapshot.schemes.find((item) => item.id === draft.schemeId) ?? null)
        : null

      const updated = await updateOfficerRecord(id, {
        name,
        email,
        phone: draft.phone.trim(),
        status: draft.status,
        scheme,
      })
      const mapped = mapUser(updated, snapshot.schemes)

      setSnapshot((current) => ({
        ...current,
        users: current.users.map((user) =>
          user.id === mapped.id ? mapped : user,
        ),
      }))

      pushActivity({
        action: 'Principal officer updated',
        subject: name,
        detail: `${name}'s account was updated${
          scheme ? ` for ${scheme.name}` : ''
        }.`,
        actor,
        referenceNumber: '',
      })
    },
    [snapshot.schemes, snapshot.users, pushActivity],
  )

  const toggleUserStatus = useCallback(
    async (id: string, actor: string) => {
      const existing = snapshot.users.find((user) => user.id === id)
      if (!existing) {
        throw new Error('The selected principal officer could not be found.')
      }

      const nextStatus: UserStatus =
        existing.status === 'Active' ? 'Disabled' : 'Active'
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
    [snapshot.schemes, snapshot.users, pushActivity],
  )

  const createScheme = useCallback(
    async (draft: SchemeDraft, actor: string) => {
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
        const record = await assignOfficerScheme(existingOfficer.id, mapped)
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
    [snapshot.schemes, snapshot.users, pushActivity],
  )

  const updateScheme = useCallback(
    async (id: string, draft: SchemeDraft, actor: string) => {
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

      if (draft.principalOfficerId) {
        const officer = snapshot.users.find(
          (user) => user.id === draft.principalOfficerId,
        )
        if (!officer) {
          throw new Error('The selected principal officer could not be found.')
        }
        const record = await assignOfficerScheme(officer.id, mapped)
        officerUpdates.set(officer.id, mapUser(record, nextSchemes))
      }

      const nameChanged =
        existing.title !== mapped.title ||
        existing.schemeName !== mapped.schemeName

      if (nameChanged) {
        // Keep the schemecode/schemename values on assigned officers aligned
        // with the renamed scheme.
        const assigned = snapshot.users.filter(
          (user) =>
            user.schemeId === id && user.id !== draft.principalOfficerId,
        )
        for (const user of assigned) {
          const record = await assignOfficerScheme(user.id, mapped)
          officerUpdates.set(user.id, mapUser(record, nextSchemes))
        }
      }

      setSnapshot((current) => ({
        ...current,
        schemes: current.schemes.map((scheme) =>
          scheme.id === id ? mapped : scheme,
        ),
        users: current.users.map(
          (user) =>
            officerUpdates.get(user.id) ??
            (user.schemeId === id
              ? {
                  ...user,
                  schemeName: mapped.name,
                  schemeCode: mapped.title || mapped.name,
                }
              : user),
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
    [snapshot.schemes, snapshot.users, pushActivity],
  )

  const toggleSchemeStatus = useCallback(
    async (id: string, actor: string) => {
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
    [snapshot.schemes, pushActivity],
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
      refresh,
      approveNomination,
      rejectNomination,
      validateNomination,
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
      approveNomination,
      createScheme,
      createUser,
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
