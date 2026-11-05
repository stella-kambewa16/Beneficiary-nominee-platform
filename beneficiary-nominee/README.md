# Beneficiary Nominee

A beneficiary nomination workspace for Mthunzi Funeral Services, built with React 19, TypeScript and Vite as a **Power Apps Code App**. SharePoint is the database: schemes, principal officers, nominations and nominees are read from and written to the `bnf` site through the SharePoint connector.

## Data source

The app is connected to:

`https://uapgroup.sharepoint.com/sites/bnf`

| App entity | SharePoint list | Generated service |
| --- | --- | --- |
| Schemes | `schemes` | `SchemesService` |
| Principal officers | `principalOfficers` | `PrincipalOfficersService` |
| Nominations | `Nomination Members` | `NominationMembersService` |
| Beneficiaries | `Nomination Nominees` | `NominationNomineesService` |

Connector services and models are generated under `src/generated`. The connection mapping is stored in `power.config.json`, and all SharePoint reads/writes are centralised in `src/data/sharepoint.ts`.

## Run locally

Connector calls only work inside the Power Apps host. Running plain `vite` shows a clear error instead of falling back to sample data.

```bash
npm install
npx -y --package @microsoft/power-apps-cli pa app run
```

Then open the **Local Play URL** printed by the CLI. Sign in with an account that can access the `bnf` site; the SharePoint connection is resolved by the Power Apps host.

```bash
npm run build   # type-check and production build
npm run lint    # ESLint
```

## Included screens

- **Dashboard** — centralized nomination, validation, approval, beneficiary, member, allocation, active/disabled scheme and Principal Officer KPIs, plus a validation queue summary, recent nominations and activity. The queue shows open task volume, error breakdown, newest/oldest task age and a shortcut to Tasks.
- **Tasks** — Admin-only validation queue. New and returned nominations stay here until `Errors` is `Clear`. Review the validation findings, correct the scheme, member details or beneficiary records, re-evaluate, and then move a cleared nomination to **Beneficiary Nominations**. The drawer keeps the full append-only `Comments` audit trail and record details.
- **Beneficiary Nominations** — endorsement register for nominations with `Errors = Clear`. Search and filter by status, scheme or member; the table includes reference, member, scheme, nominee count, status, `Errors`, First Endorser, Second Endorser, latest comment and submission date. Open a record to see member details, beneficiaries, allocation, validation findings, comments, derived approval history and the supporting form. Approve or reject from the register or drawer.
- **Beneficiaries** — nominee register linked back to its nomination reference, member and allocation share. View details, search for a beneficiary, or export the current view.
- **Reports** — Nominations by Scheme, Validation Summary, Validation Tasks, Pending Approvals, Approved Nominations, Beneficiary Register and Principal Officer Activity. Filter by date range, scheme and status, then export to Excel (CSV) or print to PDF.
- **User Management** — Admin-only creation, editing and disabling of `principalOfficers` records, including scheme assignment.
- **Scheme Management** — Admin-only creation and editing of `schemes` records, including the assigned Principal Officer.

The sidebar groups the first five screens under **Workspace** and the two administration screens under **Administration**.

## Entity model

The UI is aligned to the four real lists and their columns:

- `schemes` — `ID`, `Title`, `schemeName`, `scheme-status`, `Created`, `Modified`. `scheme-status` stores `active` or `disable`; legacy blank values are treated as active.
- `principalOfficers` — `Title`, `fullname`, `email`, `contactno`, `status`, `physicaladdress`, `postaladdress`, `schemecode`, `schemename`, `Created`, `Modified`. Every record is treated as a **Principal Officer**.
- `Nomination Members` (nominations) — `MemberNumber`, `FundName`, `DateOfBirth`, `BranchCode`, `CostCentre`, `EmailAddress`, `NomineeCount`, `TotalCurrentPct`, `TotalRevisedPct`, `FormVersion`, `Warnings`, `SourceFile*`, `refNumber`, `endorseStatus`, `Errors`, `Comments`, first/second endorser names and emails, `Created`, `Modified`.
- `Nomination Nominees` (beneficiaries) — `ID`, `Title`, `Member#Id`, `MemberNumber`, `RowNumber`, `DateOfBirth`, `Relationship`, `IdentityNumber`, `BenefitCurrentPct`, `BenefitRevisedPct`, `FundName`, `refNumber`, `Created`, `Modified`.

`refNumber` links a nominee to its nomination member. When the lookup is present, `Nomination Nominees.Member#Id` is also used as a fallback match to `Nomination Members.ID`.

## Statuses, validation and derived history

The workflow is **validation-first**:

```text
New / blank / Submitted ──► Tasks ──► Pending PO ──► Pending PA ──► Approved
                              ▲            │             │
                              └────────────┴─────────────┘
                           returned when Errors is not Clear
```

- **Tasks** — the nomination is incomplete or unassigned and cannot be endorsed.
- **Pending PO** — `Errors = Clear`; the First Endorser (Principal Officer) reviews it.
- **Pending PA** — the Principal Officer has endorsed it; the Second Endorser (Pension Administrator) reviews it.
- **Approved** — both endorsement stages are complete.
- **Rejected** — the exception path at either pending stage; a written reason is required.

`Errors` is a separate gate from the workflow status: **Missing Scheme**, **Missing Principal Officer**, **Missing Information** or **Clear**. Validation precedence is Scheme → Principal Officer → Information, but every finding is recorded so an operator can resolve a nomination in one pass. A nomination cannot be endorsed unless `Errors = Clear`.

`endorseStatus` is a free-text SharePoint column, not a choice column. Legacy values (`Pending PO Approval`, `Pending PM Approval`) are normalised on read to `Pending PO` / `Pending PA`; missing, blank or unrecognised values default to `Tasks`, never `Pending PO`. New writes use the canonical labels. The raw value remains visible as **Source status** so unexpected live values are not hidden.

`Comments` is an append-only audit trail. Validation findings, corrections, promotions, endorsements and rejection reasons are appended with a timestamp, actor and role. The legacy `Warnings` field is still updated with a rejection reason because older records and views may rely on it.

There is no approval-history list. The drawer's approval history and the dashboard/report activity feed are derived from the endorsement fields (`endorseStatus`, endorser names/emails) and the record timestamps, plus in-session actions.

Updating a nominee's revised percentage writes only `BenefitRevisedPct`, preserving the existing `BenefitCurrentPct`. Corrections also append a `Comments` entry to the parent nomination.

## Roles and workflow

Roles are switched from the user menu in the top-right corner. This switcher is a UI simulation for demonstrating the workflow; it is **not** an authentication or security boundary. Access is ultimately controlled by SharePoint permissions for the signed-in account.

| Capability | Admin | Principal Officer | Pension Administrator |
| --- | --- | --- | --- |
| View dashboard, beneficiaries and reports | Yes | Yes | Yes |
| View and action the Tasks validation queue | Yes | No | No |
| Correct nomination or beneficiary data | Yes | No | No |
| Promote a cleared nomination to Beneficiary Nominations | Yes | No | No |
| Endorse Pending PO nominations | Yes | Yes (own scheme) | No |
| Endorse Pending PA nominations | Yes | No | Yes |
| Reject a nomination (reason required) | Yes | Yes (own scheme) | Yes |
| Manage users and schemes (`/users`, `/schemes`) | Yes | No | No |

- **Admin** — full access, including validation, both endorsement stages and administration.
- **Principal Officer** — sees nominations for the scheme assigned to their `principalOfficers` record and endorses the first stage.
- **Pension Administrator** — provides final endorsement across the scheme book. The internal role key remains `Pension Manager` for compatibility with the existing role switcher.
- There is no separate Pension Administrator list in SharePoint, so the Second Endorser defaults to the configured Pension Administrator profile (`Nyasha Banda`).

Restricted routes render an access-restricted state, and endorsement actions are hidden when the active role cannot act on the current stage or when `Errors` is not `Clear`.

## Real-column limitations

The SharePoint lists do not contain every field an earlier prototype assumed. The UI deliberately reflects the real columns instead of inventing them:

- Schemes have no description column. Scheme Management edits `Title` / `schemeName` and updates the `scheme-status` field to enable or disable a scheme.
- `principalOfficers` has no role column, so every record is a Principal Officer.
- User creation does not offer a role selector, and scheme assignment is stored through `schemecode` / `schemename`.
- Principal Officer status uses the real `status` text column; blank values are treated as active.
- The generated `NominationMembersModel.ts` does not yet expose `Errors` and `Comments`. The SharePoint adapter uses typed record intersections for those columns without editing generated code; regenerate the connector model if the columns are added to the data source schema.
- There is no dedicated rejection-reason or activity-history column; `Comments` is the audit trail and `Warnings` mirrors rejection reasons for compatibility.
- There is no nomination-creation screen in this app. Records created in SharePoint (or blank statuses) are treated as **Tasks** and must pass validation before endorsement.

## Design system

The UI follows `DESIGN_SYSTEM.md`: Inter typography, green Mthunzi palette, no top navigation bar, a collapsible sidebar (desktop icon rail + mobile drawer), responsive layouts down to 320px, and reusable card, table, form and toast patterns. Print styles support report PDF output through the browser print dialog.

## Project structure

```
src/
  auth/         roles, permissions, AuthProvider and useAuth
  components/   Layout, Icon, Drawer, Badges, Toast, RoleMenu, AccessDenied
  data/         types, SharePoint adapter, async DataProvider/context
  generated/    Power Apps connector services and models
  lib/          formatting, exports, scoping, workflow, validation,
                comments and derived helpers
  pages/        Dashboard, Tasks, BeneficiaryNominations, Beneficiaries,
                Reports, UserManagement, SchemeManagement
  styles/       design tokens and component styles
  navigation.ts role-aware navigation
  router.tsx    lightweight hash router
.power/         generated connector schemas
power.config.json  environment and SharePoint data-source mapping
```

Legacy prototype screens (`Policies`, `Nominees`, `NewNomination`, `Activity` and `lib/stats.ts`) remain in the repository for reference but are not routed or included in the type-check/build.

## Behaviour notes

- Data loads asynchronously from SharePoint. A banner shows initial loading, refresh progress, or a read error with a **Retry** action.
- The demo role switcher in the top-right user menu changes the active role immediately.
- Navigation and page actions follow the selected role; restricted routes show an access-restricted state.
- Principal Officers only see nominations and beneficiaries for their assigned scheme.
- New and invalid nominations appear in **Tasks**; only Admin can correct, re-evaluate and promote them.
- Moving a nomination out of Tasks requires `Errors = Clear` and assigns the scheme's active Principal Officer as First Endorser.
- Endorsing at the PO stage assigns the Pension Administrator as Second Endorser and moves the nomination to **Pending PA**; endorsing at the PA stage marks it **Approved**.
- Rejecting a nomination requires a written reason, appends it to `Comments` and mirrors it to `Warnings`.
- Excel exports download CSV files; PDF export opens the browser print dialog.
- Legacy paths (`/policies`, `/nominees`, `/nominations/new`, `/activity`, `/access`) redirect to their new equivalents.
- Sign-out is handled by the Power Apps host; closing the Local Play tab ends the session.
