# Mthunzi Beneficiary Nomination

A front-end-only beneficiary nomination workspace for Mthunzi Funeral Services, built with React 19, TypeScript and Vite.

> **No database, API or Power Apps data connection is used.** All schemes, users, nominations, beneficiaries and activity are seeded in memory from `src/data/seed.ts`. Refreshing the page resets the demo data.

## Run locally

```bash
npm install
npm run dev
```

Then open the URL printed by Vite (usually `http://localhost:5173`).

```bash
npm run build   # type-check and production build
npm run lint    # ESLint
```

## Included screens

- **Dashboard** — total nominations and beneficiaries, pending Principal Officer and Pension Manager approvals, approved and rejected nominations, total schemes and users, plus recent nominations and activity. The overview intentionally avoids trend and ratio analytics.
- **Beneficiary Nominations** — searchable/filterable nomination register with reference, member, scheme, nominee count, status and submission date. Open a record to see member details, beneficiaries, allocation, approval history and the supporting form. Approve or reject from the register or drawer.
- **Beneficiaries** — beneficiary register linked back to its nomination reference, member and allocation share. View details, search for a beneficiary, or export the current view.
- **Reports** — Nominations by Scheme, Pending Approvals, Approved Nominations, Beneficiary Register and Principal Officer Activity. Filter by date range, scheme and status, then export to Excel (CSV) or print to PDF.
- **User Management** — Admin-only creation, editing and disabling of Admin, Principal Officer and Pension Manager accounts.
- **Scheme Management** — Admin-only creation, editing and activation/deactivation of schemes, including the assigned Principal Officer.

The sidebar groups the first four screens under **Workspace** and the two administration screens under **Administration**.

## Entity model

The UI is aligned to four SharePoint-style entities:

- `schemes`
- `principalOfficers` (represented by users with the Principal Officer role and a `schemeId`)
- `Nomination Members` (`nominations`)
- `Nomination Nominees` (`beneficiaries`)

Nomination statuses follow the two-stage workflow: **Pending PO Approval** → **Pending PM Approval** → **Approved**, with **Rejected** available at either pending stage.

## Roles and workflow

This is a front-end demo, so roles are switched from the user menu in the top-right corner. The selected role is stored in `localStorage` and applies immediately across navigation and page actions.

| Capability | Admin | Principal Officer | Pension Manager |
| --- | --- | --- | --- |
| View dashboard, nominations, beneficiaries and reports | Yes | Yes | Yes |
| Action Pending PO Approval nominations | Yes | Yes | No |
| Action Pending PM Approval nominations | Yes | No | Yes |
| Reject a nomination (reason required) | Yes | Yes | Yes |
| Manage users and schemes (`/users`, `/schemes`) | Yes | No | No |

- **Admin** — full access, including both approval stages and administration.
- **Principal Officer** — reviews nominations for the scheme assigned to their account.
- **Pension Manager** — provides final approval across the scheme book.

Restricted routes render an access-restricted state, and approval actions are hidden when the active role cannot act on the current stage. Because there is no backend, these checks are presentation-only and are not a security boundary.

## Design system

The UI follows `DESIGN_SYSTEM.md`: Inter typography, green Mthunzi palette, no top navigation bar, a collapsible sidebar (desktop icon rail + mobile drawer), responsive layouts down to 320px, and reusable card, table, form and toast patterns. Print styles support report PDF output through the browser print dialog.

## Project structure

```
src/
  auth/         roles, permissions, AuthProvider and useAuth
  components/   Layout, Icon, Drawer, Badges, Toast, RoleMenu, AccessDenied
  data/         types, seed data, in-memory store/context
  lib/          formatting, exports, scoping, workflow and derived helpers
  pages/        Dashboard, BeneficiaryNominations, Beneficiaries, Reports,
                UserManagement, SchemeManagement
  styles/       design tokens and component styles
  navigation.ts role-aware navigation
  router.tsx    lightweight hash router
```

Legacy prototype screens (`Policies`, `Nominees`, `NewNomination`, `Activity` and `lib/stats.ts`) remain in the repository for reference but are not routed or included in the type-check/build.

## Demo behaviour

- The demo role switcher in the top-right user menu changes the active role immediately.
- Navigation and page actions follow the selected role; restricted routes show an access-restricted state.
- Principal Officers only see nominations and beneficiaries for their assigned scheme.
- Approving at the PO stage moves a nomination to **Pending PM Approval**; approving at the PM stage marks it **Approved**.
- Rejecting a nomination requires a written reason and records it in the approval history.
- Excel exports download CSV files; PDF export opens the browser print dialog.
- Legacy paths (`/policies`, `/nominees`, `/nominations/new`, `/activity`, `/access`) redirect to their new equivalents.
- Sign-out is intentionally disabled because the build is front-end only.
