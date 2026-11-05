import { Icon } from './Icon'
import { navigate } from '../router'
import { useAuth } from '../auth/auth-context'
import { roleLabel } from '../auth/roles'

export function AccessDenied() {
  const { role, profile } = useAuth()

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
          are signed
          in as {profile.name}. Switch to a role with the required permission,
          or return to your dashboard.
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
          <button
            type="button"
            className="button button-secondary"
            onClick={() => navigate('/reports')}
          >
            <Icon name="chart" size={15} />
            View reports
          </button>
        </div>
        <p className="help access-denied-help">
          Tip: use the role menu in the top-right corner to switch demo roles.
        </p>
      </section>
    </div>
  )
}
