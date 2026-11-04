import { useState } from 'react'
import { useData } from '../data/context'
import { navigate } from '../router'
import { Icon } from '../components/Icon'
import { AllocationBar, NomineeStatusBadge, PolicyStatusBadge } from '../components/Badges'
import { Drawer } from '../components/Drawer'
import { useToast } from '../components/toast-context'
import { useAuth } from '../auth/auth-context'
import { formatCurrency, formatDate, initials } from '../lib/format'
import type { NomineeStatus, Relationship } from '../data/types'

type RelationshipFilter = 'All' | Relationship
type StatusFilter = 'All' | NomineeStatus

export function NomineesPage() {
  const { nominees, policies, verifyNominee } = useData()
  const { notify } = useToast()
  const { can } = useAuth()
  const canCreate = can('nominations:create')
  const canVerify = can('nominees:verify')
  const [search, setSearch] = useState('')
  const [relationship, setRelationship] =
    useState<RelationshipFilter>('All')
  const [status, setStatus] = useState<StatusFilter>('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const policyById = new Map(policies.map((policy) => [policy.id, policy]))
  const query = search.trim().toLowerCase()

  const filtered = nominees.filter((nominee) => {
    const policy = policyById.get(nominee.policyId)
    const matchesSearch =
      !query ||
      [nominee.name, nominee.id, nominee.idNumber, nominee.policyId, policy?.holder]
        .join(' ')
        .toLowerCase()
        .includes(query)
    const matchesRelationship =
      relationship === 'All' || nominee.relationship === relationship
    const matchesStatus = status === 'All' || nominee.status === status
    return matchesSearch && matchesRelationship && matchesStatus
  })

  const selected =
    nominees.find((nominee) => nominee.id === selectedId) ?? null
  const selectedPolicy = selected ? policyById.get(selected.policyId) : undefined

  const verifiedCount = nominees.filter(
    (nominee) => nominee.status === 'Verified',
  ).length
  const pendingCount = nominees.filter(
    (nominee) => nominee.status === 'Pending',
  ).length
  const primaryCount = nominees.filter((nominee) => nominee.primary).length

  const handleVerify = () => {
    if (!selected) return
    verifyNominee(selected.id)
    notify(
      'success',
      'Nominee verified',
      `${selected.name} has been marked as verified on ${selected.policyId}.`,
    )
  }

  return (
    <div className="page-stack">
      <section className="hero">
        <div className="hero-main">
          <span className="hero-eyebrow">
            <Icon name="users" size={13} />
            Beneficiary register
          </span>
          <h1 className="hero-title">Every nominee, clearly accounted for.</h1>
          <p className="hero-text">
            Track beneficiary details, allocation shares and identity
            verification status across the entire policy book.
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
            onClick={() => setStatus(status === 'Pending' ? 'All' : 'Pending')}
          >
            <Icon name="user-check" size={15} />
            {status === 'Pending' ? 'Show all' : 'Show pending'}
          </button>
        </div>
      </section>

      <section className="stat-grid" aria-label="Nominee figures">
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-blue">
              <Icon name="users" size={17} />
            </span>
            <span className="stat-context">Register</span>
          </div>
          <p className="stat-value">{nominees.length}</p>
          <p className="stat-label">Total nominees</p>
          <p className="stat-hint">
            <Icon name="shield" size={12} />
            Across {policies.length} policies
          </p>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-green">
              <Icon name="check-circle" size={17} />
            </span>
            <span className="stat-context">Verified</span>
          </div>
          <p className="stat-value">{verifiedCount}</p>
          <p className="stat-label">Identity verified</p>
          <p className="stat-hint is-up">
            <Icon name="trending-up" size={12} />
            {Math.round((verifiedCount / Math.max(nominees.length, 1)) * 100)}%
            of the register
          </p>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-amber">
              <Icon name="clock" size={17} />
            </span>
            <span className="stat-context">Pending</span>
          </div>
          <p className="stat-value">{pendingCount}</p>
          <p className="stat-label">Awaiting verification</p>
          <p className="stat-hint is-warn">
            <Icon name="alert-circle" size={12} />
            Requires follow-up
          </p>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-green">
              <Icon name="heart" size={17} />
            </span>
            <span className="stat-context">Primary</span>
          </div>
          <p className="stat-value">{primaryCount}</p>
          <p className="stat-label">Primary nominees</p>
          <p className="stat-hint">
            <Icon name="circle-dot" size={12} />
            First point of contact
          </p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="panel-heading">
            <h2 className="panel-title">Nominee register</h2>
            <p className="panel-subtitle">
              Open a nominee to review contact details and verification.
            </p>
          </div>
        </div>

        <div className="toolbar" style={{ marginBottom: 16 }}>
          <div className="search-field">
            <Icon name="search" size={15} className="search-icon" />
            <input
              type="search"
              className="search-input"
              placeholder="Search nominee, ID or policy"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search nominees"
            />
          </div>
          <select
            className="filter-select"
            value={relationship}
            onChange={(event) =>
              setRelationship(event.target.value as RelationshipFilter)
            }
            aria-label="Filter by relationship"
          >
            <option value="All">All relationships</option>
            <option value="Spouse">Spouse</option>
            <option value="Child">Child</option>
            <option value="Parent">Parent</option>
            <option value="Sibling">Sibling</option>
            <option value="Extended family">Extended family</option>
            <option value="Other">Other</option>
          </select>
          <select
            className="filter-select"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as StatusFilter)
            }
            aria-label="Filter by verification status"
          >
            <option value="All">All statuses</option>
            <option value="Verified">Verified</option>
            <option value="Pending">Pending</option>
            <option value="Draft">Draft</option>
          </select>
          <div className="toolbar-actions">
            <span className="result-count">
              {filtered.length} of {nominees.length} nominees
            </span>
          </div>
        </div>

        {filtered.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nominee</th>
                  <th>Policy</th>
                  <th>Relationship</th>
                  <th>Allocation</th>
                  <th>Status</th>
                  <th>Nominated</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((nominee) => {
                  const policy = policyById.get(nominee.policyId)
                  return (
                    <tr
                      key={nominee.id}
                      className="is-clickable"
                      onClick={() => setSelectedId(nominee.id)}
                    >
                      <td>
                        <div className="table-holder">
                          <span className="table-avatar" aria-hidden="true">
                            {initials(nominee.name)}
                          </span>
                          <span>
                            <span className="cell-strong">
                              {nominee.name}
                              {nominee.primary ? (
                                <span
                                  className="badge badge-green"
                                  style={{ marginLeft: 6 }}
                                >
                                  Primary
                                </span>
                              ) : null}
                            </span>
                            <span className="cell-muted">
                              {nominee.idNumber}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="cell-strong">{nominee.policyId}</span>
                        <span className="cell-muted">{policy?.holder}</span>
                      </td>
                      <td>{nominee.relationship}</td>
                      <td>
                        <span className="cell-strong">
                          {nominee.allocation}%
                        </span>
                      </td>
                      <td>
                        <NomineeStatusBadge status={nominee.status} />
                      </td>
                      <td>{formatDate(nominee.nominatedOn)}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="row-button"
                            aria-label={`View ${nominee.name}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedId(nominee.id)
                            }}
                          >
                            <Icon name="eye" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <Icon name="users" size={20} />
            </span>
            <p className="empty-title">No nominees match your filters</p>
            <p className="empty-text">
              Adjust the search term or clear the relationship and status
              filters to see the full nominee register.
            </p>
            <div className="empty-actions">
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => {
                  setSearch('')
                  setRelationship('All')
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
        eyebrow="Nominee record"
        title={selected?.name ?? 'Nominee'}
        subtitle={
          selected
            ? `${selected.relationship} · ${selected.policyId}`
            : undefined
        }
        footer={
          selected ? (
            <>
              {selected.status === 'Pending' && canVerify ? (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={handleVerify}
                >
                  <Icon name="user-check" size={14} />
                  Mark as verified
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
            <section className="drawer-section">
              <p className="drawer-section-title">Nominee details</p>
              <div className="detail-grid">
                <div className="detail-item">
                  <p className="detail-label">Full name</p>
                  <p className="detail-value">{selected.name}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Relationship</p>
                  <p className="detail-value">{selected.relationship}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">National ID</p>
                  <p className="detail-value">{selected.idNumber}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Status</p>
                  <p className="detail-value">
                    <NomineeStatusBadge status={selected.status} />
                  </p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Phone</p>
                  <p className="detail-value">{selected.phone}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Email</p>
                  <p className="detail-value">{selected.email}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Nominated on</p>
                  <p className="detail-value">
                    {formatDate(selected.nominatedOn)}
                  </p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Nominee reference</p>
                  <p className="detail-value">{selected.id}</p>
                </div>
              </div>
            </section>

            <section className="drawer-section">
              <p className="drawer-section-title">Allocation</p>
              <div className="progress-meta">
                <span>
                  <strong>{selected.allocation}% of cover</strong>
                </span>
                <span>
                  {selectedPolicy
                    ? formatCurrency(
                        selectedPolicy.cover * (selected.allocation / 100),
                      )
                    : '—'}
                </span>
              </div>
              <AllocationBar value={selected.allocation} />
              {selected.primary ? (
                <p className="help" style={{ marginTop: 8 }}>
                  This nominee is marked as the primary contact for the
                  nomination.
                </p>
              ) : null}
            </section>

            {selectedPolicy ? (
              <section className="drawer-section">
                <p className="drawer-section-title">Linked policy</p>
                <div className="policy-summary">
                  <span className="policy-summary-icon">
                    <Icon name="shield" size={19} />
                  </span>
                  <div className="policy-summary-copy">
                    <p className="policy-summary-title">
                      {selectedPolicy.holder}
                      <PolicyStatusBadge status={selectedPolicy.status} />
                    </p>
                    <p className="policy-summary-meta">
                      {selectedPolicy.id} · {selectedPolicy.product}
                    </p>
                  </div>
                  <div className="policy-summary-stats">
                    <div className="policy-summary-stat">
                      <strong>{formatCurrency(selectedPolicy.cover)}</strong>
                      <span>Cover</span>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {selected.status === 'Pending' ? (
              <div
                className={`notice${canVerify ? '' : ' is-info'}`}
                style={{ marginTop: 18 }}
              >
                <Icon
                  name={canVerify ? 'info' : 'lock'}
                  size={14}
                  className="notice-icon"
                />
                <span>
                  {canVerify
                    ? "Verification confirms the nominee's identity against the national ID register. This is a front-end demo, so the check completes instantly."
                    : 'Your role does not include nominee verification. Switch to a role with edit permissions to mark this nominee as verified.'}
                </span>
              </div>
            ) : null}
          </>
        ) : null}
      </Drawer>
    </div>
  )
}
