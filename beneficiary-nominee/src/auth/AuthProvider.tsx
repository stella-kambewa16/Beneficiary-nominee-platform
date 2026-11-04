import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './auth-context'
import { hasPermission, roleOrder, roleProfiles } from './roles'
import type { Permission, Role } from './roles'

const ROLE_KEY = 'mfs-demo-role'

function readRole(): Role {
  try {
    const stored = window.localStorage.getItem(ROLE_KEY)
    if (stored && roleOrder.includes(stored as Role)) {
      return stored as Role
    }
  } catch {
    /* Preference persistence is optional. */
  }
  return 'Admin'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(readRole)

  const setRole = useCallback((next: Role) => {
    setRoleState(next)
    try {
      window.localStorage.setItem(ROLE_KEY, next)
    } catch {
      /* Preference persistence is optional. */
    }
  }, [])

  const can = useCallback(
    (permission: Permission) => hasPermission(role, permission),
    [role],
  )

  const value = useMemo(
    () => ({
      role,
      profile: roleProfiles[role],
      setRole,
      can,
    }),
    [role, setRole, can],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
