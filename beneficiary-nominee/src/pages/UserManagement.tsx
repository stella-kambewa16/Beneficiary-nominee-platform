import { useState } from 'react'
import { useData } from '../data/context'
import { Icon } from '../components/Icon'
import { RoleBadge, UserStatusBadge } from '../components/Badges'
import { Drawer } from '../components/Drawer'
import { useToast } from '../components/toast-context'
import { useAuth } from '../auth/auth-context'
import { formatDate, initials } from '../lib/format'
import { userSchemeLabel } from '../lib/nominations'
import type {
  SystemUser,
  UserDraft,
  UserRole,
  UserStatus,
} from '../data/types'

type RoleFilter = 'All' | UserRole
type StatusFilter = 'All' | UserStatus

const roles: UserRole[] = ['Admin', 'Principal Officer', 'Pension Manager']
const statuses: UserStatus[] = ['Active', 'Disabled']

const emptyUserForm: UserDraft = {
  name: '',
  email: '',
  phone: '',
  role: 'Principal Officer',
  schemeId: null,
  status: 'Active',
}

function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function UserManagementPage() {
  const { users, schemes, createUser, updateUser, toggleUserStatus } = useData()
  const { notify } = useToast()
  const { profile } = useAuth()

  const [search, setSearch] = useState('')
  const [role, setRole] = useState<RoleFilter>('All')
  const [status, setStatus] = useState<StatusFilter>('All')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<UserDraft>({ ...emptyUserForm })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const query = search.trim().toLowerCase()
  const filtered = users.filter((user) => {
    const matchesSearch =
      !query ||
      [user.name, user.email, userSchemeLabel(user, schemes)]
        .join(' ')
        .toLowerCase()
        .includes(query)
    const matchesRole = role === 'All' || user.role === role
    const matchesStatus = status === 'All' || user.status === status
    return matchesSearch && matchesRole && matchesStatus
  })

  const countByRole = (target: UserRole) =>
    users.filter((user) => user.role === target).length

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
      schemeId: user.schemeId,
      status: user.status,
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

  const updateRole = (nextRole: UserRole) => {
    setForm((current) => ({
      ...current,
      role: nextRole,
      schemeId:
        nextRole === 'Principal Officer' ? current.schemeId : null,
    }))
    setErrors((current) => {
      if (!current.role && !current.schemeId) return current
      const next = { ...current }
      delete next.role
      delete next.schemeId
      return next
    })
  }

  const handleSave = () => {
    const nextErrors: Record<string, string> = {}
    const name = form.name.trim()
    const email = form.email.trim()
    const phone = form.phone.trim()

    if (name.length < 3) {
      nextErrors.name = 'Enter the user’s full name.'
    }
    if (!validateEmail(email)) {
      nextErrors.email = 'Enter a valid email address.'
    }
    const duplicate = users.some(
      (user) =>
        user.id !== editingId &&
        user.email.toLowerCase() === email.toLowerCase(),
    )
    if (duplicate) {
      nextErrors.email = 'This email address is already registered.'
    }
    if (form.role === 'Principal Officer' && !form.schemeId) {
      nextErrors.schemeId = 'Assign a scheme to this principal officer.'
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
      schemeId: form.role === 'Principal Officer' ? form.schemeId : null,
      status: form.status,
    }

    if (editingId) {
      updateUser(editingId, draft, profile.name)
      notify('success', 'User updated', `${name}’s account was updated.`)
    } else {
      createUser(draft, profile.name)
      notify('success', 'User created', `${name} was added to the workspace.`)
    }
    closeDrawer()
  }

  const handleToggle = (user: SystemUser) => {
    const nextStatus = user.status === 'Active' ? 'disabled' : 'enabled'
    toggleUserStatus(user.id, profile.name)
    notify(
      'success',
      `User ${nextStatus}`,
      `${user.name} was ${nextStatus} for the workspace.`,
    )
  }

  return (
    <div className="page-stack">
      <section className="hero">
        <div className="hero-main">
          <span className="hero-eyebrow">
            <Icon name="user-check" size={13} />
            Administration
          </span>
          <h1 className="hero-title">User management</h1>
          <p className="hero-text">
            Create system users, assign their role and scheme access, and
            disable accounts that should no longer access the workspace.
          </p>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={openCreate}
          >
            <Icon name="plus" size={15} />
            Create user
          </button>
        </div>
      </section>

      <section className="stat-grid" aria-label="User figures">
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-blue">
              <Icon name="users" size={17} />
            </span>
            <span className="stat-context">Accounts</span>
          </div>
          <p className="stat-value">{users.length}</p>
          <p className="stat-label">Total users</p>
          <p className="stat-hint">
            <Icon name="check-circle" size={12} />
            {users.filter((user) => user.status === 'Active').length} active
          </p>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-green">
              <Icon name="shield" size={17} />
            </span>
            <span className="stat-context">Role</span>
          </div>
          <p className="stat-value">{countByRole('Admin')}</p>
          <p className="stat-label">Administrators</p>
          <p className="stat-hint">
            <Icon name="lock" size={12} />
            Full workspace access
          </p>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-amber">
              <Icon name="user-check" size={17} />
            </span>
            <span className="stat-context">Role</span>
          </div>
          <p className="stat-value">{countByRole('Principal Officer')}</p>
          <p className="stat-label">Principal officers</p>
          <p className="stat-hint">
            <Icon name="send" size={12} />
            First-stage endorsements
          </p>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon is-blue">
              <Icon name="briefcase" size={17} />
            </span>
            <span className="stat-context">Role</span>
          </div>
          <p className="stat-value">{countByRole('Pension Manager')}</p>
          <p className="stat-label">Pension managers</p>
          <p className="stat-hint">
            <Icon name="check" size={12} />
            Final approvals
          </p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="panel-heading">
            <h2 className="panel-title">System users</h2>
            <p className="panel-subtitle">
              Search by name, email or scheme, then edit or disable an account.
            </p>
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
            value={role}
            onChange={(event) => setRole(event.target.value as RoleFilter)}
            aria-label="Filter by role"
          >
            <option value="All">All roles</option>
            {roles.map((item) => (
              <option key={item} value={item}>
                {item}
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
                    <td>
                      <RoleBadge role={user.role} />
                    </td>
                    <td>{userSchemeLabel(user, schemes)}</td>
                    <td>
                      <UserStatusBadge status={user.status} />
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
                          onClick={(event) => {
                            event.stopPropagation()
                            handleToggle(user)
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
              Try a different search term, role or status, or create a new user
              account.
            </p>
            <div className="empty-actions">
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => {
                  setSearch('')
                  setRole('All')
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
        eyebrow="User account"
        title={editingId ? 'Edit user' : 'Create user'}
        subtitle={
          editingId
            ? 'Update the role, scheme access or account status.'
            : 'Add a new principal officer, pension manager or administrator.'
        }
        footer={
          <>
            <button
              type="button"
              className="button button-secondary"
              onClick={closeDrawer}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={handleSave}
            >
              <Icon name="check" size={14} />
              {editingId ? 'Save changes' : 'Create user'}
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
                  updateRole(event.target.value as UserRole)
                }
              >
                {roles.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field-row">
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
            {form.role === 'Principal Officer' ? (
              <div className="field">
                <label className="label" htmlFor="user-scheme">
                  Scheme
                </label>
                <select
                  id="user-scheme"
                  className={`select${errors.schemeId ? ' is-error' : ''}`}
                  value={form.schemeId ?? ''}
                  onChange={(event) =>
                    updateField(
                      'schemeId',
                      event.target.value ? event.target.value : null,
                    )
                  }
                >
                  <option value="">Select a scheme</option>
                  {schemes.map((scheme) => (
                    <option key={scheme.id} value={scheme.id}>
                      {scheme.name}
                    </option>
                  ))}
                </select>
                {errors.schemeId ? (
                  <p className="error-text">
                    <Icon name="alert-circle" size={12} />
                    {errors.schemeId}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="notice is-info">
                <Icon name="info" size={14} className="notice-icon" />
                <span>
                  {form.role === 'Admin'
                    ? 'Administrators can access every scheme.'
                    : 'Pension managers can review nominations across every scheme.'}
                </span>
              </div>
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
