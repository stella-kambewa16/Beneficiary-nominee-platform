# Implementation Prompt — Beneficiary Nomination Validation-First Workflow

## Role

You are a senior full-stack engineer working on the Beneficiary Nominee application in this repository (`beneficiary-nominee`). The app is React 19 + TypeScript + Vite, deployed as a Power Apps Code App, with SharePoint (`https://uapgroup.sharepoint.com/sites/bnf`) as the database. The nomination list is `Nomination Members`; beneficiaries are in `Nomination Nominees`.

Implement the workflow change described below end to end: data model, status logic, UI, navigation, role permissions, reporting and backward compatibility. Follow the existing structure, naming, styling and design system (`DESIGN_SYSTEM.md`). Do not replace SharePoint with another data store.

## Objective

Move the Beneficiary Nomination process from an endorsement-first process to a **validation-first** process.

Today, incomplete nominations can enter the endorsement workflow and are only corrected later. The new process must make the **Errors** status the gate: every new nomination goes to a **Tasks** queue, is validated, and can only move to **Beneficiary Nominations** and endorsement when its error status is **Clear**.

We have recently added the following columns to the `Nomination Members` list:

- **First Endorser**
- **Second Endorser**
- **Errors**
- **Comments**

Use these columns to drive and evidence the workflow. The **Comments** column must provide an auditable record of validation feedback, corrections and endorsement remarks.

## Current state in the codebase

- Nomination status is stored in the free-text SharePoint column `endorseStatus`.
- The current status model is `Pending PO Approval` → `Pending PM Approval` → `Approved`, with `Rejected` available at either pending stage.
- The current role model is `Admin`, `Principal Officer` and `Pension Manager`.
- The app currently maps status using `normalizeEndorsementStatus` and writes using `statusWriteValue` in `src/data/sharepoint.ts`.
- Approval permissions live in `src/lib/workflow.ts`.
- The endorsement assignees are currently mapped from the first/second endorser name and email columns.
- Rejection reasons are currently written to the legacy `Warnings` column.
- The connector model in `src/generated/models/NominationMembersModel.ts` may not yet expose `Errors` and `Comments`. If it does not, refresh/regenerate the Power Apps connector model and services rather than bypassing the generated services.

## Target status model

Treat workflow status and error status as **two separate dimensions**. Do not mix them into one field.

### Workflow status — stored in `endorseStatus`

| Status | Meaning |
| --- | --- |
| `Submitted` | Transient entry state when a nomination is created. It must be evaluated and moved to `Tasks` in the same operation. It must not be a resting state. |
| `Tasks` | Nomination is in the validation queue and is not available for endorsement. |
| `Pending PO` | Validation passed. Awaiting Principal Officer (First Endorser) review. |
| `Pending PA` | PO endorsed. Awaiting Pension Administrator (Second Endorser) review. |
| `Approved` | Both endorsements complete. Final state. |
| `Rejected` | Optional terminal state available at `Pending PO` or `Pending PA`, with a required reason in `Comments`. Not part of the happy path. |

### Error status — stored in `Errors`

| Error status | Meaning |
| --- | --- |
| `Missing Scheme` | The nomination has no valid scheme, or its `FundName` does not match an active scheme. |
| `Missing Principal Officer` | The matched scheme has no active Principal Officer assigned, or the nomination cannot resolve a PO for that scheme. |
| `Missing Information` | Required member, nominee or allocation information is missing or invalid. |
| `Clear` | All validation rules pass. The nomination is eligible to leave Tasks. |

`Clear` is an **error status**, not a workflow status. When `Errors` becomes `Clear`, the workflow status must move from `Tasks` to `Pending PO`.

### Required flow

```text
Submitted
    ↓
Tasks  (Errors evaluated)
    ↓
┌──────────────────────────────────┐
│ Missing Scheme                   │
│ Missing Principal Officer        │
│ Missing Information              │
└──────────────────────────────────┘
    ↓
Remain in Tasks until corrected and re-evaluated
    ↓
Errors = Clear
    ↓
Pending PO  (First Endorser / Principal Officer)
    ↓
Pending PA  (Second Endorser / Pension Administrator)
    ↓
Approved
```

## Error evaluation rules

Implement a single validation function, for example `evaluateNominationErrors(...)`, used by both the UI and the transition logic. The result must contain:

- the resulting error status;
- a list of human-readable validation findings;
- the fields or records that failed.

Validation rules:

1. **Missing Scheme**
   - `FundName` is blank, or
   - no matching scheme exists, or
   - the matched scheme is disabled.

2. **Missing Principal Officer**
   - the matched scheme has no assigned Principal Officer, or
   - the assigned Principal Officer is disabled/inactive.

3. **Missing Information**
   - required member details are missing or invalid (at minimum: member number, member name/title, date of birth, email where required);
   - the nomination has no nominees;
   - a nominee is missing required details (name, relationship, date of birth or identity number as applicable);
   - allocation percentages are missing, non-numeric or do not total 100%;
   - `NomineeCount` does not match the linked nominee records.

4. **Clear**
   - none of the above apply.

If more than one error applies, use this precedence for the `Errors` value: `Missing Scheme` → `Missing Principal Officer` → `Missing Information`. Record **all** findings in `Comments` so the user can fix everything in one pass.

`Errors` must be system-computed by default. If an Admin override is provided, it must require a justification and append that justification to `Comments`; never clear an error silently.

## Workflow transitions and exact field updates

### 1. Nomination submitted

On creation:

- set `endorseStatus = Submitted`, then immediately evaluate;
- write the computed value to `Errors`;
- set `endorseStatus = Tasks`;
- append a timestamped `Comments` entry describing the validation result.

The nomination must appear in the **Tasks** queue and must **not** appear in **Beneficiary Nominations**.

### 2. Nomination corrected in Tasks

When a user edits the nomination or its beneficiaries:

- re-run all validation rules;
- update `Errors`;
- append a timestamped `Comments` entry describing what changed;
- if `Errors` is not `Clear`, keep `endorseStatus = Tasks`;
- if `Errors` is `Clear`:
  - resolve the scheme’s active Principal Officer;
  - write the PO’s name and email to the **First Endorser** fields;
  - set `endorseStatus = Pending PO`;
  - append a comment recording the promotion and the assigned First Endorser.

The record must now leave Tasks and appear in Beneficiary Nominations as `Pending PO`.

### 3. Principal Officer endorsement

Only allowed when `Errors = Clear` and `endorseStatus = Pending PO`.

- resolve the Pension Administrator for the scheme (the Second Endorser);
- write the PA’s name and email to the **Second Endorser** fields;
- set `endorseStatus = Pending PA`;
- append the PO’s endorsement remark to `Comments`.

### 4. Pension Administrator endorsement

Only allowed when `Errors = Clear` and `endorseStatus = Pending PA`.

- set `endorseStatus = Approved`;
- append the PA’s endorsement remark to `Comments`.

### 5. Rejection

At `Pending PO` or `Pending PA`:

- require a rejection reason;
- set `endorseStatus = Rejected`;
- append the reason to `Comments`;
- keep the legacy `Warnings` field in sync for backward compatibility with existing reports, but treat `Comments` as the primary audit record.

### 6. Error regression

If a nomination that had already progressed is edited and now fails validation:

- set `Errors` to the computed error status;
- move `endorseStatus` back to `Tasks`;
- remove it from the active endorsement queue;
- append a comment explaining why it was returned to Tasks.

An endorsement must never be possible while `Errors` is anything other than `Clear`.

## UI requirements

### Navigation

- Add a **Tasks** item under **Workspace**, above **Beneficiary Nominations**.
- Show a count badge for open Tasks.
- Tasks is available to Admin/operations users. Principal Officers and Pension Administrators must not use Tasks as an endorsement queue.
- Keep the existing role switcher behaviour and restricted-route handling.

### Tasks queue page

Create a dedicated Tasks page/queue that lists only nominations with `endorseStatus = Tasks`.

Include at minimum:

- reference number;
- member number and member name;
- scheme/fund;
- **Error Status** (colour-coded);
- validation findings summary;
- submitted date;
- last updated date;
- age in days;
- assigned/related Principal Officer where available;
- actions: **Review**, **Correct**, **Re-evaluate**.

Provide filters for Error Status, scheme and age, plus search by reference/member. Show an empty state when no tasks are open.

The Tasks detail view must show:

- the full list of validation findings;
- editable nomination and beneficiary fields needed to resolve them;
- the `Errors` value and a **Re-evaluate** action;
- the `Comments` history;
- a **Move to Beneficiary Nominations** action that is enabled only when `Errors = Clear`.

### Beneficiary Nominations page

- Exclude `Tasks` records entirely.
- Include only `Pending PO`, `Pending PA`, `Approved` and `Rejected`.
- Add **First Endorser**, **Second Endorser**, **Errors** and **Comments** to the register and detail drawer.
- Keep the approval/rejection actions, but disable them when `Errors` is not `Clear`.
- Show the current stage clearly (`Pending PO`, `Pending PA`, `Approved`, `Rejected`) and preserve the raw SharePoint status where it differs from the normalised status.

### Dashboard and reports

- Add a Tasks/validation KPI: open tasks, error breakdown, and ageing.
- Add a data-quality view or report showing nominations by error status and the most common missing items.
- Keep existing nomination, approval and beneficiary KPIs working.
- Ensure exports include the new columns.

### Comments and audit trail

- Treat `Comments` as an append-only audit log.
- Each entry must include at least: timestamp, actor, role, and message.
- Never overwrite previous comments.
- Use it for validation findings, corrections, promotion to `Pending PO`, endorsement remarks and rejection reasons.
- Display the history in reverse chronological order in the drawer.

Suggested entry format:

```text
[2026-11-05 14:32] Jane Doe (Admin): Missing Information — beneficiary allocation totals 85%. Returned to Tasks.
```

## Column definitions and mapping

| UI label | SharePoint column | Purpose |
| --- | --- | --- |
| First Endorser | Existing first endorser name/email fields | Principal Officer assigned at `Pending PO`. |
| Second Endorser | Existing second endorser name/email fields | Pension Administrator assigned at `Pending PA`. |
| Errors | `Errors` (confirm exact internal name) | Validation gate: `Missing Scheme`, `Missing Principal Officer`, `Missing Information`, `Clear`. |
| Comments | `Comments` (confirm exact internal name) | Append-only validation and endorsement audit trail. |

If the generated connector model does not expose `Errors` and `Comments`, regenerate the model/services from the SharePoint list and wire them through `src/data/sharepoint.ts` and `src/data/types.ts`. Do not write directly to SharePoint outside the existing data adapter.

## Roles and permissions

Use the existing role model unless a separate Operations role is explicitly requested.

| Capability | Admin | Principal Officer | Pension Administrator |
| --- | --- | --- | --- |
| View Tasks queue | Yes | No | No |
| Correct validation issues | Yes | No | No |
| Override `Errors` (with justification) | Yes | No | No |
| Action `Pending PO` | Yes | Yes, for own scheme | No |
| Action `Pending PA` | Yes | No | Yes |
| Reject at a pending stage | Yes | Yes, at `Pending PO` | Yes, at `Pending PA` |
| View Beneficiary Nominations | Yes | Yes, own scheme | Yes |

In the UI, use the business label **Pension Administrator (PA)**. If the existing internal role is still named `Pension Manager`, keep the internal mapping stable but update all user-facing labels to Pension Administrator. Do not break existing role checks.

## Backward compatibility

- Existing records may contain legacy values: `Pending PO Approval`, `Pending PM Approval`, `Pending PM`, `Submitted`, `Approved`, `Rejected`.
- Normalise legacy values to the new labels when reading:
  - `Pending PO Approval` → `Pending PO`
  - `Pending PM Approval` / `Pending PM` → `Pending PA`
- Preserve the raw value for transparency, as the app currently does with `sourceStatus`.
- Do not bulk-rewrite production records as part of the code change. If a migration is required, provide a separate, reviewed migration script and document it.
- Keep the existing `Warnings` rejection data readable. New rejection reasons must also be written to `Comments`; mirroring to `Warnings` is acceptable during transition.
- Existing records without an `Errors` value must be evaluated on load or on first action, not treated as automatically `Clear`. Default an unknown error status to the appropriate missing-data status, never to `Clear`.

## Acceptance criteria

The change is complete when all of the following are true:

1. A newly submitted nomination appears in **Tasks**, not in **Beneficiary Nominations**, and has a computed `Errors` value.
2. A nomination with `Missing Scheme`, `Missing Principal Officer` or `Missing Information` remains in Tasks and cannot be endorsed.
3. Correcting the underlying data and re-evaluating updates `Errors` to `Clear`, assigns the First Endorser, and moves the nomination to `Pending PO`.
4. A `Pending PO` nomination can only be endorsed by a Principal Officer (or Admin), and endorsement moves it to `Pending PA` and assigns the Second Endorser.
5. A `Pending PA` nomination can only be endorsed by a Pension Administrator (or Admin), and endorsement sets `Approved`.
6. Approval actions are disabled or blocked whenever `Errors` is not `Clear`.
7. Editing a progressed nomination into an invalid state returns it to Tasks and removes it from endorsement.
8. `Comments` is append-only and shows validation, correction, promotion and endorsement history with timestamp, actor and role.
9. The four new columns are visible in the register and detail drawer, and included in exports.
10. Dashboard and reports show Tasks/error-status metrics without breaking existing metrics.
11. Legacy status values still display and behave correctly.
12. `npm run build` and `npm run lint` pass.

## Guardrails

- Do not introduce a separate database or local-only workflow state.
- Do not allow endorsement without `Errors = Clear`.
- Do not overwrite `Comments`; always append.
- Do not silently treat missing or unrecognised `Errors` values as `Clear`.
- Do not remove the `Rejected` path or existing approval history.
- Do not rename SharePoint columns or rewrite historical records without an explicit migration step.
- Do not hard-code scheme or user names; resolve them from the existing schemes and principal officers data.
- Follow the existing design system and responsive behaviour down to 320px.

## Deliverables

1. Updated TypeScript types and SharePoint mapping for `Errors` and `Comments`.
2. Validation and status-transition logic with unit-testable functions.
3. Tasks queue page, navigation entry and route guards.
4. Updated Beneficiary Nominations register and detail drawer.
5. Updated role permissions and approval guards.
6. Dashboard/report additions for Tasks and data quality.
7. Backward-compatible status normalisation.
8. A short implementation summary covering changed files, status mapping, validation rules and any migration notes.

## Verification

- Run `npm run build`.
- Run `npm run lint`.
- Manually exercise the full flow with at least four scenarios:
  - missing scheme;
  - missing Principal Officer;
  - missing information/allocation not 100%;
  - complete nomination through `Pending PO` → `Pending PA` → `Approved`.
- Confirm a `Tasks` record never appears in the endorsement queue and cannot be approved.
- Confirm a corrected record moves automatically to `Pending PO` and is assigned to the correct Principal Officer.
- Confirm legacy `Pending PO Approval` / `Pending PM Approval` records still load and act correctly.
