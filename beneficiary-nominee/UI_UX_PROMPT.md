# UI/UX Explanation Prompt — Beneficiary Nominee Platform

> **How to use this file:** Copy everything from `## Role` to the end into an AI assistant (or use this file as context). The prompt asks the assistant to explain the UI and UX of this system accurately, using the product context and interface rules below. Replace the final "Your task" section with a narrower request if you only want one page or one component explained.

---

## Role

You are a senior product designer and front-end architect who specialises in enterprise operations software. You are fluent in information architecture, interaction design, design systems, accessibility, and responsive web behaviour.

You are explaining the **UI and UX of the Beneficiary Nominee platform** to a mixed audience of product owners, designers, engineers, and new team members. Your explanation must be accurate to the implementation described below, practical, and easy to follow.

## Objective

Produce a clear, structured explanation of how the system looks, how it is organised, how users move through it, and why it is designed that way. Explain both the **UI** (visual language, layout, components, states) and the **UX** (user goals, workflows, navigation, feedback, decision points, edge cases).

Do not simply list CSS values. Connect visual decisions to user outcomes: scanability, trust, speed, error prevention, and clarity of the next action.

## Output contract

Structure your answer with these sections, in this order:

1. **Executive summary** — 2–3 sentences describing the product, its users, and the overall feel.
2. **Product and user context** — what the system does, who uses it, and the role model.
3. **Information architecture and navigation** — route map, sidebar structure, role-based visibility.
4. **Visual language** — colour, typography, spacing, shape, elevation, iconography, and tone.
5. **App shell and responsive behaviour** — sidebar, content area, breakpoints, mobile behaviour.
6. **Page-by-page UX** — purpose, layout, primary actions, and key interactions for every screen.
7. **Core workflows** — authentication, validation, endorsement, rejection, search/filter/pagination, export/print, administration.
8. **Component behaviour** — buttons, tables, badges, drawers, notices, toasts, forms, empty states, pagination.
9. **Feedback, loading, and error states** — how the system keeps users informed and recovers from failure.
10. **Accessibility and interaction standards** — keyboard, focus, semantics, motion, contrast, touch.
11. **Design strengths and risks** — what works well, and where the UX could be improved. Clearly label recommendations as recommendations, not current behaviour.
12. **Source map** — the files that are authoritative for each area, if you have repository access.

Use headings, short paragraphs, and tables where they improve clarity. Prefer concrete component and token names over vague descriptions. State assumptions explicitly. Never invent a feature, route, role, or data state that is not described below.

## Product context

**Product name:** Beneficiary Nominee (Mthunzi Funeral Services).

**What it is:** An internal operations workspace for managing funeral-scheme beneficiary nominations. It supports a two-stage endorsement workflow, validation of submitted nominations, registers of approved members and beneficiaries, operational reporting, and administration of users and schemes.

**Data source:** Microsoft SharePoint lists (`schemes`, `principalOfficers`, `nominations`, `nominees`) accessed through Power Apps connectors. A browser-local demo mode can seed data when SharePoint is unavailable; workflow changes in demo mode are not persisted to SharePoint.

**Technology context (for accuracy, not for the explanation):** React 19 + TypeScript + Vite, hash-based routing, hand-written CSS with design tokens in `src/styles/ui.css`, shared components in `src/components`, no third-party UI component library.

**Users and roles** — preserve the exact role labels used by the system, including the intentional spellings `Pension Adminstration` and `Adminstration`:

| Role | What they can do | Navigation they see |
| --- | --- | --- |
| `Employee` | Read-only fallback. Can see the workspace shell and a "No workflow role assigned" panel on the dashboard; cannot see nomination or beneficiary data. | Dashboard only |
| `Principal Officer` | Reviews and endorses nominations assigned to their schemes at the first endorsement stage; may reject with a reason. | Dashboard, Pending PO, Active Members, Active Beneficiaries, Reports |
| `Pension Adminstration` | Validates nominations in Tasks and acts at both endorsement stages. | Dashboard, Tasks, Pending PO, Pending PA, Active Members, Active Beneficiaries, Reports |
| `Adminstration` | Full operational access plus user and scheme administration. | Everything above plus User Management and Scheme Management |

Roles are read from the SharePoint `principalOfficers` list after Microsoft 365 sign-in. If the role cannot be confirmed, the app falls back to `Employee` read-only access and shows an explanatory banner with a retry action. A role-preview menu may be enabled for demonstrations, letting a user switch the active role without changing SharePoint data.

**Workflow model:**

`Submitted` → `Tasks` (validation) → `Pending PO` (first endorsement) → `Pending PA` (second endorsement) → `Approved` or `Rejected`.

- A nomination must have `Errors = Clear` before it can move from Tasks to Pending PO.
- Error statuses are `Clear`, `Missing Scheme`, `Missing Principal Officer`, `Missing Information`, or `Not set` (null).
- The first and second endorsers are recorded against the nomination.
- Rejection requires a reason and returns the nomination to the member.
- Every workflow change should produce a toast confirmation and keep the user's list context intact.

## Information architecture

The app uses a persistent left sidebar as the only primary navigation. There is **no conventional top navigation bar**. The content area contains the current page.

| Route | Screen | Purpose |
| --- | --- | --- |
| `/` | Dashboard | Greeting, operational KPIs, validation queue summary, recent nominations, recent activity |
| `/tasks` | Tasks | Validate new nominations and correct data-quality issues before endorsement |
| `/pending-po` | Pending PO | Nominations awaiting Principal Officer endorsement |
| `/pending-pa` | Pending PA | Nominations awaiting Pension Administrator endorsement |
| `/nominations` | Active Members | Register of approved beneficiary nominations |
| `/beneficiaries` | Active Beneficiaries | Register of beneficiaries linked to approved nominations |
| `/reports` | Reports | Choose and download nomination, approval, and beneficiary reports |
| `/users` | User Management | Create, edit, enable, and disable principal officers (admin only) |
| `/schemes` | Scheme Management | Create, edit, and activate/deactivate schemes (admin only) |

Legacy routes redirect to the nearest current screen (for example `/policies` → `/nominations`, `/nominees` → `/beneficiaries`).

Navigation is grouped into **Workspace** and **Administration**. Items are filtered by role, and Tasks, Pending PO, and Pending PA show live count badges when their queues are non-empty. In demo mode, the administration routes are hidden.

## Visual language

### Design principles

- **Calm and dependable:** restrained green accent, neutral canvas, fine borders, minimal elevation.
- **Businesslike:** direct titles, short explanatory subtitles, explicit labels, visible record state.
- **Data-dense but orderly:** tables and metrics support scanning without turning into a wall of controls.
- **Action-oriented:** the next useful action is obvious; destructive actions are visually distinct.
- **Consistent:** the same navigation, panel, table, badge, drawer, empty-state, and feedback patterns repeat across screens.

Avoid loud gradients, heavy shadows, oversized cards, decorative charts, and unnecessary animation.

### Colour tokens

| Purpose | Value | Usage |
| --- | --- | --- |
| Primary green | `#43a047` | Brand accent, selected states |
| Primary action green | `#2e7d32` | Primary buttons, focus outline, active iconography |
| Soft green | `#e8f5e9` | Subtle positive/active surfaces |
| App background | `#f5f6f7` | Page canvas and sidebar background |
| Surface | `#ffffff` | Panels, tables, drawers, menus |
| Surface muted | `#fafafa` | Quiet supporting surfaces |
| Border | `#d9dde1` | Fine separation |
| Main text | `#202428` | Headings and key values |
| Muted text | `#555d65` | Supporting copy and metadata |
| Danger | `#b91c1c` | Errors and destructive states |
| Warning | `#b45309` | Caution and attention states |
| Info | `#1d4ed8` | Informational feedback |

Status colour is always paired with a text label and often a dot or icon. Never rely on colour alone.

### Typography

- Font stack: **Inter**, then system sans-serif (`-apple-system`, `Segoe UI`, `Roboto`, etc.).
- Page titles: approximately `22px`, weight `650`, negative tracking (`-0.02em`), responsive `clamp()` sizing on wide screens.
- Panel titles: approximately `15px`, weight `600`.
- Body and controls: approximately `12–14px`.
- Table headers and compact labels: `10–11px`, uppercase, letter-spaced (`0.07em`–`0.12em`), muted.
- Use medium/semibold for headings, table headers, key values, and buttons; regular weight for paragraphs.
- Muted colour and smaller size indicate secondary information, never important instructions or errors.

### Shape, borders, and elevation

- Control radius: roughly `8–9px`; panels `12–14px`; pills `999px`.
- Prefer a `1px` border and a white surface over a shadow. The current system uses **no shadows** for panels and drawers.
- The app canvas and sidebar share the same `#f5f6f7` background; white surfaces create hierarchy.
- Icons are small and purposeful, typically `13–22px`, and inherit the surrounding colour.

## App shell and navigation

### Desktop shell

```
┌──────────────┬──────────────────────────────────────────┐
│ Sidebar      │ Content area                             │
│ 264px        │ max-width 1680px, centred, responsive    │
│ (78px rail)  │ padding                                  │
└──────────────┴──────────────────────────────────────────┘
```

The sidebar is sticky, full height, and contains:

1. **Brand:** a green rounded square with a shield icon and the product name "Beneficiary Nominee".
2. **Collapse control:** a small bordered button that toggles the sidebar between the expanded `264px` state and a `78px` icon rail. The preference is stored in `localStorage` under `mfs-sidebar-collapsed`. In the collapsed rail, labels are hidden, icons remain, and each item exposes its label through a `title` tooltip. A separate rail toggle expands it again.
3. **Navigation:** grouped by `Workspace` and `Administration`. Each item has an icon, label, optional count badge, and an active state with a green left accent bar, soft green background, bold text, and a right chevron. Active items use `aria-current="page"`.
4. **Footer:** a user card with initials avatar, name, and role. In role-preview mode this is replaced by a role menu.

At `max-width: 900px` the shell becomes a single column: the sidebar turns into a full-width horizontal, scrollable navigation strip at the top, section labels disappear, collapse controls and the user footer are hidden, and the content padding reduces. There is no off-canvas drawer and no hamburger menu in the current implementation.

### Content area

The content area holds a vertical `.page-stack` with a consistent gap between sections. It also hosts global banners before page content:

- SharePoint loading, refreshing, and error banners with retry actions.
- A demo-mode banner explaining that changes stay in the browser.
- A role/warning banner when the user's role cannot be confirmed.

On the dashboard, a welcome block greets the user with a time-aware greeting ("Good Morning / Afternoon / Evening") and a one-line summary.

## Page-by-page UX

### Dashboard (`/`)

**Purpose:** give an at-a-glance operational picture and shortcuts into queues.

**Layout, top to bottom:**

1. Welcome greeting and description.
2. Six KPI stat cards in a responsive three-column grid: total nomination members, Tasks queue with findings to resolve, total beneficiaries, Pending PO, Pending PA, and Rejected.
3. A "Schemes and users" panel with compact mini-stats: total/active/disabled schemes, principal officers, schemes with/without an officer, active officers, officers without a scheme, members covered, and average revised allocation.
4. A "Validation queue" panel with mini-stats (in Tasks, Missing Scheme, Missing Principal Officer, Missing Information, oldest task age, Errors Clear) and an "Open Tasks" secondary action.
5. A "Nominations" table showing recent nominations, with pagination.
6. A "Recent activity" timeline panel.

For an `Employee`, the dashboard is replaced by a single "Read-only access" panel explaining that no workflow role is assigned and how to request one.

**UX intent:** answer "what needs attention?" and "where do I go next?" without forcing a drill-down first.

### Tasks (`/tasks`)

**Purpose:** validate submitted nominations and fix data-quality issues before endorsement.

**Layout:**

- Page header: title "Tasks", short explanation of the validation role, and a primary **Export** action.
- One panel titled "Validation queue" with the subtitle "Only nominations with Errors = Clear move to Pending PO" and an open-count badge.
- Toolbar: search across reference, member, scheme, and comments; filters for scheme, error status, and age (`Any age`, `0–3`, `4–7`, `8+` days).
- Table columns: reference, member number, member name, scheme, nominee count, status, errors, first/second endorser, comments, submission date, and row actions.
- Empty state with a clear-filters action when no rows match.

**Drawer (validation):** opening a row reveals a right-side drawer with the reference and member/scheme context. It contains:

- Current error and nomination status badges.
- A notice explaining that the Errors value comes from SharePoint and should only be changed after review.
- An Errors status selector.
- A contextual notice and shortcut to Scheme Management when the error is `Missing Principal Officer`.
- A "Correct scheme" section with an active-scheme selector and save action.
- A "Correct member details" section for member number, name, date of birth, branch, cost centre, and contact details.
- Editable nominee details (title, relationship, identity number, date of birth, revised allocation).
- Comments and validation notes.
- Footer actions: primary **Save Errors and move to Pending PO** when setting `Clear` on a `Tasks`/`Submitted` nomination, otherwise **Save Errors status**, plus **Close**.

**UX intent:** keep the queue visible behind the drawer, make the promotion rule explicit, and prevent accidental endorsement of an invalid nomination.

### Pending PO (`/pending-po`) and Pending PA (`/pending-pa`)

**Purpose:** review nominations at the first and second endorsement stages.

**Layout:** the same register pattern as Tasks — page title that names the stage, primary **Export**, panel title naming the queue, search, scheme filter, result count, and a table with reference, member, scheme, nominee count, status, errors, endorsers, comments, submission date, and row actions.

**Drawer (nomination review):**

- Header eyebrow "Nomination record", reference title, member and scheme subtitle.
- Member information in a two-column detail grid: reference, member number, name, date of birth, branch, cost centre, email, scheme, source status, errors badge, first and second endorser.
- A notice clarifying that Errors is read from SharePoint.
- Warnings when present.
- A beneficiaries section listing linked nominees.
- Supporting documents section with PDF preview.
- Footer: **Approve** (primary) and **Reject** (danger) when the user can act, plus **Close**. Rejecting reveals a reason field and a **Cancel rejection** action. Busy actions show "Saving…" and disable.

**UX intent:** support a confident approve/reject decision with full context, while making rejection deliberate and auditable.

### Active Members (`/nominations`)

**Purpose:** the register of approved beneficiary nominations.

**Layout:** page title "Active Members", primary **Export**, a panel of approved nominations, search, scheme filter, result count, and the same nomination table. Opening a record shows the same review drawer without endorsement actions when the user cannot act.

### Active Beneficiaries (`/beneficiaries`)

**Purpose:** the register of beneficiaries linked to approved member nominations.

**Layout:** page title "Active Beneficiaries", primary **Export**, panel "Approved nomination beneficiaries", search across beneficiary/member/reference, relationship filter, and result count. Table columns: beneficiary name with avatar, relationship, member number, reference, allocation percentage, date of birth, and row action. Rows are clickable and open a detail drawer. Empty state offers a clear-filters action.

### Reports (`/reports`)

**Purpose:** choose and export operational reports.

**Layout:**

- Page header "Nomination reports" with **Export Excel** (primary) and **Export PDF** (secondary).
- "Choose a report" panel containing a grid of action cards. The selected card uses a soft green background and green border.
- Report filters: date range, scheme, and status.
- Report table with a title, filters, row count, and pagination.
- Export downloads CSV; PDF uses the browser print flow. Print styles hide the sidebar, toasts, page actions, and filters, and reveal all table rows.

### User Management (`/users`)

**Purpose:** administer principal officers and workflow roles (Administration role only).

**Layout:** page title "User management" with a primary **Create principal officer** action, an alert if the SharePoint role column is unavailable, a panel titled "Principal officers", search across name/email/scheme, status filter, result count, and a table of users with role, scheme, contact, and status badges. Create and edit open a drawer form with labelled fields and save/cancel actions. Empty state offers a clear-filters action.

### Scheme Management (`/schemes`)

**Purpose:** administer schemes and their principal officer assignments (Administration role only).

**Layout:** page title "Scheme Management" with a primary **Create scheme** action, a "Schemes" panel, search across scheme and principal officer, status filter, result count, and a table of schemes with status and assignment. Create and edit open a drawer form. Empty state offers a clear-filters action.

### Access denied

If a signed-in user opens a route their role does not permit, the content area shows a centred access-denied panel with a lock/shield icon, an eyebrow, a clear title, an explanation, and a way back. The sidebar remains visible so the user can navigate to an allowed screen.

## Core workflows

### Sign-in and role resolution

1. The app shows a calm "Checking access / Loading your workspace" screen while it confirms the Microsoft 365 identity and reads the user's role from SharePoint.
2. On success, the shell renders with role-filtered navigation.
3. On failure, an error panel explains that identity or role could not be confirmed and offers **Try again**.
4. If role lookup succeeds but no workflow role is found, the user gets `Employee` read-only access with a banner and a **Retry role check** action.

### Validation and endorsement

1. A submitted nomination appears in **Tasks**.
2. A Pension Administrator or Administrator opens it, reviews the source data, corrects scheme/member/nominee details, records comments, and sets Errors.
3. Setting Errors to `Clear` promotes the nomination to **Pending PO**.
4. A Principal Officer, Pension Administrator, or Administrator reviews it in Pending PO and either approves (moves to Pending PA) or rejects with a reason.
5. At Pending PA, an authorised user approves (moves to Approved/Active Members) or rejects with a reason.
6. Every mutation shows a toast and refreshes the visible data; the list context is preserved where possible.

### Search, filtering, and pagination

- Every data table has a search field and one or more relevant filters in a compact toolbar.
- Result counts are shown as "X of Y items".
- Tables paginate in the browser. The default page size is **5 rows**. Users can choose **5, 10, 20, or 50** rows per page from a labelled "Rows per page" selector.
- The footer shows "Showing X–Y of N items" and "Page X of Y" with previous/next buttons.
- Changing search, filters, report selection, or page size resets to page 1.
- Filtered-out rows are hidden with a class rather than removed, so print styles can reveal the full table.
- Empty states explain why no rows appear and, where useful, offer **Clear filters**.

### Export and print

- Registers and reports export to CSV through a download action and confirm with a success toast.
- Reports also support a print/PDF path. Print styles hide navigation, filters, toasts, and actions, and show all rows.

### Administration

- Administrators create and edit principal officers and schemes in drawer forms.
- Status is managed through explicit fields and badges (`Active`, `Inactive`/`Disabled`), never through deletion.
- Validation errors appear next to the relevant field; save actions show busy states and disable while saving.
- Destructive or high-impact changes are visually separated and explained before confirmation.

## Component behaviour

### Buttons

- **Primary** (`button-primary`): one main action per page or workflow step, green background, white text.
- **Secondary** (`button-secondary`): export, cancel, view details, and other supporting actions; white with a border.
- **Danger** (`button-danger`): rejection and destructive actions; visually distinct and separated from routine actions.
- **Small** (`button-small`): compact table and drawer actions.
- **Icon-only** buttons (row actions, pagination, drawer close) are square, bordered, and always carry an `aria-label` and/or `title`.
- Buttons show disabled, busy ("Saving…"), and hover states. Avoid multiple equally prominent primary buttons on one screen.

### Tables

- Contained in a bordered, rounded wrapper with horizontal scroll on narrow screens; minimum table width around `680–720px`.
- Header cells are uppercase, muted, letter-spaced, and left-aligned on a very light surface.
- Rows use thin dividers, a light hover surface, and a pointer cursor when the whole row is clickable.
- Important identifiers and names use stronger text; secondary details sit below in muted text.
- Avatar initials appear in small rounded squares for people and beneficiaries.
- Row actions sit at the far right and open the detail drawer.

### Status badges

Compact pills with a dot, soft background, readable text, and a matching border:

- Green: approved, active, clear, success.
- Amber: pending, warning, missing information, attention.
- Red: rejected, missing scheme, error, destructive.
- Blue: informational, in progress, pending PA, missing principal officer.
- Slate: neutral, inactive, not set, submitted/tasks.

The same mapping is used everywhere. Labels are always in words.

### Pagination

A footer below each table containing:

- A summary such as "Showing 1–5 of 23 tasks".
- A "Rows per page" select with `5`, `10`, `20`, and `50`; default `5`.
- Previous and next icon buttons, disabled at the ends.
- "Page X of Y".

The footer renders whenever a table has rows, even when there is only one page, so the row-count preference is always available.

### Drawers

- Right-side overlay, `min(460px, 100vw)` wide, full height, white surface, no shadow, thin border.
- Opens from the right with a short, subtle animation; a scrim covers the page.
- Header: uppercase eyebrow, title, optional subtitle, and a close icon button with autofocus.
- Body scrolls independently; footer stays visible for primary actions.
- Closes on Escape, scrim click, or the close button. Body scrolling is locked while open.
- Uses `role="dialog"`, `aria-modal="true"`, and an accessible name.
- Keeps the underlying list visible so users do not lose context.

### Notices and banners

Inline `notice` blocks with an icon and a tinted background:

- Amber: caution or attention.
- Blue: information or loading.
- Green: success or clear.
- Red: error or blocked state.

Global data banners sit at the top of the content area and may include a retry action. Loading banner icons spin gently; reduced-motion preferences stop the animation.

### Toasts

- Fixed bottom-right, maximum width `380px`.
- Variants: success, error, warning, info, each with a coloured accent and icon.
- Title, message, close button, and a progress bar that counts down.
- Slide/fade in and out; stack vertically; announced to assistive technology.
- Used to confirm exports, saves, approvals, rejections, and failures. Do not fail silently.

### Forms

- Explicit labels above fields; placeholders are hints, not substitutes.
- Inputs, selects, and textareas share a consistent height, border, radius, and focus treatment.
- Validation messages appear beside the field and explain how to fix the problem.
- Group related fields; use two-column rows where space allows and stack on small screens.
- Drawer footers hold the primary save action and a secondary cancel/close action.
- Busy states disable actions and change labels (for example "Saving…").

### Empty states

A centred icon in a soft square, a short title, a one-line explanation, and—when relevant—a clear-filters or create action. Empty states are calm and instructive, not decorative.

### Loading states

- Auth gate: "Checking access" with a shield/refresh icon.
- Data banners: "Loading … from SharePoint" or "Refreshing SharePoint data".
- Skeletons may be used for content that is still arriving.
- Keep loading feedback close to the affected content and avoid blocking the entire shell unnecessarily.

## Responsive behaviour

| Breakpoint | Behaviour |
| --- | --- |
| `max-width: 1200px` | Stat grid gap tightens; dashboard grid becomes one column; report action grid becomes two columns |
| `max-width: 1024px` | Sidebar narrows to `240px`; content padding reduces; stat grid becomes two columns |
| `max-width: 900px` | Shell becomes one column; sidebar becomes a full-width horizontal scrollable nav; section labels and footer hide; content padding reduces |
| `max-width: 720px` | Action grids become one column; form actions and detail layouts stack |
| `max-width: 640px` | Content padding reduces; grids become one column; tables scroll horizontally; drawers become full width; toolbar fields go full width; top-level spacing tightens |
| `max-width: 360px` | Nav and table typography tighten further |

Rules:

- Support viewports from `320px` upward without page-level horizontal scrolling.
- Let wide tables scroll inside their own container rather than crushing columns.
- Keep touch targets comfortably sized (about 44px minimum for primary mobile controls).
- Keep headings and actions from clipping at the narrowest widths.

## Accessibility and interaction

- Use semantic HTML: `nav`, `main`, headings in order, `table`/`thead`/`tbody`/`th`, real `button` and `a` elements, labelled form controls.
- Provide a visible keyboard focus ring: `2px solid #2e7d32`, offset `2px`.
- Use `aria-current="page"` for the active nav item, `aria-label` for icon-only controls and nav regions, and `role="dialog"`/`aria-modal` for drawers.
- Announce loading and error banners with `role="status"` or `role="alert"` as appropriate.
- Do not communicate state through colour alone; pair badges with text and icons.
- Respect `prefers-reduced-motion`: disable or shorten animations and transitions.
- Keep text and control contrast high. Ensure disabled states remain readable.
- Close overlays with Escape and return focus sensibly.
- Ensure every action is reachable and operable by keyboard.

## Content and tone

- Use plain, direct business English.
- Page titles are short nouns or noun phrases: "Tasks", "Active Beneficiaries", "Nomination reports", "Scheme Management".
- Subtitles explain scope or a rule in one sentence: "Only nominations with Errors = Clear move to Pending PO."
- Buttons use concise verbs: "Export", "Approve", "Reject", "Save scheme", "Create principal officer", "Open Tasks", "Clear filters".
- Errors explain what happened and what to do next, in the user's language, without blame.
- Dates are formatted for readability; identifiers and counts use consistent formatting.
- Preserve the system's exact role labels and domain terms (`Principal Officer`, `Pension Adminstration`, `Adminstration`, `Errors`, `Pending PO`, `Pending PA`, `nominees`, `beneficiaries`).

## Constraints and anti-patterns

- Do not introduce a horizontal top navigation bar or duplicate sidebar navigation in a header.
- Do not add decorative gradients, heavy shadows, glassmorphism, oversized hero cards, or ornamental charts.
- Do not use colour as the only status signal.
- Do not hide primary actions in overflow menus when they are essential to the page's job.
- Do not replace drawers with full-page navigations when list context matters.
- Do not silently fail, silently succeed, or discard user input after an error.
- Do not change routes, permissions, APIs, or data models as part of a visual change.
- Do not invent metrics, statuses, or workflows that are not in the product.
- Do not describe the design system's aspirational rules as implemented behaviour; distinguish current behaviour from recommendations.

## Source of truth

If you have repository access, verify the explanation against these files:

| Area | File |
| --- | --- |
| Design tokens, layout, and component styles | `src/styles/ui.css` |
| Global typography, focus, reduced motion | `src/index.css` |
| App shell, sidebar, banners, greeting | `src/components/Layout.tsx` |
| Routing and access gating | `src/App.tsx`, `src/router.tsx` |
| Navigation model and role filtering | `src/navigation.ts` |
| Roles and permissions | `src/auth/roles.ts`, `src/auth/AuthProvider.tsx` |
| Shared pagination logic and controls | `src/lib/pagination.ts`, `src/components/Pagination.tsx` |
| Drawer, badges, toasts, icons | `src/components/Drawer.tsx`, `src/components/Badges.tsx`, `src/components/Toast.tsx`, `src/components/Icon.tsx` |
| Dashboard | `src/pages/Dashboard.tsx` |
| Validation queue | `src/pages/Tasks.tsx` |
| Nomination registers and endorsement | `src/pages/BeneficiaryNominations.tsx` |
| Beneficiary register | `src/pages/Beneficiaries.tsx` |
| Reports | `src/pages/Reports.tsx` |
| User administration | `src/pages/UserManagement.tsx` |
| Scheme administration | `src/pages/SchemeManagement.tsx` |
| Data types and demo data | `src/data/types.ts`, `src/data/demo.ts` |
| Existing design documentation | `DESIGN_SYSTEM.md`, `UI_UX_GUIDE.md` |

## Your task

Using the context above, explain the UI and UX of the Beneficiary Nominee platform.

Start with a short executive summary, then work through the output contract sections. For each screen, describe what the user sees, what they are trying to accomplish, the primary and secondary actions, and how the screen helps them avoid mistakes. For each component, explain its visual treatment and interaction behaviour. Finish with a balanced assessment of strengths and improvement opportunities, clearly separating current behaviour from recommendations.

Keep the explanation accurate, concrete, and useful to someone who has never seen the product. If something is unclear or not covered by this brief, say so rather than guessing.
