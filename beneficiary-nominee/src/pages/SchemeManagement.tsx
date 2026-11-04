import { useState } from 'react'
import { useData } from '../data/context'
import { Icon } from '../components/Icon'
import { Drawer } from '../components/Drawer'
import { SchemeStatusBadge } from '../components/Badges'
import { useToast } from '../components/toast-context'
import { useAuth } from '../auth/auth-context'
import { formatDate, initials } from '../lib/format'
import type {
  Scheme,
  SchemeDraft,
  SchemeStatus,
  SystemUser,
} from '../data/types'

type StatusFilter = 'All' | SchemeStatus

const emptyDraft: SchemeDraft = {
  name: '',
  description: '',
  principalOfficerId: null,
  status: 'Active',
}

export function SchemeManagementPage() {
  const { schemes, users, createScheme, updateScheme, toggleSchemeStatus } =
    useData()
  const { profile } = useAuth()
  const { notify } = useToast()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<SchemeDraft>(emptyDraft)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const principalOfficer = (schemeId: string): SystemUser | undefined =>
    users.find(
      (user) =>
        user.role === 'Principal Officer' && user.schemeId === schemeId,
    )

  const query = search.trim().toLowerCase()
  const filtered = schemes.filter((scheme) => {
    const officer = principalOfficer(scheme.id)
    const matchesSearch =
      !query ||
      [scheme.name, scheme.description, officer?.name, officer?.email]
        .join(' ')
        .toLowerCase()
        .includes(query)
    const matchesStatus =
      statusFilter === 'All' || scheme.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const activeSchemes = schemes.filter(
    (scheme) => scheme.status === 'Active',
  ).length
  const inactiveSchemes = schemes.length - activeSchemes
  const confirmScheme =
    schemes.find((scheme) => scheme.id === confirmId) ?? null

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
      description: scheme.description,
      principalOfficerId: officer?.id ?? null,
      status: scheme.status,
    })
    setEditorOpen(true)
  }

  const handleSave = () => {
    if (!draft.name.trim()) {
      notify(
        'warning',
        'Scheme name required',
        'Enter a name for the scheme before saving.',
      )
      return
    }

    try {
      if (editingId) {
        updateScheme(editingId, draft, profile.name)
        notify(
          'success',
          'Scheme updated',
          `${draft.name.trim()} has been updated.`,
        )
      } else {
        createScheme(draft, profile.name)
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
    }
  }

  const handleToggleStatus = () => {
    if (!confirmScheme) return
    try {
      toggleSchemeStatus(confirmScheme.id, profile.name)
      notify(
        'success',
        confirmScheme.status === 'Active'
          ? 'Scheme deactivated'
          : 'Scheme activated',
        `${confirmScheme.name} is now ${
          confirmScheme.status === 'Active' ? 'inactive' : 'active'
        }.`,
      )
      setConfirmId(null)
    } catch (error) {
      notify(
        'error',
        'Unable to update scheme',
        error instanceof Error ? error.message : 'Please try again.',
      )
    }
  }

  return (
    <div className="page-stack">
      <section className="hero">
        <div className="hero-main">
          <span className="hero-eyebrow">
            <Icon name="briefcase" size={13} />
            Administration
          </span>
          <h1 className="hero-title">Scheme Management</h1>
          <p className="hero-text">
            Manage the funds and schemes sourced from the schemes list. Each
            scheme can be assigned to one Principal Officer.
          </p>
        </div>
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
      </section>

      <section className="panel">
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
            <p className="mini-stat-value">{inactiveSchemes}</p>
            <p className="mini-stat-label">Inactive schemes</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="panel-heading">
            <h2 className="panel-title">Schemes</h2>
            <p className="panel-subtitle">
              Create, edit or deactivate a scheme and manage its Principal
              Officer.
            </p>
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
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search schemes"
            />
          </div>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
            aria-label="Filter by scheme status"
          >
            <option value="All">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
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
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((scheme) => {
                  const officer = principalOfficer(scheme.id)
                  return (
                    <tr key={scheme.id}>
                      <td>
                        <span className="cell-strong">{scheme.name}</span>
                        <span className="cell-muted">
                          {scheme.description} · Added{' '}
                          {formatDate(scheme.createdDate)}
                        </span>
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
                        <SchemeStatusBadge status={scheme.status} />
                      </td>
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
                            className={`row-button${
                              scheme.status === 'Active'
                                ? ' is-reject'
                                : ' is-approve'
                            }`}
                            aria-label={`${
                              scheme.status === 'Active'
                                ? 'Deactivate'
                                : 'Activate'
                            } ${scheme.name}`}
                            title={
                              scheme.status === 'Active'
                                ? 'Deactivate scheme'
                                : 'Activate scheme'
                            }
                            onClick={() => setConfirmId(scheme.id)}
                          >
                            <Icon
                              name={
                                scheme.status === 'Active'
                                  ? 'lock'
                                  : 'check-circle'
                              }
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
            <p className="empty-title">No schemes match your filters</p>
            <p className="empty-text">
              Try a different scheme name or status.
            </p>
            <div className="empty-actions">
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('All')
                }}
              >
                Clear filters
              </button>
            </div>
          </div>
        )}

        <div className="panel-footer">
          <div className="notice is-info">
            <Icon name="info" size={14} className="notice-icon" />
            <span>
              Deactivating a scheme prevents new nominations from being captured
              against it. Historical nominations and beneficiaries remain
              available.
            </span>
          </div>
        </div>
      </section>

      <Drawer
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        eyebrow="Scheme Management"
        title={editingId ? 'Edit scheme' : 'Create scheme'}
        subtitle="Assign one Principal Officer to the scheme."
        footer={
          <>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setEditorOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={handleSave}
            >
              <Icon name="check" size={14} />
              {editingId ? 'Save changes' : 'Create scheme'}
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
          </div>

          <div className="field">
            <label className="label" htmlFor="scheme-description">
              Description <span className="optional">Optional</span>
            </label>
            <textarea
              id="scheme-description"
              className="textarea"
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Describe the fund or scheme."
            />
          </div>

          <div className="field-row">
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
                  .filter((user) => user.role === 'Principal Officer')
                  .map((user) => {
                    const assignedScheme = schemes.find(
                      (scheme) => scheme.id === user.schemeId,
                    )
                    return (
                      <option key={user.id} value={user.id}>
                        {user.name}
                        {user.status === 'Disabled' ? ' (Disabled)' : ''}
                        {assignedScheme &&
                        assignedScheme.id !== editingId
                          ? ` — currently ${assignedScheme.name}`
                          : ''}
                      </option>
                    )
                  })}
              </select>
              <p className="help">
                Assigning an officer here moves the scheme assignment from their
                current scheme.
              </p>
            </div>
            <div className="field">
              <label className="label" htmlFor="scheme-status">
                Status
              </label>
              <select
                id="scheme-status"
                className="select"
                value={draft.status}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value as SchemeStatus,
                  }))
                }
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </Drawer>

      <Drawer
        open={Boolean(confirmScheme)}
        onClose={() => setConfirmId(null)}
        eyebrow="Scheme status"
        title={
          confirmScheme?.status === 'Active'
            ? 'Deactivate scheme'
            : 'Activate scheme'
        }
        subtitle={confirmScheme?.name}
        footer={
          <>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setConfirmId(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={
                confirmScheme?.status === 'Active'
                  ? 'button button-danger'
                  : 'button button-primary'
              }
              onClick={handleToggleStatus}
            >
              <Icon
                name={
                  confirmScheme?.status === 'Active' ? 'lock' : 'check-circle'
                }
                size={14}
              />
              {confirmScheme?.status === 'Active'
                ? 'Deactivate scheme'
                : 'Activate scheme'}
            </button>
          </>
        }
      >
        {confirmScheme ? (
          <div className="page-stack">
            <div
              className={
                confirmScheme.status === 'Active'
                  ? 'notice'
                  : 'notice is-info'
              }
            >
              <Icon
                name={
                  confirmScheme.status === 'Active'
                    ? 'alert-circle'
                    : 'info'
                }
                size={14}
                className="notice-icon"
              />
              <span>
                {confirmScheme.status === 'Active'
                  ? `${confirmScheme.name} will be marked inactive. Existing nominations remain available, but new nominations should not be captured against it.`
                  : `${confirmScheme.name} will be marked active and available for new nominations.`}
              </span>
            </div>
            <div className="detail-grid">
              <div className="detail-item">
                <p className="detail-label">Principal Officer</p>
                <p className="detail-value">
                  {principalOfficer(confirmScheme.id)?.name ?? 'Unassigned'}
                </p>
              </div>
              <div className="detail-item">
                <p className="detail-label">Current status</p>
                <p className="detail-value">{confirmScheme.status}</p>
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}
