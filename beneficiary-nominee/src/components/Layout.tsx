import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { RoleMenu } from './RoleMenu'
import { useToast } from './toast-context'
import { useAuth } from '../auth/auth-context'
import {
  findNavItem,
  navItemsForRole,
  navSections,
} from '../navigation'
import type { RouteState } from '../router'
import { todayLabel } from '../lib/format'

const COLLAPSE_KEY = 'mfs-sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === 'true'
  } catch {
    return false
  }
}

export function Layout({
  route,
  children,
}: {
  route: RouteState
  children: ReactNode
}) {
  const { notify } = useToast()
  const { role, profile } = useAuth()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const visibleNav = navItemsForRole(role)

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, String(collapsed))
    } catch {
      /* Preference persistence is optional. */
    }
  }, [collapsed])

  const current = findNavItem(route.path)
  const title = current?.label ?? 'Beneficiary nomination'
  const subtitle =
    current?.subtitle ?? 'Manage beneficiary nominations with confidence.'

  const handleSignOut = () => {
    notify(
      'info',
      'Demo workspace',
      'Sign-out is disabled because this build is front-end only.',
    )
  }

  return (
    <div className="app-shell">
      <div
        className={`sidebar-scrim${mobileOpen ? ' is-open' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`sidebar${collapsed ? ' is-collapsed' : ''}${
          mobileOpen ? ' is-open' : ''
        }`}
        aria-label="Primary navigation"
      >
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="shield" size={21} />
          </span>
          <div className="brand-copy">
            <span className="brand-name">Mthunzi</span>
            <span className="brand-sub">Beneficiary Nomination</span>
          </div>
          <button
            type="button"
            className="brand-toggle"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon
              name={collapsed ? 'panel-left-open' : 'panel-left-close'}
              size={16}
            />
          </button>
        </div>

        <button
          type="button"
          className="rail-toggle"
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <Icon name="panel-left-open" size={16} />
        </button>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {navSections.map((section) => {
            const sectionItems = visibleNav.filter(
              (item) => item.section === section,
            )
            if (sectionItems.length === 0) return null

            return (
              <div className="nav-group" key={section}>
                <p className="nav-label">{section}</p>
                {sectionItems.map((item) => {
                  const active = route.path === item.path
                  return (
                    <a
                      key={item.path}
                      href={`#${item.path}`}
                      className={`nav-item${active ? ' is-active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                      onClick={() => setMobileOpen(false)}
                    >
                      <Icon name={item.icon} size={18} className="nav-icon" />
                      <span className="nav-text">{item.label}</span>
                      {active ? (
                        <Icon
                          name="chevron-right"
                          size={15}
                          className="nav-chevron"
                        />
                      ) : null}
                    </a>
                  )
                })}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <span className="avatar" aria-hidden="true">
              {profile.initials}
            </span>
            <span className="user-meta">
              <span className="user-name">{profile.name}</span>
              <span className="user-role">{profile.title}</span>
            </span>
          </div>
          <button
            type="button"
            className="signout"
            onClick={handleSignOut}
            title="Sign out"
          >
            <Icon name="log-out" size={15} />
            <span className="signout-label">Sign out</span>
          </button>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button
            type="button"
            className="icon-button menu-button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <Icon name="menu" size={18} />
          </button>

          <div className="topbar-heading">
            <span className="topbar-title">{title}</span>
            <span className="topbar-subtitle">{subtitle}</span>
          </div>

          <div className="topbar-actions">
            <span className="date-chip">
              <Icon name="calendar" size={13} />
              {todayLabel()}
            </span>
            <span className="topbar-divider" aria-hidden="true" />
            <RoleMenu />
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  )
}
