import { useState } from 'react'
import { useData } from '../data/context'
import { useAuth } from '../auth/auth-context'
import { useToast } from '../components/toast-context'
import { Icon } from '../components/Icon'
import { ErrorStatusBadge, NominationStatusBadge } from '../components/Badges'
import { Drawer } from '../components/Drawer'
import { downloadCsv } from '../lib/export'
import { formatDate, initials } from '../lib/format'
import { commentLines } from '../lib/comments'
import {
  isTaskNomination,
  nominationSchemeName,
} from '../lib/nominations'
import { scopedNominations } from '../lib/scope'
import {
  activePrincipalOfficerForScheme,
  beneficiariesForNomination,
} from '../lib/validation'
import { navigate } from '../router'
import type {
  Nomination,
  NominationErrorStatus,
} from '../data/types'

type ErrorFilter = 'All' | 'Not set' | NominationErrorStatus
type AgeFilter = 'All' | '0-3' | '4-7' | '8+'

interface MemberDraft {
  memberNumber: string
  memberName: string
  memberDob: string
  email: string
}

interface NomineeDraft {
  title: string
  relationship: string
  identityNumber: string
  dateOfBirth: string
  benefitRevisedPct: string
}

const errorFilters: NominationErrorStatus[] = [
  'Missing Scheme',
  'Missing Principal Officer',
  'Missing Information',
  'Clear',
]

function ageInDays(value: string): number {
  if (!value) return 0
  const created = new Date(`${value.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(created.getTime())) return 0
  return Math.max(
    0,
    Math.floor((Date.now() - created.getTime()) / 86_400_000),
  )
}

function memberDraft(nomination: Nomination): MemberDraft {
  return {
    memberNumber: nomination.memberNumber,
    memberName: nomination.memberName,
    memberDob: nomination.memberDob,
    email: nomination.email,
  }
}

export function TasksPage() {
  const {
    nominations,
    beneficiaries,
    schemes,
    users,
    validateNomination,
    addNominationComment,
    updateNominationDetails,
    updateBeneficiaryDetails,
  } = useData()
  const { role, profile } = useAuth()
  const { notify } = useToast()

  const [search, setSearch] = useState('')
  const [errorFilter, setErrorFilter] = useState<ErrorFilter>('All')
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('All')
  const [schemeId, setSchemeId] = useState('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [errorDraft, setErrorDraft] = useState<NominationErrorStatus | ''>('')
  const [commentDraft, setCommentDraft] = useState('')
  const [memberDraftState, setMemberDraftState] = useState<MemberDraft>({
    memberNumber: '',
    memberName: '',
    memberDob: '',
    email: '',
  })
  const [schemeDraft, setSchemeDraft] = useState('')
  const [nomineeDrafts, setNomineeDrafts] = useState<
    Record<string, NomineeDraft>
  >({})

  const visibleNominations = scopedNominations(
    role,
    profile.email,
    nominations,
    users,
  )
  const tasks = visibleNominations.filter(isTaskNomination)

  const query = search.trim().toLowerCase()
  const filtered = tasks.filter((nomination) => {
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
        nomination.sourceErrors,
        nomination.comments,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    const matchesError =
      errorFilter === 'All' ||
      (errorFilter === 'Not set'
        ? nomination.errorStatus === null
        : nomination.errorStatus === errorFilter)
    const matchesScheme =
      schemeId === 'All' || nomination.schemeId === schemeId
    const age = ageInDays(nomination.submissionDate)
    const matchesAge =
      ageFilter === 'All' ||
      (ageFilter === '0-3' && age <= 3) ||
      (ageFilter === '4-7' && age >= 4 && age <= 7) ||
      (ageFilter === '8+' && age >= 8)
    return matchesSearch && matchesError && matchesScheme && matchesAge
  })

  const selected = tasks.find((item) => item.id === selectedId) ?? null
  const selectedBeneficiaries = selected
    ? beneficiariesForNomination(selected, beneficiaries)
    : []
  const selectedComments = selected
    ? commentLines(selected.comments).slice().reverse()
    : []

  const openTask = (nomination: Nomination) => {
    setSelectedId(nomination.id)
    setErrorDraft(nomination.errorStatus ?? '')
    setCommentDraft('')
    setMemberDraftState(memberDraft(nomination))
    setSchemeDraft(nomination.schemeId)
    const linked = beneficiariesForNomination(nomination, beneficiaries)
    setNomineeDrafts(
      Object.fromEntries(
        linked.map((beneficiary) => [
          beneficiary.id,
          {
            title: beneficiary.title,
            relationship: beneficiary.relationship,
            identityNumber: beneficiary.identityNumber,
            dateOfBirth: beneficiary.dateOfBirth,
            benefitRevisedPct: String(beneficiary.benefitRevisedPct),
          },
        ]),
      ),
    )
  }

  const closeDrawer = () => {
    setSelectedId(null)
    setNomineeDrafts({})
  }

  const handleExport = () => {
    downloadCsv(
      'beneficiary-nomination-tasks.csv',
      [
        'Reference Number',
        'Member Number',
        'Member Name',
        'Scheme',
        'Error Status',
        'Findings',
        'First Endorser',
        'Second Endorser',
        'Comments',
        'Submission Date',
        'Last Updated',
        'Age (days)',
      ],
      filtered.map((nomination) => [
        nomination.referenceNumber || nomination.id,
        nomination.memberNumber,
        nomination.memberName,
        nominationSchemeName(schemes, nomination),
        nomination.errorStatus ?? 'Not set',
        nomination.comments,
        nomination.endorsement1Name,
        nomination.endorsement2Name,
        nomination.comments,
        nomination.submissionDate,
        nomination.modifiedDate,
        ageInDays(nomination.submissionDate),
      ]),
    )
    notify(
      'success',
      'Export ready',
      'The Tasks queue was downloaded.',
    )
  }

  const saveScheme = async () => {
    if (!selected) return
    const scheme = schemes.find((item) => item.id === schemeDraft)
    if (!scheme) {
      notify('error', 'Scheme not selected', 'Choose a scheme before saving.')
      return
    }
    setBusy(true)
    try {
      await updateNominationDetails(
        selected.id,
        { fundName: scheme.title || scheme.schemeName || scheme.name },
        profile.name,
        role,
      )
      notify(
        'success',
        'Scheme updated',
        'The nomination has been linked to the selected scheme.',
      )
    } catch (error) {
      notify(
        'error',
        'Update failed',
        error instanceof Error ? error.message : 'Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const saveMember = async () => {
    if (!selected) return
    setBusy(true)
    try {
      await updateNominationDetails(
        selected.id,
        {
          memberNumber: memberDraftState.memberNumber.trim(),
          memberName: memberDraftState.memberName.trim(),
          memberDob: memberDraftState.memberDob,
          email: memberDraftState.email.trim(),
        },
        profile.name,
        role,
      )
      notify(
        'success',
        'Member details updated',
        'Update the Errors status from the SharePoint Errors column after review.',
      )
    } catch (error) {
      notify(
        'error',
        'Update failed',
        error instanceof Error ? error.message : 'Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const saveNominee = async (beneficiaryId: string) => {
    const draft = nomineeDrafts[beneficiaryId]
    if (!draft) return
    const percentage = Number(draft.benefitRevisedPct)
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      notify(
        'error',
        'Invalid allocation',
        'Enter an allocation percentage between 0 and 100.',
      )
      return
    }
    setBusy(true)
    try {
      await updateBeneficiaryDetails(
        beneficiaryId,
        {
          title: draft.title.trim(),
          relationship: draft.relationship.trim(),
          identityNumber: draft.identityNumber.trim(),
          dateOfBirth: draft.dateOfBirth,
          benefitRevisedPct: percentage,
        },
        profile.name,
        role,
      )
      notify(
        'success',
        'Beneficiary updated',
        'Update the Errors status from the SharePoint Errors column after review.',
      )
    } catch (error) {
      notify(
        'error',
        'Update failed',
        error instanceof Error ? error.message : 'Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleValidate = async () => {
    if (!selected) return
    if (!errorDraft) {
      notify(
        'error',
        'Select an Errors status',
        'Choose a value to save to the SharePoint Errors column.',
      )
      return
    }
    setBusy(true)
    try {
      const savedErrors = await validateNomination(
        selected.id,
        errorDraft,
        role,
        profile.name,
      )
      if (savedErrors === 'Clear') {
        notify(
          'success',
          'Errors updated',
          `${selected.referenceNumber || selected.memberName} has been updated from the SharePoint Errors value.`,
        )
        if (selected.status === 'Tasks' || selected.status === 'Submitted') {
          closeDrawer()
        }
      } else {
        notify(
          'info',
          'Errors updated',
          `${savedErrors} was saved to SharePoint. The nomination remains in Tasks.`,
        )
      }
    } catch (error) {
      notify(
        'error',
        'Validation failed',
        error instanceof Error ? error.message : 'Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleAddComment = async () => {
    if (!selected || !commentDraft.trim()) return
    setBusy(true)
    try {
      await addNominationComment(
        selected.id,
        commentDraft,
        profile.name,
        role,
      )
      setCommentDraft('')
      notify('success', 'Comment saved', 'The nomination comments were updated.')
    } catch (error) {
      notify(
        'error',
        'Comment not saved',
        error instanceof Error ? error.message : 'Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <h1 className="page-heading-title">Tasks</h1>
          <p className="help">
            Validate new nominations and correct data-quality issues before
            they enter the endorsement workflow.
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
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <div className="panel-heading">
            <h2 className="panel-title">Validation queue</h2>
            <p className="panel-subtitle">
              Only nominations with Errors = Clear move to Pending PO.
            </p>
          </div>
          <div className="panel-actions">
            <span className="result-count">{tasks.length} open</span>
          </div>
        </div>

        <div className="toolbar" style={{ marginBottom: 16 }}>
          <div className="search-field">
            <Icon name="search" size={15} className="search-icon" />
            <input
              type="search"
              className="search-input"
              placeholder="Search reference, member, scheme or comment"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search tasks"
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
            value={errorFilter}
            onChange={(event) =>
              setErrorFilter(event.target.value as ErrorFilter)
            }
            aria-label="Filter by error status"
          >
            <option value="All">All error statuses</option>
            <option value="Not set">Not set</option>
            {errorFilters.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            value={ageFilter}
            onChange={(event) =>
              setAgeFilter(event.target.value as AgeFilter)
            }
            aria-label="Filter by age"
          >
            <option value="All">Any age</option>
            <option value="0-3">0–3 days</option>
            <option value="4-7">4–7 days</option>
            <option value="8+">8+ days</option>
          </select>
        </div>

        {filtered.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference Number</th>
                  <th>Member</th>
                  <th>Scheme</th>
                  <th>Principal Officer</th>
                  <th>Error Status</th>
                  <th>Latest Comment</th>
                  <th>Submitted</th>
                  <th>Updated</th>
                  <th>Age</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((nomination) => (
                  <tr
                    key={nomination.id}
                    className="is-clickable"
                    onClick={() => openTask(nomination)}
                  >
                    <td>
                      <span className="cell-strong">
                        {nomination.referenceNumber || nomination.id}
                      </span>
                    </td>
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
                            {nomination.memberNumber || 'No member number'}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>{nominationSchemeName(schemes, nomination)}</td>
                    <td>
                      {nomination.schemeId
                        ? (activePrincipalOfficerForScheme(
                            users,
                            nomination.schemeId,
                          )?.name ?? '—')
                        : '—'}
                    </td>
                    <td>
                      <ErrorStatusBadge status={nomination.errorStatus} />
                    </td>
                    <td>
                      <span className="cell-muted">
                        {commentLines(nomination.comments).at(-1) ??
                          'No comments recorded'}
                      </span>
                    </td>
                    <td>{formatDate(nomination.submissionDate)}</td>
                    <td>{formatDate(nomination.modifiedDate)}</td>
                    <td>{ageInDays(nomination.submissionDate)}d</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="row-button"
                          aria-label={`Review ${
                            nomination.referenceNumber || nomination.id
                          }`}
                          title="Review and correct"
                          onClick={(event) => {
                            event.stopPropagation()
                            openTask(nomination)
                          }}
                        >
                          <Icon name="edit" size={14} />
                        </button>
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
              <Icon name="file-check" size={20} />
            </span>
            <p className="empty-title">No nominations in Tasks</p>
            <p className="empty-text">
              Newly submitted nominations appear here until their Errors status
              is Clear.
            </p>
            <div className="empty-actions">
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => {
                  setSearch('')
                  setErrorFilter('All')
                  setAgeFilter('All')
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
        eyebrow="Tasks"
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
            <>
              <button
                type="button"
                className="button button-primary"
                disabled={busy}
                onClick={() => void handleValidate()}
              >
                <Icon
                  name={
                    !busy &&
                    errorDraft === 'Clear' &&
                    (selected.status === 'Tasks' ||
                      selected.status === 'Submitted')
                      ? 'check-circle'
                      : 'refresh'
                  }
                  size={14}
                />
                {busy
                  ? 'Saving…'
                  : errorDraft === 'Clear' &&
                      (selected.status === 'Tasks' ||
                        selected.status === 'Submitted')
                    ? 'Save Errors and move to Pending PO'
                    : 'Save Errors status'}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={closeDrawer}
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
              <p className="drawer-section-title">Validation result</p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 10,
                  flexWrap: 'wrap',
                }}
              >
                <ErrorStatusBadge status={selected.errorStatus} />
                <NominationStatusBadge status={selected.status} />
              </div>
              <div
                className={`notice ${
                  selected.errorStatus === 'Clear'
                    ? 'is-success'
                    : 'is-info'
                }`}
              >
                <Icon
                  name={
                    selected.errorStatus === 'Clear'
                      ? 'check-circle'
                      : 'info'
                  }
                  size={14}
                  className="notice-icon"
                />
                <span>
                  Errors is read from the SharePoint Errors column. Update it
                  only after reviewing the nomination and recording notes in
                  Comments.
                </span>
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label className="label" htmlFor="task-errors">
                  SharePoint Errors status
                </label>
                <select
                  id="task-errors"
                  className="select"
                  value={errorDraft}
                  onChange={(event) =>
                    setErrorDraft(
                      event.target.value as NominationErrorStatus | '',
                    )
                  }
                >
                  <option value="">Select an Errors status</option>
                  {errorFilters.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              {selected.errorStatus === 'Missing Principal Officer' ? (
                <div className="notice is-info" style={{ marginTop: 10 }}>
                  <Icon name="info" size={14} className="notice-icon" />
                  <span>
                    Assign an active Principal Officer to the scheme before
                    setting Errors to Clear and promoting the nomination.{' '}
                    <button
                      type="button"
                      className="button button-secondary button-small"
                      onClick={() => navigate('/schemes')}
                    >
                      Open Scheme Management
                    </button>
                  </span>
                </div>
              ) : null}
            </section>

            <section className="drawer-section">
              <p className="drawer-section-title">Correct scheme</p>
              <div className="field">
                <label className="label" htmlFor="task-scheme">
                  Scheme
                </label>
                <select
                  id="task-scheme"
                  className="select"
                  value={schemeDraft}
                  onChange={(event) => setSchemeDraft(event.target.value)}
                >
                  <option value="">Select a scheme</option>
                  {schemes
                    .filter((scheme) => scheme.status === 'Active')
                    .map((scheme) => (
                      <option key={scheme.id} value={scheme.id}>
                        {scheme.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="button button-secondary button-small"
                  disabled={busy}
                  onClick={() => void saveScheme()}
                >
                  Save scheme
                </button>
              </div>
            </section>

            <section className="drawer-section">
              <p className="drawer-section-title">Correct member details</p>
              <div className="field-row">
                <div className="field">
                  <label className="label" htmlFor="task-member-number">
                    Member number
                  </label>
                  <input
                    id="task-member-number"
                    className="input"
                    value={memberDraftState.memberNumber}
                    onChange={(event) =>
                      setMemberDraftState((current) => ({
                        ...current,
                        memberNumber: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="task-member-name">
                    Member name
                  </label>
                  <input
                    id="task-member-name"
                    className="input"
                    value={memberDraftState.memberName}
                    onChange={(event) =>
                      setMemberDraftState((current) => ({
                        ...current,
                        memberName: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="task-member-dob">
                    Date of birth
                  </label>
                  <input
                    id="task-member-dob"
                    type="date"
                    className="input"
                    value={memberDraftState.memberDob}
                    onChange={(event) =>
                      setMemberDraftState((current) => ({
                        ...current,
                        memberDob: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="task-member-email">
                    Email address
                  </label>
                  <input
                    id="task-member-email"
                    type="email"
                    className="input"
                    value={memberDraftState.email}
                    onChange={(event) =>
                      setMemberDraftState((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="button button-secondary button-small"
                  disabled={busy}
                  onClick={() => void saveMember()}
                >
                  Save member details
                </button>
              </div>
            </section>

            <section className="drawer-section">
              <p className="drawer-section-title">
                Beneficiaries ({selectedBeneficiaries.length})
              </p>
              {selectedBeneficiaries.length ? (
                selectedBeneficiaries.map((beneficiary) => {
                  const draft = nomineeDrafts[beneficiary.id]
                  if (!draft) return null
                  return (
                    <div className="form-card" key={beneficiary.id}>
                      <div className="field-row">
                        <div className="field">
                          <label
                            className="label"
                            htmlFor={`nominee-name-${beneficiary.id}`}
                          >
                            Full name
                          </label>
                          <input
                            id={`nominee-name-${beneficiary.id}`}
                            className="input"
                            value={draft.title}
                            onChange={(event) =>
                              setNomineeDrafts((current) => ({
                                ...current,
                                [beneficiary.id]: {
                                  ...draft,
                                  title: event.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="field">
                          <label
                            className="label"
                            htmlFor={`nominee-relationship-${beneficiary.id}`}
                          >
                            Relationship
                          </label>
                          <input
                            id={`nominee-relationship-${beneficiary.id}`}
                            className="input"
                            value={draft.relationship}
                            onChange={(event) =>
                              setNomineeDrafts((current) => ({
                                ...current,
                                [beneficiary.id]: {
                                  ...draft,
                                  relationship: event.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="field">
                          <label
                            className="label"
                            htmlFor={`nominee-id-${beneficiary.id}`}
                          >
                            Identity number
                          </label>
                          <input
                            id={`nominee-id-${beneficiary.id}`}
                            className="input"
                            value={draft.identityNumber}
                            onChange={(event) =>
                              setNomineeDrafts((current) => ({
                                ...current,
                                [beneficiary.id]: {
                                  ...draft,
                                  identityNumber: event.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="field">
                          <label
                            className="label"
                            htmlFor={`nominee-dob-${beneficiary.id}`}
                          >
                            Date of birth
                          </label>
                          <input
                            id={`nominee-dob-${beneficiary.id}`}
                            type="date"
                            className="input"
                            value={draft.dateOfBirth}
                            onChange={(event) =>
                              setNomineeDrafts((current) => ({
                                ...current,
                                [beneficiary.id]: {
                                  ...draft,
                                  dateOfBirth: event.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="field">
                          <label
                            className="label"
                            htmlFor={`nominee-pct-${beneficiary.id}`}
                          >
                            Allocation %
                          </label>
                          <input
                            id={`nominee-pct-${beneficiary.id}`}
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            className="input"
                            value={draft.benefitRevisedPct}
                            onChange={(event) =>
                              setNomineeDrafts((current) => ({
                                ...current,
                                [beneficiary.id]: {
                                  ...draft,
                                  benefitRevisedPct: event.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="form-actions">
                        <button
                          type="button"
                          className="button button-secondary button-small"
                          disabled={busy}
                          onClick={() => void saveNominee(beneficiary.id)}
                        >
                          Save beneficiary
                        </button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="help">
                  No beneficiaries are linked. Add them in SharePoint, then
                  re-evaluate.
                </p>
              )}
            </section>

            <section className="drawer-section">
              <p className="drawer-section-title">Comments</p>
              {selectedComments.length ? (
                <div className="timeline">
                  {selectedComments.map((line, index) => (
                    <div className="workflow-step" key={`${line}-${index}`}>
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
              <div className="field" style={{ marginTop: 16 }}>
                <label className="label" htmlFor="task-comment">
                  Add a follow-up note
                </label>
                <textarea
                  id="task-comment"
                  className="textarea"
                  rows={3}
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder="Record review notes, follow-up actions, or other comments."
                />
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="button button-secondary button-small"
                  disabled={busy || !commentDraft.trim()}
                  onClick={() => void handleAddComment()}
                >
                  Save comment
                </button>
              </div>
            </section>

            <section className="drawer-section">
              <p className="drawer-section-title">Record details</p>
              <div className="detail-grid">
                <div className="detail-item">
                  <p className="detail-label">Source status</p>
                  <p className="detail-value">
                    {selected.sourceStatus || '—'}
                  </p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Source Errors</p>
                  <p className="detail-value">
                    {selected.sourceErrors || '—'}
                  </p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">First Endorser</p>
                  <p className="detail-value">
                    {selected.endorsement1Name || '—'}
                  </p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Second Endorser</p>
                  <p className="detail-value">
                    {selected.endorsement2Name || '—'}
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </Drawer>
    </div>
  )
}
