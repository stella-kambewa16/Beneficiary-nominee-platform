import { useState } from 'react'
import { useData } from '../data/context'
import { Icon } from '../components/Icon'
import { useToast } from '../components/toast-context'
import { formatDateTime } from '../lib/format'
import type { ActivityKind } from '../data/types'
import type { IconName } from '../components/Icon'

type KindFilter = 'all' | ActivityKind

const kindMeta: Record<
  ActivityKind,
  { label: string; icon: IconName; badge: string }
> = {
  nomination: { label: 'Nomination', icon: 'pen', badge: 'badge-green' },
  verification: {
    label: 'Verification',
    icon: 'user-check',
    badge: 'badge-blue',
  },
  update: { label: 'Update', icon: 'edit', badge: 'badge-slate' },
  alert: { label: 'Alert', icon: 'alert-circle', badge: 'badge-amber' },
}

export function ActivityPage() {
  const { activity } = useData()
  const { notify } = useToast()
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<KindFilter>('all')

  const query = search.trim().toLowerCase()
  const filtered = activity.filter((item) => {
    const matchesSearch =
      !query ||
      [item.action, item.subject, item.detail, item.actor, item.policyId]
        .join(' ')
        .toLowerCase()
        .includes(query)
    const matchesKind = kind === 'all' || item.kind === kind
    return matchesSearch && matchesKind
  })

  const alerts = activity.filter((item) => item.kind === 'alert').length

  const handleExport = () => {
    notify(
      'success',
      'Audit log exported',
      'The front-end activity log is ready for download.',
    )
  }

  return (
    <div className="page-stack">
      <section className="hero">
        <div className="hero-main">
          <span className="hero-eyebrow">
            <Icon name="activity" size={13} />
            Audit trail
          </span>
          <h1 className="hero-title">Activity across the nomination book</h1>
          <p className="hero-text">
            Every nomination, verification, update and alert in one chronological
            trail. Use the filters to focus on the events that need attention.
          </p>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={handleExport}
          >
            <Icon name="download" size={15} />
            Export log
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setKind(kind === 'alert' ? 'all' : 'alert')}
          >
            <Icon name="alert-circle" size={15} />
            {kind === 'alert' ? 'Show all' : `Alerts (${alerts})`}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="panel-heading">
            <h2 className="panel-title">Activity timeline</h2>
            <p className="panel-subtitle">
              Newest events first. Times are shown in local time.
            </p>
          </div>
          <div className="panel-actions">
            <span className="result-count">
              {filtered.length} of {activity.length} events
            </span>
          </div>
        </div>

        <div className="toolbar" style={{ marginBottom: 20 }}>
          <div className="search-field">
            <Icon name="search" size={15} className="search-icon" />
            <input
              type="search"
              className="search-input"
              placeholder="Search action, person or policy"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search activity"
            />
          </div>
          <select
            className="filter-select"
            value={kind}
            onChange={(event) => setKind(event.target.value as KindFilter)}
            aria-label="Filter activity by type"
          >
            <option value="all">All activity</option>
            <option value="nomination">Nominations</option>
            <option value="verification">Verifications</option>
            <option value="update">Updates</option>
            <option value="alert">Alerts</option>
          </select>
          <div className="toolbar-actions">
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={() => {
                setSearch('')
                setKind('all')
              }}
            >
              <Icon name="refresh" size={13} />
              Reset
            </button>
          </div>
        </div>

        {filtered.length ? (
          <div className="timeline">
            {filtered.map((item) => {
              const meta = kindMeta[item.kind]
              return (
                <div className="timeline-item" key={item.id}>
                  <span className={`timeline-marker is-${item.kind}`}>
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
                      {item.policyId ? (
                        <span className="chip">
                          <Icon name="shield" size={11} />
                          {item.policyId}
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
            <p className="empty-title">No activity matches your filters</p>
            <p className="empty-text">
              Try a different search term or reset the activity type filter.
            </p>
            <div className="empty-actions">
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => {
                  setSearch('')
                  setKind('all')
                }}
              >
                Reset filters
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
