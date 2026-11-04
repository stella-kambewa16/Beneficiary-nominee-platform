import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  seedActivity,
  seedBeneficiaries,
  seedNominations,
  seedSchemes,
  seedUsers,
} from './seed'
import { DataContext } from './context'
import type {
  ActivityItem,
  ApprovalDecision,
  ApprovalEvent,
  Beneficiary,
  Nomination,
  NominationStatus,
  Scheme,
  SchemeDraft,
  SystemUser,
  UserDraft,
  UserRole,
} from './types'
import { nowIso, todayIso } from '../lib/format'

let userSequence = 8
let schemeSequence = 5
let activitySequence = 3008
let eventSequence = 5000

function nextUserId(): string {
  userSequence += 1
  return `USR-${String(userSequence).padStart(3, '0')}`
}

function nextSchemeId(): string {
  schemeSequence += 1
  return `SCH-${String(schemeSequence).padStart(3, '0')}`
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [schemes, setSchemes] = useState<Scheme[]>(seedSchemes)
  const [users, setUsers] = useState<SystemUser[]>(seedUsers)
  const [nominations, setNominations] = useState<Nomination[]>(seedNominations)
  const [beneficiaries, setBeneficiaries] =
    useState<Beneficiary[]>(seedBeneficiaries)
  const [activity, setActivity] = useState<ActivityItem[]>(seedActivity)

  const pushActivity = useCallback(
    (
      action: string,
      subject: string,
      detail: string,
      actor: string,
      referenceNumber: string,
    ) => {
      activitySequence += 1
      const entry: ActivityItem = {
        id: `ACT-${activitySequence}`,
        action,
        subject,
        detail,
        actor,
        time: nowIso(),
        referenceNumber,
      }
      setActivity((current) => [entry, ...current])
    },
    [],
  )

  const approveNomination = useCallback(
    (
      referenceNumber: string,
      role: UserRole,
      actor: string,
      comments = '',
    ) => {
      const nomination = nominations.find(
        (item) => item.referenceNumber === referenceNumber,
      )
      if (!nomination) {
        throw new Error('The selected nomination could not be found.')
      }

      let nextStatus: NominationStatus
      let stage: string
      let decision: ApprovalDecision

      if (role === 'Principal Officer') {
        if (nomination.status !== 'Pending PO Approval') {
          throw new Error(
            'This nomination is not awaiting Principal Officer approval.',
          )
        }
        nextStatus = 'Pending PM Approval'
        stage = 'Principal Officer review'
        decision = 'Endorsed'
      } else if (role === 'Pension Manager') {
        if (nomination.status !== 'Pending PM Approval') {
          throw new Error(
            'This nomination is not awaiting Pension Manager approval.',
          )
        }
        nextStatus = 'Approved'
        stage = 'Pension Manager review'
        decision = 'Approved'
      } else if (nomination.status === 'Pending PO Approval') {
        nextStatus = 'Pending PM Approval'
        stage = 'Administrator review (PO stage)'
        decision = 'Endorsed'
      } else if (nomination.status === 'Pending PM Approval') {
        nextStatus = 'Approved'
        stage = 'Administrator review (PM stage)'
        decision = 'Approved'
      } else {
        throw new Error('This nomination has already been decided.')
      }

      eventSequence += 1
      const event: ApprovalEvent = {
        id: `EVT-${eventSequence}`,
        stage,
        actor,
        decision,
        date: todayIso(),
        comments:
          comments.trim() ||
          (decision === 'Endorsed'
            ? 'Endorsed for final approval.'
            : 'Final approval granted.'),
      }

      setNominations((current) =>
        current.map((item) =>
          item.referenceNumber === referenceNumber
            ? {
                ...item,
                status: nextStatus,
                approvalHistory: [...item.approvalHistory, event],
              }
            : item,
        ),
      )

      pushActivity(
        decision === 'Endorsed'
          ? 'Principal Officer endorsed'
          : 'Nomination approved',
        nomination.memberName,
        `${referenceNumber} was ${decision.toLowerCase()} by ${actor}.`,
        actor,
        referenceNumber,
      )
    },
    [nominations, pushActivity],
  )

  const rejectNomination = useCallback(
    (referenceNumber: string, role: UserRole, actor: string, reason: string) => {
      const nomination = nominations.find(
        (item) => item.referenceNumber === referenceNumber,
      )
      if (!nomination) {
        throw new Error('The selected nomination could not be found.')
      }
      if (!reason.trim()) {
        throw new Error('A rejection reason is required.')
      }
      if (
        role === 'Principal Officer' &&
        nomination.status !== 'Pending PO Approval'
      ) {
        throw new Error(
          'This nomination is not awaiting Principal Officer approval.',
        )
      }
      if (
        role === 'Pension Manager' &&
        nomination.status !== 'Pending PM Approval'
      ) {
        throw new Error(
          'This nomination is not awaiting Pension Manager approval.',
        )
      }
      if (
        role === 'Admin' &&
        nomination.status !== 'Pending PO Approval' &&
        nomination.status !== 'Pending PM Approval'
      ) {
        throw new Error('This nomination has already been decided.')
      }

      eventSequence += 1
      const event: ApprovalEvent = {
        id: `EVT-${eventSequence}`,
        stage:
          role === 'Pension Manager'
            ? 'Pension Manager review'
            : role === 'Admin'
              ? 'Administrator review'
              : 'Principal Officer review',
        actor,
        decision: 'Rejected',
        date: todayIso(),
        comments: reason.trim(),
      }

      setNominations((current) =>
        current.map((item) =>
          item.referenceNumber === referenceNumber
            ? {
                ...item,
                status: 'Rejected',
                approvalHistory: [...item.approvalHistory, event],
              }
            : item,
        ),
      )

      pushActivity(
        'Nomination rejected',
        nomination.memberName,
        `${referenceNumber} was rejected by ${actor}: ${reason.trim()}`,
        actor,
        referenceNumber,
      )
    },
    [nominations, pushActivity],
  )

  const createUser = useCallback(
    (draft: UserDraft, actor: string) => {
      const id = nextUserId()
      const scheme = draft.schemeId
        ? schemes.find((item) => item.id === draft.schemeId)
        : undefined
      const newUser: SystemUser = {
        id,
        name: draft.name.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        role: draft.role,
        schemeId: draft.role === 'Principal Officer' ? draft.schemeId : null,
        status: draft.status,
        createdDate: todayIso(),
      }

      setUsers((current) => {
        const cleared =
          newUser.role === 'Principal Officer' && newUser.schemeId
            ? current.map((user) =>
                user.schemeId === newUser.schemeId
                  ? { ...user, schemeId: null }
                  : user,
              )
            : current
        return [newUser, ...cleared]
      })

      pushActivity(
        'User created',
        newUser.name,
        `${newUser.role} account created${
          scheme ? ` and assigned to ${scheme.name}` : ''
        }.`,
        actor,
        '',
      )
    },
    [pushActivity, schemes],
  )

  const updateUser = useCallback(
    (id: string, draft: UserDraft, actor: string) => {
      const existing = users.find((user) => user.id === id)
      if (!existing) {
        throw new Error('The selected user could not be found.')
      }
      const normalized: UserDraft = {
        ...draft,
        name: draft.name.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        schemeId:
          draft.role === 'Principal Officer' ? draft.schemeId : null,
      }
      const scheme = normalized.schemeId
        ? schemes.find((item) => item.id === normalized.schemeId)
        : undefined

      setUsers((current) => {
        const cleared =
          normalized.role === 'Principal Officer' && normalized.schemeId
            ? current.map((user) =>
                user.id !== id && user.schemeId === normalized.schemeId
                  ? { ...user, schemeId: null }
                  : user,
              )
            : current
        return cleared.map((user) =>
          user.id === id ? { ...user, ...normalized } : user,
        )
      })

      pushActivity(
        'User updated',
        normalized.name,
        `${normalized.role} account updated${
          scheme ? ` and assigned to ${scheme.name}` : ''
        }.`,
        actor,
        '',
      )
    },
    [pushActivity, schemes, users],
  )

  const toggleUserStatus = useCallback(
    (id: string, actor: string) => {
      const existing = users.find((user) => user.id === id)
      if (!existing) {
        throw new Error('The selected user could not be found.')
      }
      const nextStatus = existing.status === 'Active' ? 'Disabled' : 'Active'

      setUsers((current) =>
        current.map((user) =>
          user.id === id ? { ...user, status: nextStatus } : user,
        ),
      )

      pushActivity(
        nextStatus === 'Disabled' ? 'User disabled' : 'User enabled',
        existing.name,
        `${existing.name}'s account was ${nextStatus.toLowerCase()}.`,
        actor,
        '',
      )
    },
    [pushActivity, users],
  )

  const createScheme = useCallback(
    (draft: SchemeDraft, actor: string) => {
      const id = nextSchemeId()
      const newScheme: Scheme = {
        id,
        name: draft.name.trim(),
        description: draft.description.trim(),
        status: draft.status,
        createdDate: todayIso(),
      }
      const officer = draft.principalOfficerId
        ? users.find((user) => user.id === draft.principalOfficerId)
        : undefined

      setSchemes((current) => [newScheme, ...current])
      if (officer) {
        setUsers((current) =>
          current.map((user) =>
            user.id === officer.id
              ? { ...user, schemeId: id, role: 'Principal Officer' }
              : user,
          ),
        )
      }

      pushActivity(
        'Scheme created',
        newScheme.name,
        `${newScheme.name} was created${
          officer ? ` with ${officer.name} as Principal Officer` : ''
        }.`,
        actor,
        '',
      )
    },
    [pushActivity, users],
  )

  const updateScheme = useCallback(
    (id: string, draft: SchemeDraft, actor: string) => {
      const existing = schemes.find((scheme) => scheme.id === id)
      if (!existing) {
        throw new Error('The selected scheme could not be found.')
      }
      const officer = draft.principalOfficerId
        ? users.find((user) => user.id === draft.principalOfficerId)
        : undefined

      setSchemes((current) =>
        current.map((scheme) =>
          scheme.id === id
            ? {
                ...scheme,
                name: draft.name.trim(),
                description: draft.description.trim(),
                status: draft.status,
              }
            : scheme,
        ),
      )

      setUsers((current) => {
        const cleared = current.map((user) =>
          user.schemeId === id && user.id !== officer?.id
            ? { ...user, schemeId: null }
            : user,
        )
        return officer
          ? cleared.map((user) =>
              user.id === officer.id
                ? { ...user, schemeId: id, role: 'Principal Officer' }
                : user,
            )
          : cleared
      })

      if (existing.name !== draft.name.trim()) {
        setNominations((current) =>
          current.map((nomination) =>
            nomination.schemeId === id
              ? { ...nomination, schemeName: draft.name.trim() }
              : nomination,
          ),
        )
        setBeneficiaries((current) =>
          current.map((beneficiary) =>
            beneficiary.fundName === existing.name
              ? { ...beneficiary, fundName: draft.name.trim() }
              : beneficiary,
          ),
        )
      }

      pushActivity(
        'Scheme updated',
        draft.name.trim(),
        `${existing.name} was updated${
          officer ? ` and assigned to ${officer.name}` : ''
        }.`,
        actor,
        '',
      )
    },
    [pushActivity, schemes, users],
  )

  const toggleSchemeStatus = useCallback(
    (id: string, actor: string) => {
      const existing = schemes.find((scheme) => scheme.id === id)
      if (!existing) {
        throw new Error('The selected scheme could not be found.')
      }
      const nextStatus = existing.status === 'Active' ? 'Inactive' : 'Active'

      setSchemes((current) =>
        current.map((scheme) =>
          scheme.id === id ? { ...scheme, status: nextStatus } : scheme,
        ),
      )

      pushActivity(
        nextStatus === 'Inactive' ? 'Scheme deactivated' : 'Scheme activated',
        existing.name,
        `${existing.name} was ${nextStatus.toLowerCase()}.`,
        actor,
        '',
      )
    },
    [pushActivity, schemes],
  )

  const getBeneficiariesForNomination = useCallback(
    (referenceNumber: string) =>
      beneficiaries.filter((item) => item.refNumber === referenceNumber),
    [beneficiaries],
  )

  const value = useMemo(
    () => ({
      schemes,
      users,
      nominations,
      beneficiaries,
      activity,
      approveNomination,
      rejectNomination,
      createUser,
      updateUser,
      toggleUserStatus,
      createScheme,
      updateScheme,
      toggleSchemeStatus,
      getBeneficiariesForNomination,
    }),
    [
      schemes,
      users,
      nominations,
      beneficiaries,
      activity,
      approveNomination,
      rejectNomination,
      createUser,
      updateUser,
      toggleUserStatus,
      createScheme,
      updateScheme,
      toggleSchemeStatus,
      getBeneficiariesForNomination,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
