import { useState } from 'react'
import { useData } from '../data/context'
import { Icon } from '../components/Icon'
import { UserStatusBadge } from '../components/Badges'
import { Drawer } from '../components/Drawer'
import { Pagination } from '../components/Pagination'
import { useToast } from '../components/toast-context'
import { usePagination } from '../lib/pagination'
import { useAuth } from '../auth/auth-context'
import { assignableRoles } from '../auth/roles'
import { officerRoleColumnSupported } from '../data/sharepoint'
import { formatDate, initials } from '../lib/format'
import { userSchemeLabel } from '../lib/nominations'
import type { SystemUser, UserDraft, UserRole, UserStatus } from '../data/types'

type StatusFilter = 'All' | UserStatus

const statuses: UserStatus[] = ['Active', 'Disabled']
const roles: UserRole[] = assignableRoles

const emptyUserForm: UserDraft = {
  name: '',
  email: '',
  phone: '',
  role: 'Pension Adminstration',
  status: 'Active',
  schemeIds: [],
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

  const activeAdmins = users.filter(
    (user) => user.role === 'Adminstration' && user.status === 'Active',
  ).length
  const roleColumnMissing = officerRoleColumnSupported() === false
  const isLastActiveAdmin = (user: SystemUser) =>
    user.role === 'Adminstration' &&
    user.status === 'Active' &&
    activeAdmins <= 1

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
  const pagination = usePagination(filtered.length)

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
      role: user.role,
      status: user.status,
      schemeIds: user.schemeIds,
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

  const toggleScheme = (schemeId: string) => {
    setForm((current) => ({
      ...current,
      schemeIds: current.schemeIds.includes(schemeId)
        ? current.schemeIds.filter((id) => id !== schemeId)
        : [...current.schemeIds, schemeId],
    }))
  }

  const handleSave = async () => {
    const nextErrors: Record<string, string> = {}
    const name = form.name.trim()
    const email = form.email.trim()
    const phone = form.phone.trim()

    if (name.length < 3) {
      nextErrors.name = 'Enter the user’s full name.'
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
      role: form.role,
      status: form.status,
      schemeIds: [...new Set(form.schemeIds)],
    }

    setBusy(true)
    try {
      const result = editingId
        ? await updateUser(editingId, draft, profile.name)
        : await createUser(draft, profile.name)

      if (result.rolesSaved) {
        notify(
          'success',
          editingId ? 'User updated' : 'User created',
          editingId
            ? `${name}’s account was updated.`
            : `${name} was added to the workspace.`,
        )
      } else {
        notify(
          'warning',
          editingId ? 'User saved without role' : 'User created without role',
          'The SharePoint principalOfficers list did not save PrincipalOfficersRole. Confirm the column and refresh the Power Apps connector before assigning the role again.',
        )
      }
      closeDrawer()
    } catch (error) {
      notify(
        'error',
        'Unable to save user',
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

      {roleColumnMissing ? (
        <div className="notice is-danger" role="alert">
          <Icon name="alert-circle" size={14} className="notice-icon" />
          <span className="data-banner-text">
            The SharePoint <code>principalOfficers</code> list has no writable{' '}
            <code>PrincipalOfficersRole</code> column. Name, email, phone, status and scheme are
            saved, but workflow roles cannot be persisted until an admin exposes
            the existing role choice column in the Power Apps connector.
          </span>
        </div>
      ) : null}

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
              onChange={(event) => {
                setSearch(event.target.value)
                pagination.setPage(1)
              }}
              aria-label="Search users"
            />
          </div>
          <select
            className="filter-select"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter)
              pagination.setPage(1)
            }}
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
                        <th>Role</th>
                        <th>Schemes</th>
                        <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((user, index) => (
                  <tr
                    key={user.id}
                    className={`is-clickable${
                      pagination.isVisible(index) ? '' : ' is-page-hidden'
                    }`}
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
                    <td>{user.role}</td>
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
                            isLastActiveAdmin(user)
                              ? 'At least one active Admin must remain'
                              : user.status === 'Active'
                                ? 'Disable user'
                                : 'Enable user'
                          }
                          disabled={busy || isLastActiveAdmin(user)}
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
              Try a different search term or status, or create a new user.
            </p>
            <div className="empty-actions">
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => {
                  setSearch('')
                  setStatus('All')
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
          itemLabel="users"
        />
      </section>

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        eyebrow="User account"
        title={editingId ? 'Edit user' : 'Create user'}
        subtitle={
          editingId
            ? 'Update the scheme assignments or account status.'
            : 'Add a user with a workflow role to the PrincipalOfficers list.'
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
              <label className="label" htmlFor="user-role">
                Role
              </label>
              <select
                id="user-role"
                className="select"
                value={form.role}
                onChange={(event) =>
                  updateField('role', event.target.value as UserRole)
                }
              >
                {roles.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
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
            <span className="label">Scheme assignments</span>
            {schemes.length ? (
              <div
                className="checkbox-grid"
                role="group"
                aria-label="Scheme assignments"
              >
                {schemes
                  .filter(
                    (scheme) =>
                      scheme.status === 'Active' ||
                      form.schemeIds.includes(scheme.id),
                  )
                  .map((scheme) => {
                    const checked = form.schemeIds.includes(scheme.id)
                    const locked =
                      scheme.status === 'Disabled' && !checked
                    return (
                      <label
                        key={scheme.id}
                        className={`checkbox-option${locked ? ' is-disabled' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={busy || locked}
                          onChange={() => toggleScheme(scheme.id)}
                        />
                        <span>
                          {scheme.name}
                          {scheme.status === 'Disabled'
                            ? ' (Disabled)'
                            : ''}
                        </span>
                      </label>
                    )
                  })}
              </div>
            ) : (
              <p className="help">No schemes are available yet.</p>
            )}
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
