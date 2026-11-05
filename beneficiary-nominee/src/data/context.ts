import { createContext, useContext } from 'react'
import type {
  ActivityItem,
  Beneficiary,
  Nomination,
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
  createUser: (draft: UserDraft, actor: string) => Promise<void>
  updateUser: (id: string, draft: UserDraft, actor: string) => Promise<void>
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
