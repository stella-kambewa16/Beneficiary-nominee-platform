import { useData } from '../data/context'
import { navigate } from '../router'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { NominationStatusBadge } from '../components/Badges'
import { useAuth } from '../auth/auth-context'
import { formatDateTime } from '../lib/format'
import {
  isTaskNomination,
  nominationSchemeName,
} from '../lib/nominations'
import {
  scopedBeneficiaries,
  scopedNominations,
} from '../lib/scope'

function ageInDays(value: string): number {
  if (!value) return 0
  const created = new Date(`${value.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(created.getTime())) return 0
  return Math.max(
    0,
    Math.floor((Date.now() - created.getTime()) / 86_400_000),
  )
}

function activityMeta(action: string): {
  icon: IconName
  className: string
  badge: string
  label: string
} {
  if (action.toLowerCase().includes('approved')) {
    return {
      icon: 'check-circle',
      className: 'is-verification',
      badge: 'badge-green',
      label: 'Approved',
    }
  }
  if (action.toLowerCase().includes('rejected')) {
    return {
      icon: 'alert-circle',
      className: 'is-alert',
      badge: 'badge-red',
      label: 'Rejected',
    }
  }
  if (action.toLowerCase().includes('endorsed')) {
    return {
      icon: 'user-check',
      className: 'is-verification',
      badge: 'badge-blue',
      label: 'Endorsed',
    }
  }
  if (action.toLowerCase().includes('submitted')) {
    return {
      icon: 'file-text',
      className: 'is-nomination',
      badge: 'badge-amber',
      label: 'Submitted',
    }
  }
  return {
    icon: 'edit',
    className: 'is-update',
    badge: 'badge-slate',
    label: 'Updated',
  }
}

export function DashboardPage() {
  const { nominations, beneficiaries, schemes, users, activity } = useData()
  const { role, profile } = useAuth()

  const visibleNominations = scopedNominations(
    role,
    profile.email,
    nominations,
    users,
  )
  const visibleBeneficiaries = scopedBeneficiaries(
    role,
    profile.email,
    nominations,
    beneficiaries,
    users,
  )

  const taskNominations = visibleNominations.filter(isTaskNomination)
  const tasks = taskNominations.length
  const oldestTaskDays = taskNominations.reduce(
    (oldest, item) => Math.max(oldest, ageInDays(item.submissionDate)),
    0,
  )
  const pendingPO = visibleNominations.filter(
    (item) => item.status === 'Pending PO',
  ).length
  const pendingPA = visibleNominations.filter(
    (item) => item.status === 'Pending PA',
  ).length
  const missingScheme = visibleNominations.filter(
    (item) => item.errorStatus === 'Missing Scheme',
  ).length
  const missingOfficer = visibleNominations.filter(
    (item) => item.errorStatus === 'Missing Principal Officer',
  ).length
  const missingInformation = visibleNominations.filter(
    (item) => item.errorStatus === 'Missing Information',
  ).length
  const approved = visibleNominations.filter(
    (item) => item.status === 'Approved',
  ).length
  const rejected = visibleNominations.filter(
    (item) => item.status === 'Rejected',
  ).length
  const activeOfficers = users.filter((user) => user.status === 'Active').length
  const assignedOfficers = users.filter(
    (user) => user.schemeId !== null,
  ).length
  const assignedSchemes = schemes.filter((scheme) =>
    users.some((user) => user.schemeId === scheme.id),
  ).length
  const activeSchemes = schemes.filter(
    (scheme) => scheme.status === 'Active',
  ).length
  const disabledSchemes = schemes.length - activeSchemes
  const coveredMembers = new Set(
    visibleBeneficiaries
      .map((item) => item.memberNumber.trim())
      .filter(Boolean),
  ).size
  const averageRevisedAllocation = Math.round(
    visibleBeneficiaries.reduce(
      (sum, item) => sum + item.benefitRevisedPct,
      0,
    ) / Math.max(visibleBeneficiaries.length, 1),
  )

  const recent = [...visibleNominations]
    .sort((a, b) => b.submissionDate.localeCompare(a.submissionDate))
    .slice(0, 5)

  const visibleNominationIds = new Set(
    visibleNominations.map((item) => item.id),
  )
  const recentActivity = [...activity]
    .filter(
      (item) =>
        role !== 'Principal Officer' ||
        !item.nominationId ||
        visibleNominationIds.has(item.nominationId),
    )
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 6)

  return (
    <div className="page-stack">
      <section className="stat-grid is-three" aria-label="Key figures">
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-green">
              <Icon name="file-text" size={17} />
            </span>
            <span className="stat-context">Nomination Members</span>
          </div>
          <p className="stat-value">{visibleNominations.length}</p>
          <p className="stat-label">Total nominations</p>
          <p className="stat-hint">
            <Icon name="clock" size={12} />
            {pendingPO + pendingPA} awaiting endorsement
          </p>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-amber">
              <Icon name="file-check" size={17} />
            </span>
            <span className="stat-context">Validation</span>
          </div>
          <p className="stat-value">{tasks}</p>
          <p className="stat-label">Tasks queue</p>
          <p className="stat-hint is-warn">
            <Icon name="alert-circle" size={12} />
            {missingScheme + missingOfficer + missingInformation} finding
            {missingScheme + missingOfficer + missingInformation === 1
              ? ''
              : 's'}{' '}
            to resolve
          </p>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-blue">
              <Icon name="users" size={17} />
            </span>
            <span className="stat-context">Nomination Nominees</span>
          </div>
          <p className="stat-value">{visibleBeneficiaries.length}</p>
          <p className="stat-label">Total beneficiaries</p>
          <p className="stat-hint">
            <Icon name="layers" size={12} />
            Across {visibleNominations.length} nominations
          </p>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-amber">
              <Icon name="clock" size={17} />
            </span>
            <span className="stat-context">Stage 1</span>
          </div>
          <p className="stat-value">{pendingPO}</p>
          <p className="stat-label">Pending PO approval</p>
          <p className="stat-hint is-warn">
            <Icon name="user-check" size={12} />
            Principal Officer review
          </p>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-blue">
              <Icon name="user-check" size={17} />
            </span>
            <span className="stat-context">Stage 2</span>
          </div>
          <p className="stat-value">{pendingPA}</p>
          <p className="stat-label">Pending PA approval</p>
          <p className="stat-hint">
            <Icon name="shield" size={12} />
            Pension Administrator review
          </p>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-green">
              <Icon name="check-circle" size={17} />
            </span>
            <span className="stat-context">Completed</span>
          </div>
          <p className="stat-value">{approved}</p>
          <p className="stat-label">Approved</p>
          <p className="stat-hint">
            <Icon name="check-circle" size={12} />
            Final approval complete
          </p>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-red">
              <Icon name="alert-circle" size={17} />
            </span>
            <span className="stat-context">Closed</span>
          </div>
          <p className="stat-value">{rejected}</p>
          <p className="stat-label">Rejected</p>
          <p className="stat-hint is-warn">
            <Icon name="x" size={12} />
            Returned to the member
          </p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="panel-heading">
            <h2 className="panel-title">Schemes and users</h2>
            <p className="panel-subtitle">
              Management totals for this workspace.
            </p>
          </div>
        </div>
        <div className="mini-stat-grid">
          <div className="mini-stat">
            <p className="mini-stat-value">{schemes.length}</p>
            <p className="mini-stat-label">Total schemes</p>
          </div>
          <div className="mini-stat">
            <p className="mini-stat-value">{activeSchemes}</p>
            <p className="mini-stat-label">Active schemes</p>
          </div>
          <div className="mini-stat">
            <p className="mini-stat-value">{disabledSchemes}</p>
            <p className="mini-stat-label">Disabled schemes</p>
          </div>
          <div className="mini-stat">
            <p className="mini-stat-value">{users.length}</p>
            <p className="mini-stat-label">Principal officers</p>
          </div>
          <div className="mini-stat">
            <p className="mini-stat-value">{assignedSchemes}</p>
            <p className="mini-stat-label">Schemes with an officer</p>
          </div>
          <div className="mini-stat">
            <p className="mini-stat-value">{schemes.length - assignedSchemes}</p>
            <p className="mini-stat-label">Schemes without an officer</p>
          </div>
          <div className="mini-stat">
            <p className="mini-stat-value">{activeOfficers}</p>
            <p className="mini-stat-label">Active principal officers</p>
          </div>
          <div className="mini-stat">
            <p className="mini-stat-value">
              {users.length - assignedOfficers}
            </p>
            <p className="mini-stat-label">Officers without a scheme</p>
          </div>
          <div className="mini-stat">
            <p className="mini-stat-value">{coveredMembers}</p>
            <p className="mini-stat-label">Members covered</p>
          </div>
          <div className="mini-stat">
            <p className="mini-stat-value">{averageRevisedAllocation}%</p>
            <p className="mini-stat-label">Average revised allocation</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="panel-heading">
            <h2 className="panel-title">Validation queue</h2>
            <p className="panel-subtitle">
              Nominations must reach Errors = Clear before endorsement.
            </p>
          </div>
          <div className="panel-actions">
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={() => navigate('/tasks')}
            >
              Open Tasks
              <Icon name="arrow-right" size={13} />
            </button>
          </div>
        </div>
        <div className="mini-stat-grid">
          <div className="mini-stat">
            <p className="mini-stat-value">{tasks}</p>
            <p className="mini-stat-label">In Tasks</p>
          </div>
          <div className="mini-stat">
            <p className="mini-stat-value">{missingScheme}</p>
            <p className="mini-stat-label">Missing Scheme</p>
          </div>
          <div className="mini-stat">
            <p className="mini-stat-value">{missingOfficer}</p>
            <p className="mini-stat-label">Missing Principal Officer</p>
          </div>
          <div className="mini-stat">
            <p className="mini-stat-value">{missingInformation}</p>
            <p className="mini-stat-label">Missing Information</p>
          </div>
          <div className="mini-stat">
            <p className="mini-stat-value">{oldestTaskDays}d</p>
            <p className="mini-stat-label">Oldest task</p>
          </div>
          <div className="mini-stat">
            <p className="mini-stat-value">
              {visibleNominations.filter((item) => item.errorStatus === 'Clear')
                .length}
            </p>
            <p className="mini-stat-label">Errors Clear</p>
          </div>
        </div>
      </section>

      <div className="grid-dashboard">
        <section className="panel">
          <div className="panel-header">
            <div className="panel-heading">
              <h2 className="panel-title">Recent nominations</h2>
              <p className="panel-subtitle">
                The latest records from Nomination Members.
              </p>
            </div>
            <div className="panel-actions">
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => navigate('/nominations')}
              >
                View all
                <Icon name="arrow-right" size={13} />
              </button>
            </div>
          </div>

          {recent.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Reference No</th>
                    <th>Member No</th>
                    <th>Scheme</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((nomination) => (
                    <tr
                      key={nomination.id}
                      className="is-clickable"
                      onClick={() =>
                        navigate(`/nominations?nomination=${nomination.id}`)
                      }
                    >
                      <td>
                        <span className="cell-strong">
                          {nomination.referenceNumber || nomination.id}
                        </span>
                      </td>
                      <td>{nomination.memberNumber}</td>
                      <td>{nominationSchemeName(schemes, nomination)}</td>
                      <td>
                        <NominationStatusBadge status={nomination.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-icon">
                <Icon name="file-text" size={20} />
              </span>
              <p className="empty-title">No nominations yet</p>
              <p className="empty-text">
                Nominations from Nomination Members will appear here.
              </p>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div className="panel-heading">
              <h2 className="panel-title">Recent activity</h2>
              <p className="panel-subtitle">
                Approval and administration events.
              </p>
            </div>
          </div>

          {recentActivity.length ? (
            <div className="timeline">
              {recentActivity.map((item) => {
                const meta = activityMeta(item.action)
                return (
                  <div className="timeline-item" key={item.id}>
                    <span className={`timeline-marker ${meta.className}`}>
                      <Icon name={meta.icon} size={16} />
                    </span>
                    <div className="timeline-body">
                      <div className="timeline-head">
                        <p className="timeline-title">
                          {item.action} · {item.subject}
                        </p>
                        <span className="timeline-time">
                          {formatDateTime(item.time)}
                        </span>
                      </div>
                      <p className="timeline-text">{item.detail}</p>
                      <div className="timeline-tags">
                        <span className={`badge ${meta.badge}`}>
                          {meta.label}
                        </span>
                        {item.referenceNumber ? (
                          <span className="chip">
                            <Icon name="file-text" size={11} />
                            {item.referenceNumber}
                          </span>
                        ) : null}
                        <span className="chip">
                          <Icon name="user" size={11} />
                          {item.actor}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-icon">
                <Icon name="activity" size={20} />
              </span>
              <p className="empty-title">No activity yet</p>
              <p className="empty-text">
                Approval and administration events will appear here.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
