export type NominationStatus =
  | 'Pending PO Approval'
  | 'Pending PM Approval'
  | 'Approved'
  | 'Rejected'

export type SchemeStatus = 'Active' | 'Inactive'

export type UserRole = 'Admin' | 'Principal Officer' | 'Pension Manager'

export type UserStatus = 'Active' | 'Disabled'

export type ApprovalDecision = 'Submitted' | 'Endorsed' | 'Approved' | 'Rejected'

export type Relationship =
  | 'Spouse'
  | 'Child'
  | 'Parent'
  | 'Sibling'
  | 'Extended family'
  | 'Other'

export interface Scheme {
  id: string
  name: string
  description: string
  status: SchemeStatus
  createdDate: string
}

export interface SystemUser {
  id: string
  name: string
  email: string
  phone: string
  role: UserRole
  schemeId: string | null
  status: UserStatus
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
  referenceNumber: string
  memberNumber: string
  memberName: string
  memberDob: string
  branchCode: string
  costCentre: string
  email: string
  schemeId: string
  schemeName: string
  submissionDate: string
  status: NominationStatus
  sourceFileName: string
  sourceFileUrl: string
  nomineeCount: number
  approvalHistory: ApprovalEvent[]
}

export interface Beneficiary {
  id: string
  title: string
  memberNumber: string
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
}

export interface UserDraft {
  name: string
  email: string
  phone: string
  role: UserRole
  schemeId: string | null
  status: UserStatus
}

export interface SchemeDraft {
  name: string
  description: string
  principalOfficerId: string | null
  status: SchemeStatus
}
