# Role-based access control — Dataverse security setup

This document is the **security boundary** for role access in the Funeral Assist
app. The React code (`src/auth/*`) only decides *what to show* — a determined
user can edit client state. Real enforcement is done by **Dataverse security
roles** combined with the `fb_userroleses` table, exactly as described below.

- App roles: `Admin`, `HumanCapital`, `RewardsBenefitsManager`, `HeadofOperation`,
  `Mthuzi`.
- `HeadofOperation` is **observational**: it reads every dependant, claim and
  report but holds no approval, processing or role-management capability. It
  must never appear as an approval-matrix target.
- `Employee` is **never stored** — it is simply "no active row in
  `fb_userroleses`".
- Roles are read once at startup by `src/auth/verification.ts` and cached in
  `AccountProvider`. An email that is not found becomes `Employee`. A failed or
  timed-out Dataverse lookup also becomes `Employee` (with a visible warning),
  because an account that is not yet a member of the environment answers HTTP
  403 for every query. No failure ever grants a higher role; only an unreadable
  Microsoft 365 profile blocks sign-in.

---

## 1. Data model

### `fb_userroleses` (the role assignments)

One row per **user + role**. Keyed by email. Primary key `fb_userrolesid`.

| Column | Type | Notes |
| --- | --- | --- |
| `fb_useremail` | Text | Lowercased, trimmed. The lookup key. |
| `fb_fullname` | Text | Display name. |
| `fb_rolename` | Text | `Admin` \| `HumanCapital` \| `RewardsBenefitsManager` \| `HeadofOperation` \| `Mthuzi`. **Source of truth.** |
| `fb_isactive` | Yes/No | The only active flag the app uses. Removal = `false`. |
| `fb_assignedby` | Text | Lowercased email of the admin who made the change. |
| `fb_rolesource` | Text | `Manual`. |
| `fb_recordid` | Text | The app's own reference (`UR-…`). **Required on rows the app creates:** the workspace read (`loadUserRoles`) only keeps rows that carry one, so a role written without it exists in Dataverse but is invisible to the Reports "Role coverage" card. |
| `fb_userroles_name` | Text | `<email> - <RoleKey>` (fallback display/primary column). |

> The generated model (`src/generated/models/Fb_userrolesesModel.ts`) also
> declares `fb_createdon`, `fb_modifiedon` and `fb_recordid`. `accountService`
> treats them as optional and never relies on them for logic; display timestamps
> come from the real Dataverse `createdon`/`modifiedon`. If those three columns
> are not present in your environment, nothing breaks — but confirm the column
> names against your environment before enabling any Dataverse-side rules that
> reference them.

### `fb_roleaudites` (the audit trail — append-only)

Never updated, never deleted. Primary key `fb_roleauditeid`.

| Column | Type | Notes |
| --- | --- | --- |
| `fb_useremail` | Text | Lowercased subject email. |
| `fb_previousrole` | Text | Role before the change ('' when none). |
| `fb_newrole` | Text | Role after the change ('' on removal). |
| `fb_changedby` | Text | Lowercased admin email. |
| `fb_action` | Text | `Assigned` \| `Removed` \| `Reactivated`. |
| `fb_comment` | Text | Free-text reason. |
| `fb_changedon` | DateTime | **UTC.** |
| `fb_roleaudite_name` | Text | `<email> - <Action>`. |

---

## 2. Seed row for the first Admin

Assign the Admin role to Ian Mtumodzi **once**, directly in Dataverse (make
sure you are signed in as a user who may write the table — e.g. a System
Administrator — then create **one** row):

| Column | Value |
| --- | --- |
| `fb_useremail` | `imtumodzi@oldmutual.co.mw` |
| `fb_fullname` | `Ian Mtumodzi` |
| `fb_rolename` | `Admin` |
| `fb_isactive` | `Yes` |
| `fb_assignedby` | `imtumodzi@oldmutual.co.mw` |
| `fb_rolesource` | `Manual` |
| `fb_userroles_name` | `imtumodzi@oldmutual.co.mw - Admin` |

Leave the primary key, `createdon`, `modifiedon` and `ownerid` to their
Dataverse defaults.

Optional matching audit row in `fb_roleaudites` (`fb_action = Assigned`,
`fb_previousrole = ''`, `fb_newrole = Admin`, `fb_changedby` =
`imtumodzi@oldmutual.co.mw`, `fb_changedon` = now in UTC):

| Column | Value |
| --- | --- |
| `fb_useremail` | `imtumodzi@oldmutual.co.mw` |
| `fb_previousrole` | *(empty)* |
| `fb_newrole` | `Admin` |
| `fb_changedby` | `imtumodzi@oldmutual.co.mw` |
| `fb_action` | `Assigned` |
| `fb_comment` | `Initial Admin seed.` |
| `fb_changedon` | *(now, UTC ISO-8601)* |

> Do **not** hard-code this email anywhere in the React code. The app proves
> Admin access only by reading `fb_userroleses`. This seed row is the single
> source of that access.

---

## 3. Create the security roles

In **Power Apps / Power Platform admin center → Environment → Settings → Users +
permissions → Security roles → New role**.

### 3.1 `FBA Employee` (everyone)

Purpose: **read-only** access to the role tables so the app can show its
startup check and the profile menu. No write access anywhere in the RBAC tables.

1. New role → name `FBA Employee`.
2. **Custom tables** tab → for each table set the privilege circles:

   | Table | Create | Read | Write | Delete | Append | Append To |
   | --- | --- | --- | --- | --- | --- | --- |
   | `fb_userroleses` (User Roles) | — | **Organization** (green) | — | — | — | — |
   | `fb_roleaudites` (Role Audites) | — | **Organization** (green) | — | — | — | — |

   "Organization" read = any user can read any row of these two tables. That is
   deliberate (see §5); the alternative is discussed there.
3. Leave `fb_claimses`, `fb_dependentses`, `fb_messageses`,
   `fb_approvalmatrixes` with whatever privilege set your application design
   already requires — this role is **only** about the RBAC tables.
4. Save and close.

### 3.2 `FBA Admin` (the administrators only)

Purpose: full control of the two RBAC tables.

1. New role → name `FBA Admin`.
2. **Custom tables** tab:

   | Table | Create | Read | Write | Delete | Append | Append To |
   | --- | --- | --- | --- | --- | --- | --- |
   | `fb_userroleses` (User Roles) | **Organization** | **Organization** | **Organization** | **Organization** | **Organization** | **Organization** |
   | `fb_roleaudites` (Role Audites) | **Organization** | **Organization** | **Organization** | *(none preferred)* | **Organization** | **Organization** |

   Notes:
   - `fb_roleaudites` should be **create + read** only for admins as well — the
     `Delete` privilege may be left off so the audit trail is genuinely
     append-only even for administrators.
   - `Append` / `Append To` are needed because rows carry an owner and the audit
     row references the subject; enabling both avoids "insufficient privileges"
     on create.
3. Grant `FBA Admin` the needed **core** privileges that the role-management
   screen exercises (all under the standard tabs, Organization scope):
   `User` (read), and anything your other administration screens require.
4. Save and close.

### 3.3 Assign the roles

1. **Settings → Users + permissions → Users →** pick a user.
2. **Manage security roles** → tick:
   - **`FBA Employee` for every user** (this is the read baseline), and
   - **`FBA Admin` additionally for the administrators** (including
     `imtumodzi@oldmutual.co.mw`).
3. Repeat for each user, or assign `FBA Employee` via a **team** (e.g. an
   `FBA All Users` team with team membership) so every new joiner inherits it.

Order of operations for the very first login:

1. Create the seed row (§2).
2. Assign `imtumodzi@oldmutual.co.mw` the `FBA Admin` + `FBA Employee` security
   roles (§3.3).
3. Sign in — the startup check reads `fb_userroleses`, finds the Admin row, and
   the Administration area appears.

### 3.4 `HeadofOperation` (observational only)

Create the role assignment by adding a normal `fb_userroleses` row with
`fb_rolename = HeadofOperation`. The account also needs the same data-table read
baseline as an approver — **Read** at Organization scope on `fb_dependentses`,
`fb_claimses` and (for notification history) `fb_messageses` — but **no**
Create/Write/Delete on those tables and no write access to the RBAC tables.
Without the organization-wide read, the app would ask for every record but
Dataverse would only return the user's own rows.

What the app grants:

| Capability | Head of Operations |
| --- | --- |
| View every dependant and claim | **Yes** (`viewAllRecords`, `viewAllDependants`) |
| Open reports and export CSV | **Yes** (`viewReports`) |
| Approve / reject / request information | **No** |
| Process funeral support | **No** |
| Manage roles, user management, analytics | **No** |

> Approval routing never targets this role. Any `fb_approvalmatrix` row whose
> `fb_rolename` resolves to `HeadofOperation` is treated as inactive by the app
> (and `tools/dataverse.mjs` fixes those rows on deployment). This keeps the
> reassigned queue from stalling on a role that cannot act.

### 3.5 Stage ownership (defence in depth)

Each approval stage has exactly one owning role:

| Stage | Owner | What the owner may do |
| --- | --- | --- |
| Human Capital Review | `HumanCapital` | Approve, reject or request information |
| Rewards Review | `RewardsBenefitsManager` | Approve, reject or request information |
| Funeral Support (claim `approved` stage) | `Mthuzi` | Record transport, total cost and documents; complete the claim |
| Any stage | `Admin` | Act on behalf of the stage owner |

The app enforces this in `denyDependantDecision`, `denyClaimDecision` and
`denyProcessClaim`, not only by hiding buttons. A matrix row cannot move a stage to
another role: if the row is stale or names a role outside the stage's actor list,
the transition guard falls back to the stage owner. Human Capital therefore cannot
give Rewards approval, Rewards cannot perform first review, and Mthuzi cannot
approve or reject a claim.

Server-side enforcement should mirror the same table. Do **not** implement the
Power Automate or plug-in check as "whatever role the matrix says" without also
checking the stage owner, because a stale matrix row must not grant a role access
to another stage.

---

## 4. Why app-level checks are not enough

- Everything under `src/auth` (and the `RequireRole` route guards) runs in the
  user's browser. A user can change local state, re-enable a hidden menu or call
  the Dataverse Web API directly.
- The **only** thing that stops a non-admin writing `fb_userroleses` is the
  Dataverse security role. If `FBA Employee` had `Write` on that table, any
  employee could grant themselves `Admin` — the React guards would not stop it.
- Therefore: `Write`/`Create`/`Delete` on `fb_userroleses` and
  `fb_roleaudites` belong to `FBA Admin` **only**. Do not add those privileges to
  `FBA Employee`, and do not widen them by putting users in the wrong team.

---

## 5. The privacy trade-off (and the safer alternative)

**Current design — every user may read `fb_userroleses` (Organization read).**

- *Why:* the user's own startup verification and the profile menu need to know
  *their own* roles. The generated Power Apps data source queries the table as
  the signed-in user, and the simplest reliable way is to let users read rows.
- *Trade-off:* all users can read **every** row, i.e. everyone can see who is an
  Admin / Human Capital / RBM / Head of Operations / Mthuzi, including names and
  emails. Role membership becomes visible across the organisation. For a small internal app
  this is usually acceptable — it is not confidential data — but it is more
  exposure than strictly necessary.

**Safer alternative (recommended if role membership is sensitive):** replace
broad read with *row-scoped* reads so a user can only read their own row(s).

1. Set `fb_userroleses` to **User/Business Unit** scope and make the owner (or
   an "owner team") the subject of the row, then grant `FBA Employee` read only
   at **User** scope. Each user then reads only the rows they own.
   - This requires the row created by the admin to be **owned by the subject**,
     which is awkward through the Power Apps connector: the connector creates
     rows owned by the *signed-in admin*, not the subject.
2. Or move role resolution **server-side**: a Power Automate flow / custom API
   runs with an elevated connection and returns **only the caller's** roles.
   The client then needs no read access to the table at all, and `Employee`
   remains the default. This is the cleanest option but adds a flow to maintain.
3. Or keep Organization read on `fb_userroleses` (role membership only, low
   sensitivity) and restrict `fb_roleaudites` to `FBA Admin` read only, since the
   audit trail contains change history and comments. **This is the best
   cost/benefit middle ground** and is the recommended starting point. Note that
   the Admin audit tab then works only for `FBA Admin`, which is exactly the
   intended audience; ordinary users never open it because the route is guarded.

Use option 3 by default. Adopt option 2 if/when role membership itself is
considered confidential.

---

## 6. Checklist

- [ ] `fb_userroleses` and `fb_roleaudites` exist with the columns in §1.
- [ ] Seed Admin row for `imtumodzi@oldmutual.co.mw` created (§2).
- [ ] `FBA Employee` created: read-only on both RBAC tables (§3.1).
- [ ] `FBA Admin` created: full write on `fb_userroleses`, create/read on
      `fb_roleaudites` (§3.2).
- [ ] `FBA Employee` assigned to everyone; `FBA Admin` to the admins (§3.3).
- [ ] No `Write`/`Create`/`Delete` on the RBAC tables for non-admins.
- [ ] `HeadofOperation` has a row in `fb_userroleses` but **no** active
      `fb_approvalmatrix` row; it must never be an approval target.
- [ ] Server-side enforcement (Power Automate or Dataverse plug-in) checks the
      stage owner in §3.5, not just the matrix row, and allows the Admin override.
- [ ] `VITE_ENABLE_ROLE_PREVIEW` **unset or `false`** in production.
- [ ] Confirmed whether `fb_createdon` / `fb_modifiedon` / `fb_recordid` exist;
      the app does not require them.

---

## 7. Dataverse query limits this app works around

Both limits were confirmed against the live environment
(`https://org66fbe6bf.crm4.dynamics.com/`). They are not configuration
mistakes: the Dataverse query translator behind the Power Apps data client
rejects these clauses.

### 7.1 The OData `in` operator is rejected (HTTP 501, `0x8006088a`)

`column in ('a','b')` fails with *"The query node In is not supported"*. Every
multi-value filter is therefore an OR of `eq` comparisons:

```
(fb_useremail eq 'a@x' or fb_useremail eq 'b@x')
```

This is centralised in `inFilter()` in `src/data/paging.ts`. If you add a new
filter, never write `in` by hand — call `inFilter()`.

### 7.2 The `$skip` clause is rejected (HTTP 400, `0x80060888`)

`$skip` fails with *"Skip Clause is not supported in CRM"*. Every paged read
therefore asks for the first `skip + top` rows (`windowTop()` in
`src/data/paging.ts`) and cuts the current page out of that set in memory. The
total still comes from the server-side `$count`.

**Consequence for the People table.** Because the window is applied after the
server returns, any row the app discards in the browser shifts the page and can
hide a real assignment. `toAssignment()` discards a row whose role is Employee,
retired or unknown. The paged read therefore includes
`inFilter('fb_rolename', storedRoleNames)` in its `$filter`
(`roleAssignmentsFilter()` in `src/auth/accountService.ts`), so Dataverse
excludes those rows *before* `$top` and the count, window and mapping agree.
`storedRoleNames` is derived from the role registry in `src/data/roles.ts` — do
not hard-code a second list.

### 7.3 `$top` is a hard cap, not a page size

When a query sets `$top`, Dataverse returns at most that many rows and **no**
`@odata.nextLink`. The skip-token cursor (`$skiptoken`) is only produced when
`$top` is omitted. That is why the full reads (`fetchAllDependants`,
`fetchAllClaims`) walk `skipToken` without setting `$top`, while the paged
tables set `$top` explicitly.

### 7.4 Verifying the limits yourself

```bash
node tools/probe-fixes.mjs    # filters, counts, the startup role lookup
node tools/probe-writes.mjs   # dependant/claim/role write -> read-back
node tools/probe-window.mjs   # page window alignment for the People table
```

The probes use the cached device-code token written by
`node tools/dataverse.mjs auth` and clean up after themselves.
`tools/cleanup-probes.mjs` removes anything an interrupted run left behind.

---

## 8. Accounts that are not Dataverse users (HTTP 403)

Signing in to Microsoft 365 is **not** the same as being a user of the Dataverse
environment. An account that is in the tenant but has never been added to the
environment (or has no Power Apps/Dataverse licence) is refused by Dataverse
with:

```
HTTP 403 · 0x80072560 · "The user is not a member of the organization."
```

That happens for **every** table read, including `fb_userroleses`. It is not a
missing row and it is not a query bug.

The app therefore treats a failed role lookup as **Employee access with a
warning**, never as a lockout:

| Situation | What the app does |
| --- | --- |
| Account not a member of the environment (403 / `0x80072560`) | Opens the Employee dashboard and shows *"not a member of this Dataverse environment yet"* with a **Retry role check** button |
| Any other lookup failure (network, timeout, missing table) | Opens the Employee dashboard with the failure reason and a **Retry role check** button |
| Account is a member, but has no active `fb_userroleses` row | Opens the Employee dashboard silently — this is normal |

**To give the person their assigned role**, an administrator must:

1. Assign a licence that includes Power Apps (and Dataverse) to the account in
   the Microsoft 365 admin center.
2. Add the account to the environment (**Power Platform admin center →
   Environments → \<environment\> → Users + permissions → Users → Add user**) and
   assign the security roles described in §3.3 (`FBA Employee`, plus
   `FBA Admin` for administrators).
3. Sign in again. Dataverse provisions the system-user record, the role lookup
   returns the row, and the app opens the matching dashboard.

> Until step 1–2 are done, the person can open the app but Dataverse returns no
> data either. The Employee fallback is a graceful landing, not a substitute for
> environment access.

