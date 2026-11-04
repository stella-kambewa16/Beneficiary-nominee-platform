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
  approveNomination: (
    referenceNumber: string,
    role: UserRole,
    actor: string,
    comments?: string,
  ) => void
  rejectNomination: (
    referenceNumber: string,
    role: UserRole,
    actor: string,
    reason: string,
  ) => void
  createUser: (draft: UserDraft, actor: string) => void
  updateUser: (id: string, draft: UserDraft, actor: string) => void
  toggleUserStatus: (id: string, actor: string) => void
  createScheme: (draft: SchemeDraft, actor: string) => void
  updateScheme: (id: string, draft: SchemeDraft, actor: string) => void
  toggleSchemeStatus: (id: string, actor: string) => void
  getBeneficiariesForNomination: (referenceNumber: string) => Beneficiary[]
}

export const DataContext = createContext<DataContextValue | null>(null)

export function useData(): DataContextValue {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
}
