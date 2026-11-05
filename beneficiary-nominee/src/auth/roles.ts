export type Role = 'Admin' | 'Principal Officer' | 'Pension Manager'

/** Business label for a role. The internal Pension Manager key is retained for compatibility. */
export function roleLabel(role: Role): string {
  return role === 'Pension Manager' ? 'Pension Administrator' : role
}

export type Permission =
  | 'dashboard:view'
  | 'nominations:view'
  | 'beneficiaries:view'
  | 'reports:view'
  | 'nominations:approve:po'
  | 'nominations:approve:pm'
  | 'nominations:reject'
  | 'users:manage'
  | 'schemes:manage'

export interface RoleProfile {
  role: Role
  name: string
  title: string
  email: string
  initials: string
  description: string
  permissions: Permission[]
}

export const roleOrder: Role[] = [
  'Admin',
  'Principal Officer',
  'Pension Manager',
]

export const roleProfiles: Record<Role, RoleProfile> = {
  Admin: {
    role: 'Admin',
    name: 'S. Kambewa',
    title: 'System Administrator',
    email: 'skambewa@oldmutual.co.mw',
    initials: 'SK',
    description:
      'Full control of users, schemes, nominations and both approval stages.',
    permissions: [
      'dashboard:view',
      'nominations:view',
      'beneficiaries:view',
      'reports:view',
      'nominations:approve:po',
      'nominations:approve:pm',
      'nominations:reject',
      'users:manage',
      'schemes:manage',
    ],
  },
  'Principal Officer': {
    role: 'Principal Officer',
    name: 'Thandiwe Moyo',
    title: 'Principal Officer',
    email: 'thandiwe.moyo@oldmutual.co.mw',
    initials: 'TM',
    description:
      'Reviews and endorses beneficiary nominations for the assigned scheme.',
    permissions: [
      'dashboard:view',
      'nominations:view',
      'beneficiaries:view',
      'reports:view',
      'nominations:approve:po',
      'nominations:reject',
    ],
  },
  'Pension Manager': {
    role: 'Pension Manager',
    name: 'Nyasha Banda',
    title: 'Pension Administrator',
    email: 'nyasha.banda@oldmutual.co.mw',
    initials: 'NB',
    description:
      'Provides final approval for nominations endorsed by the Principal Officer.',
    permissions: [
      'dashboard:view',
      'nominations:view',
      'beneficiaries:view',
      'reports:view',
      'nominations:approve:pm',
      'nominations:reject',
    ],
  },
}

/**
 * The current build has no separate Pension Administrator list, so the demo
 * Pension Manager profile is used as the default second endorser. Replace this
 * helper with a real lookup when a PA source list is available.
 */
export function pensionAdministrator(): {
  name: string
  email: string
} {
  const profile = roleProfiles['Pension Manager']
  return { name: profile.name, email: profile.email }
}

export interface PermissionMeta {
  key: Permission
  label: string
  group: string
}

export const permissionCatalog: PermissionMeta[] = [
  { key: 'dashboard:view', label: 'View dashboard', group: 'Workspace' },
  {
    key: 'nominations:view',
    label: 'View beneficiary nominations',
    group: 'Workspace',
  },
  {
    key: 'beneficiaries:view',
    label: 'View beneficiaries',
    group: 'Workspace',
  },
  { key: 'reports:view', label: 'View and export reports', group: 'Insight' },
  {
    key: 'nominations:approve:po',
    label: 'Endorse nominations as Principal Officer',
    group: 'Approval workflow',
  },
  {
    key: 'nominations:approve:pm',
    label: 'Give final approval as Pension Administrator',
    group: 'Approval workflow',
  },
  {
    key: 'nominations:reject',
    label: 'Reject nominations at the active stage',
    group: 'Approval workflow',
  },
  { key: 'users:manage', label: 'Manage users', group: 'Administration' },
  { key: 'schemes:manage', label: 'Manage schemes', group: 'Administration' },
]

export function hasPermission(role: Role, permission: Permission): boolean {
  return roleProfiles[role].permissions.includes(permission)
}
