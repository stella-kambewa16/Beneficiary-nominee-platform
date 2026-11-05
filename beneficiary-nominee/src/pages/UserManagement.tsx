import { useState } from 'react'
import { useData } from '../data/context'
import { Icon } from '../components/Icon'
import { UserStatusBadge } from '../components/Badges'
import { Drawer } from '../components/Drawer'
import { useToast } from '../components/toast-context'
import { useAuth } from '../auth/auth-context'
import { formatDate, initials } from '../lib/format'
import { userSchemeLabel } from '../lib/nominations'
import type { SystemUser, UserDraft, UserStatus } from '../data/types'

type StatusFilter = 'All' | UserStatus

const statuses: UserStatus[] = ['Active', 'Disabled']

const emptyUserForm: UserDraft = {
  name: '',
  email: '',
  phone: '',
  status: 'Active',
  schemeId: null,
}

function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function UserManagementPage() {
  const { users, schemes, createUser, updateUser, toggleUserStatus } = useData()
  const { notify } = useToast()
  const { profile } = useAuth()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('All')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<UserDraft>({ ...emptyUserForm })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const query = search.trim().toLowerCase()
  const filtered = users.filter((user) => {
    const matchesSearch =
      !query ||
      [
        user.name,
        user.email,
        userSchemeLabel(user, schemes),
        user.schemeCode,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    const matchesStatus = status === 'All' || user.status === status
    return matchesSearch && matchesStatus
  })

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...emptyUserForm })
    setErrors({})
    setDrawerOpen(true)
  }

  const openEdit = (user: SystemUser) => {
    setEditingId(user.id)
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      schemeId: user.schemeId,
    })
    setErrors({})
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setEditingId(null)
    setErrors({})
  }

  const updateField = <K extends keyof UserDraft>(
    key: K,
    value: UserDraft[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const handleSave = async () => {
    const nextErrors: Record<string, string> = {}
    const name = form.name.trim()
    const email = form.email.trim()
    const phone = form.phone.trim()

    if (name.length < 3) {
      nextErrors.name = 'Enter the principal officer’s full name.'
    }
    const validEmail = validateEmail(email)
    if (!validEmail) {
      nextErrors.email = 'Enter a valid email address.'
    }
    if (validEmail) {
      const duplicate = users.some(
        (user) =>
          user.id !== editingId &&
          user.email.trim().toLowerCase() === email.toLowerCase(),
      )
      if (duplicate) {
        nextErrors.email = 'This email address is already registered.'
      }
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    const draft: UserDraft = {
      name,
      email,
      phone,
      status: form.status,
      schemeId: form.schemeId,
    }

    setBusy(true)
    try {
      if (editingId) {
        await updateUser(editingId, draft, profile.name)
        notify('success', 'Principal officer updated', `${name}’s account was updated.`)
      } else {
        await createUser(draft, profile.name)
        notify(
          'success',
          'Principal officer created',
          `${name} was added to the workspace.`,
        )
      }
      closeDrawer()
    } catch (error) {
      notify(
        'error',
        'Unable to save principal officer',
        error instanceof Error ? error.message : 'Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleToggle = async (user: SystemUser) => {
    const nextStatus = user.status === 'Active' ? 'disabled' : 'enabled'
    setBusy(true)
    try {
      await toggleUserStatus(user.id, profile.name)
      notify(
        'success',
        `User ${nextStatus}`,
        `${user.name} was ${nextStatus} for the workspace.`,
      )
    } catch (error) {
      notify(
        'error',
        'Unable to update user',
        error instanceof Error ? error.message : 'Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <h1 className="page-heading-title">User management</h1>
        <div className="hero-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={openCreate}
          >
            <Icon name="plus" size={15} />
            Create principal officer
          </button>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <div className="panel-heading">
            <h2 className="panel-title">Principal officers</h2>
          </div>
        </div>

        <div className="toolbar" style={{ marginBottom: 16 }}>
          <div className="search-field">
            <Icon name="search" size={15} className="search-icon" />
            <input
              type="search"
              className="search-input"
              placeholder="Search name, email or scheme"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search users"
            />
          </div>
          <select
            className="filter-select"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            aria-label="Filter by status"
          >
            <option value="All">All statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <div className="toolbar-actions">
            <span className="result-count">
              {filtered.length} of {users.length} users
            </span>
          </div>
        </div>

        {filtered.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Scheme</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr
                    key={user.id}
                    className="is-clickable"
                    onClick={() => openEdit(user)}
                  >
                    <td>
                      <div className="table-holder">
                        <span className="table-avatar" aria-hidden="true">
                          {initials(user.name)}
                        </span>
                        <span className="cell-strong">{user.name}</span>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>{userSchemeLabel(user, schemes)}</td>
                    <td>
                      <UserStatusBadge status={user.status} />
                      {user.sourceStatus &&
                      user.sourceStatus.toLowerCase() !==
                        user.status.toLowerCase() ? (
                        <span className="cell-muted">
                          SharePoint: {user.sourceStatus}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="row-button"
                          aria-label={`Edit ${user.name}`}
                          title="Edit user"
                          onClick={(event) => {
                            event.stopPropagation()
                            openEdit(user)
                          }}
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          type="button"
                          className="row-button"
                          aria-label={`${
                            user.status === 'Active' ? 'Disable' : 'Enable'
                          } ${user.name}`}
                          title={
                            user.status === 'Active'
                              ? 'Disable user'
                              : 'Enable user'
                          }
                          disabled={busy}
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleToggle(user)
                          }}
                        >
                          <Icon
                            name={user.status === 'Active' ? 'x' : 'check'}
                            size={14}
                          />
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
              <Icon name="users" size={20} />
            </span>
            <p className="empty-title">No users match your filters</p>
            <p className="empty-text">
              Try a different search term or status, or create a new principal
              officer account.
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
        open={drawerOpen}
        onClose={closeDrawer}
        eyebrow="Principal officer account"
        title={editingId ? 'Edit principal officer' : 'Create principal officer'}
        subtitle={
          editingId
            ? 'Update the scheme assignment or account status.'
            : 'Add a principal officer to the principalOfficers list.'
        }
        footer={
          <>
            <button
              type="button"
              className="button button-secondary"
              disabled={busy}
              onClick={closeDrawer}
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
                  : 'Save principal officer'}
            </button>
          </>
        }
      >
        <div className="drawer-form">
          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="user-name">
                Full name
              </label>
              <input
                id="user-name"
                className={`input${errors.name ? ' is-error' : ''}`}
                value={form.name}
                onChange={(event) =>
                  updateField('name', event.target.value)
                }
                placeholder="e.g. Thandiwe Moyo"
              />
              {errors.name ? (
                <p className="error-text">
                  <Icon name="alert-circle" size={12} />
                  {errors.name}
                </p>
              ) : null}
            </div>
            <div className="field">
              <label className="label" htmlFor="user-email">
                Email address
              </label>
              <input
                id="user-email"
                type="email"
                className={`input${errors.email ? ' is-error' : ''}`}
                value={form.email}
                onChange={(event) =>
                  updateField('email', event.target.value)
                }
                placeholder="name@company.co.mw"
              />
              {errors.email ? (
                <p className="error-text">
                  <Icon name="alert-circle" size={12} />
                  {errors.email}
                </p>
              ) : null}
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="user-phone">
                Phone number
              </label>
              <input
                id="user-phone"
                className="input"
                value={form.phone}
                onChange={(event) =>
                  updateField('phone', event.target.value)
                }
                placeholder="+265 999 000 000"
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="user-status">
                Status
              </label>
              <select
                id="user-status"
                className="select"
                value={form.status}
                onChange={(event) =>
                  updateField('status', event.target.value as UserStatus)
                }
              >
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="user-scheme">
              Scheme
            </label>
            <select
              id="user-scheme"
              className="select"
              value={form.schemeId ?? ''}
              onChange={(event) =>
                updateField(
                  'schemeId',
                  event.target.value ? event.target.value : null,
                )
              }
            >
              <option value="">Unassigned</option>
              {schemes
                .filter(
                  (scheme) =>
                    scheme.status === 'Active' || scheme.id === form.schemeId,
                )
                .map((scheme) => (
                  <option
                    key={scheme.id}
                    value={scheme.id}
                    disabled={scheme.status === 'Disabled'}
                  >
                    {scheme.name}
                    {scheme.status === 'Disabled' ? ' (Disabled)' : ''}
                  </option>
                ))}
            </select>
            <p className="help">
              Assigning a scheme writes its code and name to the officer’s
              schemecode and schemename fields.
            </p>
          </div>

          {editingId ? (
            <p className="help">
              This account was created on{' '}
              {formatDate(
                users.find((user) => user.id === editingId)?.createdDate ?? '',
              )}
              .
            </p>
          ) : null}
        </div>
      </Drawer>
    </div>
  )
}
