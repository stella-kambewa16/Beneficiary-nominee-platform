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
  PrincipalOfficersRoleChoice,
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
import {
  applyRecordedErrors,
  normalizeNominationErrorStatus,
} from '../lib/validation'

export type PrincipalOfficerRecord = PrincipalOfficersRead & {
  PrincipalOfficersRole?: string | PrincipalOfficersRoleChoice
}
type PrincipalOfficerWriteRecord = Omit<PrincipalOfficersWrite, 'ID'> & {
  PrincipalOfficersRole?: string | PrincipalOfficersRoleChoice
}

/* -------------------------------------------------------------------------- */
/* Field helpers                                                              */
/* -------------------------------------------------------------------------- */

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value && typeof value === 'object') {
    const fieldValue = value as Record<string, unknown>
    for (const key of ['Value', 'value', 'Label', 'label', 'Title', 'title']) {
      if (key in fieldValue && fieldValue[key] !== value) {
        const normalized = text(fieldValue[key])
        if (normalized) return normalized
      }
    }
  }
  return ''
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
 * The connector model predates the current list columns. Keep the current
 * SharePoint names and legacy aliases optional until the connector is refreshed.
 */
export type NominationRecord = NominationMembersRead & {
  errors?: unknown
  comments?: string
  Errors?: unknown
  Comments?: string
  '1stEndorserEmail'?: string
  OData__x0031_stEndorserEmail?: string
}

type NominationWriteRecord = Partial<Omit<NominationMembersWrite, 'ID'>> & {
  errors?: unknown
  comments?: string
  Errors?: unknown
  Comments?: string
  OData__x0031_stEndorserEmail?: string
}

type NominationLogicalField = 'errors' | 'comments' | 'endorser1Email'

/**
 * The connector schema and the live list disagree on the casing/prefix of a few
 * optional columns. Detect the names that are actually returned and use those
 * names for reads and writes.
 */
const nominationFieldCandidates: Record<NominationLogicalField, string[]> = {
  errors: ['errors', 'Errors'],
  comments: ['comments', 'Comments'],
  endorser1Email: [
    'OData__x0031_stEndorserEmail',
    '1stEndorserEmail',
    'OData__x0031_stEndorsementEmail',
  ],
}

const detectedNominationFields: Record<NominationLogicalField, string> = {
  errors: 'errors',
  comments: 'comments',
  endorser1Email: 'OData__x0031_stEndorserEmail',
}
let errorsChoiceTemplate: Record<string, unknown> | null = null

function hasOwnField(record: unknown, name: string): boolean {
  return (
    !!record &&
    typeof record === 'object' &&
    Object.prototype.hasOwnProperty.call(record, name)
  )
}

function detectNominationFields(records: NominationRecord[]): void {
  const fields = Object.keys(
    nominationFieldCandidates,
  ) as NominationLogicalField[]
  for (const field of fields) {
    const found = nominationFieldCandidates[field].find((candidate) =>
      records.some((record) => hasOwnField(record, candidate)),
    )
    if (found) detectedNominationFields[field] = found
  }
  const errorsField = detectedNominationFields.errors
  const choice = records
    .map((record) => (record as Record<string, unknown>)[errorsField])
    .find((value) => value !== undefined && value !== null)
  errorsChoiceTemplate =
    choice && typeof choice === 'object' && !Array.isArray(choice)
      ? { ...(choice as Record<string, unknown>) }
      : null
}

function noteNominationRecord(record: NominationRecord): void {
  detectNominationFields([record])
}

function nominationFieldValue(
  record: NominationRecord,
  field: NominationLogicalField,
): string {
  const names = [
    detectedNominationFields[field],
    ...nominationFieldCandidates[field],
  ]
  for (const name of new Set(names)) {
    const value = (record as Record<string, unknown>)[name]
    if (value !== undefined) return text(value)
  }
  return ''
}

/** Maps logical optional fields onto the live SharePoint column names. */
function nominationFieldPatch(
  values: Partial<Record<NominationLogicalField, string>>,
): NominationWriteRecord {
  const patch: NominationWriteRecord = {}
  for (const field of Object.keys(values) as NominationLogicalField[]) {
    const value = values[field]
    if (value === undefined) continue
    const writeValue =
      field === 'errors' && errorsChoiceTemplate
        ? { ...errorsChoiceTemplate, Value: value }
        : value
    ;(patch as Record<string, unknown>)[detectedNominationFields[field]] = writeValue
  }
  return patch
}

/* -------------------------------------------------------------------------- */
/* Status vocabulary                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Writes always use the canonical workflow labels. Legacy values are still read
 * and normalised, but new transitions use the validation-first vocabulary.
 */
function statusWriteValue(status: NominationStatus): string {
  return status
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
function normalizeEndorsementStatus(
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
  return /^(active|enabled|yes|true|1)$/.test(raw) ? 'Active' : 'Disabled'
}

function normalizeSchemeStatus(value: string | undefined): SchemeStatus {
  const raw = text(value).toLowerCase()
  if (!raw || raw === 'active') return 'Active'
  return 'Disabled'
}

/* -------------------------------------------------------------------------- */
/* Mappers                                                                    */
/* -------------------------------------------------------------------------- */

function findSchemeByLabel(
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
  record: PrincipalOfficerRecord,
  schemes: Scheme[],
): SystemUser {
  const schemeCode = text(record.schemecode)
  const schemeName = text(record.schemename)
  const schemeCodes = schemeCode.split(';').map(text).filter(Boolean)
  const schemeNames = schemeName.split(';').map(text).filter(Boolean)
  const schemeIds = [...new Set(
    [...schemeCodes, ...schemeNames]
      .map((label) => findSchemeByLabel(schemes, label)?.id)
      .filter((id): id is string => Boolean(id)),
  )]

  return {
    id: itemId(record.ID),
    name:
      text(record.fullname) ||
      text(record.Title) ||
      text(record.email) ||
      `Principal officer ${itemId(record.ID)}`,
    email: text(record.email),
    phone: text(record.contactno),
    role: normalizeUserRole(record.PrincipalOfficersRole),
    status: normalizeUserStatus(record.status),
    sourceStatus: text(record.status),
    schemeId: schemeIds[0] ?? null,
    schemeIds,
    schemeCode,
    schemeName,
    createdDate: dateOnly(record.Created),
  }
}

export function normalizeUserRole(value: unknown): UserRole {
  switch (text(value).toLowerCase()) {
    case 'principal officer':
    case 'principalofficer':
    case 'po':
      return 'Principal Officer'
    case 'pension administration':
    case 'pension adminstration':
    case 'pension administrator':
    case 'pension officer':
    case 'task manager':
    case 'taskmanager':
    case 'pensionadmin':
      return 'Pension Adminstration'
    case 'administration':
    case 'adminstration':
    case 'admin':
    case 'administrator':
    case 'system administrator':
      return 'Adminstration'
    case 'employee':
    default:
      return 'Employee'
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
    nominationFieldValue(record, 'endorser1Email')
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

  if (
    status === 'Rejected' ||
    (status === 'Pending PO' && secondEndorser && text(record.Warnings))
  ) {
    if (status === 'Pending PO' && firstEndorser) {
      history.push({
        id: `${nominationId}-endorsed`,
        stage: 'Principal Officer review',
        actor: firstEndorser,
        decision: 'Endorsed',
        date: decisionDate,
        comments: '',
      })
    }
    const rejectedAtSecondStage =
      status === 'Pending PO' ||
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

  if (status === 'Approved') {
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
  noteNominationRecord(record)
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
    homeTelephone: text(record.HomeTelephone),
    cellTelephone: text(record.CellTelephone),
    workTelephone: text(record.WorkTelephone),
    email: text(record.EmailAddress),
    schemeId: scheme?.id ?? '',
    schemeName: fundName || scheme?.name || '',
    fundName,
    submissionDate,
    status,
    sourceStatus,
    errorStatus: null,
    sourceErrors: nominationFieldValue(record, 'errors'),
    comments: nominationFieldValue(record, 'comments'),
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
    endorsement1Email: nominationFieldValue(record, 'endorser1Email'),
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

export async function fetchOfficerRecords(): Promise<
  PrincipalOfficerRecord[]
> {
  const records = await getAllPages(
    PrincipalOfficersService.getAll,
    'principalOfficers',
  )
  noteOfficerRecords(records)
  return records
}

export async function fetchSharePointSnapshot(): Promise<SharePointSnapshot> {
  const [schemeRecords, officerRecords, nominationRecords, nomineeRecords] =
    await Promise.all([
      getAllPages(SchemesService.getAll, 'schemes'),
      getAllPages(PrincipalOfficersService.getAll, 'principalOfficers'),
      getAllPages(NominationMembersService.getAll, 'Nomination Members'),
      getAllPages(NominationNomineesService.getAll, 'Nomination Nominees'),
    ])

  noteOfficerRecords(officerRecords)
  detectNominationFields(nominationRecords)

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

async function readSchemeRecord(
  id: string | undefined,
  fallback: SchemesRead,
): Promise<SchemesRead> {
  if (id === undefined || id === null || id === '') return fallback
  const result = await SchemesService.get(String(id))
  return result.success ? result.data : fallback
}

export async function createSchemeRecord(
  name: string,
): Promise<SchemesRead> {
  const record: Omit<SchemesWrite, 'ID'> = {
    Title: name,
    schemeName: name,
    'scheme-status': 'active',
  }
  const created = unwrap(
    await SchemesService.create(record),
    'SharePoint could not create the scheme.',
  )
  return readSchemeRecord(
    created.ID === undefined ? '' : String(created.ID),
    created,
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
  const updated = unwrap(
    await SchemesService.update(id, changed),
    'SharePoint could not update the scheme.',
  )
  return readSchemeRecord(
    updated.ID === undefined ? id : String(updated.ID),
    updated,
  )
}

export async function setSchemeStatusRecord(
  id: string,
  status: SchemeStatus,
): Promise<SchemesRead> {
  const updated = unwrap(
    await SchemesService.update(id, {
      'scheme-status': status === 'Active' ? 'active' : 'disable',
    }),
    'SharePoint could not update the scheme status.',
  )
  return readSchemeRecord(
    updated.ID === undefined ? id : String(updated.ID),
    updated,
  )
}

/* -------------------------------------------------------------------------- */
/* Principal officer writes                                                   */
/* -------------------------------------------------------------------------- */

export interface OfficerWrite {
  name: string
  email: string
  phone: string
  role: UserRole
  status: UserStatus
  schemes: Scheme[]
}

export interface OfficerWriteResult {
  record: PrincipalOfficerRecord
  /** False when the live list does not expose a writable role column. */
  rolesSaved: boolean
}

let rolesColumnSupported: boolean | null = null
let officerRoleChoiceTemplate: Record<string, unknown> | null = null

export function officerRoleColumnSupported(): boolean | null {
  return rolesColumnSupported
}

/** Remember whether the connected SharePoint list exposes its role field. */
function noteOfficerRecords(records: PrincipalOfficerRecord[]): void {
  if (records.length > 0) {
    rolesColumnSupported = records.some((record) =>
      hasOwnField(record, 'PrincipalOfficersRole'),
    )
    const choice = records
      .map((record) => record.PrincipalOfficersRole)
      .find(
        (value): value is PrincipalOfficersRoleChoice =>
          value !== undefined &&
          value !== null &&
          typeof value === 'object' &&
          !Array.isArray(value),
      )
    officerRoleChoiceTemplate = choice
      ? { ...choice }
      : null
  }
}

function officerFields(write: OfficerWrite): PrincipalOfficerWriteRecord {
  const schemeCodes = write.schemes
    .map((scheme) => scheme.title || scheme.name)
    .join('; ')
  const schemeNames = write.schemes
    .map((scheme) => scheme.schemeName || scheme.name)
    .join('; ')
  if (schemeCodes.length > 255 || schemeNames.length > 255) {
    throw new Error(
      'The selected scheme assignments exceed the SharePoint 255-character limit.',
    )
  }
  return {
    Title: write.name,
    fullname: write.name,
    email: write.email,
    contactno: write.phone,
    PrincipalOfficersRole: {
      ...officerRoleChoiceTemplate,
      Value: write.role,
    },
    status: write.status,
    schemecode: schemeCodes,
    schemename: schemeNames,
  }
}

function verifyOfficerSchemes(
  record: PrincipalOfficerRecord,
  schemes: Scheme[],
): void {
  const expected = new Set(schemes.map((scheme) => scheme.id))
  const saved = new Set(mapUser(record, schemes).schemeIds)
  if (
    expected.size !== saved.size ||
    [...expected].some((schemeId) => !saved.has(schemeId))
  ) {
    throw new Error(
      'SharePoint did not save all selected scheme assignments. Check the schemecode and schemename fields and try again.',
    )
  }
}

async function readOfficerRecord(
  id: string | undefined,
  fallback: PrincipalOfficersRead,
): Promise<PrincipalOfficerRecord> {
  if (id === undefined || id === null) return fallback
  const result = await PrincipalOfficersService.get(String(id))
  return result.success ? result.data : fallback
}

async function writeOfficerRecord(
  write: OfficerWrite,
  operation: () => Promise<IOperationResult<PrincipalOfficersRead>>,
  fallbackMessage: string,
): Promise<OfficerWriteResult> {
  const result = unwrap(await operation(), fallbackMessage)
  const record = await readOfficerRecord(
    result.ID === undefined ? '' : String(result.ID),
    result,
  )
  verifyOfficerSchemes(record, write.schemes)
  const rolesSaved =
    write.role === 'Employee' ||
    normalizeUserRole(record.PrincipalOfficersRole) === write.role
  rolesColumnSupported = rolesSaved
  return {
    record,
    rolesSaved,
  }
}

export async function createOfficerRecord(
  write: OfficerWrite,
): Promise<OfficerWriteResult> {
  return writeOfficerRecord(
    write,
    () => PrincipalOfficersService.create(officerFields(write)),
    'SharePoint could not create the principal officer.',
  )
}

export async function updateOfficerRecord(
  id: string,
  write: OfficerWrite,
): Promise<OfficerWriteResult> {
  return writeOfficerRecord(
    write,
    () => PrincipalOfficersService.update(id, officerFields(write)),
    'SharePoint could not update the principal officer.',
  )
}

export async function assignOfficerSchemes(
  id: string,
  schemes: Scheme[],
): Promise<PrincipalOfficersRead> {
  const schemeCodes = schemes.map((scheme) => scheme.title || scheme.name).join('; ')
  const schemeNames = schemes.map((scheme) => scheme.schemeName || scheme.name).join('; ')
  if (schemeCodes.length > 255 || schemeNames.length > 255) {
    throw new Error(
      'The selected scheme assignments exceed the SharePoint 255-character limit.',
    )
  }
  const changed: Partial<Omit<PrincipalOfficersWrite, 'ID'>> = {
    schemecode: schemeCodes,
    schemename: schemeNames,
  }
  const updated = unwrap(
    await PrincipalOfficersService.update(id, changed),
    'SharePoint could not assign the scheme to the principal officer.',
  )
  const record = await readOfficerRecord(
    updated.ID === undefined ? id : String(updated.ID),
    updated,
  )
  verifyOfficerSchemes(record, schemes)
  return record
}

export async function setOfficerStatus(
  id: string,
  status: UserStatus,
): Promise<PrincipalOfficersRead> {
  const updated = unwrap(
    await PrincipalOfficersService.update(id, { status }),
    'SharePoint could not update the principal officer status.',
  )
  return readOfficerRecord(
    updated.ID === undefined ? id : String(updated.ID),
    updated,
  )
}

/* -------------------------------------------------------------------------- */
/* Nomination writes                                                          */
/* -------------------------------------------------------------------------- */

export type DecisionStage = 'PO' | 'PA'

export interface NominationDecision {
  status: NominationStatus
  rejection?: boolean
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
    ...nominationFieldPatch({
      comments: appendComment(
        decision.previousComments,
        decision.actor,
        decision.actorRole,
        decision.comment,
      ),
      ...(decision.errors ? { errors: decision.errors } : {}),
    }),
  }

  if (decision.stage === 'PO') {
    changed.OData__x0031_stEndorseName = decision.actor
    Object.assign(
      changed,
      nominationFieldPatch({ endorser1Email: decision.actorEmail }),
    )
    if (decision.secondEndorser) {
      changed.OData__x0032_ndEndorseName = decision.secondEndorser.name
      changed.OData__x0032_ndEndorseEmail = decision.secondEndorser.email
    }
  } else {
    changed.OData__x0032_ndEndorseName = decision.actor
    changed.OData__x0032_ndEndorseEmail = decision.actorEmail
  }

  if (decision.status === 'Rejected' || decision.rejection) {
    // Keep the legacy field in sync while Comments becomes the primary record.
    changed.Warnings = decision.comment
  }

  const updated = unwrap(
    await NominationMembersService.update(id, changed),
    'SharePoint could not update the nomination.',
  )

  const saved = await getNominationRecord(id, updated)
  const savedStatus = normalizeEndorsementStatus(text(saved.endorseStatus))
  if (savedStatus !== decision.status) {
    throw new Error(
      `SharePoint did not save the nomination status. Expected "${statusWriteValue(decision.status)}", but the list returned "${text(saved.endorseStatus) || 'blank'}".`,
    )
  }

  return saved
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
  const errorsUpdated = unwrap(
    await NominationMembersService.update(
      id,
      nominationFieldPatch({ errors: payload.errors }),
    ),
    'SharePoint could not update the nomination Errors choice.',
  )
  const errorsRecord = await getNominationRecord(id, errorsUpdated)
  const savedErrors = normalizeNominationErrorStatus(
    nominationFieldValue(errorsRecord, 'errors'),
  )
  if (savedErrors !== payload.errors) {
    throw new Error(
      `SharePoint did not save the Errors choice. Expected "${payload.errors}", but the list returned "${nominationFieldValue(errorsRecord, 'errors') || 'blank'}". Check the Errors choice options and refresh the Power Apps connector.`,
    )
  }

  const changed: NominationWriteRecord = {
    endorseStatus: statusWriteValue(payload.status),
    ...nominationFieldPatch({
      comments: payload.comments,
    }),
  }

  if (payload.firstEndorser) {
    changed.OData__x0031_stEndorseName = payload.firstEndorser.name
    Object.assign(
      changed,
      nominationFieldPatch({ endorser1Email: payload.firstEndorser.email }),
    )
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
  if (correction.branchCode !== undefined) {
    changed.BranchCode = correction.branchCode
  }
  if (correction.costCentre !== undefined) {
    changed.CostCentre = correction.costCentre
  }
  if (correction.homeTelephone !== undefined) {
    changed.HomeTelephone = correction.homeTelephone
  }
  if (correction.cellTelephone !== undefined) {
    changed.CellTelephone = correction.cellTelephone
  }
  if (correction.workTelephone !== undefined) {
    changed.WorkTelephone = correction.workTelephone
  }
  if (correction.email !== undefined) changed.EmailAddress = correction.email
  if (comments !== undefined) {
    Object.assign(changed, nominationFieldPatch({ comments }))
  }

  const updated = unwrap(
    await NominationMembersService.update(id, changed),
    'SharePoint could not update the nomination details.',
  )

  const saved = await getNominationRecord(id, updated)
  if (
    correction.fundName !== undefined &&
    text(saved.FundName).toLowerCase() !== correction.fundName.trim().toLowerCase()
  ) {
    throw new Error(
      `SharePoint did not save the selected scheme to FundName. Expected "${correction.fundName}", but the list returned "${text(saved.FundName) || 'blank'}".`,
    )
  }

  return saved
}

export async function updateNominationComments(
  id: string,
  comments: string,
): Promise<NominationRecord> {
  const changed = nominationFieldPatch({ comments })
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

  const updated = unwrap(
    await NominationNomineesService.update(id, changed),
    'SharePoint could not update the beneficiary details.',
  )
  if (updated.ID === undefined || updated.ID === null) return updated
  const persisted = await NominationNomineesService.get(String(updated.ID))
  return persisted.success ? persisted.data : updated
}

async function getNominationRecord(
  id: string,
  fallback?: NominationMembersRead,
): Promise<NominationRecord> {
  const result = await NominationMembersService.get(id)
  if (result.success) {
    noteNominationRecord(result.data)
    return result.data
  }
  if (fallback && fallback.ID !== undefined) return fallback
  return unwrap(result, 'SharePoint could not read the updated nomination.')
}


