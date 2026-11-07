import type {
  NominationErrorStatus,
  NominationStatus,
  UserStatus,
} from '../data/types'

export function NominationStatusBadge({
  status,
}: {
  status: NominationStatus
}) {
  const tone =
    status === 'Approved'
      ? 'green'
      : status === 'Rejected'
        ? 'red'
        : status === 'Pending PA'
          ? 'blue'
          : status === 'Tasks' || status === 'Submitted'
            ? 'slate'
            : 'amber'

  return (
    <span className={`badge badge-${tone}`}>
      <span className="badge-dot" />
      {status}
    </span>
  )
}

export function ErrorStatusBadge({
  status,
}: {
  status: NominationErrorStatus | null
}) {
  const tone =
    status === 'Clear'
      ? 'green'
      : status === 'Missing Scheme'
        ? 'red'
        : status === 'Missing Principal Officer'
          ? 'blue'
          : status === 'Missing Information'
            ? 'amber'
            : 'slate'

  return (
    <span className={`badge badge-${tone}`}>
      <span className="badge-dot" />
      {status ?? 'Not set'}
    </span>
  )
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return (
    <span className={`badge badge-${status === 'Active' ? 'green' : 'slate'}`}>
      <span className="badge-dot" />
      {status}
    </span>
  )
}

export function AllocationBar({
  value,
  size = 'default',
}: {
  value: number
  size?: 'default' | 'sm'
}) {
  const clamped = Math.max(0, Math.min(100, value))
  const tone =
    clamped >= 100
      ? ''
      : clamped >= 50
        ? ' is-amber'
        : clamped > 0
          ? ' is-red'
          : ' is-slate'

  return (
    <div
      className={`progress${size === 'sm' ? ' progress-sm' : ''}`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${clamped}% allocated`}
    >
      <div className={`progress-bar${tone}`} style={{ width: `${clamped}%` }} />
    </div>
  )
}
