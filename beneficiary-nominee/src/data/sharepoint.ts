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
  BeneficiaryCorrection,
  Nomination,
  NominationCorrection,
  NominationErrorStatus,
  NominationStatus,
  Scheme,
  SchemeStatus,
  SystemUser,
  UserRole,
  UserStatus,
} from './types'
import { appendComment } from '../lib/comments'
import { applyRecordedErrors } from '../lib/validation'

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

/**
 * The generated connector model predates the new list columns. These
 * intersections keep the generated code untouched until it is regenerated;
 * both fields are optional so older records still map cleanly.
 */
export type NominationRecord = NominationMembersRead & {
  Errors?: string
  Comments?: string
}

type NominationWriteRecord = Partial<Omit<NominationMembersWrite, 'ID'>> & {
  Errors?: string
  Comments?: string
}

/* -------------------------------------------------------------------------- */
/* Status vocabulary                                                          */
/* -------------------------------------------------------------------------- */

const canonicalStatus: Record<NominationStatus, string> = {
  Submitted: 'Submitted',
  Tasks: 'Tasks',
  'Pending PO': 'Pending PO',
  'Pending PA': 'Pending PA',
  Approved: 'Approved',
  Rejected: 'Rejected',
}

/**
 * Always write the canonical workflow labels. Legacy values are still read and
 * normalised, but new transitions use the validation-first vocabulary.
 */
export function statusWriteValue(status: NominationStatus): string {
  return canonicalStatus[status]
}

const REJECTED = /(reject|declin|denied|not\s+(approved|endorsed))/i
const APPROVED = /(approved|approval|approve|complete|finalis|finaliz|accepted)/i
const PENDING = /(pending|await|in\s*progress|open)/i
const TASKS =
  /(\btask\b|validation|validated|data\s*quality|missing|error|correct|hold)/i
const SUBMITTED = /\b(submitted|new)\b/i
const PA = /(\bpa\b|\bpm\b|pension|administrator|manager|second|2nd|stage\s*2|final)/i
const PO = /(\bpo\b|principal|first|1st|stage\s*1)/i

/**
 * Maps the free-text `endorseStatus` value onto the validation-first workflow.
 * Unknown and blank values land in Tasks so a record is never silently treated
 * as ready for endorsement.
 */
export function normalizeEndorsementStatus(
  value: string | undefined,
): NominationStatus {
  const raw = text(value)
  if (!raw) return 'Tasks'
  if (REJECTED.test(raw)) return 'Rejected'
  if (TASKS.test(raw) || SUBMITTED.test(raw)) return 'Tasks'

  if (PENDING.test(raw)) {
    if (PA.test(raw) && !PO.test(raw)) return 'Pending PA'
    return 'Pending PO'
  }

  if (APPROVED.test(raw)) {
    // "PO approved" still needs the Pension Administrator; "PA approved" is final.
    if (PA.test(raw) || !PO.test(raw)) return 'Approved'
    return 'Pending PA'
  }

  if (/endors/i.test(raw)) {
    return PA.test(raw) ? 'Approved' : 'Pending PA'
  }

  if (PA.test(raw)) return 'Pending PA'
  if (PO.test(raw)) return 'Pending PO'
  return 'Tasks'
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
  record: NominationRecord,
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
      /(\bpa\b|\bpm\b|pension|administrator|manager|second|2nd)/i.test(
        text(record.endorseStatus),
      )
    history.push({
      id: `${nominationId}-rejected`,
      stage: rejectedAtSecondStage
        ? 'Pension Administrator review'
        : 'Principal Officer review',
      actor:
        (rejectedAtSecondStage ? secondEndorser : firstEndorser) ||
        (rejectedAtSecondStage
          ? 'Pension Administrator'
          : 'Principal Officer'),
      decision: 'Rejected',
      date: decisionDate,
      comments: text(record.Warnings) || 'Rejected in SharePoint.',
    })
    return history
  }

  if (firstEndorser || status === 'Pending PA' || status === 'Approved') {
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
      stage: 'Pension Administrator review',
      actor: secondEndorser || 'Pension Administrator',
      decision: 'Approved',
      date: decisionDate,
      comments: '',
    })
  }

  return history
}

export function mapNomination(
  record: NominationRecord,
  schemes: Scheme[],
  _users: SystemUser[],
  _beneficiaries: Beneficiary[],
): Nomination {
  void _users
  void _beneficiaries
  const fundName = text(record.FundName)
  const scheme = findSchemeByLabel(schemes, fundName)
  const sourceStatus = text(record.endorseStatus)
  const status = normalizeEndorsementStatus(sourceStatus)

  const created = text(record.Created)
  const modified = text(record.Modified)
  const submissionDate = dateOnly(created)

  const mapped: Nomination = {
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
    errorStatus: null,
    sourceErrors: text(record.Errors),
    comments: text(record.Comments),
    warnings: text(record.Warnings),
    sourceFileName: text(record.SourceFileName),
    sourceFileUrl: text(record.SourceFileUrl),
    pdfDataUri: text(record.PdfDataUri),
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

  return applyRecordedErrors(mapped)
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
  nominationRecords: NominationRecord[]
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

export type DecisionStage = 'PO' | 'PA'

export interface NominationDecision {
  status: NominationStatus
  stage: DecisionStage
  actor: string
  actorEmail: string
  actorRole: UserRole
  comment: string
  previousComments: string
  errors: NominationErrorStatus | null
  secondEndorser?: { name: string; email: string }
}

export async function writeNominationDecision(
  id: string,
  decision: NominationDecision,
): Promise<NominationRecord> {
  const changed: NominationWriteRecord = {
    endorseStatus: statusWriteValue(decision.status),
    Comments: appendComment(
      decision.previousComments,
      decision.actor,
      decision.actorRole,
      decision.comment,
    ),
  }

  if (decision.errors) changed.Errors = decision.errors

  if (decision.stage === 'PO') {
    changed.OData__x0031_stEndorseName = decision.actor
    changed.OData__x0031_stEndorsementEmail = decision.actorEmail
    if (decision.secondEndorser) {
      changed.OData__x0032_ndEndorseName = decision.secondEndorser.name
      changed.OData__x0032_ndEndorseEmail = decision.secondEndorser.email
    }
  } else {
    changed.OData__x0032_ndEndorseName = decision.actor
    changed.OData__x0032_ndEndorseEmail = decision.actorEmail
  }

  if (decision.status === 'Rejected') {
    // Keep the legacy field in sync while Comments becomes the primary record.
    changed.Warnings = decision.comment
  }

  const updated = unwrap(
    await NominationMembersService.update(id, changed),
    'SharePoint could not update the nomination.',
  )

  return await getNominationRecord(id, updated)
}

export interface NominationValidationWrite {
  status: NominationStatus
  errors: NominationErrorStatus
  comments: string
  firstEndorser?: { name: string; email: string }
  secondEndorser?: { name: string; email: string }
}

export async function writeNominationValidation(
  id: string,
  payload: NominationValidationWrite,
): Promise<NominationRecord> {
  const changed: NominationWriteRecord = {
    endorseStatus: statusWriteValue(payload.status),
    Errors: payload.errors,
    Comments: payload.comments,
  }

  if (payload.firstEndorser) {
    changed.OData__x0031_stEndorseName = payload.firstEndorser.name
    changed.OData__x0031_stEndorsementEmail = payload.firstEndorser.email
  }
  if (payload.secondEndorser) {
    changed.OData__x0032_ndEndorseName = payload.secondEndorser.name
    changed.OData__x0032_ndEndorseEmail = payload.secondEndorser.email
  }

  const updated = unwrap(
    await NominationMembersService.update(id, changed),
    'SharePoint could not update the nomination validation.',
  )

  return await getNominationRecord(id, updated)
}

export async function updateNominationRecord(
  id: string,
  correction: NominationCorrection,
  comments?: string,
): Promise<NominationRecord> {
  const changed: NominationWriteRecord = {}
  if (correction.fundName !== undefined) changed.FundName = correction.fundName
  if (correction.memberNumber !== undefined) {
    changed.MemberNumber = correction.memberNumber
  }
  if (correction.memberName !== undefined) changed.Title = correction.memberName
  if (correction.memberDob !== undefined) {
    changed.DateOfBirth = correction.memberDob
  }
  if (correction.email !== undefined) changed.EmailAddress = correction.email
  if (comments !== undefined) changed.Comments = comments

  const updated = unwrap(
    await NominationMembersService.update(id, changed),
    'SharePoint could not update the nomination details.',
  )

  return await getNominationRecord(id, updated)
}

export async function updateNominationComments(
  id: string,
  comments: string,
): Promise<NominationRecord> {
  const changed: NominationWriteRecord = { Comments: comments }
  const updated = unwrap(
    await NominationMembersService.update(id, changed),
    'SharePoint could not update the nomination comments.',
  )
  return await getNominationRecord(id, updated)
}

export async function updateNomineeRecord(
  id: string,
  correction: BeneficiaryCorrection,
): Promise<NominationNomineesRead> {
  const changed: Partial<Omit<NominationNomineesWrite, 'ID'>> = {}
  if (correction.title !== undefined) changed.Title = correction.title
  if (correction.relationship !== undefined) {
    changed.Relationship = correction.relationship
  }
  if (correction.identityNumber !== undefined) {
    changed.IdentityNumber = correction.identityNumber
  }
  if (correction.dateOfBirth !== undefined) {
    changed.DateOfBirth = correction.dateOfBirth
  }
  if (correction.benefitRevisedPct !== undefined) {
    changed.BenefitRevisedPct = correction.benefitRevisedPct
  }

  return unwrap(
    await NominationNomineesService.update(id, changed),
    'SharePoint could not update the beneficiary details.',
  )
}

export async function getNominationRecord(
  id: string,
  fallback?: NominationMembersRead,
): Promise<NominationRecord> {
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
