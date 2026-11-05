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

- **Dashboard** — centralized nomination, approval, beneficiary, member, allocation, active/disabled scheme and Principal Officer KPIs, plus recent nominations and activity. Operational modules focus on their filters, records and actions.
- **Beneficiary Nominations** — searchable/filterable nomination register with reference, member, scheme, nominee count, status and submission date. Open a record to see member details, beneficiaries, allocation, derived approval history and the supporting form. Approve or reject from the register or drawer.
- **Beneficiaries** — nominee register linked back to its nomination reference, member and allocation share. View details, search for a beneficiary, or export the current view.
- **Reports** — Nominations by Scheme, Pending Approvals, Approved Nominations, Beneficiary Register and Principal Officer Activity. Filter by date range, scheme and status, then export to Excel (CSV) or print to PDF.
- **User Management** — Admin-only creation, editing and disabling of `principalOfficers` records, including scheme assignment.
- **Scheme Management** — Admin-only creation and editing of `schemes` records, including the assigned Principal Officer.

The sidebar groups the first four screens under **Workspace** and the two administration screens under **Administration**.

## Entity model

The UI is aligned to the four real lists and their columns:

- `schemes` — `ID`, `Title`, `schemeName`, `scheme-status`, `Created`, `Modified`. `scheme-status` stores `active` or `disable`; legacy blank values are treated as active.
- `principalOfficers` — `Title`, `fullname`, `email`, `contactno`, `status`, `physicaladdress`, `postaladdress`, `schemecode`, `schemename`, `Created`, `Modified`. Every record is treated as a **Principal Officer**.
- `Nomination Members` (nominations) — `MemberNumber`, `FundName`, `DateOfBirth`, `BranchCode`, `CostCentre`, `EmailAddress`, `NomineeCount`, `TotalCurrentPct`, `TotalRevisedPct`, `FormVersion`, `Warnings`, `SourceFile*`, `refNumber`, `endorseStatus`, first/second endorser names and emails, `Created`, `Modified`.
- `Nomination Nominees` (beneficiaries) — `ID`, `Title`, `Member#Id`, `MemberNumber`, `RowNumber`, `DateOfBirth`, `Relationship`, `IdentityNumber`, `BenefitCurrentPct`, `BenefitRevisedPct`, `FundName`, `refNumber`, `Created`, `Modified`.

`refNumber` links a nominee to its nomination member. When the lookup is present, `Nomination Nominees.Member#Id` is also used as a fallback match to `Nomination Members.ID`.

## Statuses and derived history

Nomination statuses follow the two-stage workflow: **Pending PO Approval** → **Pending PM Approval** → **Approved**, with **Rejected** available at either pending stage.

`endorseStatus` is a free-text SharePoint column, not a choice column. The app learns the live status vocabulary from the records it loads and reuses those exact tokens when writing. If no matching token has been observed, it falls back to the canonical labels above. The raw value is shown alongside the normalised status so unexpected live values remain visible.

There is no approval-history list. The drawer's approval history and the dashboard/report activity feed are derived from the endorsement fields (`endorseStatus`, endorser names/emails) and the record timestamps, plus in-session actions. A rejection reason is written to the real `Warnings` field because there is no dedicated rejection-reason column.

Updating a nominee's revised percentage writes only `BenefitRevisedPct`, preserving the existing `BenefitCurrentPct`.

## Roles and workflow

Roles are switched from the user menu in the top-right corner. This switcher is a UI simulation for demonstrating the workflow; it is **not** an authentication or security boundary. Access is ultimately controlled by SharePoint permissions for the signed-in account.

| Capability | Admin | Principal Officer | Pension Manager |
| --- | --- | --- | --- |
| View dashboard, nominations, beneficiaries and reports | Yes | Yes | Yes |
| Action Pending PO Approval nominations | Yes | Yes | No |
| Action Pending PM Approval nominations | Yes | No | Yes |
| Reject a nomination (reason required) | Yes | Yes | Yes |
| Manage users and schemes (`/users`, `/schemes`) | Yes | No | No |

- **Admin** — full access, including both approval stages and administration.
- **Principal Officer** — reviews nominations for the scheme assigned to their `principalOfficers` record.
- **Pension Manager** — provides final approval across the scheme book.

Restricted routes render an access-restricted state, and approval actions are hidden when the active role cannot act on the current stage.

## Real-column limitations

The SharePoint lists do not contain every field an earlier prototype assumed. The UI deliberately reflects the real columns instead of inventing them:

- Schemes have no description column. Scheme Management edits `Title` / `schemeName` and updates the `scheme-status` field to enable or disable a scheme.
- `principalOfficers` has no role column, so every record is a Principal Officer.
- User creation does not offer a role selector, and scheme assignment is stored through `schemecode` / `schemename`.
- Principal Officer status uses the real `status` text column; blank values are treated as active.
- There is no dedicated rejection-reason or activity-history column (see above).

## Design system

The UI follows `DESIGN_SYSTEM.md`: Inter typography, green Mthunzi palette, no top navigation bar, a collapsible sidebar (desktop icon rail + mobile drawer), responsive layouts down to 320px, and reusable card, table, form and toast patterns. Print styles support report PDF output through the browser print dialog.

## Project structure

```
src/
  auth/         roles, permissions, AuthProvider and useAuth
  components/   Layout, Icon, Drawer, Badges, Toast, RoleMenu, AccessDenied
  data/         types, SharePoint adapter, async DataProvider/context
  generated/    Power Apps connector services and models
  lib/          formatting, exports, scoping, workflow and derived helpers
  pages/        Dashboard, BeneficiaryNominations, Beneficiaries, Reports,
                UserManagement, SchemeManagement
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
- Approving at the PO stage moves a nomination to **Pending PM Approval**; approving at the PM stage marks it **Approved**.
- Rejecting a nomination requires a written reason and stores it in `Warnings`.
- Excel exports download CSV files; PDF export opens the browser print dialog.
- Legacy paths (`/policies`, `/nominees`, `/nominations/new`, `/activity`, `/access`) redirect to their new equivalents.
- Sign-out is handled by the Power Apps host; closing the Local Play tab ends the session.
