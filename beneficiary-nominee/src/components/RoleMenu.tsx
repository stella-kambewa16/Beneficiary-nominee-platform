import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useToast } from './toast-context'
import { useAuth } from '../auth/auth-context'
import { roleOrder, roleProfiles } from '../auth/roles'

export function RoleMenu() {
  const { role, profile, setRole } = useAuth()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointer = (event: MouseEvent) => {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)

    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const selectRole = (next: typeof role) => {
    setOpen(false)
    if (next === role) return
    setRole(next)
    notify(
      'info',
      `Viewing as ${next}`,
      roleProfiles[next].description,
    )
  }

  return (
    <div className="user-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="user-menu-button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Signed in as ${profile.name}, ${profile.title}. Switch role`}
      >
        <span className="avatar-sm" aria-hidden="true">
          {profile.initials}
        </span>
        <span className="user-menu-profile-meta">
          <span className="user-menu-profile-name">{profile.name}</span>
          <span className="user-menu-profile-role">{profile.title}</span>
        </span>
        <Icon name="chevron-down" size={14} className="user-menu-chevron" />
      </button>

      {open ? (
        <div className="user-menu" role="menu" aria-label="Switch demo role">
          <div className="user-menu-head">
            <p className="user-menu-label">Signed in as</p>
            <p className="user-menu-current">{profile.name}</p>
            <p className="user-menu-email">{profile.email}</p>
          </div>

          <p className="user-menu-label user-menu-switch-label">
            Switch demo role
          </p>

          {roleOrder.map((option) => {
            const optionProfile = roleProfiles[option]
            const active = option === role
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={`role-option${active ? ' is-active' : ''}`}
                onClick={() => selectRole(option)}
              >
                <span className="role-avatar" aria-hidden="true">
                  {optionProfile.initials}
                </span>
                <span className="role-option-copy">
                  <span className="role-option-name">{option}</span>
                  <span className="role-option-desc">
                    {optionProfile.description}
                  </span>
                </span>
                {active ? (
                  <Icon
                    name="check"
                    size={15}
                    className="role-option-check"
                  />
                ) : null}
              </button>
            )
          })}

          <p className="user-menu-note">
            Demo only — role changes apply instantly and are stored in this
            browser.
          </p>
        </div>
      ) : null}
    </div>
  )
}
