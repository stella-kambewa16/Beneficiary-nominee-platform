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
import { isTaskNomination } from '../lib/nominations'

const COLLAPSE_KEY = 'mfs-sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === 'true'
  } catch {
    return false
  }
}

export function Layout({ route, children }: {
  route: RouteState
  children: ReactNode
}) {
  const {
    role,
    profile,
    warning,
    roleSource,
    previewEnabled,
    retry,
  } = useAuth()
  const {
    loading,
    refreshing,
    error,
    refresh,
    nominations,
    demoMode,
  } = useData()
  const taskCount = nominations.filter(isTaskNomination).length
  const navCounts: Record<string, number> = {
    '/tasks': taskCount,
    '/pending-po': nominations.filter(
      (nomination) =>
        nomination.status === 'Pending PO' &&
        nomination.errorStatus === 'Clear',
    ).length,
    '/pending-pa': nominations.filter(
      (nomination) =>
        nomination.status === 'Pending PA' &&
        nomination.errorStatus === 'Clear',
    ).length,
  }
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [now, setNow] = useState(() => new Date())
  const visibleNav = navItemsForRole(role).filter(
    (item) =>
      !demoMode || (item.path !== '/users' && item.path !== '/schemes'),
  )
  const isDashboard = route.path === '/'

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, String(collapsed))
    } catch {
      /* Preference persistence is optional. */
    }
  }, [collapsed])

  const hour = now.getHours()
  const greeting =
    hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'

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
      <aside
        className={`sidebar${collapsed ? ' is-collapsed' : ''}`}
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
                    >
                      <Icon name={item.icon} size={18} className="nav-icon" />
                      <span className="nav-text">{item.label}</span>
                      {navCounts[item.path] > 0 ? (
                        <span className="nav-count">
                          {navCounts[item.path]}
                        </span>
                      ) : null}
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
          {previewEnabled ? (
            <RoleMenu />
          ) : (
            <div className="user-card">
              <span className="avatar" aria-hidden="true">
                {profile.initials}
              </span>
              <span className="user-meta">
                <span className="user-name">{profile.name}</span>
                <span className="user-role">
                  {roleSource === 'default'
                    ? `${profile.title} · read-only`
                    : profile.title}
                </span>
              </span>
            </div>
          )}
        </div>
      </aside>

      <div className="main-column">
        <main className="content">
          {warning ? (
            <div className="notice is-info data-banner" role="status">
              <Icon name="shield" size={14} className="notice-icon" />
              <span className="data-banner-text">{warning}</span>
              {role === 'Employee' && roleSource === 'default' ? (
                <button
                  type="button"
                  className="button button-secondary button-small data-banner-action"
                  onClick={retry}
                >
                  Retry role check
                </button>
              ) : null}
            </div>
          ) : null}
          {demoMode ? (
            <div className="notice is-info data-banner" role="status">
              <Icon name="info" size={14} className="notice-icon" />
              <span className="data-banner-text">
                Demo seed data — workflow changes stay in this browser and are
                not saved to SharePoint.
              </span>
            </div>
          ) : null}
          {isDashboard ? (
            <section className="welcome-container" aria-label="Welcome">
              <div className="welcome-copy">
                <h1 className="welcome-greeting">
                  {greeting}, {profile.name}!
                </h1>
                <p className="welcome-description">
                  Welcome back. Here&apos;s a summary of today&apos;s activities.
                </p>
              </div>
            </section>
          ) : null}
          {dataStatus}
          {children}
        </main>
      </div>
    </div>
  )
}
