import type { ClientSendHtmlMessage } from '../generated/models/Office365OutlookModel'
import type { Nomination, SystemUser } from '../data/types'

export type NominationActionStage = 'PO' | 'PA'

function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

function attachmentFor(nomination: Nomination): {
  Name: string
  ContentBytes: string
} {
  const dataUri = nomination.pdfDataUri.trim()
  const comma = dataUri.indexOf(',')
  if (
    comma < 0 ||
    !/^data:application\/pdf(?:;[^;,]+)*;base64$/i.test(
      dataUri.slice(0, comma),
    )
  ) {
    throw new Error(
      'The nomination PDF preview is unavailable as base64 data, so it cannot be attached to the email.',
    )
  }

  const contentBytes = dataUri.slice(comma + 1).replace(/\s/g, '')
  if (!contentBytes || !/^[A-Za-z0-9+/]*={0,2}$/.test(contentBytes)) {
    throw new Error('The nomination PDF attachment data is invalid.')
  }

  const reference = nomination.referenceNumber || nomination.id
  const sourceName = nomination.sourceFileName.trim()
  const baseName = (sourceName || `Beneficiary-Nomination-${reference}`)
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\.pdf$/i, '')

  return {
    Name: `${baseName || 'Beneficiary-Nomination'}.pdf`,
    ContentBytes: contentBytes,
  }
}

function actionUrl(stage: NominationActionStage, nominationId: string): string {
  const url = new URL(window.location.pathname, window.location.origin)
  const route = stage === 'PO' ? 'pending-po' : 'pending-pa'
  url.hash = `/${route}?nomination=${encodeURIComponent(nominationId)}`
  return url.toString()
}

export function prepareNominationStageEmail(
  stage: NominationActionStage,
  nomination: Nomination,
  recipient: SystemUser,
  users: SystemUser[],
): ClientSendHtmlMessage {
  const recipientEmail = recipient.email.trim()
  if (!isEmailAddress(recipientEmail)) {
    throw new Error(
      `The assigned ${stage === 'PO' ? 'Principal Officer' : 'Pension Administrator'} does not have a valid email address.`,
    )
  }
  if (!recipient.id.trim()) {
    throw new Error('The assigned endorser has no SharePoint reference code.')
  }

  const reference = nomination.referenceNumber || nomination.id
  const action = stage === 'PO' ? 'endorsement' : 'approval'
  const verb = stage === 'PO' ? 'endorse' : 'approve'
  const url = actionUrl(stage, nomination.id)
  const cc = [
    ...new Set(
      users
        .filter(
          (user) =>
            user.role === 'Adminstration' &&
            user.status === 'Active' &&
            isEmailAddress(user.email.trim()) &&
            user.email.trim().toLowerCase() !== recipientEmail.toLowerCase(),
        )
        .map((user) => user.email.trim()),
    ),
  ]

  return {
    To: recipientEmail,
    ...(cc.length ? { Cc: cc.join(';') } : {}),
    Subject: `Beneficiary Nomination ${reference} pending your ${action}`,
    Body: [
      `<p>Good day ${escapeHtml(recipient.name || recipientEmail)},</p>`,
      `<p>Please find attached Beneficiary Nomination Form pending your ${action}. To ${verb} the form, please follow the link and use the details below:</p>`,
      `<p><a href="${escapeHtml(url)}">Open Beneficiary Nomination</a></p>`,
      `<p><strong>${stage === 'PO' ? 'Endorsement' : 'Approval'} details</strong></p>`,
      `<p>Beneficiary Nomination Reference number: ${escapeHtml(reference)}</p>`,
      `<p>Endorser Reference code: ${escapeHtml(recipient.id)}</p>`,
      `<p>Endorser Email: <a href="mailto:${escapeHtml(recipientEmail)}">${escapeHtml(recipientEmail)}</a></p>`,
      '<p>Kind regards<br>Old Mutual</p>',
    ].join(''),
    Attachments: [attachmentFor(nomination)],
  }
}

export async function sendNominationStageEmail(
  email: ClientSendHtmlMessage,
): Promise<void> {
  const { Office365OutlookService } = await import(
    '../generated/services/Office365OutlookService'
  )
  const result = await Office365OutlookService.SendEmailV2(email)
  if (!result.success) {
    throw result.error ?? new Error('Outlook did not send the notification email.')
  }
}
