import type { IconName } from './components/Icon'
import type { Role } from './auth/roles'

export type NavSection = 'Workspace' | 'Administration'

export interface NavItem {
  path: string
  label: string
  subtitle: string
  icon: IconName
  section: NavSection
  roles: Role[]
}

const allRoles: Role[] = ['Admin', 'Principal Officer', 'Pension Manager']
const adminOnly: Role[] = ['Admin']

export const navItems: NavItem[] = [
  {
    path: '/',
    label: 'Dashboard',
    subtitle: 'System KPIs, recent nominations and activity.',
    icon: 'grid',
    section: 'Workspace',
    roles: allRoles,
  },
  {
    path: '/tasks',
    label: 'Tasks',
    subtitle: 'Validate and correct nominations before endorsement.',
    icon: 'file-check',
    section: 'Workspace',
    roles: adminOnly,
  },
  {
    path: '/nominations',
    label: 'Beneficiary Nominations',
    subtitle: 'Review, endorse and approve nominations from Nomination Members.',
    icon: 'file-text',
    section: 'Workspace',
    roles: allRoles,
  },
  {
    path: '/beneficiaries',
    label: 'Beneficiaries',
    subtitle: 'Every beneficiary captured in Nomination Nominees.',
    icon: 'users',
    section: 'Workspace',
    roles: allRoles,
  },
  {
    path: '/reports',
    label: 'Reports',
    subtitle: 'Downloadable nomination, approval and beneficiary reports.',
    icon: 'chart',
    section: 'Workspace',
    roles: allRoles,
  },
  {
    path: '/users',
    label: 'User Management',
    subtitle: 'Create, edit and disable system users.',
    icon: 'user-check',
    section: 'Administration',
    roles: adminOnly,
  },
  {
    path: '/schemes',
    label: 'Scheme Management',
    subtitle: 'Create, edit and deactivate funds and schemes.',
    icon: 'briefcase',
    section: 'Administration',
    roles: adminOnly,
  },
]

export const navSections: NavSection[] = ['Workspace', 'Administration']

export function findNavItem(path: string): NavItem | undefined {
  return navItems.find((item) => item.path === path)
}

export function navItemsForRole(role: Role): NavItem[] {
  return navItems.filter((item) => item.roles.includes(role))
}
