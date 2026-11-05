import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { RoleMenu } from './RoleMenu'
import { useAuth } from '../auth/auth-context'
import { useData } from '../data/context'
import {
  navItemsForRole,
  navSections,
} from '../navigation'
import type { RouteState } from '../router'

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
  const { role, profile } = useAuth()
  const { loading, refreshing, error, refresh } = useData()
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

  const dataStatus = error ? (
    <div className="notice is-danger data-banner" role="alert">
      <Icon name="alert-circle" size={14} className="notice-icon" />
      <span className="data-banner-text">{error}</span>
      <button
        type="button"
        className="button button-secondary button-small data-banner-action"
        onClick={() => void refresh()}
        disabled={refreshing}
      >
        {refreshing ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  ) : loading ? (
    <div className="notice is-info data-banner" role="status">
      <Icon name="refresh" size={14} className="notice-icon" />
      <span className="data-banner-text">
        Loading schemes, principal officers, nominations and nominees from
        SharePoint…
      </span>
    </div>
  ) : refreshing ? (
    <div className="notice is-info data-banner" role="status">
      <Icon name="refresh" size={14} className="notice-icon" />
      <span className="data-banner-text">Refreshing SharePoint data…</span>
    </div>
  ) : null

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
            <span className="brand-name">Beneficiary Nominee</span>
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
            <span className="topbar-title">Hello, {profile.name}</span>
          </div>

          <div className="topbar-actions">
            <RoleMenu />
          </div>
        </header>

        <main className="content">
          {dataStatus}
          {children}
        </main>
      </div>
    </div>
  )
}
