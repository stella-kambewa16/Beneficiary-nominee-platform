export type NominationStatus =
  | 'Pending PO Approval'
  | 'Pending PM Approval'
  | 'Approved'
  | 'Rejected'

export type UserRole = 'Admin' | 'Principal Officer' | 'Pension Manager'

export type UserStatus = 'Active' | 'Disabled'
export type SchemeStatus = 'Active' | 'Disabled'

export type ApprovalDecision = 'Submitted' | 'Endorsed' | 'Approved' | 'Rejected'

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
  /** Every record in principalOfficers is treated as a Principal Officer. */
  role: 'Principal Officer'
  status: UserStatus
  /** Raw value read from the SharePoint `status` column. */
  sourceStatus: string
  schemeId: string | null
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
  email: string
  schemeId: string
  schemeName: string
  fundName: string
  submissionDate: string
  status: NominationStatus
  /** Raw value read from the SharePoint `endorseStatus` column. */
  sourceStatus: string
  warnings: string
  sourceFileName: string
  sourceFileUrl: string
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
  status: UserStatus
  schemeId: string | null
}

export interface SchemeDraft {
  name: string
  principalOfficerId: string | null
}
