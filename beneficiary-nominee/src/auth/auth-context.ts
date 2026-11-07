import { createContext, useContext } from 'react'
import type { Permission, Role, RoleProfile } from './roles'

export type AuthStatus = 'loading' | 'ready' | 'error'

export type RoleSource =
  | 'loading'
  | 'sharepoint'
  | 'preview'
  | 'default'

export interface AuthUser {
  name: string
  email: string
  /** Microsoft Entra object id, when the host exposes it. */
  objectId: string
}

export interface AuthContextValue {
  role: Role
  profile: RoleProfile
  user: AuthUser
  status: AuthStatus
  error: string | null
  warning: string | null
  roleSource: RoleSource
  /** True only when `VITE_ENABLE_ROLE_PREVIEW` is explicitly enabled. */
  previewEnabled: boolean
  /** Changes the preview role. No-op unless preview is enabled. */
  setRole: (role: Role) => void
  retry: () => void
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
