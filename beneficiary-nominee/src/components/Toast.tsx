import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { ToastContext } from './toast-context'
import type { ToastKind } from './toast-context'

interface ToastItem {
  id: number
  kind: ToastKind
  title: string
  message?: string
}

const toastIcons: Record<ToastKind, IconName> = {
  success: 'check-circle',
  error: 'alert-circle',
  warning: 'alert-circle',
  info: 'info',
}

let toastSequence = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<number[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    (kind: ToastKind, title: string, message?: string) => {
      toastSequence += 1
      const id = toastSequence
      setToasts((current) => [...current, { id, kind, title, message }])
      const timer = window.setTimeout(() => dismiss(id), 4500)
      timers.current.push(timer)
    },
    [dismiss],
  )

  useEffect(() => {
    const activeTimers = timers.current
    return () => {
      activeTimers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" role="region" aria-label="Notifications">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast is-${toast.kind}`} role="status">
            <span className="toast-icon">
              <Icon name={toastIcons[toast.kind]} size={15} />
            </span>
            <div className="toast-copy">
              <p className="toast-title">{toast.title}</p>
              {toast.message ? (
                <p className="toast-message">{toast.message}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <Icon name="x" size={14} />
            </button>
            <span className="toast-progress" aria-hidden="true" />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
