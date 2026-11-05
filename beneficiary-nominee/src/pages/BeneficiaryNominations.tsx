import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useData } from '../data/context'
import { navigate } from '../router'
import type { RouteState } from '../router'
import { Icon } from '../components/Icon'
import {
  AllocationBar,
  ErrorStatusBadge,
  NominationStatusBadge,
} from '../components/Badges'
import { Drawer } from '../components/Drawer'
import { useToast } from '../components/toast-context'
import { useAuth } from '../auth/auth-context'
import { downloadCsv } from '../lib/export'
import { formatDate, initials } from '../lib/format'
import { commentLines } from '../lib/comments'
import {
  canActOnNomination,
  isEndorsementNomination,
  isTaskNomination,
  nextStageLabel,
  nominationSchemeName,
} from '../lib/nominations'
import { scopedBeneficiaries, scopedNominations } from '../lib/scope'
import type { Nomination, NominationStatus } from '../data/types'

type StatusFilter = 'All' | NominationStatus

function getSourceFileUrl(value: string): string {
  const sourceText =
    new DOMParser().parseFromString(value, 'text/html').body.textContent?.trim() ??
    ''
  try {
    const url = new URL(sourceText)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : ''
  } catch {
    return ''
  }
}

function getPdfDataUri(value: string): string {
  const dataUri = value.trim()
  return /^data:application\/pdf(?:;[a-z0-9=+-]+)*,/i.test(dataUri)
    ? dataUri
    : ''
}

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
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const fromQuery = route.query.get('nomination')
    if (fromQuery) return fromQuery
    const legacyRef = route.query.get('ref')
    if (!legacyRef) return null
    const match = nominations.find(
      (item) => item.referenceNumber === legacyRef,
    )
    return match?.id ?? null
  })
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pdfDocument, setPdfDocument] = useState<{
    url: string
    sourceUrl: string
    title: string
    canEmbed: boolean
  } | null>(null)

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

  const endorsementNominations = visibleNominations.filter(
    isEndorsementNomination,
  )

  const query = search.trim().toLowerCase()
  const filtered = endorsementNominations.filter((nomination) => {
    const matchesSearch =
      !query ||
      [
        nomination.referenceNumber,
        nomination.memberNumber,
        nomination.memberName,
        nomination.email,
        nomination.schemeName,
        nomination.fundName,
        nominationSchemeName(schemes, nomination),
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
    visibleNominations.find((item) => item.id === selectedId) ?? null
  const selectedSourceFileUrl = selected
    ? getSourceFileUrl(selected.sourceFileUrl)
    : ''
  const selectedPdfDataUri = selected ? getPdfDataUri(selected.pdfDataUri) : ''
  const selectedBeneficiaries = selected
    ? visibleBeneficiaries.filter(
        (item) =>
          (selected.referenceNumber !== '' &&
            item.refNumber === selected.referenceNumber) ||
          (item.memberItemId !== null &&
            String(item.memberItemId) === selected.id),
      )
    : []
  const selectedComments = selected
    ? commentLines(selected.comments).slice().reverse()
    : []
  const canAct = selected
    ? canActOnNomination(role, selected.status) &&
      selected.errorStatus === 'Clear'
    : false
  const selectedIsTask = selected ? isTaskNomination(selected) : false
  const lastRejection = selected
    ? [...selected.approvalHistory]
        .reverse()
        .find((event) => event.decision === 'Rejected')
    : undefined

  const openNomination = (nominationId: string) => {
    setSelectedId(nominationId)
    setRejecting(false)
    setRejectReason('')
    setRejectError('')
  }

  const closeDrawer = () => {
    setSelectedId(null)
    setRejecting(false)
    setRejectReason('')
    setRejectError('')
  }

  const closePdfViewer = () => setPdfDocument(null)

  useEffect(() => {
    if (!pdfDocument) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        setPdfDocument(null)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [pdfDocument])

  const handleApprove = async (
    nominationId: string,
    currentStatus: NominationStatus,
  ) => {
    const target = visibleNominations.find((item) => item.id === nominationId)
    if (target && target.errorStatus !== 'Clear') {
      notify(
        'error',
        'Validation required',
        `This nomination cannot be endorsed while Errors is "${target.errorStatus}". Clear the findings in Tasks first.`,
      )
      return
    }
    setBusy(true)
    try {
      await approveNomination(
        nominationId,
        role,
        profile.name,
        profile.email,
      )
      notify(
        'success',
        'Nomination updated',
        `Moved to ${nextStageLabel(currentStatus)}.`,
      )
    } catch (error) {
      notify(
        'error',
        'Approval failed',
        error instanceof Error ? error.message : 'Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async () => {
    if (!selected) return
    if (rejectReason.trim().length < 4) {
      setRejectError('Please provide a reason for rejecting this nomination.')
      return
    }
    setBusy(true)
    try {
      await rejectNomination(
        selected.id,
        role,
        profile.name,
        profile.email,
        rejectReason.trim(),
      )
      notify(
        'success',
        'Nomination rejected',
        `${selected.referenceNumber || selected.memberName} was returned to the member.`,
      )
      setRejecting(false)
      setRejectReason('')
      setRejectError('')
    } catch (error) {
      setRejectError(
        error instanceof Error ? error.message : 'Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const viewForm = (nomination: Nomination) => {
    const url = getSourceFileUrl(nomination.sourceFileUrl)
    const pdfDataUri = getPdfDataUri(nomination.pdfDataUri)
    if (!pdfDataUri && !url) {
      notify(
        'info',
        'Supporting document unavailable',
        `The SharePoint source file URL is missing or invalid for ${
          nomination.referenceNumber || nomination.memberName
        }.`,
      )
      return
    }
    setPdfDocument({
      url: pdfDataUri || url,
      sourceUrl: url,
      title: `Nomination ${nomination.referenceNumber || nomination.id}`,
      canEmbed: Boolean(pdfDataUri),
    })
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
        'Errors',
        'First Endorser',
        'Second Endorser',
        'Comments',
        'Submission Date',
      ],
      filtered.map((nomination) => [
        nomination.referenceNumber || nomination.id,
        nomination.memberNumber,
        nomination.memberName,
        nominationSchemeName(schemes, nomination),
        nomination.nomineeCount,
        nomination.status,
        nomination.errorStatus,
        nomination.endorsement1Name,
        nomination.endorsement2Name,
        nomination.comments,
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
      <header className="page-heading">
        <h1 className="page-heading-title">Beneficiary nominations</h1>
        <div className="hero-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={handleExport}
          >
            <Icon name="download" size={15} />
            Export
          </button>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <div className="panel-heading">
            <h2 className="panel-title">Nomination register</h2>
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
            <option value="Pending PO">Pending PO</option>
            <option value="Pending PA">Pending PA</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <div className="toolbar-actions">
            <span className="result-count">
              {filtered.length} of {endorsementNominations.length} nominations
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
                  <th>Errors</th>
                  <th>First Endorser</th>
                  <th>Second Endorser</th>
                  <th>Comments</th>
                  <th>Submission Date</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((nomination) => {
                  const actionsAllowed =
                    canActOnNomination(role, nomination.status) &&
                    nomination.errorStatus === 'Clear'
                  const latestComment =
                    commentLines(nomination.comments).at(-1) ?? ''
                  return (
                    <tr
                      key={nomination.id}
                      className="is-clickable"
                      onClick={() => openNomination(nomination.id)}
                    >
                      <td>
                        <span className="cell-strong">
                          {nomination.referenceNumber || nomination.id}
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
                      <td>{nominationSchemeName(schemes, nomination)}</td>
                      <td>{nomination.nomineeCount}</td>
                      <td>
                        <NominationStatusBadge status={nomination.status} />
                      </td>
                      <td>
                        <ErrorStatusBadge status={nomination.errorStatus} />
                      </td>
                      <td>{nomination.endorsement1Name || '—'}</td>
                      <td>{nomination.endorsement2Name || '—'}</td>
                      <td>
                        <span
                          className="cell-muted"
                          title={nomination.comments}
                        >
                          {latestComment || '—'}
                        </span>
                      </td>
                      <td>{formatDate(nomination.submissionDate)}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="row-button"
                            aria-label={`View ${
                              nomination.referenceNumber || nomination.id
                            }`}
                            title="View details"
                            onClick={(event) => {
                              event.stopPropagation()
                              openNomination(nomination.id)
                            }}
                          >
                            <Icon name="eye" size={14} />
                          </button>
                          <button
                            type="button"
                            className="row-button"
                            aria-label={`Review PDF for ${
                              nomination.referenceNumber || nomination.id
                            }`}
                            title="Review PDF"
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
                                aria-label={`Approve ${
                                  nomination.referenceNumber || nomination.id
                                }`}
                                title="Approve"
                                disabled={busy}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void handleApprove(
                                    nomination.id,
                                    nomination.status,
                                  )
                                }}
                              >
                                <Icon name="check" size={14} />
                              </button>
                              <button
                                type="button"
                                className="row-button"
                                aria-label={`Reject ${
                                  nomination.referenceNumber || nomination.id
                                }`}
                                title="Reject"
                                disabled={busy}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openNomination(nomination.id)
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
          selected
            ? `Reference ${selected.referenceNumber || selected.id}`
            : 'Nomination'
        }
        subtitle={
          selected
            ? `${selected.memberName} · ${nominationSchemeName(
                schemes,
                selected,
              )}`
            : undefined
        }
        footer={
          selected ? (
            rejecting ? (
              <button
                type="button"
                className="button button-secondary"
                disabled={busy}
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
                      disabled={busy}
                      onClick={() =>
                        void handleApprove(selected.id, selected.status)
                      }
                    >
                      <Icon name="check" size={14} />
                      {busy ? 'Saving…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      className="button button-danger"
                      disabled={busy}
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
                  <p className="detail-value">
                    {selected.referenceNumber || '—'}
                  </p>
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
                    {nominationSchemeName(schemes, selected)}
                  </p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Source status</p>
                  <p className="detail-value">
                    {selected.sourceStatus || '—'}
                  </p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Errors</p>
                  <p className="detail-value">
                    <ErrorStatusBadge status={selected.errorStatus} />
                  </p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">First Endorser</p>
                  <p className="detail-value">
                    {selected.endorsement1Name || '—'}
                    {selected.endorsement1Email ? (
                      <span className="cell-muted">
                        {' '}
                        · {selected.endorsement1Email}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Second Endorser</p>
                  <p className="detail-value">
                    {selected.endorsement2Name || '—'}
                    {selected.endorsement2Email ? (
                      <span className="cell-muted">
                        {' '}
                        · {selected.endorsement2Email}
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
              {selected.errorFindings.length ? (
                <div className="notice is-danger" style={{ marginTop: 14 }}>
                  <Icon
                    name="alert-circle"
                    size={14}
                    className="notice-icon"
                  />
                  <span>
                    <strong>{selected.errorStatus}</strong>
                    {selected.errorFindings.map((finding) => (
                      <span key={finding} style={{ display: 'block' }}>
                        • {finding}
                      </span>
                    ))}
                  </span>
                </div>
              ) : (
                <div className="notice is-success" style={{ marginTop: 14 }}>
                  <Icon
                    name="check-circle"
                    size={14}
                    className="notice-icon"
                  />
                  <span>Errors is Clear. This nomination is eligible for
                    endorsement.</span>
                </div>
              )}
              {selected.warnings ? (
                <div className="notice" style={{ marginTop: 14 }}>
                  <Icon
                    name="alert-circle"
                    size={14}
                    className="notice-icon"
                  />
                  <span>
                    <strong>Warnings:</strong> {selected.warnings}
                  </span>
                </div>
              ) : null}
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
              <p className="drawer-section-title">Comments</p>
              {selectedComments.length ? (
                <div className="workflow">
                  {selectedComments.map((line, index) => (
                    <div
                      className="workflow-step"
                      key={`${line}-${index}`}
                    >
                      <span className="workflow-marker">
                        <Icon name="info" size={15} />
                      </span>
                      <div className="workflow-body">
                        <p className="workflow-text">{line}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="help">No comments recorded yet.</p>
              )}
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
              {selectedPdfDataUri || selectedSourceFileUrl ? (
                <div className="supporting-document-actions">
                  <p className="policy-summary-meta">
                    Review the source PDF for this nomination.
                  </p>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() =>
                      setPdfDocument({
                        url: selectedPdfDataUri || selectedSourceFileUrl,
                        sourceUrl: selectedSourceFileUrl,
                        title: `Nomination ${
                          selected.referenceNumber || selected.id
                        }`,
                        canEmbed: Boolean(selectedPdfDataUri),
                      })
                    }
                  >
                    <Icon name="file-text" size={14} />
                    Review PDF
                  </button>
                </div>
              ) : (
                <p className="policy-summary-meta">
                  SharePoint source file URL is missing or invalid.
                </p>
              )}
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
                    disabled={busy}
                    onClick={() => void handleReject()}
                  >
                    <Icon name="x" size={14} />
                    {busy ? 'Saving…' : 'Confirm rejection'}
                  </button>
                </div>
                <p className="help">
                  The reason is appended to Comments and mirrored to the legacy
                  Warnings field.
                </p>
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

            {selectedIsTask ? (
              <div className="notice is-info" style={{ marginTop: 18 }}>
                <Icon name="info" size={14} className="notice-icon" />
                <span>
                  This nomination is still in Tasks with Errors ={' '}
                  <strong>{selected.errorStatus}</strong>. Correct the findings
                  before it can be endorsed.{' '}
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    onClick={() => navigate('/tasks')}
                  >
                    Open Tasks
                  </button>
                </span>
              </div>
            ) : !canAct &&
              selected.status !== 'Approved' &&
              selected.status !== 'Rejected' ? (
              <div className="notice is-info" style={{ marginTop: 18 }}>
                <Icon name="lock" size={14} className="notice-icon" />
                <span>
                  This nomination is waiting for the{' '}
                  {selected.status === 'Pending PO'
                    ? 'Principal Officer'
                    : 'Pension Administrator'}
                  . Switch to a role with the matching approval permission to
                  action it.
                </span>
              </div>
            ) : null}
          </>
        ) : null}
      </Drawer>
      {pdfDocument
        ? createPortal(
            <div
              className="pdf-viewer-overlay"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closePdfViewer()
              }}
            >
              <section
                className="pdf-viewer-dialog"
                role="dialog"
                aria-modal="true"
                aria-label={`PDF review: ${pdfDocument.title}`}
              >
                <header className="pdf-viewer-header">
                  <div className="pdf-viewer-heading">
                    <p className="drawer-eyebrow">Supporting document</p>
                    <h2 className="pdf-viewer-title">{pdfDocument.title}</h2>
                  </div>
                  <button
                    type="button"
                    className="drawer-close"
                    onClick={closePdfViewer}
                    aria-label="Close PDF viewer"
                    autoFocus
                  >
                    <Icon name="x" size={16} />
                  </button>
                </header>
                {pdfDocument.canEmbed ? (
                  <iframe
                    className="pdf-viewer-frame"
                    src={pdfDocument.url}
                    title={`PDF review: ${pdfDocument.title}`}
                  />
                ) : (
                  <div className="pdf-viewer-unavailable" role="status">
                    <Icon name="alert-circle" size={22} />
                    <p className="empty-title">
                      This SharePoint file can’t be previewed in the app yet.
                    </p>
                    <p>
                      SharePoint blocks embedding the file URL. An embedded PDF
                      preview requires the nomination&apos;s PdfDataUri field to
                      contain the PDF data.
                    </p>
                    <a
                      className="button button-secondary"
                      href={pdfDocument.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open source in new tab
                    </a>
                  </div>
                )}
                <footer className="pdf-viewer-footer">
                  {pdfDocument.sourceUrl ? (
                    <a
                      className="button button-secondary"
                      href={pdfDocument.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open source in new tab
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={closePdfViewer}
                  >
                    Done reviewing
                  </button>
                </footer>
              </section>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
