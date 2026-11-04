import { useState } from 'react'
import { useData } from '../data/context'
import type { RouteState } from '../router'
import { navigate } from '../router'
import { Icon } from '../components/Icon'
import {
  AllocationBar,
  NominationStatusBadge,
} from '../components/Badges'
import { Drawer } from '../components/Drawer'
import { useToast } from '../components/toast-context'
import { useAuth } from '../auth/auth-context'
import { downloadCsv } from '../lib/export'
import { formatDate, initials } from '../lib/format'
import {
  canActOnNomination,
  nextStageLabel,
  schemeName,
} from '../lib/nominations'
import { scopedBeneficiaries, scopedNominations } from '../lib/scope'
import type { Nomination, NominationStatus } from '../data/types'

type StatusFilter = 'All' | NominationStatus

export function BeneficiaryNominationsPage({ route }: { route: RouteState }) {
  const {
    nominations,
    beneficiaries,
    schemes,
    users,
    approveNomination,
    rejectNomination,
  } = useData()
  const { notify } = useToast()
  const { role, profile } = useAuth()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('All')
  const [schemeId, setSchemeId] = useState('All')
  const [selectedRef, setSelectedRef] = useState<string | null>(
    route.query.get('ref'),
  )
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')

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

  const query = search.trim().toLowerCase()
  const filtered = visibleNominations.filter((nomination) => {
    const matchesSearch =
      !query ||
      [
        nomination.referenceNumber,
        nomination.memberNumber,
        nomination.memberName,
        nomination.email,
        nomination.schemeName,
        schemeName(schemes, nomination.schemeId),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    const matchesStatus = status === 'All' || nomination.status === status
    const matchesScheme =
      schemeId === 'All' || nomination.schemeId === schemeId
    return matchesSearch && matchesStatus && matchesScheme
  })

  const selected =
    visibleNominations.find((item) => item.referenceNumber === selectedRef) ??
    null
  const selectedBeneficiaries = selected
    ? visibleBeneficiaries.filter(
        (item) => item.refNumber === selected.referenceNumber,
      )
    : []
  const canAct = selected
    ? canActOnNomination(role, selected.status)
    : false
  const lastRejection = selected
    ? [...selected.approvalHistory]
        .reverse()
        .find((event) => event.decision === 'Rejected')
    : undefined

  const counts = {
    total: visibleNominations.length,
    pendingPo: visibleNominations.filter(
      (item) => item.status === 'Pending PO Approval',
    ).length,
    pendingPm: visibleNominations.filter(
      (item) => item.status === 'Pending PM Approval',
    ).length,
    approved: visibleNominations.filter((item) => item.status === 'Approved')
      .length,
  }

  const openNomination = (referenceNumber: string) => {
    setSelectedRef(referenceNumber)
    setRejecting(false)
    setRejectReason('')
    setRejectError('')
  }

  const closeDrawer = () => {
    setSelectedRef(null)
    setRejecting(false)
    setRejectReason('')
    setRejectError('')
  }

  const handleApprove = (
    referenceNumber: string,
    currentStatus: NominationStatus,
  ) => {
    try {
      approveNomination(referenceNumber, role, profile.name)
      notify(
        'success',
        'Nomination updated',
        `${referenceNumber} moved to ${nextStageLabel(currentStatus)}.`,
      )
    } catch (error) {
      notify(
        'error',
        'Approval failed',
        error instanceof Error ? error.message : 'Please try again.',
      )
    }
  }

  const handleReject = () => {
    if (!selected) return
    if (rejectReason.trim().length < 4) {
      setRejectError('Please provide a reason for rejecting this nomination.')
      return
    }
    try {
      rejectNomination(
        selected.referenceNumber,
        role,
        profile.name,
        rejectReason.trim(),
      )
      notify(
        'success',
        'Nomination rejected',
        `${selected.referenceNumber} was returned to the member.`,
      )
      setRejecting(false)
      setRejectReason('')
      setRejectError('')
    } catch (error) {
      setRejectError(
        error instanceof Error ? error.message : 'Please try again.',
      )
    }
  }

  const viewForm = (nomination: Nomination) => {
    if (nomination.sourceFileUrl) {
      window.open(nomination.sourceFileUrl, '_blank', 'noopener,noreferrer')
      return
    }
    notify(
      'info',
      'Nomination form',
      `${nomination.sourceFileName || 'The nomination form'} is attached to ${
        nomination.referenceNumber
      }.`,
    )
  }

  const handleExport = () => {
    downloadCsv(
      'beneficiary-nominations.csv',
      [
        'Reference Number',
        'Member Number',
        'Member Name',
        'Scheme',
        'Nominee Count',
        'Status',
        'Submission Date',
      ],
      filtered.map((nomination) => [
        nomination.referenceNumber,
        nomination.memberNumber,
        nomination.memberName,
        schemeName(schemes, nomination.schemeId),
        nomination.nomineeCount,
        nomination.status,
        nomination.submissionDate,
      ]),
    )
    notify(
      'success',
      'Export ready',
      'The nomination register was downloaded.',
    )
  }

  return (
    <div className="page-stack">
      <section className="hero">
        <div className="hero-main">
          <span className="hero-eyebrow">
            <Icon name="file-text" size={13} />
            Nomination members
          </span>
          <h1 className="hero-title">Beneficiary nominations</h1>
          <p className="hero-text">
            Review every nomination submission, open the linked beneficiaries
            and move records through principal officer and pension manager
            approval.
          </p>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={handleExport}
          >
            <Icon name="download" size={15} />
            Export
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => navigate('/beneficiaries')}
          >
            <Icon name="users" size={15} />
            Beneficiaries
          </button>
        </div>
      </section>

      <section className="stat-grid" aria-label="Nomination figures">
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-blue">
              <Icon name="file-text" size={17} />
            </span>
            <span className="stat-context">Total</span>
          </div>
          <p className="stat-value">{counts.total}</p>
          <p className="stat-label">Nominations received</p>
          <p className="stat-hint">
            <Icon name="layers" size={12} />
            Across {schemes.length} schemes
          </p>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-amber">
              <Icon name="clock" size={17} />
            </span>
            <span className="stat-context">Stage 1</span>
          </div>
          <p className="stat-value">{counts.pendingPo}</p>
          <p className="stat-label">Pending PO approval</p>
          <p className="stat-hint is-warn">
            <Icon name="alert-circle" size={12} />
            Awaiting endorsement
          </p>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-amber">
              <Icon name="clock" size={17} />
            </span>
            <span className="stat-context">Stage 2</span>
          </div>
          <p className="stat-value">{counts.pendingPm}</p>
          <p className="stat-label">Pending PM approval</p>
          <p className="stat-hint is-warn">
            <Icon name="alert-circle" size={12} />
            Awaiting final approval
          </p>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-green">
              <Icon name="check-circle" size={17} />
            </span>
            <span className="stat-context">Complete</span>
          </div>
          <p className="stat-value">{counts.approved}</p>
          <p className="stat-label">Approved nominations</p>
          <p className="stat-hint is-up">
            <Icon name="check" size={12} />
            Fully approved
          </p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="panel-heading">
            <h2 className="panel-title">Nomination register</h2>
            <p className="panel-subtitle">
              Search by reference, member number or member name. Open a row to
              review the nomination.
            </p>
          </div>
        </div>

        <div className="toolbar" style={{ marginBottom: 16 }}>
          <div className="search-field">
            <Icon name="search" size={15} className="search-icon" />
            <input
              type="search"
              className="search-input"
              placeholder="Search reference, member or scheme"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search nominations"
            />
          </div>
          <select
            className="filter-select"
            value={schemeId}
            onChange={(event) => setSchemeId(event.target.value)}
            aria-label="Filter by scheme"
          >
            <option value="All">All schemes</option>
            {schemes.map((scheme) => (
              <option key={scheme.id} value={scheme.id}>
                {scheme.name}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            aria-label="Filter by status"
          >
            <option value="All">All statuses</option>
            <option value="Pending PO Approval">Pending PO Approval</option>
            <option value="Pending PM Approval">Pending PM Approval</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <div className="toolbar-actions">
            <span className="result-count">
              {filtered.length} of {visibleNominations.length} nominations
            </span>
          </div>
        </div>

        {filtered.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference Number</th>
                  <th>Member Number</th>
                  <th>Member Name</th>
                  <th>Scheme</th>
                  <th>Nominee Count</th>
                  <th>Status</th>
                  <th>Submission Date</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((nomination) => {
                  const actionsAllowed = canActOnNomination(
                    role,
                    nomination.status,
                  )
                  return (
                    <tr
                      key={nomination.referenceNumber}
                      className="is-clickable"
                      onClick={() =>
                        openNomination(nomination.referenceNumber)
                      }
                    >
                      <td>
                        <span className="cell-strong">
                          {nomination.referenceNumber}
                        </span>
                      </td>
                      <td>{nomination.memberNumber}</td>
                      <td>
                        <div className="table-holder">
                          <span className="table-avatar" aria-hidden="true">
                            {initials(nomination.memberName)}
                          </span>
                          <span>
                            <span className="cell-strong">
                              {nomination.memberName}
                            </span>
                            <span className="cell-muted">
                              {nomination.email}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td>{schemeName(schemes, nomination.schemeId)}</td>
                      <td>{nomination.nomineeCount}</td>
                      <td>
                        <NominationStatusBadge status={nomination.status} />
                      </td>
                      <td>{formatDate(nomination.submissionDate)}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="row-button"
                            aria-label={`View ${nomination.referenceNumber}`}
                            title="View details"
                            onClick={(event) => {
                              event.stopPropagation()
                              openNomination(nomination.referenceNumber)
                            }}
                          >
                            <Icon name="eye" size={14} />
                          </button>
                          <button
                            type="button"
                            className="row-button"
                            aria-label={`View form for ${nomination.referenceNumber}`}
                            title="View form"
                            onClick={(event) => {
                              event.stopPropagation()
                              viewForm(nomination)
                            }}
                          >
                            <Icon name="file-text" size={14} />
                          </button>
                          {actionsAllowed ? (
                            <>
                              <button
                                type="button"
                                className="row-button"
                                aria-label={`Approve ${nomination.referenceNumber}`}
                                title="Approve"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleApprove(
                                    nomination.referenceNumber,
                                    nomination.status,
                                  )
                                }}
                              >
                                <Icon name="check" size={14} />
                              </button>
                              <button
                                type="button"
                                className="row-button"
                                aria-label={`Reject ${nomination.referenceNumber}`}
                                title="Reject"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openNomination(nomination.referenceNumber)
                                  setRejecting(true)
                                }}
                              >
                                <Icon name="x" size={14} />
                              </button>
                            </>
                          ) : null}
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
              <Icon name="search" size={20} />
            </span>
            <p className="empty-title">No nominations match your filters</p>
            <p className="empty-text">
              Adjust the search term, scheme or status filter to see the full
              nomination register.
            </p>
            <div className="empty-actions">
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => {
                  setSearch('')
                  setStatus('All')
                  setSchemeId('All')
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
        onClose={closeDrawer}
        eyebrow="Nomination record"
        title={
          selected ? `Reference ${selected.referenceNumber}` : 'Nomination'
        }
        subtitle={
          selected
            ? `${selected.memberName} · ${schemeName(
                schemes,
                selected.schemeId,
              )}`
            : undefined
        }
        footer={
          selected ? (
            rejecting ? (
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setRejecting(false)
                  setRejectReason('')
                  setRejectError('')
                }}
              >
                Cancel rejection
              </button>
            ) : (
              <>
                {canAct ? (
                  <>
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() =>
                        handleApprove(selected.referenceNumber, selected.status)
                      }
                    >
                      <Icon name="check" size={14} />
                      Approve
                    </button>
                    <button
                      type="button"
                      className="button button-danger"
                      onClick={() => setRejecting(true)}
                    >
                      <Icon name="x" size={14} />
                      Reject
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={closeDrawer}
                >
                  Close
                </button>
              </>
            )
          ) : null
        }
      >
        {selected ? (
          <>
            <section className="drawer-section">
              <p className="drawer-section-title">Member information</p>
              <div className="detail-grid">
                <div className="detail-item">
                  <p className="detail-label">Reference number</p>
                  <p className="detail-value">{selected.referenceNumber}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Member number</p>
                  <p className="detail-value">{selected.memberNumber}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Member name</p>
                  <p className="detail-value">{selected.memberName}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Date of birth</p>
                  <p className="detail-value">
                    {formatDate(selected.memberDob)}
                  </p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Branch code</p>
                  <p className="detail-value">{selected.branchCode}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Cost centre</p>
                  <p className="detail-value">{selected.costCentre}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Email address</p>
                  <p className="detail-value">{selected.email}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Scheme</p>
                  <p className="detail-value">
                    {schemeName(schemes, selected.schemeId)}
                  </p>
                </div>
              </div>
            </section>

            <section className="drawer-section">
              <p className="drawer-section-title">
                Beneficiaries ({selectedBeneficiaries.length})
              </p>
              {selectedBeneficiaries.length ? (
                selectedBeneficiaries.map((beneficiary) => (
                  <div className="drawer-nominee" key={beneficiary.id}>
                    <span className="table-avatar" aria-hidden="true">
                      {initials(beneficiary.title)}
                    </span>
                    <div className="drawer-nominee-copy">
                      <p className="drawer-nominee-name">
                        {beneficiary.title}
                      </p>
                      <p className="drawer-nominee-meta">
                        {beneficiary.relationship} · {beneficiary.identityNumber}
                      </p>
                    </div>
                    <span className="cell-strong">
                      {beneficiary.benefitRevisedPct}%
                    </span>
                  </div>
                ))
              ) : (
                <p className="help">No beneficiaries linked to this record.</p>
              )}
            </section>

            <section className="drawer-section">
              <p className="drawer-section-title">Allocation summary</p>
              <div className="progress-meta">
                <span>
                  <strong>
                    {selectedBeneficiaries.reduce(
                      (sum, beneficiary) =>
                        sum + beneficiary.benefitRevisedPct,
                      0,
                    )}
                    % allocated
                  </strong>
                </span>
                <span>{selectedBeneficiaries.length} beneficiaries</span>
              </div>
              <AllocationBar
                value={selectedBeneficiaries.reduce(
                  (sum, beneficiary) => sum + beneficiary.benefitRevisedPct,
                  0,
                )}
              />
            </section>

            <section className="drawer-section">
              <p className="drawer-section-title">Approval history</p>
              <div className="workflow">
                {selected.approvalHistory.map((event) => (
                  <div
                    className={`workflow-step${
                      event.decision === 'Approved' ? ' is-done' : ''
                    }`}
                    key={event.id}
                  >
                    <span className="workflow-marker">
                      <Icon
                        name={
                          event.decision === 'Rejected'
                            ? 'x'
                            : event.decision === 'Approved'
                              ? 'check'
                              : 'send'
                        }
                        size={15}
                      />
                    </span>
                    <div className="workflow-body">
                      <p className="workflow-title">{event.stage}</p>
                      <p className="workflow-text">
                        {event.actor} · {event.decision} ·{' '}
                        {formatDate(event.date)}
                      </p>
                      {event.comments ? (
                        <p className="workflow-text">{event.comments}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="drawer-section">
              <p className="drawer-section-title">Supporting document</p>
              <div className="policy-summary">
                <span className="policy-summary-icon">
                  <Icon name="file-text" size={19} />
                </span>
                <div className="policy-summary-copy">
                  <p className="policy-summary-title">
                    {selected.sourceFileName}
                  </p>
                  <p className="policy-summary-meta">
                    Uploaded with the member submission
                  </p>
                </div>
                <button
                  type="button"
                  className="button button-secondary button-small"
                  onClick={() => viewForm(selected)}
                >
                  View form
                </button>
              </div>
            </section>

            {rejecting ? (
              <section className="drawer-section">
                <p className="drawer-section-title">Reject nomination</p>
                <div className="field">
                  <label className="label" htmlFor="rejection-reason">
                    Rejection reason
                  </label>
                  <textarea
                    id="rejection-reason"
                    className={`textarea${rejectError ? ' is-error' : ''}`}
                    value={rejectReason}
                    onChange={(event) => {
                      setRejectReason(event.target.value)
                      setRejectError('')
                    }}
                    placeholder="Explain why this nomination is being rejected."
                  />
                  {rejectError ? (
                    <p className="error-text">
                      <Icon name="alert-circle" size={12} />
                      {rejectError}
                    </p>
                  ) : null}
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="button button-danger"
                    onClick={handleReject}
                  >
                    <Icon name="x" size={14} />
                    Confirm rejection
                  </button>
                </div>
              </section>
            ) : null}

            {lastRejection ? (
              <div className="notice" style={{ marginTop: 18 }}>
                <Icon name="alert-circle" size={14} className="notice-icon" />
                <span>
                  <strong>Rejected:</strong> {lastRejection.comments}
                </span>
              </div>
            ) : null}

            {!canAct &&
            selected.status !== 'Approved' &&
            selected.status !== 'Rejected' ? (
              <div className="notice is-info" style={{ marginTop: 18 }}>
                <Icon name="lock" size={14} className="notice-icon" />
                <span>
                  This nomination is waiting for the{' '}
                  {selected.status === 'Pending PO Approval'
                    ? 'principal officer'
                    : 'pension manager'}
                  . Switch to a role with the matching approval permission to
                  action it.
                </span>
              </div>
            ) : null}
          </>
        ) : null}
      </Drawer>
    </div>
  )
}
