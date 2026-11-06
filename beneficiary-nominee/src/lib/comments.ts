import type { UserRole } from '../data/types'
import { roleLabel } from '../auth/roles'
import { formatDateTime } from './format'

/**
 * Appends an entry to the free-text Comments column. Existing content is never
 * removed, which keeps the column usable as an audit trail.
 */
export function appendComment(
  existing: string,
  actor: string,
  role: UserRole,
  message: string,
): string {
  const entry = `[${formatDateTime(new Date().toISOString())}] ${actor} (${roleLabel(
    role,
  )}): ${message.trim()}`
  const current = existing.trim()
  return current ? `${current}\n${entry}` : entry
}

export function appendSystemComment(existing: string, message: string): string {
  const entry = `[${formatDateTime(new Date().toISOString())}] Workflow automation: ${message.trim()}`
  const current = existing.trim()
  return current ? `${current}\n${entry}` : entry
}

export function commentLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}
