import { useEffect } from 'react'
import { Layout } from './components/Layout'
import { AccessDenied } from './components/AccessDenied'
import { ToastProvider } from './components/Toast'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/auth-context'
import { DataProvider } from './data/store'
import { findNavItem } from './navigation'
import { navigate, useRoute } from './router'
import type { RouteState } from './router'
import { DashboardPage } from './pages/Dashboard'
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
    case '/nominations':
      return <BeneficiaryNominationsPage route={route} />
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

function Shell() {
  const route = useRoute()
  const { role } = useAuth()
  const navItem = findNavItem(route.path)
  const allowed = !navItem || navItem.roles.includes(role)

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
          <Shell />
        </DataProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
