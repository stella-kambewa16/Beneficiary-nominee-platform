import type { UserRole } from '../data/types'

export type Role = UserRole

export function roleLabel(role: Role): string {
  return role
}

export type Permission =
  | 'dashboard:view'
  | 'nominations:view'
  | 'beneficiaries:view'
  | 'reports:view'
  | 'tasks:manage'
  | 'nominations:approve:po'
  | 'nominations:approve:pa'
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
  'Employee',
  'Principal Officer',
  'Pension Adminstration',
  'Adminstration',
]

/** Roles that may be written to `principalOfficers.PrincipalOfficersRole`.
 * `Employee` is the implicit no-role state and is never stored. */
export const assignableRoles: Role[] = roleOrder.filter(
  (role) => role !== 'Employee',
)

export const roleProfiles: Record<Role, RoleProfile> = {
  Employee: {
    role: 'Employee',
    name: 'Employee',
    title: 'Employee',
    email: '',
    initials: 'EM',
    description:
      'Read-only fallback access. Ask an administrator to assign a workflow role.',
    permissions: ['dashboard:view'],
  },
  'Principal Officer': {
    role: 'Principal Officer',
    name: 'Principal Officer',
    title: 'Principal Officer',
    email: '',
    initials: 'PO',
    description:
      'Reviews and endorses nominations assigned to their schemes.',
    permissions: [
      'dashboard:view',
      'nominations:view',
      'beneficiaries:view',
      'reports:view',
      'nominations:approve:po',
      'nominations:reject',
    ],
  },
  'Pension Adminstration': {
    role: 'Pension Adminstration',
    name: 'Pension Adminstration',
    title: 'Pension Adminstration',
    email: '',
    initials: 'PA',
    description:
      'Reviews validation tasks and assigned nominations at both endorsement stages.',
    permissions: [
      'dashboard:view',
      'nominations:view',
      'beneficiaries:view',
      'reports:view',
      'tasks:manage',
      'nominations:approve:po',
      'nominations:approve:pa',
      'nominations:reject',
    ],
  },
  Adminstration: {
    role: 'Adminstration',
    name: 'Adminstration',
    title: 'Adminstration',
    email: '',
    initials: 'AD',
    description:
      'Manages users and schemes and may act on either endorsement stage.',
    permissions: [
      'dashboard:view',
      'nominations:view',
      'beneficiaries:view',
      'reports:view',
      'tasks:manage',
      'nominations:approve:po',
      'nominations:approve:pa',
      'nominations:reject',
      'users:manage',
      'schemes:manage',
    ],
  },
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return roleProfiles[role].permissions.includes(permission)
}
