import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Layout } from './components/Layout'
import { AccessDenied } from './components/AccessDenied'
import { ToastProvider } from './components/Toast'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/auth-context'
import { DataProvider } from './data/store'
import { useData } from './data/context'
import { findNavItem } from './navigation'
import { navigate, useRoute } from './router'
import type { RouteState } from './router'
import { DashboardPage } from './pages/Dashboard'
import { Icon } from './components/Icon'
import { TasksPage } from './pages/Tasks'
import { BeneficiaryNominationsPage } from './pages/BeneficiaryNominations'
import { BeneficiariesPage } from './pages/Beneficiaries'
import { ReportsPage } from './pages/Reports'
import { UserManagementPage } from './pages/UserManagement'
import { SchemeManagementPage } from './pages/SchemeManagement'

const legacyRoutes: Record<string, string> = {
  '/policies': '/nominations',
  '/nominees': '/beneficiaries',
  '/nominations/new': '/nominations',
  '/activity': '/reports',
  '/access': '/users',
}

function CurrentPage({ route }: { route: RouteState }) {
  switch (route.path) {
    case '/tasks':
      return <TasksPage />
    case '/pending-po':
    case '/pending-pa':
    case '/nominations':
      return <BeneficiaryNominationsPage key={route.path} route={route} />
    case '/beneficiaries':
      return <BeneficiariesPage />
    case '/reports':
      return <ReportsPage />
    case '/users':
      return <UserManagementPage />
    case '/schemes':
      return <SchemeManagementPage />
    case '/':
    default:
      return <DashboardPage />
  }
}

function AuthGate({ children }: { children: ReactNode }) {
  const { status, error, retry } = useAuth()

  if (status === 'ready') return <>{children}</>

  const failed = status === 'error'

  return (
    <div className="page-stack" style={{ padding: '48px 24px' }}>
      <section className="access-denied" role={failed ? 'alert' : 'status'}>
        <span className="access-denied-icon">
          <Icon name={failed ? 'alert-circle' : 'refresh'} size={26} />
        </span>
        <span className="hero-eyebrow">
          <Icon name="shield" size={13} />
          {failed ? 'Sign-in required' : 'Checking access'}
        </span>
        <h1 className="hero-title">
          {failed ? 'Unable to verify your identity' : 'Loading your workspace'}
        </h1>
        <p className="hero-text">
          {failed
            ? error ??
              'The app could not confirm your Microsoft 365 identity or workflow role.'
            : 'Confirming your signed-in Microsoft 365 account and reading your role from SharePoint.'}
        </p>
        {failed ? (
          <div className="access-denied-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={retry}
            >
              <Icon name="refresh" size={15} />
              Try again
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function Shell() {
  const route = useRoute()
  const { role } = useAuth()
  const { demoMode } = useData()
  const navItem = findNavItem(route.path)
  const allowed =
    (!demoMode || (route.path !== '/users' && route.path !== '/schemes')) &&
    (!navItem || navItem.roles.includes(role))

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [route.path])

  useEffect(() => {
    const redirect = legacyRoutes[route.path]
    if (redirect) navigate(redirect)
  }, [route.path])

  return (
    <Layout route={route}>
      {allowed ? <CurrentPage route={route} /> : <AccessDenied />}
    </Layout>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <DataProvider>
          <AuthGate>
            <Shell />
          </AuthGate>
        </DataProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
