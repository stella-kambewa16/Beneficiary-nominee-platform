import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getContext } from '@microsoft/power-apps/app'
import { AuthContext } from './auth-context'
import type {
  AuthStatus,
  AuthUser,
  RoleSource,
} from './auth-context'
import { hasPermission, roleOrder, roleProfiles } from './roles'
import type { Permission, Role } from './roles'
import {
  fetchOfficerRecords,
  normalizeUserRole,
  normalizeUserStatus,
} from '../data/sharepoint'
import { initials } from '../lib/format'

const PREVIEW_KEY = 'mfs-role-preview'
const previewEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_ROLE_PREVIEW === 'true'

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function emailFallbackName(email: string): string {
  const local = email.split('@')[0] ?? ''
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ')
}

function readPreviewRole(): Role | null {
  if (!previewEnabled) return null
  try {
    const stored = window.localStorage.getItem(PREVIEW_KEY)
    if (stored && roleOrder.includes(stored as Role)) return stored as Role
  } catch {
    /* Preview persistence is optional. */
  }
  return null
}

function isDemoMode(): boolean {
  return (
    new URLSearchParams(window.location.hash.split('?')[1] ?? '').get(
      'demo',
    ) === 'seed'
  )
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return 'The request failed.'
}

interface ResolvedAccess {
  role: Role
  source: RoleSource
  warning: string | null
}

function resolveAccess(
  user: AuthUser,
  officers: Awaited<ReturnType<typeof fetchOfficerRecords>>,
): ResolvedAccess {
  const email = user.email.trim().toLowerCase()
  const matches = officers.filter(
    (record) => trimmed(record.email).toLowerCase() === email,
  )
  const activeMatches = matches.filter(
    (record) => normalizeUserStatus(record.status) === 'Active',
  )

  if (activeMatches.length > 1) {
    return {
      role: 'Employee',
      source: 'default',
      warning:
        'More than one active principalOfficers record matches your email. Ask an administrator to remove the duplicate; read-only Employee access was applied.',
    }
  }

  if (activeMatches.length > 0) {
    const role = normalizeUserRole(
      activeMatches[0].PrincipalOfficersRole,
    )
    return { role, source: 'sharepoint', warning: null }
  }

  if (matches.length > 0) {
    return {
      role: 'Employee',
      source: 'default',
      warning:
        'Your principalOfficers record is disabled, so the read-only Employee role was applied.',
    }
  }

  return {
    role: 'Employee',
    source: 'default',
    warning:
      'No active workflow role is assigned to your account. You have read-only Employee access.',
  }
}

async function resolveIdentity(): Promise<AuthUser> {
  try {
    const context = await getContext()
    const email = trimmed(context.user?.userPrincipalName).toLowerCase()
    const name =
      trimmed(context.user?.fullName) ||
      (email ? emailFallbackName(email) : '')
    if (!email) {
      throw new Error(
        'The Power Apps host did not return a user principal name for this session.',
      )
    }
    return {
      name: name || email,
      email,
      objectId: trimmed(context.user?.objectId),
    }
  } catch (error) {
    const devEmail = trimmed(import.meta.env.VITE_DEV_USER_EMAIL).toLowerCase()
    if (devEmail) {
      const devName =
        trimmed(import.meta.env.VITE_DEV_USER_NAME) ||
        emailFallbackName(devEmail)
      return { name: devName, email: devEmail, objectId: '' }
    }
    throw new Error(
      [
        'Signed-in identity is unavailable.',
        'Open the app through the Power Apps host (the Local Play URL printed by `pa app run`) so Microsoft 365 identity is available.',
        messageOf(error),
      ]
        .filter(Boolean)
        .join(' '),
    )
  }
}

interface AuthState {
  status: AuthStatus
  user: AuthUser
  resolvedRole: Role
  roleSource: RoleSource
  error: string | null
  warning: string | null
}

const INITIAL_STATE: AuthState = {
  status: 'loading',
  user: { name: '', email: '', objectId: '' },
  resolvedRole: 'Employee',
  roleSource: 'loading',
  error: null,
  warning: null,
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE)
  const [previewRole, setPreviewRole] = useState<Role | null>(readPreviewRole)
  const [reloadToken, setReloadToken] = useState(0)

  const retry = useCallback(() => {
    setState((current) => ({ ...current, status: 'loading', error: null }))
    setReloadToken((value) => value + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      let user: AuthUser
      try {
        user = await resolveIdentity()
      } catch (error) {
        if (cancelled) return
        setState({
          ...INITIAL_STATE,
          status: 'error',
          error: messageOf(error),
        })
        return
      }

      try {
        const officers = await fetchOfficerRecords()
        if (cancelled) return
        const access = resolveAccess(user, officers)
        const effectiveAccess =
          isDemoMode() && access.role === 'Employee'
            ? {
                role: 'Adminstration' as const,
                source: 'default' as const,
                warning:
                  'Demo seed mode is active. Role changes stay in this browser and do not touch SharePoint.',
              }
            : access
        setState({
          status: 'ready',
          user,
          resolvedRole: effectiveAccess.role,
          roleSource: effectiveAccess.source,
          error: null,
          warning: effectiveAccess.warning,
        })
      } catch (error) {
        if (cancelled) return
        // A failed role lookup never grants a role. Land on Employee with a
        // visible, retryable warning.
        setState({
          status: 'ready',
          user,
          resolvedRole: 'Employee',
          roleSource: 'default',
          error: null,
          warning: [
            'Your workflow role could not be read from SharePoint, so the least-privilege Employee role was applied.',
            messageOf(error),
          ].join(' '),
        })
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const setRole = useCallback(
    (next: Role) => {
      if (!previewEnabled) return
      setPreviewRole(next)
      try {
        window.localStorage.setItem(PREVIEW_KEY, next)
      } catch {
        /* Preview persistence is optional. */
      }
    },
    [],
  )

  const role =
    previewEnabled && previewRole ? previewRole : state.resolvedRole
  const roleSource: RoleSource =
    previewEnabled && previewRole ? 'preview' : state.roleSource

  const profile = useMemo(() => {
    const base = roleProfiles[role]
    const name = state.user.name || base.name
    return {
      ...base,
      name,
      email: state.user.email || base.email,
      initials: initials(name) || base.initials,
    }
  }, [role, state.user])

  const can = useCallback(
    (permission: Permission) => hasPermission(role, permission),
    [role],
  )

  const value = useMemo(
    () => ({
      role,
      profile,
      user: state.user,
      status: state.status,
      error: state.error,
      warning: state.warning,
      roleSource,
      previewEnabled,
      setRole,
      retry,
      can,
    }),
    [
      can,
      profile,
      retry,
      role,
      roleSource,
      setRole,
      state.error,
      state.status,
      state.user,
      state.warning,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
