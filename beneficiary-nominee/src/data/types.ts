export type NominationStatus =
  | 'Submitted'
  | 'Tasks'
  | 'Pending PO'
  | 'Pending PA'
  | 'Approved'
  | 'Rejected'

export type NominationErrorStatus =
  | 'Missing Scheme'
  | 'Missing Principal Officer'
  | 'Missing Information'
  | 'Clear'

export type UserRole =
  | 'Employee'
  | 'Principal Officer'
  | 'Pension Adminstration'
  | 'Adminstration'

export type UserStatus = 'Active' | 'Disabled'
export type SchemeStatus = 'Active' | 'Disabled'

type ApprovalDecision = 'Submitted' | 'Endorsed' | 'Approved' | 'Rejected'

export type Relationship = string

export interface Scheme {
  id: string
  name: string
  title: string
  schemeName: string
  status: SchemeStatus
  sourceStatus: string
  createdDate: string
}

export interface SystemUser {
  id: string
  name: string
  email: string
  phone: string
  role: UserRole
  status: UserStatus
  /** Raw value read from the SharePoint `status` column. */
  sourceStatus: string
  schemeId: string | null
  schemeIds: string[]
  schemeCode: string
  schemeName: string
  createdDate: string
}

export interface ApprovalEvent {
  id: string
  stage: string
  actor: string
  decision: ApprovalDecision
  date: string
  comments: string
}

export interface Nomination {
  /** SharePoint item ID from Nomination Members. */
  id: string
  referenceNumber: string
  memberNumber: string
  memberName: string
  memberDob: string
  branchCode: string
  costCentre: string
  homeTelephone: string
  cellTelephone: string
  workTelephone: string
  email: string
  schemeId: string
  schemeName: string
  fundName: string
  submissionDate: string
  status: NominationStatus
  /** Raw value read from the SharePoint `endorseStatus` column. */
  sourceStatus: string
  /** Normalized directly from the SharePoint `Errors` column. */
  errorStatus: NominationErrorStatus | null
  /** Raw value read from the SharePoint `Errors` column, when present. */
  sourceErrors: string
  /** Append-only validation and endorsement audit trail. */
  comments: string
  warnings: string
  sourceFileName: string
  sourceFileUrl: string
  pdfDataUri: string
  nomineeCount: number
  totalCurrentPct: number
  totalRevisedPct: number
  formVersion: string
  approvalHistory: ApprovalEvent[]
  endorsement1Name: string
  endorsement1Email: string
  endorsement2Name: string
  endorsement2Email: string
  createdDate: string
  modifiedDate: string
}

export interface Beneficiary {
  id: string
  title: string
  memberNumber: string
  /** SharePoint lookup value from `Member#Id`, when present. */
  memberItemId: number | null
  rowNumber: number
  dateOfBirth: string
  relationship: Relationship
  identityNumber: string
  benefitCurrentPct: number
  benefitRevisedPct: number
  fundName: string
  refNumber: string
}

export interface ActivityItem {
  id: string
  action: string
  subject: string
  detail: string
  actor: string
  time: string
  referenceNumber: string
  nominationId?: string
}

export interface UserDraft {
  name: string
  email: string
  phone: string
  role: UserRole
  status: UserStatus
  schemeIds: string[]
}

/** Fields operations can correct while a nomination is in the Tasks queue. */
export interface NominationCorrection {
  fundName?: string
  memberNumber?: string
  memberName?: string
  memberDob?: string
  branchCode?: string
  costCentre?: string
  homeTelephone?: string
  cellTelephone?: string
  workTelephone?: string
  email?: string
}

/** Fields operations can correct on a linked beneficiary. */
export interface BeneficiaryCorrection {
  title?: string
  relationship?: string
  identityNumber?: string
  dateOfBirth?: string
  benefitRevisedPct?: number
}

export interface SchemeDraft {
  name: string
  principalOfficerId: string | null
}
