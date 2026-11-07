import { Icon } from './Icon'
import { navigate } from '../router'
import { useAuth } from '../auth/auth-context'
import { roleLabel } from '../auth/roles'

export function AccessDenied() {
  const { role, profile, can } = useAuth()

  return (
    <div className="page-stack">
      <section className="access-denied">
        <span className="access-denied-icon">
          <Icon name="lock" size={26} />
        </span>
        <span className="hero-eyebrow">
          <Icon name="shield" size={13} />
          Restricted area
        </span>
        <h1 className="hero-title">Access restricted</h1>
        <p className="hero-text">
          The {roleLabel(role)} role does not include access to this area. You
          are signed in as {profile.name}
          {role === 'Employee'
            ? '. Your account has read-only access until an administrator assigns a workflow role in principalOfficers.'
            : '. Contact an administrator if you believe you should have access.'}
        </p>
        <div className="access-denied-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => navigate('/')}
          >
            <Icon name="grid" size={15} />
            Back to dashboard
          </button>
          {can('reports:view') ? (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => navigate('/reports')}
            >
              <Icon name="chart" size={15} />
              View reports
            </button>
          ) : null}
        </div>
        <p className="help access-denied-help">
          Access is resolved from your signed-in Microsoft 365 account and the
          role assigned in the principalOfficers list.
        </p>
      </section>
    </div>
  )
}
