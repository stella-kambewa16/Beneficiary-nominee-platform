import { createContext, useContext } from 'react'
import type { Permission, Role, RoleProfile } from './roles'

export interface AuthContextValue {
  role: Role
  profile: RoleProfile
  setRole: (role: Role) => void
  can: (permission: Permission) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
