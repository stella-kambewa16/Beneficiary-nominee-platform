import { Icon } from '../components/Icon'
import { useToast } from '../components/toast-context'
import { useAuth } from '../auth/auth-context'
import {
  hasPermission,
  permissionCatalog,
  roleOrder,
  roleProfiles,
} from '../auth/roles'

const lastActive: Record<string, string> = {
  Admin: 'Today, 09:42',
  'Principal Officer': 'Yesterday, 16:10',
  'Pension Manager': 'Today, 08:05',
}

export function TeamAccessPage() {
  const { role } = useAuth()
  const { notify } = useToast()

  const handleInvite = () => {
    notify(
      'success',
      'Invite prepared',
      'A front-end preview of the team invite has been generated.',
    )
  }

  const handleManage = (name: string) => {
    notify(
      'info',
      'Demo access control',
      `Role changes for ${name} are disabled in this front-end build.`,
    )
  }

  return (
    <div className="page-stack">
      <section className="hero">
        <div className="hero-main">
          <span className="hero-eyebrow">
            <Icon name="lock" size={13} />
            Administration
          </span>
          <h1 className="hero-title">Team roles and access</h1>
          <p className="hero-text">
            Control what each role can see and do across the beneficiary
            nomination workspace. Role changes apply instantly in this demo and
            are stored in your browser.
          </p>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={handleInvite}
          >
            <Icon name="plus" size={15} />
            Invite user
          </button>
        </div>
      </section>

      <section className="role-grid" aria-label="Roles">
        {roleOrder.map((item) => {
          const profile = roleProfiles[item]
          const active = item === role
          return (
            <article
              className={`role-card${active ? ' is-active' : ''}`}
              key={item}
            >
              <div className="role-card-head">
                <span className="role-avatar role-avatar-lg" aria-hidden="true">
                  {profile.initials}
                </span>
                <div className="role-card-heading">
                  <div className="role-card-title-row">
                    <h2 className="role-card-title">{item}</h2>
                    {active ? (
                      <span className="badge badge-green">Current role</span>
                    ) : null}
                  </div>
                  <p className="role-card-owner">{profile.name}</p>
                </div>
              </div>
              <p className="role-card-desc">{profile.description}</p>
              <div className="role-permissions">
                {profile.permissions.map((permission) => {
                  const meta = permissionCatalog.find(
                    (entry) => entry.key === permission,
                  )
                  return (
                    <span className="permission-chip" key={permission}>
                      <Icon name="check" size={12} />
                      {meta?.label ?? permission}
                    </span>
                  )
                })}
              </div>
              <div className="role-card-foot">
                <span className="role-card-count">
                  <Icon name="users" size={13} />1 demo user
                </span>
                <button
                  type="button"
                  className="button button-secondary button-small"
                  onClick={() => handleManage(profile.name)}
                >
                  Manage
                </button>
              </div>
            </article>
          )
        })}
      </section>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-header">
            <div className="panel-heading">
              <h2 className="panel-title">Demo users</h2>
              <p className="panel-subtitle">
                The accounts available in the role switcher.
              </p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last active</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {roleOrder.map((item) => {
                  const profile = roleProfiles[item]
                  return (
                    <tr key={item}>
                      <td>
                        <div className="table-holder">
                          <span className="table-avatar" aria-hidden="true">
                            {profile.initials}
                          </span>
                          <span>
                            <span className="cell-strong">
                              {profile.name}
                              {item === role ? (
                                <span
                                  className="badge badge-green"
                                  style={{ marginLeft: 6 }}
                                >
                                  You
                                </span>
                              ) : null}
                            </span>
                            <span className="cell-muted">{profile.email}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="cell-strong">{item}</span>
                      </td>
                      <td>
                        <span className="badge badge-green">Active</span>
                      </td>
                      <td>{lastActive[item]}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="row-button"
                            aria-label={`Manage ${profile.name}`}
                            onClick={() => handleManage(profile.name)}
                          >
                            <Icon name="edit" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="panel-footer">
            <div className="notice is-info">
              <Icon name="info" size={14} className="notice-icon" />
              <span>
                This build is front-end only. No accounts are created or
                invited, and role assignments reset if browser storage is
                cleared.
              </span>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div className="panel-heading">
              <h2 className="panel-title">Access matrix</h2>
              <p className="panel-subtitle">
                Permissions granted to each role.
              </p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table access-matrix">
              <thead>
                <tr>
                  <th>Permission</th>
                  {roleOrder.map((item) => (
                    <th key={item} className="access-matrix-role">
                      {item}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionCatalog.map((permission) => (
                  <tr key={permission.key}>
                    <td>
                      <span className="cell-strong">{permission.label}</span>
                      <span className="cell-muted">{permission.group}</span>
                    </td>
                    {roleOrder.map((item) => {
                      const allowed = hasPermission(item, permission.key)
                      return (
                        <td key={item} className="access-matrix-cell">
                          {allowed ? (
                            <span
                              className="access-check"
                              title={`${item} can ${permission.label.toLowerCase()}`}
                            >
                              <Icon name="check" size={14} />
                            </span>
                          ) : (
                            <span className="access-dash" aria-label="No access">
                              —
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="panel-footer">
            <div className="notice">
              <Icon name="shield" size={14} className="notice-icon" />
              <span>
                Admin validates and promotes nominations. Principal Officers
                and the Pension Administrator endorse cleared nominations. Only
                Admin can manage team access and role assignments.
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
