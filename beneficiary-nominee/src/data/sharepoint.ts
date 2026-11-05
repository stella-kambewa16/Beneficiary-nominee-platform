import type { IOperationResult } from '@microsoft/power-apps/data'
import {
  NominationMembersService,
  NominationNomineesService,
  PrincipalOfficersService,
  SchemesService,
} from '../generated'
import type { IGetAllOptions } from '../generated/models/CommonModels'
import type {
  NominationMembersRead,
  NominationMembersWrite,
} from '../generated/models/NominationMembersModel'
import type {
  NominationNomineesRead,
  NominationNomineesWrite,
} from '../generated/models/NominationNomineesModel'
import type {
  PrincipalOfficersRead,
  PrincipalOfficersWrite,
} from '../generated/models/PrincipalOfficersModel'
import type {
  SchemesRead,
  SchemesWrite,
} from '../generated/models/SchemesModel'
import type {
  Beneficiary,
  Nomination,
  NominationStatus,
  Scheme,
  SchemeStatus,
  SystemUser,
  UserStatus,
} from './types'

/* -------------------------------------------------------------------------- */
/* Field helpers                                                              */
/* -------------------------------------------------------------------------- */

function text(value: string | undefined): string {
  return value?.trim() ?? ''
}

function numberValue(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function itemId(value: number | undefined): string {
  return value === undefined || value === null ? '' : String(value)
}

function dateOnly(value: string | undefined): string {
  const raw = text(value)
  if (!raw) return ''
  return raw.slice(0, 10)
}

/* -------------------------------------------------------------------------- */
/* Status vocabulary                                                          */
/* -------------------------------------------------------------------------- */

const canonicalStatus: Record<NominationStatus, string> = {
  'Pending PO Approval': 'Pending PO Approval',
  'Pending PM Approval': 'Pending PM Approval',
  Approved: 'Approved',
  Rejected: 'Rejected',
}

let observedStatusTokens: Partial<Record<NominationStatus, string>> = {}

/**
 * `endorseStatus` is free text in SharePoint, so the live vocabulary is
 * learned from the records that are actually returned. Writes reuse an
 * observed token when one is available and fall back to the canonical label
 * otherwise.
 */
export function resetStatusVocabulary(): void {
  observedStatusTokens = {}
}

export function rememberStatusToken(raw: string | undefined): void {
  const value = text(raw)
  if (!value) return
  const status = normalizeEndorsementStatus(value)
  if (!observedStatusTokens[status]) {
    observedStatusTokens[status] = value
  }
}

export function statusWriteValue(status: NominationStatus): string {
  return observedStatusTokens[status] ?? canonicalStatus[status]
}

const REJECTED = /(reject|declin|return|denied|not\s+(approved|endorsed))/i
const APPROVED = /(approved|approval|approve|complete|finalis|finaliz|accepted)/i
const PENDING = /(pending|await|in\s*progress|submitted|new|open)/i
const PM = /(\bpm\b|pension|manager|second|2nd|stage\s*2|final)/i
const PO = /(\bpo\b|principal|first|1st|stage\s*1)/i

/**
 * Maps the free-text `endorseStatus` value onto the two-stage workflow.
 * Anything that cannot be recognised stays at the first stage so a record is
 * never silently treated as complete.
 */
export function normalizeEndorsementStatus(
  value: string | undefined,
): NominationStatus {
  const raw = text(value)
  if (!raw) return 'Pending PO Approval'
  if (REJECTED.test(raw)) return 'Rejected'

  if (PENDING.test(raw)) {
    if (PM.test(raw) && !PO.test(raw)) return 'Pending PM Approval'
    return 'Pending PO Approval'
  }

  if (APPROVED.test(raw)) {
    // "PO approved" still needs the pension manager; "PM approved" is final.
    if (PM.test(raw) || !PO.test(raw)) return 'Approved'
    return 'Pending PM Approval'
  }

  if (/endors/i.test(raw)) {
    return PM.test(raw) ? 'Approved' : 'Pending PM Approval'
  }

  if (PM.test(raw)) return 'Pending PM Approval'
  return 'Pending PO Approval'
}

export function normalizeUserStatus(value: string | undefined): UserStatus {
  const raw = text(value).toLowerCase()
  if (!raw) return 'Active'
  if (/(inactive|disabled?|suspend|blocked|false|^no$|^0$)/.test(raw)) {
    return 'Disabled'
  }
  return 'Active'
}

export function normalizeSchemeStatus(value: string | undefined): SchemeStatus {
  const raw = text(value).toLowerCase()
  if (!raw || raw === 'active') return 'Active'
  return 'Disabled'
}

/* -------------------------------------------------------------------------- */
/* Mappers                                                                    */
/* -------------------------------------------------------------------------- */

export function findSchemeByLabel(
  schemes: Scheme[],
  label: string,
): Scheme | undefined {
  const needle = label.trim().toLowerCase()
  if (!needle) return undefined
  return schemes.find((scheme) =>
    [scheme.title, scheme.schemeName, scheme.name].some(
      (value) => value.trim().toLowerCase() === needle,
    ),
  )
}

export function mapScheme(record: SchemesRead): Scheme {
  const title = text(record.Title)
  const schemeName = text(record.schemeName)
  const sourceStatus = text(record['scheme-status'])
  return {
    id: itemId(record.ID),
    name: schemeName || title || `Scheme ${itemId(record.ID)}`,
    title,
    schemeName,
    status: normalizeSchemeStatus(sourceStatus),
    sourceStatus,
    createdDate: dateOnly(record.Created),
  }
}

export function mapUser(
  record: PrincipalOfficersRead,
  schemes: Scheme[],
): SystemUser {
  const schemeCode = text(record.schemecode)
  const schemeName = text(record.schemename)
  const scheme =
    findSchemeByLabel(schemes, schemeCode) ??
    findSchemeByLabel(schemes, schemeName)

  return {
    id: itemId(record.ID),
    name:
      text(record.fullname) ||
      text(record.Title) ||
      text(record.email) ||
      `Principal officer ${itemId(record.ID)}`,
    email: text(record.email),
    phone: text(record.contactno),
    role: 'Principal Officer',
    status: normalizeUserStatus(record.status),
    sourceStatus: text(record.status),
    schemeId: scheme?.id ?? null,
    schemeCode: schemeCode || scheme?.title || '',
    schemeName: schemeName || scheme?.name || '',
    createdDate: dateOnly(record.Created),
  }
}

function buildApprovalHistory(
  record: NominationMembersRead,
  status: NominationStatus,
  submissionDate: string,
): Nomination['approvalHistory'] {
  const nominationId = itemId(record.ID)
  const firstEndorser =
    text(record.OData__x0031_stEndorseName) ||
    text(record.OData__x0031_stEndorsementEmail)
  const secondEndorser =
    text(record.OData__x0032_ndEndorseName) ||
    text(record.OData__x0032_ndEndorseEmail)
  const decisionDate = dateOnly(record.Modified) || submissionDate
  const history: Nomination['approvalHistory'] = [
    {
      id: `${nominationId}-submitted`,
      stage: 'Submission',
      actor: 'Employee self-service',
      decision: 'Submitted',
      date: submissionDate,
      comments: text(record.FormVersion)
        ? `Submitted using form ${text(record.FormVersion)}.`
        : '',
    },
  ]

  if (status === 'Rejected') {
    const rejectedAtSecondStage =
      Boolean(secondEndorser) ||
      /(\bpm\b|pension|manager|second|2nd)/i.test(text(record.endorseStatus))
    history.push({
      id: `${nominationId}-rejected`,
      stage: rejectedAtSecondStage
        ? 'Pension Manager review'
        : 'Principal Officer review',
      actor:
        (rejectedAtSecondStage ? secondEndorser : firstEndorser) ||
        (rejectedAtSecondStage ? 'Pension Manager' : 'Principal Officer'),
      decision: 'Rejected',
      date: decisionDate,
      comments: text(record.Warnings) || 'Rejected in SharePoint.',
    })
    return history
  }

  if (
    firstEndorser ||
    status === 'Pending PM Approval' ||
    status === 'Approved'
  ) {
    history.push({
      id: `${nominationId}-endorsed`,
      stage: 'Principal Officer review',
      actor: firstEndorser || 'Principal Officer',
      decision: 'Endorsed',
      date: decisionDate,
      comments: '',
    })
  }

  if (secondEndorser || status === 'Approved') {
    history.push({
      id: `${nominationId}-approved`,
      stage: 'Pension Manager review',
      actor: secondEndorser || 'Pension Manager',
      decision: 'Approved',
      date: decisionDate,
      comments: '',
    })
  }

  return history
}

export function mapNomination(
  record: NominationMembersRead,
  schemes: Scheme[],
): Nomination {
  const fundName = text(record.FundName)
  const scheme = findSchemeByLabel(schemes, fundName)
  const sourceStatus = text(record.endorseStatus)
  const status = normalizeEndorsementStatus(sourceStatus)
  rememberStatusToken(sourceStatus)

  const created = text(record.Created)
  const modified = text(record.Modified)
  const submissionDate = dateOnly(created)

  return {
    id: itemId(record.ID),
    referenceNumber: text(record.refNumber),
    memberNumber: text(record.MemberNumber),
    memberName:
      text(record.Title) ||
      text(record.MemberNumber) ||
      `Member ${itemId(record.ID)}`,
    memberDob: dateOnly(record.DateOfBirth),
    branchCode: text(record.BranchCode),
    costCentre: text(record.CostCentre),
    email: text(record.EmailAddress),
    schemeId: scheme?.id ?? '',
    schemeName: fundName || scheme?.name || '',
    fundName,
    submissionDate,
    status,
    sourceStatus,
    warnings: text(record.Warnings),
    sourceFileName: text(record.SourceFileName),
    sourceFileUrl: text(record.SourceFileUrl),
    nomineeCount: numberValue(record.NomineeCount),
    totalCurrentPct: numberValue(record.TotalCurrentPct),
    totalRevisedPct: numberValue(record.TotalRevisedPct),
    formVersion: text(record.FormVersion),
    approvalHistory: buildApprovalHistory(record, status, submissionDate),
    endorsement1Name: text(record.OData__x0031_stEndorseName),
    endorsement1Email: text(record.OData__x0031_stEndorsementEmail),
    endorsement2Name: text(record.OData__x0032_ndEndorseName),
    endorsement2Email: text(record.OData__x0032_ndEndorseEmail),
    createdDate: dateOnly(created),
    modifiedDate: dateOnly(modified),
  }
}

export function mapBeneficiary(record: NominationNomineesRead): Beneficiary {
  return {
    id: itemId(record.ID),
    title: text(record.Title),
    memberNumber: text(record.MemberNumber),
    memberItemId:
      typeof record['Member#Id'] === 'number' ? record['Member#Id'] : null,
    rowNumber: numberValue(record.RowNumber),
    dateOfBirth: dateOnly(record.DateOfBirth),
    relationship: text(record.Relationship),
    identityNumber: text(record.IdentityNumber),
    benefitCurrentPct: numberValue(record.BenefitCurrentPct),
    benefitRevisedPct: numberValue(record.BenefitRevisedPct),
    fundName: text(record.FundName),
    refNumber: text(record.refNumber),
  }
}

/* -------------------------------------------------------------------------- */
/* Connection helpers                                                         */
/* -------------------------------------------------------------------------- */

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error
  if (typeof error === 'string' && error.trim()) return new Error(error)
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) {
      return new Error(message)
    }
  }
  return new Error(fallback)
}

function unwrap<T>(
  result: IOperationResult<T>,
  fallback: string,
): T {
  if (!result.success) {
    throw toError(result.error, fallback)
  }
  return result.data
}

async function getAllPages<T>(
  fetchPage: (
    options: IGetAllOptions,
  ) => Promise<IOperationResult<T[]>>,
  listName: string,
): Promise<T[]> {
  const records: T[] = []
  const seenTokens = new Set<string>()
  let skipToken: string | undefined

  for (let page = 0; page < 1000; page += 1) {
    const result = await fetchPage(skipToken ? { skipToken } : {})
    const data = unwrap(
      result,
      `SharePoint did not return the ${listName} list.`,
    )
    records.push(...(data ?? []))

    const nextToken = result.skipToken?.trim()
    if (!nextToken) return records
    if (seenTokens.has(nextToken)) {
      throw new Error(
        `SharePoint returned a repeated page token while reading ${listName}.`,
      )
    }
    seenTokens.add(nextToken)
    skipToken = nextToken
  }

  throw new Error(`Reading ${listName} exceeded the paging limit.`)
}

export interface SharePointSnapshot {
  schemeRecords: SchemesRead[]
  officerRecords: PrincipalOfficersRead[]
  nominationRecords: NominationMembersRead[]
  nomineeRecords: NominationNomineesRead[]
}

export async function fetchSharePointSnapshot(): Promise<SharePointSnapshot> {
  const [schemeRecords, officerRecords, nominationRecords, nomineeRecords] =
    await Promise.all([
      getAllPages(SchemesService.getAll, 'schemes'),
      getAllPages(PrincipalOfficersService.getAll, 'principalOfficers'),
      getAllPages(NominationMembersService.getAll, 'Nomination Members'),
      getAllPages(NominationNomineesService.getAll, 'Nomination Nominees'),
    ])

  return {
    schemeRecords,
    officerRecords,
    nominationRecords,
    nomineeRecords,
  }
}

/* -------------------------------------------------------------------------- */
/* Scheme writes                                                              */
/* -------------------------------------------------------------------------- */

export async function createSchemeRecord(
  name: string,
): Promise<SchemesRead> {
  const record: Omit<SchemesWrite, 'ID'> = {
    Title: name,
    schemeName: name,
    'scheme-status': 'active',
  }
  return unwrap(
    await SchemesService.create(record),
    'SharePoint could not create the scheme.',
  )
}

export async function updateSchemeRecord(
  id: string,
  name: string,
): Promise<SchemesRead> {
  const changed: Partial<Omit<SchemesWrite, 'ID'>> = {
    Title: name,
    schemeName: name,
  }
  return unwrap(
    await SchemesService.update(id, changed),
    'SharePoint could not update the scheme.',
  )
}

export async function setSchemeStatusRecord(
  id: string,
  status: SchemeStatus,
): Promise<SchemesRead> {
  return unwrap(
    await SchemesService.update(id, {
      'scheme-status': status === 'Active' ? 'active' : 'disable',
    }),
    'SharePoint could not update the scheme status.',
  )
}

/* -------------------------------------------------------------------------- */
/* Principal officer writes                                                   */
/* -------------------------------------------------------------------------- */

export interface OfficerWrite {
  name: string
  email: string
  phone: string
  status: UserStatus
  scheme: Scheme | null
}

function officerFields(write: OfficerWrite): Omit<PrincipalOfficersWrite, 'ID'> {
  return {
    Title: write.name,
    fullname: write.name,
    email: write.email,
    contactno: write.phone,
    status: write.status,
    schemecode: write.scheme?.title || write.scheme?.name || '',
    schemename: write.scheme?.schemeName || write.scheme?.name || '',
  }
}

export async function createOfficerRecord(
  write: OfficerWrite,
): Promise<PrincipalOfficersRead> {
  return unwrap(
    await PrincipalOfficersService.create(officerFields(write)),
    'SharePoint could not create the principal officer.',
  )
}

export async function updateOfficerRecord(
  id: string,
  write: OfficerWrite,
): Promise<PrincipalOfficersRead> {
  return unwrap(
    await PrincipalOfficersService.update(id, officerFields(write)),
    'SharePoint could not update the principal officer.',
  )
}

export async function assignOfficerScheme(
  id: string,
  scheme: Scheme,
): Promise<PrincipalOfficersRead> {
  const changed: Partial<Omit<PrincipalOfficersWrite, 'ID'>> = {
    schemecode: scheme.title || scheme.name,
    schemename: scheme.schemeName || scheme.name,
  }
  return unwrap(
    await PrincipalOfficersService.update(id, changed),
    'SharePoint could not assign the scheme to the principal officer.',
  )
}

export async function setOfficerStatus(
  id: string,
  status: UserStatus,
): Promise<PrincipalOfficersRead> {
  return unwrap(
    await PrincipalOfficersService.update(id, { status }),
    'SharePoint could not update the principal officer status.',
  )
}

/* -------------------------------------------------------------------------- */
/* Nomination writes                                                          */
/* -------------------------------------------------------------------------- */

export type DecisionStage = 'PO' | 'PM'

export interface NominationDecision {
  status: NominationStatus
  stage: DecisionStage
  actor: string
  actorEmail: string
  comment: string
}

export async function writeNominationDecision(
  id: string,
  decision: NominationDecision,
): Promise<NominationMembersRead> {
  const changed: Partial<Omit<NominationMembersWrite, 'ID'>> = {
    endorseStatus: statusWriteValue(decision.status),
  }

  if (decision.stage === 'PO') {
    changed.OData__x0031_stEndorseName = decision.actor
    changed.OData__x0031_stEndorsementEmail = decision.actorEmail
  } else {
    changed.OData__x0032_ndEndorseName = decision.actor
    changed.OData__x0032_ndEndorseEmail = decision.actorEmail
  }

  if (decision.status === 'Rejected') {
    // There is no dedicated rejection-reason column, so the reason is kept in
    // the real `Warnings` field.
    changed.Warnings = decision.comment
  }

  const updated = unwrap(
    await NominationMembersService.update(id, changed),
    'SharePoint could not update the nomination.',
  )

  return await getNominationRecord(id, updated)
}

export async function getNominationRecord(
  id: string,
  fallback?: NominationMembersRead,
): Promise<NominationMembersRead> {
  if (fallback && fallback.ID !== undefined) return fallback
  return unwrap(
    await NominationMembersService.get(id),
    'SharePoint could not read the updated nomination.',
  )
}

/**
 * Updates only the revised percentage. `BenefitCurrentPct` is deliberately
 * left out of the payload so SharePoint preserves the current allocation.
 */
export async function updateNomineeRevisedPct(
  id: string,
  benefitRevisedPct: number,
): Promise<NominationNomineesRead> {
  const changed: Partial<Omit<NominationNomineesWrite, 'ID'>> = {
    BenefitRevisedPct: benefitRevisedPct,
  }
  return unwrap(
    await NominationNomineesService.update(id, changed),
    'SharePoint could not update the beneficiary allocation.',
  )
}
