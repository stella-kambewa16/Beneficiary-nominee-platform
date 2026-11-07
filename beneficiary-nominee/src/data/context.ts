import { createContext, useContext } from 'react'
import type {
  ActivityItem,
  Beneficiary,
  BeneficiaryCorrection,
  Nomination,
  NominationCorrection,
  NominationErrorStatus,
  Scheme,
  SchemeDraft,
  SystemUser,
  UserDraft,
  UserRole,
} from './types'

export interface DataContextValue {
  schemes: Scheme[]
  users: SystemUser[]
  nominations: Nomination[]
  beneficiaries: Beneficiary[]
  activity: ActivityItem[]
  loading: boolean
  refreshing: boolean
  error: string | null
  demoMode: boolean
  refresh: () => Promise<void>
  approveNomination: (
    nominationId: string,
    role: UserRole,
    actor: string,
    actorEmail: string,
    comments?: string,
  ) => Promise<void>
  rejectNomination: (
    nominationId: string,
    role: UserRole,
    actor: string,
    actorEmail: string,
    reason: string,
  ) => Promise<void>
  validateNomination: (
    nominationId: string,
    status: NominationErrorStatus,
    role: UserRole,
    actor: string,
  ) => Promise<NominationErrorStatus>
  addNominationComment: (
    nominationId: string,
    comment: string,
    actor: string,
    role: UserRole,
  ) => Promise<void>
  updateNominationDetails: (
    nominationId: string,
    correction: NominationCorrection,
    actor: string,
    role: UserRole,
  ) => Promise<void>
  updateBeneficiaryDetails: (
    beneficiaryId: string,
    correction: BeneficiaryCorrection,
    actor: string,
    role: UserRole,
  ) => Promise<void>
  createUser: (
    draft: UserDraft,
    actor: string,
  ) => Promise<{ rolesSaved: boolean }>
  updateUser: (
    id: string,
    draft: UserDraft,
    actor: string,
  ) => Promise<{ rolesSaved: boolean }>
  toggleUserStatus: (id: string, actor: string) => Promise<void>
  createScheme: (draft: SchemeDraft, actor: string) => Promise<void>
  updateScheme: (id: string, draft: SchemeDraft, actor: string) => Promise<void>
  toggleSchemeStatus: (id: string, actor: string) => Promise<void>
  getBeneficiariesForNomination: (nominationId: string) => Beneficiary[]
}

export const DataContext = createContext<DataContextValue | null>(null)

export function useData(): DataContextValue {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
}
