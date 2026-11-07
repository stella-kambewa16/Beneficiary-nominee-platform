# Beneficiary Nominee

A beneficiary nomination workspace for Mthunzi Funeral Services, built with React 19, TypeScript and Vite as a **Power Apps Code App**. SharePoint is the database: schemes, principal officers, nominations and nominees are read from and written to the `bnf` site through the SharePoint connector. The Office 365 Outlook connector sends workflow action emails.

## Data source

The app is connected to:

`https://uapgroup.sharepoint.com/sites/bnf`

| App entity | SharePoint list | Generated service |
| --- | --- | --- |
| Schemes | `schemes` | `SchemesService` |
| Principal officers | `principalOfficers` | `PrincipalOfficersService` |
| Nominations | `Nomination Members` | `NominationMembersService` |
| Beneficiaries | `Nomination Nominees` | `NominationNomineesService` |
| Workflow email | Office 365 Outlook | `Office365OutlookService` |

Connector services and models are generated under `src/generated`. The connection mapping is stored in `power.config.json`, and all SharePoint reads/writes are centralised in `src/data/sharepoint.ts`.

## Run locally

Connector calls only work inside the Power Apps host. Running plain `vite` shows a clear error instead of falling back to sample data.

```bash
npm install
npm start
```

Then open the **Local Play URL** printed by the CLI. Sign in with an account that can access the `bnf` site; the SharePoint connection is resolved by the Power Apps host.

```bash
npm run build    # type-check and production build
npm run lint     # ESLint
npm run deploy   # build and push the app to Power Apps
```

## Included screens

- **Dashboard** — centralized nomination, validation, approval, beneficiary, member, allocation, active/disabled scheme and Principal Officer KPIs, plus a validation queue summary, recent nominations and activity. The queue shows open task volume, error breakdown, newest/oldest task age and a shortcut to Tasks.
- **Tasks** — Pension Adminstration/Adminstration validation queue. New and returned nominations stay here until the SharePoint `errors` value is `Clear`. Review findings, correct scheme/member/beneficiary records in the corresponding lists, record comments, and move cleared nominations to **Pending PO**.
- **Pending PO / Pending PA** — separate endorsement queues. Principal Officers review assigned schemes in Pending PO; Pension Adminstration users handle Pending PA. Legacy Pension Adminstration accounts can still act at both stages.
- **Active Members / Active Beneficiaries** — approved nominations and the beneficiaries linked to them.
- **Beneficiaries** — nominee register linked back to its nomination reference, member and allocation share. View details, search for a beneficiary, or export the current view.
- **Reports** — Nominations by Scheme, Validation Summary, Validation Tasks, Pending Approvals, Approved Nominations, Beneficiary Register and Principal Officer Activity. Filter by date range, scheme and status, then export to Excel (CSV) or print to PDF.
- **User Management** — Adminstration-only creation, editing and disabling of `principalOfficers` records, including Principal Officer, Pension Adminstration and Adminstration roles. Every role can be assigned to multiple schemes using checkboxes.
- **Scheme Management** — Adminstration-only creation and editing of `schemes` records, including the assigned Principal Officer.

The sidebar groups the first five screens under **Workspace** and the two administration screens under **Administration**.

## Entity model

The UI is aligned to the four real lists and their columns:

- `schemes` — `ID`, `Title`, `schemeName`, `scheme-status`, `Created`, `Modified`. `scheme-status` stores `active` or `disable`; legacy blank values are treated as active.
- `principalOfficers` — `Title`, `fullname`, `email`, `contactno`, `status`, `physicaladdress`, `postaladdress`, `schemecode`, `schemename`, `PrincipalOfficersRole`, `Created`, `Modified`.
- `Nomination Members` (nominations) — `MemberNumber`, `FundName`, `DateOfBirth`, `BranchCode`, `CostCentre`, `EmailAddress`, `NomineeCount`, `TotalCurrentPct`, `TotalRevisedPct`, `FormVersion`, `Warnings`, `SourceFile*`, `refNumber`, `endorseStatus`, `Errors`, `Comments`, first/second endorser names and emails, `Created`, `Modified`.
- `Nomination Nominees` (beneficiaries) — `ID`, `Title`, `Member#Id`, `MemberNumber`, `RowNumber`, `DateOfBirth`, `Relationship`, `IdentityNumber`, `BenefitCurrentPct`, `BenefitRevisedPct`, `FundName`, `refNumber`, `Created`, `Modified`.

`refNumber` links a nominee to its nomination member. When the lookup is present, `Nomination Nominees.Member#Id` is also used as a fallback match to `Nomination Members.ID`.

## Statuses, validation and derived history

The workflow is **validation-first**:

```text
New / blank / Submitted ──► Tasks ──► Pending PO ──► Pending PA ──► Approved
                              ▲            │             │
                              └────────────┴─────────────┘
                       remains in Tasks until SharePoint `errors` is Clear
```

- **Tasks** — Pension Adminstration reviews/corrects the nomination; it cannot be promoted until the SharePoint `errors` value is `Clear`.
- **Pending PO** — `errors = Clear`; the assigned First Endorser reviews it.
- **Pending PA** — the First Endorser has endorsed it; the assigned Second Endorser reviews it.
- **Approved** — both endorsement stages are complete.
- **Rejected** — the exception path at either pending stage; a written reason is required.

When a nomination enters **Pending PO**, an email is sent to the active Principal Officer assigned to its scheme. After endorsement, an email is sent to the active Pension Adminstration user assigned to that scheme. Active Adminstration users are copied on both messages. Each email links directly to the nomination and attaches the PDF preview from `PdfDataUri`; the responsible user’s SharePoint item ID is included as the endorser reference code. The stage change is saved before the email is sent, and a delivery error reports that the status changed but the email failed. Demo mode does not send emails.

The in-app form preview renders PDF pages to canvases with PDF.js instead of embedding a PDF frame. The PDF.js worker is imported statically so the preview keeps working under the published Power Apps host CSP.

`Errors` is a separate gate from the workflow status: **Missing Scheme**, **Missing Principal Officer**, **Missing Information** or **Clear**. Validation precedence is Scheme → Principal Officer → Information, but every finding is recorded so an operator can resolve a nomination in one pass. A nomination cannot be endorsed unless `Errors = Clear`.

`endorseStatus` is a free-text SharePoint column, not a choice column. Legacy values (`Pending PO Approval`, `Pending PM Approval`) are normalised on read to `Pending PO` / `Pending PA`; missing, blank or unrecognised values default to `Tasks`, never `Pending PO`. New writes use the canonical labels. The raw value remains visible as **Source status** so unexpected live values are not hidden.

The SharePoint `comments` column records validation notes, corrections, promotions, endorsements and rejection reasons. The app appends timestamped actor/role entries; SharePoint list version history should also be enabled for durable change tracking. The legacy `Warnings` field is still updated with a rejection reason because older records and views may rely on it.

There is no approval-history list. The drawer's approval history and the dashboard/report activity feed are derived from the endorsement fields (`endorseStatus`, endorser names/emails) and the record timestamps, plus in-session actions.

Updating a nominee's revised percentage writes only `BenefitRevisedPct`, preserving the existing `BenefitCurrentPct`. Corrections also append a `comments` entry to the parent nomination.

## Roles and workflow

The app resolves the signed-in Power Apps identity against an active `principalOfficers` row and reads its `PrincipalOfficersRole`. Missing, unknown or disabled assignments receive read-only **Employee** access; duplicate active rows fail closed. Role preview is development-only (`VITE_ENABLE_ROLE_PREVIEW=true`) and is always disabled in production builds.

| Capability | Employee | Pension Adminstration | Adminstration |
| --- | --- | --- | --- |
| View dashboard | Yes | Yes | Yes |
| View reports and approved registers | No | Yes | Yes |
| Review and correct Tasks | No | Yes | Yes |
| Endorse Pending PO and Pending PA | No | Assigned endorser | Override |
| Manage users/roles and schemes | No | No | Yes |

`PrincipalOfficersRole` is assigned one of the two SharePoint choices: **Pension Adminstration** or **Adminstration**. Employee is the implicit no-role state and is not stored. Pension Adminstration users are scheme-scoped for Pending PO and approved records; Pending PA actions require the email recorded as Second Endorser. The two endorsement stages must be handled by different users. Seed the first Adminstration user directly in SharePoint before app-based role management is available.

**Security boundary:** React route and mutation guards improve usability but are not server-side authorization. Restrict write access to `principalOfficers` to administrators (other app users need read access to resolve roles), enable SharePoint list version history, and enforce stage ownership for nomination writes in a trusted Power Automate flow or equivalent server-side component. Do not rely on hidden menus or client checks to prevent direct SharePoint writes.

## Real-column limitations

The SharePoint lists do not contain every field an earlier prototype assumed. The UI deliberately reflects the real columns instead of inventing them:

- Schemes have no description column. Scheme Management edits `Title` / `schemeName` and updates the `scheme-status` field to enable or disable a scheme.
- `principalOfficers.PrincipalOfficersRole` is the role source of truth; unrecognized or missing roles map to Employee.
- User creation includes Principal Officer, Pension Adminstration and Adminstration roles. Scheme assignments are stored through `schemecode` / `schemename`; multiple assignments are separated by semicolons in those text fields.
- Principal Officer status uses the real `status` text column; only recognized active values grant an active account.
- The generated `NominationMembersModel.ts` does not yet expose `Errors` and `Comments`. The SharePoint adapter uses typed record intersections for those columns without editing generated code; regenerate the connector model if the columns are added to the data source schema.
- There is no dedicated rejection-reason or activity-history column; `Comments` is the audit trail and `Warnings` mirrors rejection reasons for compatibility.
- There is no nomination-creation screen in this app. Records created in SharePoint (or blank statuses) are treated as **Tasks** and must pass validation before endorsement.

## Design system

The UI follows `DESIGN_SYSTEM.md`: Inter-first system typography, green Mthunzi palette, no top navigation bar, a collapsible sidebar (desktop icon rail + mobile drawer), responsive layouts down to 320px, and reusable card, table, form and toast patterns. Print styles support report PDF output through the browser print dialog.

## Project structure

```
src/
  auth/         roles, permissions, AuthProvider and useAuth
  components/   Layout, Icon, Drawer, Badges, Toast, RoleMenu, AccessDenied
  data/         types, SharePoint adapter, async DataProvider/context
  generated/    Power Apps connector services and models
  lib/          formatting, exports, scoping, validation,
                comments and derived helpers
  pages/        Dashboard, Tasks, BeneficiaryNominations, Beneficiaries,
                Reports, UserManagement, SchemeManagement
  styles/       design tokens and component styles
  navigation.ts role-aware navigation
  router.tsx    lightweight hash router
.power/         generated connector schemas
power.config.json  environment and SharePoint data-source mapping
```

## Behaviour notes

- Data loads asynchronously from SharePoint. A banner shows initial loading, refresh progress, or a read error with a **Retry** action.
- In Power Apps, navigation and actions follow the role read from `PrincipalOfficersRole`; role preview is development-only.
- Principal Officers see nominations for their assigned schemes and can endorse/reject Pending PO nominations assigned to them.
- Pension Adminstration users see Tasks, nominations for their assigned schemes, and Pending PA items assigned to them.
- New and invalid nominations appear in **Tasks**; Pension Adminstration/Adminstration can correct, re-evaluate and promote them.
- Promotion from Tasks requires the SharePoint `errors` field to be `Clear` and assigns the scheme's active Principal Officer as First Endorser (falling back to a legacy Pension Adminstration assignment).
- PO endorsement assigns a different active Pension Adminstration user as Second Endorser and moves the nomination to **Pending PA**; only that assignee may act at PA stage. Adminstration may override either stage.
- Rejecting a nomination requires a written reason, appends it to `Comments` and mirrors it to `Warnings`.
- Excel exports download CSV files; PDF export opens the browser print dialog.
- Legacy paths (`/policies`, `/nominees`, `/nominations/new`, `/activity`, `/access`) redirect to their new equivalents.
- Sign-out is handled by the Power Apps host; closing the Local Play tab ends the session.
