import { useState } from 'react'
import { useData } from '../data/context'
import { navigate } from '../router'
import { Icon } from '../components/Icon'
import { AllocationBar, NomineeStatusBadge, PolicyStatusBadge } from '../components/Badges'
import { Drawer } from '../components/Drawer'
import { useToast } from '../components/toast-context'
import { useAuth } from '../auth/auth-context'
import { formatCurrency, formatDate, initials } from '../lib/format'
import type { PolicyStatus } from '../data/types'

type StatusFilter = 'All' | PolicyStatus

export function PoliciesPage() {
  const { policies, nominees } = useData()
  const { notify } = useToast()
  const { can } = useAuth()
  const canCreate = can('nominations:create')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const query = search.trim().toLowerCase()
  const filtered = policies.filter((policy) => {
    const matchesSearch =
      !query ||
      [policy.holder, policy.id, policy.product, policy.branch, policy.holderId]
        .join(' ')
        .toLowerCase()
        .includes(query)
    const matchesStatus = status === 'All' || policy.status === status
    return matchesSearch && matchesStatus
  })

  const selected = policies.find((policy) => policy.id === selectedId) ?? null
  const selectedNominees = selected
    ? nominees.filter((nominee) => nominee.policyId === selected.id)
    : []

  const activeCount = policies.filter(
    (policy) => policy.status === 'Active',
  ).length
  const pendingCount = policies.filter(
    (policy) => policy.status === 'Pending',
  ).length
  const unallocatedCount = policies.filter(
    (policy) => policy.allocated < 100,
  ).length
  const totalCover = policies.reduce((sum, policy) => sum + policy.cover, 0)

  const handleExport = () => {
    notify(
      'success',
      'Policy book export',
      'A front-end preview of the policy register is ready to download.',
    )
  }

  return (
    <div className="page-stack">
      <section className="hero">
        <div className="hero-main">
          <span className="hero-eyebrow">
            <Icon name="shield" size={13} />
            Policy book
          </span>
          <h1 className="hero-title">Policies and nominee coverage</h1>
          <p className="hero-text">
            Search the funeral policy register, check how much cover is assigned
            and open a policy to review or extend its beneficiary nominations.
          </p>
        </div>
        <div className="hero-actions">
          {canCreate ? (
            <button
              type="button"
              className="button button-primary"
              onClick={() => navigate('/nominations/new')}
            >
              <Icon name="plus" size={15} />
              New nomination
            </button>
          ) : null}
          <button
            type="button"
            className={`button ${canCreate ? 'button-secondary' : 'button-primary'}`}
            onClick={handleExport}
          >
            <Icon name="download" size={15} />
            Export
          </button>
        </div>
      </section>

      <section className="stat-grid" aria-label="Policy figures">
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-green">
              <Icon name="shield" size={17} />
            </span>
            <span className="stat-context">Register</span>
          </div>
          <p className="stat-value">{policies.length}</p>
          <p className="stat-label">Total policies</p>
          <p className="stat-hint">
            <Icon name="check-circle" size={12} />
            {activeCount} active
          </p>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-blue">
              <Icon name="wallet" size={17} />
            </span>
            <span className="stat-context">Sum assured</span>
          </div>
          <p className="stat-value">{formatCurrency(totalCover)}</p>
          <p className="stat-label">Cover in the book</p>
          <p className="stat-hint">
            <Icon name="layers" size={12} />
            Across {policies.length} policies
          </p>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-amber">
              <Icon name="clock" size={17} />
            </span>
            <span className="stat-context">Pipeline</span>
          </div>
          <p className="stat-value">{pendingCount}</p>
          <p className="stat-label">Pending policies</p>
          <p className="stat-hint is-warn">
            <Icon name="alert-circle" size={12} />
            Awaiting activation
          </p>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-red">
              <Icon name="percent" size={17} />
            </span>
            <span className="stat-context">Allocation</span>
          </div>
          <p className="stat-value">{unallocatedCount}</p>
          <p className="stat-label">Policies with cover to assign</p>
          <p className="stat-hint is-warn">
            <Icon name="target" size={12} />
            Below 100% allocated
          </p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="panel-heading">
            <h2 className="panel-title">Policy register</h2>
            <p className="panel-subtitle">
              Open a row to review the holder and their nominees.
            </p>
          </div>
        </div>

        <div className="toolbar" style={{ marginBottom: 16 }}>
          <div className="search-field">
            <Icon name="search" size={15} className="search-icon" />
            <input
              type="search"
              className="search-input"
              placeholder="Search holder, policy, product or branch"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search policies"
            />
          </div>
          <select
            className="filter-select"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as StatusFilter)
            }
            aria-label="Filter by policy status"
          >
            <option value="All">All statuses</option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Lapsed">Lapsed</option>
          </select>
          <div className="toolbar-actions">
            <span className="result-count">
              {filtered.length} of {policies.length} policies
            </span>
          </div>
        </div>

        {filtered.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Policy holder</th>
                  <th>Policy</th>
                  <th>Branch</th>
                  <th>Cover</th>
                  <th>Allocation</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((policy) => (
                  <tr
                    key={policy.id}
                    className="is-clickable"
                    onClick={() => setSelectedId(policy.id)}
                  >
                    <td>
                      <div className="table-holder">
                        <span className="table-avatar" aria-hidden="true">
                          {initials(policy.holder)}
                        </span>
                        <span>
                          <span className="cell-strong">{policy.holder}</span>
                          <span className="cell-muted">{policy.holderId}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="cell-strong">{policy.id}</span>
                      <span className="cell-muted">{policy.product}</span>
                    </td>
                    <td>{policy.branch}</td>
                    <td>{formatCurrency(policy.cover)}</td>
                    <td>
                      <div className="alloc-cell">
                        <AllocationBar value={policy.allocated} size="sm" />
                        <span className="alloc-cell-value">
                          {policy.allocated}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <PolicyStatusBadge status={policy.status} />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="row-button"
                          aria-label={`View ${policy.id}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedId(policy.id)
                          }}
                        >
                          <Icon name="eye" size={14} />
                        </button>
                        {canCreate ? (
                          <button
                            type="button"
                            className="row-button"
                            aria-label={`Nominate for ${policy.id}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              navigate(`/nominations/new?policy=${policy.id}`)
                            }}
                          >
                            <Icon name="pen" size={14} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <Icon name="search" size={20} />
            </span>
            <p className="empty-title">No policies match your filters</p>
            <p className="empty-text">
              Try a different search term or clear the status filter to see the
              full policy register.
            </p>
            <div className="empty-actions">
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => {
                  setSearch('')
                  setStatus('All')
                }}
              >
                Clear filters
              </button>
            </div>
          </div>
        )}
      </section>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        eyebrow="Policy record"
        title={selected?.holder ?? 'Policy'}
        subtitle={
          selected ? `${selected.id} · ${selected.product}` : undefined
        }
        footer={
          selected ? (
            <>
              {canCreate ? (
                <button
                  type="button"
                  className="button button-primary"
                  disabled={selected.status === 'Lapsed'}
                  onClick={() =>
                    navigate(`/nominations/new?policy=${selected.id}`)
                  }
                >
                  <Icon name="pen" size={14} />
                  Nominate for this policy
                </button>
              ) : null}
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setSelectedId(null)}
              >
                Close
              </button>
            </>
          ) : null
        }
      >
        {selected ? (
          <>
            {selected.status === 'Lapsed' ? (
              <div className="notice" style={{ marginBottom: 18 }}>
                <Icon name="alert-circle" size={14} className="notice-icon" />
                <span>
                  This policy is lapsed. Reinstate it before capturing new
                  nominations.
                </span>
              </div>
            ) : null}

            {!canCreate ? (
              <div className="notice is-info" style={{ marginBottom: 18 }}>
                <Icon name="lock" size={14} className="notice-icon" />
                <span>
                  Your role does not include nomination editing. Switch to a
                  role with edit permissions to capture a nomination.
                </span>
              </div>
            ) : null}

            <section className="drawer-section">
              <p className="drawer-section-title">Policy details</p>
              <div className="detail-grid">
                <div className="detail-item">
                  <p className="detail-label">Policy number</p>
                  <p className="detail-value">{selected.id}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Status</p>
                  <p className="detail-value">
                    <PolicyStatusBadge status={selected.status} />
                  </p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Product</p>
                  <p className="detail-value">{selected.product}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Branch</p>
                  <p className="detail-value">{selected.branch}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Sum assured</p>
                  <p className="detail-value">
                    {formatCurrency(selected.cover)}
                  </p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Monthly premium</p>
                  <p className="detail-value">
                    {formatCurrency(selected.premium, 2)}
                  </p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Inception date</p>
                  <p className="detail-value">
                    {formatDate(selected.inception)}
                  </p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Next premium due</p>
                  <p className="detail-value">{formatDate(selected.nextDue)}</p>
                </div>
              </div>
            </section>

            <section className="drawer-section">
              <p className="drawer-section-title">Policy holder</p>
              <div className="detail-grid">
                <div className="detail-item">
                  <p className="detail-label">Full name</p>
                  <p className="detail-value">{selected.holder}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">National ID</p>
                  <p className="detail-value">{selected.holderId}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Phone</p>
                  <p className="detail-value">{selected.phone}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Email</p>
                  <p className="detail-value">{selected.email}</p>
                </div>
              </div>
            </section>

            <section className="drawer-section">
              <p className="drawer-section-title">Allocation</p>
              <div className="progress-meta">
                <span>
                  <strong>{selected.allocated}% allocated</strong>
                </span>
                <span>
                  {formatCurrency(
                    selected.cover * (1 - selected.allocated / 100),
                  )}{' '}
                  remaining
                </span>
              </div>
              <AllocationBar value={selected.allocated} />
            </section>

            <section className="drawer-section">
              <p className="drawer-section-title">
                Nominees ({selectedNominees.length})
              </p>
              {selectedNominees.length ? (
                selectedNominees.map((nominee) => (
                  <div className="drawer-nominee" key={nominee.id}>
                    <span className="table-avatar" aria-hidden="true">
                      {initials(nominee.name)}
                    </span>
                    <div className="drawer-nominee-copy">
                      <p className="drawer-nominee-name">
                        {nominee.name}
                        {nominee.primary ? (
                          <span className="badge badge-green" style={{ marginLeft: 6 }}>
                            Primary
                          </span>
                        ) : null}
                      </p>
                      <p className="drawer-nominee-meta">
                        {nominee.relationship} · {nominee.allocation}% ·{' '}
                        {nominee.idNumber}
                      </p>
                    </div>
                    <NomineeStatusBadge status={nominee.status} />
                  </div>
                ))
              ) : (
                <p className="help">No nominees have been captured yet.</p>
              )}
            </section>
          </>
        ) : null}
      </Drawer>
    </div>
  )
}
