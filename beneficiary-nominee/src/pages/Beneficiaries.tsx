import { useState } from 'react'
import { useData } from '../data/context'
import { Icon } from '../components/Icon'
import {
  AllocationBar,
  NominationStatusBadge,
} from '../components/Badges'
import { Drawer } from '../components/Drawer'
import { Pagination } from '../components/Pagination'
import { useToast } from '../components/toast-context'
import { usePagination } from '../lib/pagination'
import { useAuth } from '../auth/auth-context'
import { downloadCsv } from '../lib/export'
import { formatDate, initials } from '../lib/format'
import { schemeName } from '../lib/nominations'
import { scopedBeneficiaries, scopedNominations } from '../lib/scope'
import { activePrincipalOfficerForScheme } from '../lib/validation'
import type { Beneficiary, Relationship } from '../data/types'

type RelationshipFilter = 'All' | Relationship

export function BeneficiariesPage() {
  const { beneficiaries, nominations, schemes, users } = useData()
  const { notify } = useToast()
  const { role, profile } = useAuth()
  const [search, setSearch] = useState('')
  const [relationship, setRelationship] =
    useState<RelationshipFilter>('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const visibleNominations = scopedNominations(
    role,
    profile.email,
    nominations,
    users,
  )
  const scopedRows = scopedBeneficiaries(
    role,
    profile.email,
    nominations,
    beneficiaries,
    users,
  )

  const nominationByRef = new Map(
    visibleNominations
      .filter((nomination) => nomination.status === 'Approved')
      .map((nomination) => [
        nomination.referenceNumber,
        nomination,
      ]),
  )
  const nominationFor = (beneficiary: Beneficiary) => {
    if (beneficiary.refNumber) {
      const byReference = nominationByRef.get(beneficiary.refNumber)
      if (byReference) return byReference
    }
    if (beneficiary.memberItemId !== null) {
      return visibleNominations.find(
        (nomination) =>
          nomination.id === String(beneficiary.memberItemId) &&
          nomination.status === 'Approved',
      )
    }
    return undefined
  }
  const query = search.trim().toLowerCase()

  const visibleBeneficiaries = scopedRows.filter((beneficiary) =>
    Boolean(nominationFor(beneficiary)),
  )

  const relationshipOptions = Array.from(
    new Set(
      visibleBeneficiaries
        .map((beneficiary) => beneficiary.relationship.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b))

  const filtered = visibleBeneficiaries.filter((beneficiary) => {
    const nomination = nominationFor(beneficiary)
    const scheme = nomination
      ? schemes.find((item) => item.id === nomination.schemeId)
      : undefined
    const matchesSearch =
      !query ||
      [
        beneficiary.title,
        beneficiary.identityNumber,
        beneficiary.memberNumber,
        beneficiary.refNumber,
        beneficiary.fundName,
        scheme?.name,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    const matchesRelationship =
      relationship === 'All' || beneficiary.relationship === relationship
    return matchesSearch && matchesRelationship
  })
  const pagination = usePagination(filtered.length)

  const selected =
    visibleBeneficiaries.find((item) => item.id === selectedId) ?? null
  const selectedNomination = selected ? nominationFor(selected) : undefined
  const selectedScheme = selectedNomination
    ? schemes.find((scheme) => scheme.id === selectedNomination.schemeId)
    : undefined

  const handleExport = () => {
    downloadCsv(
      'beneficiary-register.csv',
      [
        'Beneficiary Name',
        'Relationship',
        'Member Number',
        'Reference Number',
        'Allocation %',
        'Date of Birth',
        'Identity Number',
        'Scheme',
      ],
      filtered.map((beneficiary) => {
        const nomination = nominationFor(beneficiary)
        return [
          beneficiary.title,
          beneficiary.relationship,
          beneficiary.memberNumber,
          beneficiary.refNumber,
          beneficiary.benefitRevisedPct,
          beneficiary.dateOfBirth,
          beneficiary.identityNumber,
          nomination ? schemeName(schemes, nomination.schemeId) : '—',
        ]
      }),
    )
    notify(
      'success',
      'Export ready',
      'The beneficiary register was downloaded.',
    )
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <h1 className="page-heading-title">Active Beneficiaries</h1>
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
            <h2 className="panel-title">Approved nomination beneficiaries</h2>
          </div>
        </div>

        <div className="toolbar" style={{ marginBottom: 16 }}>
          <div className="search-field">
            <Icon name="search" size={15} className="search-icon" />
            <input
              type="search"
              className="search-input"
              placeholder="Search beneficiary, member or reference"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                pagination.setPage(1)
              }}
              aria-label="Search beneficiaries"
            />
          </div>
          <select
            className="filter-select"
            value={relationship}
            onChange={(event) => {
              setRelationship(event.target.value as RelationshipFilter)
              pagination.setPage(1)
            }}
            aria-label="Filter by relationship"
          >
            <option value="All">All relationships</option>
            {relationshipOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <div className="toolbar-actions">
            <span className="result-count">
              {filtered.length} of {visibleBeneficiaries.length} beneficiaries
            </span>
          </div>
        </div>

        {filtered.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Beneficiary Name</th>
                  <th>Relationship</th>
                  <th>Member Number</th>
                  <th>Reference Number</th>
                  <th>Allocation %</th>
                  <th>Date of Birth</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((beneficiary, index) => {
                  const nomination = nominationFor(beneficiary)
                  return (
                    <tr
                      key={beneficiary.id}
                      className={`is-clickable${
                        pagination.isVisible(index) ? '' : ' is-page-hidden'
                      }`}
                      onClick={() => setSelectedId(beneficiary.id)}
                    >
                      <td>
                        <div className="table-holder">
                          <span className="table-avatar" aria-hidden="true">
                            {initials(beneficiary.title)}
                          </span>
                          <span>
                            <span className="cell-strong">
                              {beneficiary.title}
                            </span>
                            <span className="cell-muted">
                              {beneficiary.identityNumber}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td>{beneficiary.relationship}</td>
                      <td>{beneficiary.memberNumber}</td>
                      <td>
                        <span className="cell-strong">
                          {beneficiary.refNumber}
                        </span>
                        <span className="cell-muted">
                          {nomination
                            ? schemeName(schemes, nomination.schemeId)
                            : beneficiary.fundName}
                        </span>
                      </td>
                      <td>
                        <span className="cell-strong">
                          {beneficiary.benefitRevisedPct}%
                        </span>
                      </td>
                      <td>{formatDate(beneficiary.dateOfBirth)}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="row-button"
                            aria-label={`View ${beneficiary.title}`}
                            title="View details"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedId(beneficiary.id)
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
            <p className="empty-title">No beneficiaries match your search</p>
            <p className="empty-text">
              Try a different name, member number or reference number, or clear
              the relationship filter.
            </p>
            <div className="empty-actions">
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => {
                  setSearch('')
                  setRelationship('All')
                  pagination.setPage(1)
                }}
              >
                Clear filters
              </button>
            </div>
          </div>
        )}

        <Pagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          totalItems={filtered.length}
          start={pagination.start}
          end={pagination.end}
          onPageChange={pagination.setPage}
          itemLabel="beneficiaries"
        />
      </section>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        eyebrow="Beneficiary record"
        title={selected?.title ?? 'Beneficiary'}
        subtitle={
          selected
            ? `${selected.relationship} · Reference ${selected.refNumber}`
            : undefined
        }
        footer={
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setSelectedId(null)}
          >
            Close
          </button>
        }
      >
        {selected ? (
          <>
            <section className="drawer-section">
              <p className="drawer-section-title">Beneficiary details</p>
              <div className="detail-grid">
                <div className="detail-item">
                  <p className="detail-label">Full name</p>
                  <p className="detail-value">{selected.title}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Relationship</p>
                  <p className="detail-value">{selected.relationship}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Date of birth</p>
                  <p className="detail-value">
                    {formatDate(selected.dateOfBirth)}
                  </p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Identity number</p>
                  <p className="detail-value">{selected.identityNumber}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Member number</p>
                  <p className="detail-value">{selected.memberNumber}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Reference number</p>
                  <p className="detail-value">{selected.refNumber}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Scheme</p>
                  <p className="detail-value">
                    {selectedNomination
                      ? schemeName(schemes, selectedNomination.schemeId)
                      : selected.fundName}
                  </p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Record ID</p>
                  <p className="detail-value">{selected.id}</p>
                </div>
              </div>
            </section>

            <section className="drawer-section">
              <p className="drawer-section-title">Benefit allocation</p>
              <div className="progress-meta">
                <span>
                  <strong>{selected.benefitRevisedPct}% revised</strong>
                </span>
                <span>{selected.benefitCurrentPct}% current</span>
              </div>
              <AllocationBar value={selected.benefitRevisedPct} />
              <p className="help" style={{ marginTop: 8 }}>
                Current and revised percentages are both retained from the
                nomination nominee record.
              </p>
            </section>

            {selectedNomination ? (
              <section className="drawer-section">
                <p className="drawer-section-title">Linked nomination</p>
                <div className="policy-summary">
                  <span className="policy-summary-icon">
                    <Icon name="file-text" size={19} />
                  </span>
                  <div className="policy-summary-copy">
                    <p className="policy-summary-title">
                      {selectedNomination.memberName}
                      <NominationStatusBadge
                        status={selectedNomination.status}
                      />
                    </p>
                    <p className="policy-summary-meta">
                      {selectedNomination.referenceNumber} ·{' '}
                      {schemeName(schemes, selectedNomination.schemeId)}
                    </p>
                    <p className="policy-summary-meta">
                      Submitted{' '}
                      {formatDate(selectedNomination.submissionDate)}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {selectedScheme ? (
              <div className="notice is-info" style={{ marginTop: 18 }}>
                <Icon name="info" size={14} className="notice-icon" />
                <span>
                  {selectedScheme.name} is managed by{' '}
                  {activePrincipalOfficerForScheme(users, selectedScheme.id)
                    ?.name ?? 'an unassigned Principal Officer'}
                  .
                </span>
              </div>
            ) : null}
          </>
        ) : null}
      </Drawer>
    </div>
  )
}
