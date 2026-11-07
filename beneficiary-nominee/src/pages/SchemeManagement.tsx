import { useState } from 'react'
import { useData } from '../data/context'
import { Icon } from '../components/Icon'
import { Drawer } from '../components/Drawer'
import { Pagination } from '../components/Pagination'
import { useToast } from '../components/toast-context'
import { usePagination } from '../lib/pagination'
import { useAuth } from '../auth/auth-context'
import { formatDate, initials } from '../lib/format'
import { userHasScheme } from '../lib/nominations'
import type {
  Scheme,
  SchemeDraft,
  SchemeStatus,
  SystemUser,
} from '../data/types'

type SchemeStatusFilter = 'All' | SchemeStatus

const schemeStatuses: SchemeStatus[] = ['Active', 'Disabled']

const emptyDraft: SchemeDraft = {
  name: '',
  principalOfficerId: null,
}

export function SchemeManagementPage() {
  const {
    schemes,
    users,
    createScheme,
    updateScheme,
    toggleSchemeStatus,
  } = useData()
  const { profile } = useAuth()
  const { notify } = useToast()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<SchemeStatusFilter>('All')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<SchemeDraft>(emptyDraft)
  const [busy, setBusy] = useState(false)

  const principalOfficer = (schemeId: string): SystemUser | undefined =>
    users.find(
      (user) =>
        user.role === 'Principal Officer' && userHasScheme(user, schemeId),
    ) ??
    users.find(
      (user) =>
        user.role === 'Pension Adminstration' &&
        userHasScheme(user, schemeId),
    )

  const query = search.trim().toLowerCase()
  const filtered = schemes.filter((scheme) => {
    const officer = principalOfficer(scheme.id)
    const matchesSearch =
      !query ||
      [scheme.name, scheme.title, officer?.name, officer?.email]
        .join(' ')
        .toLowerCase()
        .includes(query)
    const matchesStatus = status === 'All' || scheme.status === status
    return matchesSearch && matchesStatus
  })
  const pagination = usePagination(filtered.length)

  const openCreate = () => {
    setEditingId(null)
    setDraft({ ...emptyDraft })
    setEditorOpen(true)
  }

  const openEdit = (scheme: Scheme) => {
    const officer = principalOfficer(scheme.id)
    setEditingId(scheme.id)
    setDraft({
      name: scheme.name,
      principalOfficerId: officer?.id ?? null,
    })
    setEditorOpen(true)
  }

  const handleSave = async () => {
    if (!draft.name.trim()) {
      notify(
        'warning',
        'Scheme name required',
        'Enter a name for the scheme before saving.',
      )
      return
    }

    setBusy(true)
    try {
      if (editingId) {
        await updateScheme(editingId, draft, profile.name)
        notify(
          'success',
          'Scheme updated',
          `${draft.name.trim()} has been updated.`,
        )
      } else {
        await createScheme(draft, profile.name)
        notify(
          'success',
          'Scheme created',
          `${draft.name.trim()} has been added.`,
        )
      }
      setEditorOpen(false)
    } catch (error) {
      notify(
        'error',
        'Unable to save scheme',
        error instanceof Error ? error.message : 'Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleToggleStatus = async (scheme: Scheme) => {
    const nextStatus = scheme.status === 'Active' ? 'Disabled' : 'Active'
    setBusy(true)
    try {
      await toggleSchemeStatus(scheme.id, profile.name)
      notify(
        'success',
        `Scheme ${nextStatus.toLowerCase()}`,
        `${scheme.name} is now ${nextStatus.toLowerCase()}.`,
      )
    } catch (error) {
      notify(
        'error',
        'Unable to update scheme status',
        error instanceof Error ? error.message : 'Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <h1 className="page-heading-title">Scheme Management</h1>
        <div className="hero-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={openCreate}
          >
            <Icon name="plus" size={15} />
            Create scheme
          </button>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <div className="panel-heading">
            <h2 className="panel-title">Schemes</h2>
          </div>
        </div>

        <div className="toolbar" style={{ marginBottom: 16 }}>
          <div className="search-field">
            <Icon name="search" size={15} className="search-icon" />
            <input
              type="search"
              className="search-input"
              placeholder="Search scheme or Principal Officer"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                pagination.setPage(1)
              }}
              aria-label="Search schemes"
            />
          </div>
          <select
            className="filter-select"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as SchemeStatusFilter)
              pagination.setPage(1)
            }}
            aria-label="Filter by scheme status"
          >
            <option value="All">All statuses</option>
            {schemeStatuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <div className="toolbar-actions">
            <span className="result-count">
              {filtered.length} of {schemes.length} schemes
            </span>
          </div>
        </div>

        {filtered.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Scheme Name</th>
                  <th>Principal Officer</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((scheme, index) => {
                  const officer = principalOfficer(scheme.id)
                  return (
                    <tr
                      key={scheme.id}
                      className={
                        pagination.isVisible(index) ? undefined : 'is-page-hidden'
                      }
                    >
                      <td>
                        <span className="cell-strong">{scheme.name}</span>
                        {scheme.title && scheme.title !== scheme.name ? (
                          <span className="cell-muted">
                            List title: {scheme.title}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        {officer ? (
                          <div className="table-holder">
                            <span className="table-avatar" aria-hidden="true">
                              {initials(officer.name)}
                            </span>
                            <span>
                              <span className="cell-strong">
                                {officer.name}
                              </span>
                              <span className="cell-muted">
                                {officer.email}
                              </span>
                            </span>
                          </div>
                        ) : (
                          <span className="muted">Unassigned</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            scheme.status === 'Active'
                              ? 'badge-green'
                              : 'badge-slate'
                          }`}
                        >
                          {scheme.status}
                        </span>
                        {scheme.sourceStatus &&
                        !['active', 'disable', 'disabled'].includes(
                          scheme.sourceStatus.toLowerCase(),
                        ) ? (
                          <span className="cell-muted">
                            SharePoint: {scheme.sourceStatus}
                          </span>
                        ) : null}
                      </td>
                      <td>{formatDate(scheme.createdDate)}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="row-button"
                            aria-label={`Edit ${scheme.name}`}
                            title="Edit scheme"
                            onClick={() => openEdit(scheme)}
                          >
                            <Icon name="edit" size={14} />
                          </button>
                          <button
                            type="button"
                            className="row-button"
                            aria-label={`${
                              scheme.status === 'Active' ? 'Disable' : 'Enable'
                            } ${scheme.name}`}
                            title={
                              scheme.status === 'Active'
                                ? 'Disable scheme'
                                : 'Enable scheme'
                            }
                            disabled={busy}
                            onClick={() => void handleToggleStatus(scheme)}
                          >
                            <Icon
                              name={scheme.status === 'Active' ? 'x' : 'check'}
                              size={14}
                            />
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
              <Icon name="briefcase" size={20} />
            </span>
            <p className="empty-title">No schemes match your search</p>
            <p className="empty-text">Try a different scheme name.</p>
            <div className="empty-actions">
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => {
                  setSearch('')
                  pagination.setPage(1)
                }}
              >
                Clear search
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
          itemLabel="schemes"
        />
      </section>

      <Drawer
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        eyebrow="Scheme Management"
        title={editingId ? 'Edit scheme' : 'Create scheme'}
        subtitle="Assign a Principal Officer to the scheme."
        footer={
          <>
            <button
              type="button"
              className="button button-secondary"
              disabled={busy}
              onClick={() => setEditorOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={busy}
              onClick={() => void handleSave()}
            >
              <Icon name="check" size={14} />
              {busy
                ? 'Saving…'
                : editingId
                  ? 'Save changes'
                  : 'Save scheme'}
            </button>
          </>
        }
      >
        <div className="page-stack">
          <div className="field">
            <label className="label" htmlFor="scheme-name">
              Scheme name
            </label>
            <input
              id="scheme-name"
              className="input"
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="e.g. Telekom Networks"
            />
            <p className="help">
              The same value is written to the list’s Title and schemeName
              columns.
            </p>
          </div>

          <div className="field">
            <label className="label" htmlFor="scheme-officer">
              Principal Officer
            </label>
            <select
              id="scheme-officer"
              className="select"
              value={draft.principalOfficerId ?? ''}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  principalOfficerId: event.target.value || null,
                }))
              }
            >
              <option value="">Unassigned</option>
              {users
                .filter(
                  (user) =>
                    user.role === 'Principal Officer' ||
                    user.role === 'Pension Adminstration',
                )
                .map((user) => {
                  const assignedSchemes = schemes.filter(
                    (scheme) =>
                      userHasScheme(user, scheme.id) &&
                      scheme.id !== editingId,
                  )
                  return (
                    <option key={user.id} value={user.id}>
                      {user.name} — {user.role}
                      {user.status === 'Disabled' ? ' (Disabled)' : ''}
                      {assignedSchemes.length
                        ? ` — also assigned to ${assignedSchemes.map((scheme) => scheme.name).join(', ')}`
                        : ''}
                    </option>
                  )
                })}
            </select>
            <p className="help">
              Assigning an officer adds this scheme while retaining their
              other scheme assignments.
            </p>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
