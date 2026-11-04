import { useState } from 'react'
import { useData } from '../data/context'
import { Icon } from '../components/Icon'
import { useToast } from '../components/toast-context'
import { useAuth } from '../auth/auth-context'
import { downloadCsv, printReport } from '../lib/export'
import { formatDate } from '../lib/format'
import { schemeName } from '../lib/nominations'
import { scopedBeneficiaries, scopedNominations } from '../lib/scope'
import type { IconName } from '../components/Icon'
import type {
  ApprovalEvent,
  Nomination,
  NominationStatus,
} from '../data/types'

type ReportId =
  | 'nominations-by-scheme'
  | 'pending-approvals'
  | 'approved-nominations'
  | 'beneficiary-register'
  | 'principal-officer-activity'

interface ReportDefinition {
  id: ReportId
  title: string
  description: string
  icon: IconName
}

const reports: ReportDefinition[] = [
  {
    id: 'nominations-by-scheme',
    title: 'Nominations by Scheme',
    description: 'Submission volumes and approval outcomes for every scheme.',
    icon: 'briefcase',
  },
  {
    id: 'pending-approvals',
    title: 'Pending Approvals',
    description: 'Nominations still waiting for a principal officer or manager.',
    icon: 'clock',
  },
  {
    id: 'approved-nominations',
    title: 'Approved Nominations',
    description: 'Fully approved nominations with their final decision date.',
    icon: 'check-circle',
  },
  {
    id: 'beneficiary-register',
    title: 'Beneficiary Register',
    description: 'Every beneficiary linked back to a nomination reference.',
    icon: 'users',
  },
  {
    id: 'principal-officer-activity',
    title: 'Principal Officer Activity',
    description: 'Endorsements and rejections recorded at the first stage.',
    icon: 'user-check',
  },
]

type StatusFilter = 'All' | NominationStatus

interface ReportTable {
  headers: string[]
  rows: Array<Array<string | number>>
}

const statuses: NominationStatus[] = [
  'Pending PO Approval',
  'Pending PM Approval',
  'Approved',
  'Rejected',
]

function inDateRange(value: string, from: string, to: string): boolean {
  if (from && value < from) return false
  if (to && value > to) return false
  return true
}

function finalApproval(nomination: Nomination): ApprovalEvent | undefined {
  return [...nomination.approvalHistory]
    .reverse()
    .find((event) => event.decision === 'Approved')
}

export function ReportsPage() {
  const { nominations, beneficiaries, schemes, users } = useData()
  const { notify } = useToast()
  const { role, profile } = useAuth()

  const [reportId, setReportId] = useState<ReportId>('nominations-by-scheme')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [schemeId, setSchemeId] = useState('All')
  const [status, setStatus] = useState<StatusFilter>('All')

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

  const activeReport =
    reports.find((report) => report.id === reportId) ?? reports[0]

  const nominationByRef = new Map(
    visibleNominations.map((nomination) => [
      nomination.referenceNumber,
      nomination,
    ]),
  )

  const matchesFilters = (nomination: Nomination) =>
    inDateRange(nomination.submissionDate, from, to) &&
    (schemeId === 'All' || nomination.schemeId === schemeId) &&
    (status === 'All' || nomination.status === status)

  const filteredNominations = visibleNominations.filter(matchesFilters)

  const filteredBeneficiaries = visibleBeneficiaries.filter((beneficiary) => {
    const nomination = nominationByRef.get(beneficiary.refNumber)
    return nomination ? matchesFilters(nomination) : false
  })

  const officerActivity = visibleNominations
    .flatMap((nomination) =>
      nomination.approvalHistory
        .filter((event) => event.stage.includes('Principal Officer'))
        .map((event) => ({ nomination, event })),
    )
    .filter(
      ({ nomination, event }) =>
        inDateRange(event.date, from, to) &&
        (schemeId === 'All' || nomination.schemeId === schemeId) &&
        (status === 'All' || nomination.status === status),
    )
    .sort((a, b) => b.event.date.localeCompare(a.event.date))

  const buildReport = (): ReportTable => {
    switch (reportId) {
      case 'nominations-by-scheme': {
        const rows = schemes
          .filter((scheme) => schemeId === 'All' || scheme.id === schemeId)
          .map((scheme) => {
            const items = filteredNominations.filter(
              (nomination) => nomination.schemeId === scheme.id,
            )
            const references = new Set(
              items.map((nomination) => nomination.referenceNumber),
            )
            return [
              scheme.name,
              items.length,
              items.filter(
                (item) => item.status === 'Pending PO Approval',
              ).length,
              items.filter(
                (item) => item.status === 'Pending PM Approval',
              ).length,
              items.filter((item) => item.status === 'Approved').length,
              items.filter((item) => item.status === 'Rejected').length,
              visibleBeneficiaries.filter((beneficiary) =>
                references.has(beneficiary.refNumber),
              ).length,
            ]
          })
        return {
          headers: [
            'Scheme',
            'Nominations',
            'Pending PO Approval',
            'Pending PM Approval',
            'Approved',
            'Rejected',
            'Beneficiaries',
          ],
          rows,
        }
      }

      case 'pending-approvals': {
        const rows = filteredNominations
          .filter(
            (nomination) =>
              nomination.status === 'Pending PO Approval' ||
              nomination.status === 'Pending PM Approval',
          )
          .sort((a, b) => a.submissionDate.localeCompare(b.submissionDate))
          .map((nomination) => [
            nomination.referenceNumber,
            nomination.memberNumber,
            nomination.memberName,
            schemeName(schemes, nomination.schemeId),
            nomination.status,
            formatDate(nomination.submissionDate),
          ])
        return {
          headers: [
            'Reference Number',
            'Member Number',
            'Member Name',
            'Scheme',
            'Stage',
            'Submission Date',
          ],
          rows,
        }
      }

      case 'approved-nominations': {
        const rows = filteredNominations
          .filter((nomination) => nomination.status === 'Approved')
          .sort((a, b) => b.submissionDate.localeCompare(a.submissionDate))
          .map((nomination) => {
            const approval = finalApproval(nomination)
            return [
              nomination.referenceNumber,
              nomination.memberName,
              schemeName(schemes, nomination.schemeId),
              nomination.nomineeCount,
              formatDate(approval?.date ?? nomination.submissionDate),
              approval?.actor ?? '—',
            ]
          })
        return {
          headers: [
            'Reference Number',
            'Member Name',
            'Scheme',
            'Beneficiaries',
            'Approved On',
            'Final Approver',
          ],
          rows,
        }
      }

      case 'beneficiary-register': {
        const rows = filteredBeneficiaries.map((beneficiary) => {
          const nomination = nominationByRef.get(beneficiary.refNumber)
          return [
            beneficiary.title,
            beneficiary.relationship,
            beneficiary.memberNumber,
            beneficiary.refNumber,
            `${beneficiary.benefitRevisedPct}%`,
            formatDate(beneficiary.dateOfBirth),
            nomination
              ? schemeName(schemes, nomination.schemeId)
              : beneficiary.fundName,
          ]
        })
        return {
          headers: [
            'Beneficiary Name',
            'Relationship',
            'Member Number',
            'Reference Number',
            'Allocation %',
            'Date of Birth',
            'Scheme',
          ],
          rows,
        }
      }

      case 'principal-officer-activity': {
        const rows = officerActivity.map(({ nomination, event }) => [
          formatDate(event.date),
          event.actor,
          schemeName(schemes, nomination.schemeId),
          nomination.referenceNumber,
          nomination.memberName,
          event.decision,
          event.comments || '—',
        ])
        return {
          headers: [
            'Date',
            'Principal Officer',
            'Scheme',
            'Reference Number',
            'Member Name',
            'Decision',
            'Comment',
          ],
          rows,
        }
      }

      default:
        return { headers: [], rows: [] }
    }
  }

  const table = buildReport()

  const handleExport = () => {
    downloadCsv(`${reportId}.csv`, table.headers, table.rows)
    notify(
      'success',
      'Export ready',
      `${activeReport.title} was downloaded as a spreadsheet.`,
    )
  }

  const handlePrint = () => {
    printReport()
  }

  const resetFilters = () => {
    setFrom('')
    setTo('')
    setSchemeId('All')
    setStatus('All')
  }

  const officerCount = new Set(
    officerActivity.map(({ event }) => event.actor),
  ).size
  const assignedOfficers = users.filter(
    (user) => user.role === 'Principal Officer',
  ).length
  const activeSchemes = schemes.filter(
    (scheme) => scheme.status === 'Active',
  ).length

  return (
    <div className="page-stack">
      <section className="hero">
        <div className="hero-main">
          <span className="hero-eyebrow">
            <Icon name="chart" size={13} />
            Reporting
          </span>
          <h1 className="hero-title">Nomination reports</h1>
          <p className="hero-text">
            Review nomination, approval and beneficiary activity, then export
            the current view to Excel or print it as a PDF.
          </p>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={handleExport}
          >
            <Icon name="download" size={15} />
            Export Excel
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={handlePrint}
          >
            <Icon name="printer" size={15} />
            Export PDF
          </button>
        </div>
      </section>

      <section className="panel print-hide">
        <div className="panel-header">
          <div className="panel-heading">
            <h2 className="panel-title">Choose a report</h2>
            <p className="panel-subtitle">
              Select the report you want to preview and export.
            </p>
          </div>
        </div>

        <div className="action-grid">
          {reports.map((report) => (
            <button
              type="button"
              key={report.id}
              className={`action-card${
                reportId === report.id ? ' is-active' : ''
              }`}
              onClick={() => setReportId(report.id)}
            >
              <span className="action-icon">
                <Icon name={report.icon} size={17} />
              </span>
              <span className="action-copy">
                <span className="action-title">{report.title}</span>
                <span className="action-text">{report.description}</span>
              </span>
              <Icon
                name="chevron-right"
                size={15}
                className="action-arrow"
              />
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="panel-heading">
            <h2 className="panel-title">{activeReport.title}</h2>
            <p className="panel-subtitle">
              {activeReport.description}
              {reportId === 'principal-officer-activity' && officerCount
                ? ` ${officerCount} principal officer${
                    officerCount === 1 ? '' : 's'
                  } recorded a decision in this view.`
                : ''}
            </p>
          </div>
          <div className="panel-actions">
            <span className="result-count">{table.rows.length} rows</span>
          </div>
        </div>

        <div className="toolbar" style={{ marginBottom: 16 }}>
          <div className="field">
            <label className="label" htmlFor="report-from">
              From
            </label>
            <input
              id="report-from"
              type="date"
              className="input"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="report-to">
              To
            </label>
            <input
              id="report-to"
              type="date"
              className="input"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="report-scheme">
              Scheme
            </label>
            <select
              id="report-scheme"
              className="select"
              value={schemeId}
              onChange={(event) => setSchemeId(event.target.value)}
            >
              <option value="All">All schemes</option>
              {schemes.map((scheme) => (
                <option key={scheme.id} value={scheme.id}>
                  {scheme.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="report-status">
              Status
            </label>
            <select
              id="report-status"
              className="select"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as StatusFilter)
              }
            >
              <option value="All">All statuses</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="toolbar-actions">
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={resetFilters}
            >
              <Icon name="refresh" size={13} />
              Reset
            </button>
          </div>
        </div>

        {table.rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {table.headers.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, index) => (
                  <tr key={`${reportId}-${index}`}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${reportId}-${index}-${cellIndex}`}>
                        {cellIndex === 0 ? (
                          <span className="cell-strong">{cell}</span>
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <Icon name="filter" size={20} />
            </span>
            <p className="empty-title">No records match this report</p>
            <p className="empty-text">
              Adjust the date range, scheme or status filters to widen the
              report.
            </p>
            <div className="empty-actions">
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={resetFilters}
              >
                Clear filters
              </button>
            </div>
          </div>
        )}

        <div className="panel-footer">
          <p className="help">
            {assignedOfficers} principal officers are assigned across{' '}
            {activeSchemes} active schemes. Exports reflect the filters above.
          </p>
        </div>
      </section>
    </div>
  )
}
