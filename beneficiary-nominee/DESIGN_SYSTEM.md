# Design System: Mthunzi Funeral Services Dashboard

> **Purpose:** This document is the single source of truth for the Mthunzi Funeral Services dashboard's visual identity. It is extracted from the actual codebase and is intended to be reused by AI coding agents and developers to build other applications with the same professional, polished look and feel.

> **Rule:** Do not redesign this dashboard. Preserve and reuse the patterns documented here.

---

## Table of Contents

1. [Design System Overview](#1-design-system-overview)
2. [Visual Identity & Design Principles](#2-visual-identity--design-principles)
3. [Design Tokens & Color Palette](#3-design-tokens--color-palette)
4. [Typography & Text Tracking](#4-typography--text-tracking)
5. [Spacing, Dimensions & Layout](#5-spacing-dimensions--layout)
6. [Application Layout & Page Structure](#6-application-layout--page-structure)
7. [Collapsible Sidebar & Navigation Rules](#7-collapsible-sidebar--navigation-rules)
8. [No Top Navigation Bar Rule](#8-no-top-navigation-bar-rule)
9. [Cards, KPIs & Dashboard Widgets](#9-cards-kpis--dashboard-widgets)
10. [Tables & Data Presentation](#10-tables--data-presentation)
11. [Buttons & Interactive Components](#11-buttons--interactive-components)
12. [Forms & Validation](#12-forms--validation)
13. [Modals, Drawers, Notifications & Overlays](#13-modals-drawers-notifications--overlays)
14. [Icons & Imagery](#14-icons--imagery)
15. [Borders, Shadows & Radii](#15-borders-shadows--radii)
16. [Responsive Design Specifications](#16-responsive-design-specifications)
17. [Interaction & Animation Standards](#17-interaction--animation-standards)
18. [Accessibility Requirements](#18-accessibility-requirements)
19. [Reusable Component Specifications](#19-reusable-component-specifications)
20. [Verified Implementation Examples](#20-verified-implementation-examples)
21. [Design Do's & Don'ts](#21-design-dos--donts)
22. [How To Apply This Design System To A New Application](#22-how-to-apply-this-design-system-to-a-new-application)
23. [Mandatory Instructions For AI Coding Agents](#23-mandatory-instructions-for-ai-coding-agents)
24. [Verification & Quality Assurance Checklist](#24-verification--quality-assurance-checklist)
25. [Known Limitations, Unknown Values & Inferred Recommendations](#25-known-limitations-unknown-values--inferred-recommendations)

---

## 1. Design System Overview

- **Framework:** React 19 + TypeScript + Vite
- **Routing:** React Router DOM (HashRouter)
- **Styling:** Global CSS with CSS custom properties (design tokens) in `src/styles/ui.css`. Base styles in `src/index.css`.
- **Component Structure:** Layout-driven shell via `src/components/Layout.tsx`. Page components in `src/pages/`. Shared components in `src/components/`.
- **Design Character:** Clean, professional enterprise UI with a soft green brand identity. Prioritizes clarity, information density without clutter, generous whitespace, and subtle elevation.
- **Philosophy:** Function-first, polished details (subtle shadows, consistent radii, tight typography hierarchy). Calm, trustworthy aesthetic appropriate for funeral services business operations.

**Key files inspected:**
- `src/components/Layout.tsx` - Application shell, sidebar, topbar
- `src/styles/ui.css` - Design tokens, component styles, responsive rules
- `src/index.css` - Global reset, font imports, base styles
- `src/App.tsx` - Route structure
- `src/main.tsx` - Style imports

---

## 2. Visual Identity & Design Principles

**Visual character:**
- Soft, natural palette anchored by greens (`#4caf50`, `#43a047`, `#66bb6a`) conveying calm/trustworthiness
- Predominantly white surfaces on light grey background (`#f4f6f8`)
- Subtle borders and soft shadows for depth without heaviness
- Tight, refined typography (Inter) with negative letter-spacing on headings

**Principles (observed):**
- **Clarity over decoration:** Icons are functional, accents are purposeful
- **Consistent hierarchy:** Clear distinction between page titles, section headers, body text, labels
- **Breathing room:** Generous padding/margins, structured vertical rhythm
- **Subtle states:** Hover/active states use gentle background/border changes, minimal transforms
- **Professional restraint:** No heavy gradients, minimal animation, focus on usability
- **Information density done well:** Cards and tables present data clearly without overwhelming

---

## 3. Design Tokens & Color Palette

All tokens defined in `src/styles/ui.css` under `:root`:

| Token | Actual Value | Purpose | Source |
|---|---|---|---|
| `--mfs-primary` | `#4caf50` | Primary brand color | `src/styles/ui.css:2` |
| `--mfs-primary-600` | `#43a047` | Primary active/emphasis | `src/styles/ui.css:3` |
| `--mfs-primary-500` | `#66bb6a` | Lighter primary accent | `src/styles/ui.css:4` |
| `--mfs-accent` | `#81c784` | Accent/gradient end | `src/styles/ui.css:5` |
| `--mfs-primary-soft` | `#e8f5e9` | Soft primary background (badges/icons) | `src/styles/ui.css:6` |
| `--mfs-bg` | `#f4f6f8` | Main application background | `src/styles/ui.css:7` |
| `--mfs-surface` | `#ffffff` | Cards, panels, topbar, sidebar surface | `src/styles/ui.css:8` |
| `--mfs-surface-muted` | `#f8fafc` | Muted surfaces (user card, some panels) | `src/styles/ui.css:9` |
| `--mfs-border` | `#e5e7eb` | Borders/dividers | `src/styles/ui.css:10` |
| `--mfs-text` | `#0f172a` | Primary text | `src/styles/ui.css:11` |
| `--mfs-muted` | `#64748b` | Secondary/muted text | `src/styles/ui.css:12` |
| `--mfs-danger` | `#b91c1c` | Destructive/error | `src/styles/ui.css:13` |
| `--mfs-warning` | `#b45309` | Warning | `src/styles/ui.css:14` |
| `--mfs-info` | `#1d4ed8` | Informational | `src/styles/ui.css:15` |
| `--mfs-radius-sm` | `8px` | Small radius | `src/styles/ui.css:16` |
| `--mfs-radius` | `12px` | Default radius | `src/styles/ui.css:17` |
| `--mfs-radius-lg` | `16px` | Large radius | `src/styles/ui.css:18` |
| `--mfs-shadow-sm` | `0 1px 2px rgba(15, 23, 42, 0.05)` | Subtle shadow | `src/styles/ui.css:19` |
| `--mfs-shadow` | `0 1px 3px rgba(15, 23, 42, 0.06), 0 14px 34px -20px rgba(15, 23, 42, 0.2)` | Default shadow | `src/styles/ui.css:20` |
| `--mfs-shadow-lg` | `0 24px 60px -24px rgba(15, 23, 42, 0.3)` | Large/elevated shadow | `src/styles/ui.css:21` |
| `--mfs-sidebar` | `#4caf50` | Sidebar token (defined but sidebar uses white bg) | `src/styles/ui.css:22` |

**Additional colors observed in components:**
- Selection: `background: #c8e6c9; color: #1b5e20;` (`src/styles/ui.css:31-33`)
- Focus: `outline: 2px solid #4caf50;` (`src/styles/ui.css:35-38`)
- Sidebar active: `color: #15803d; background: #f0fdf4;` with left accent bar `#43a047`
- Nav icons default: `#94a3b8`, hover `#64748b`, active `#43a047`
- Brand mark: `background: #43a047`, shadow `0 6px 14px -8px rgba(67, 160, 71, 0.6)`
- Toast states use specific greens/blues/reds/yellows as shown in styles

---

## 4. Typography & Text Tracking

**Font family:**
- Primary: `'Inter'` (Google Fonts import)
- Fallbacks: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif`
- Source: `src/index.css:1,10-12`; applied globally via `body`, inherited by buttons/inputs

**Weights used:** 300, 400, 500, 600, 700 (as imported). Observed usage: 500, 600, 650, 700 primarily.

**Typography scale (observed):**
| Element | Size | Weight | Line Height | Letter Spacing | Color | Notes |
|---|---|---|---|---|---|---|
| Body/default | inherited | 400-500 | normal/1.6 | normal | `var(--mfs-text)` / `var(--mfs-muted)` | Base text |
| Sidebar brand name | 15px | 700 | 1.2 | -0.01em | `var(--mfs-text)` | `src/styles/ui.css:87-94` |
| Sidebar brand sub | 10px | 600 | normal | 0.12em | `#94a3b8` | Uppercase (`src/styles/ui.css:96-104`) |
| Nav label | 10px | 600 | normal | 0.13em | `#94a3b8` | Uppercase (`src/styles/ui.css:121-128`) |
| Nav item | 13.5px | 500 (600 when active) | normal | normal | `#475569` / `#15803d` | (`src/styles/ui.css:137-140,150-154`) |
| Topbar title | 18px | 650 | normal | -0.015em | `var(--mfs-text)` | (`src/styles/ui.css:304-310`) |
| Topbar subtitle | 12px | normal | normal | normal | `var(--mfs-muted)` | (`src/styles/ui.css:312-316`) |
| Topbar user name | 12.5px | 600 | 1.2 | normal | `var(--mfs-text)` | (`src/styles/ui.css:366-371`) |
| Topbar user role | 11px | normal | normal | normal | `var(--mfs-muted)` | (`src/styles/ui.css:373-376`) |
| Content max width | - | - | - | - | - | `max-width: 1440px` on `.content` |
| Hero title | 26px | 650 | 1.2 | -0.025em | `var(--mfs-text)` | Responsive to 22px at 900px (`src/styles/ui.css:504-511,1682-1684`) |
| Hero eyebrow | 10.5px | 600 | normal | 0.12em | `#15803d` | Uppercase (`src/styles/ui.css:492-503`) |
| Hero text | 13.5px | normal | 1.6 | normal | `var(--mfs-muted)` | (`src/styles/ui.css:512-517`) |
| Section title | 16px | 600 | normal | -0.01em | `var(--mfs-text)` | (`src/styles/ui.css:535-541`) |
| Section subtitle | 12.5px | normal | normal | normal | `var(--mfs-muted)` | (`src/styles/ui.css:543-547`) |
| Panel title | 15px | 600 | normal | -0.01em | `var(--mfs-text)` | (`src/styles/ui.css:871-878`) |
| Panel subtitle | 12px | normal | normal | normal | `var(--mfs-muted)` | (`src/styles/ui.css:879-883`) |
| Stat value | 28px | 700 | 1.1 | -0.03em | `var(--mfs-text)` | (`src/styles/ui.css:634-641`) |
| Stat label | 12.5px | 500 | normal | normal | `var(--mfs-muted)` | (`src/styles/ui.css:643-648`) |
| Stat context | 10px | 600 | normal | 0.06em | `#94a3b8` | Uppercase (`src/styles/ui.css:627-632`) |
| Button | 13px | 600 | 1.2 | normal | varies | (`src/styles/ui.css:423-431`) |
| Button small | 12px | 600 | normal | normal | varies | (`src/styles/ui.css:565-569`) |

**Text tracking rules (observed):**
- Uppercase labels (nav-label, hero-eyebrow, brand-sub, stat-context) use deliberate tracking: 0.12em, 0.13em, 0.06em
- Headings use negative tracking for tighter, polished look: -0.01em to -0.03em
- Body text uses normal tracking
- Buttons/inputs use normal tracking

**Rendering:** Antialiased via `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;` on body.

---

## 5. Spacing, Dimensions & Layout

**Spacing scale (observed values):** 2px, 3px, 4px, 5px, 6px, 7px, 8px, 9px, 10px, 11px, 12px, 13px, 14px, 16px, 18px, 20px, 22px, 24px, 26px, 28px, 32px, 34px, 36px, 38px, 40px, 48px, 52px - used consistently, not strictly a single scale but follows tight increments.

**Key dimensions:**
| Element | Value | Source |
|---|---|---|
| Sidebar width (desktop) | `264px` | `src/styles/ui.css:59` |
| Sidebar width (tablet <1024) | `240px` | `src/styles/ui.css:1618` |
| Sidebar width (mobile drawer) | `272px` | `src/styles/ui.css:1639` |
| Sidebar height | `100vh`, `position: sticky; top: 0` on desktop | `src/styles/ui.css:53-61` |
| Topbar height | `70px` | `src/styles/ui.css:292` |
| Content max-width | `1440px`, centered with `margin: 0 auto` | `src/styles/ui.css:406-408` |
| Content padding | `28px` (desktop), `24px` (<1024), `20px 18px` (<=900), `16px 14px` (<=640) | `src/styles/ui.css:407,1622,1674,1698` |
| Brand mark | `40px x 40px`, radius `11px` | `src/styles/ui.css:74-85` |
| Nav item padding | `10px 12px`, radius `9px`, gap `12px` | `src/styles/ui.css:130-143` |
| Nav icon area | `flex-shrink: 0` | `src/styles/ui.css:168-182` |
| User card padding | `10px`, radius `10px` | `src/styles/ui.css:196-204` |
| Avatar (sidebar) | `36px x 36px`, radius `10px` | `src/styles/ui.css:206-219` |
| Avatar (topbar) | `34px x 34px`, radius `50%` | `src/styles/ui.css:351-364` |
| Icon button | `38px x 38px`, radius `9px` | `src/styles/ui.css:378-391` |
| Button padding | `10px 16px` (default), `7px 11px` (small) | `src/styles/ui.css:421-431,565-569` |
| Card radius | `12px` / `14px` depending on component | Various (panels use `14px`, stats `12px`) |

**Layout structure:** Flexbox app shell. Sidebar is sticky/fixed depending on breakpoint. Main column is flex column. Content area is constrained and centered.

---

## 6. Application Layout & Page Structure

**App shell structure (`src/components/Layout.tsx`):**
```tsx
<div className="app-shell">
  <div className="sidebar-scrim" ... />
  <aside className="sidebar">...</aside>
  <div className="main-column">
    <header className="topbar">...</header>
    <main className="content">{children}</main>
  </div>
</div>
```

**Sidebar contents:**
1. **Brand section** (`.brand`): Logo mark (shield icon in green circle) + "Mthunzi" / "Funeral Services" text
2. **Nav** (`.sidebar-nav`): "Workspace" label + filtered nav items by role, active state with left accent bar, chevron on active
3. **Footer** (`.sidebar-footer`): User card (avatar initials, name, role + staffNo) + Sign out button

**Topbar contents** (`.topbar` - sticky, height 70px):
1. Menu button (hamburger) - visible only on mobile (`.menu-button { display: none; }` shown at <=900px)
2. Page heading area: Title (from current nav item label or fallback) + subtitle (from nav item subtitle or fallback)
3. Topbar actions (right): Date chip (calendar icon + formatted date) + divider + user info (avatar-sm + name + role). On small screens (<640px), user info and divider hidden.

**Content area:** `<main className="content">` with max-width 1440px, centered, responsive padding.

**Page structure pattern (observed in Dashboard):** Hero section, section headings with actions, stat grids, panels with headers/subheaders, action grids, workflow lists. Consistent use of `.section-heading`, `.panel`, `.panel-header` patterns.

---

## 7. Collapsible Sidebar & Navigation Rules

**Current implementation:** The sidebar is **collapsible on mobile** via off-canvas drawer. On desktop it is a fixed/sticky sidebar (264px). There is **no desktop collapse/expand to icon rail** - the current implementation uses mobile drawer pattern.

**Mobile behavior (verified):**
- At `max-width: 900px` (`src/styles/ui.css:1630-1685`):
  - `.menu-button { display: inline-flex; }` - hamburger visible
  - `.sidebar { position: fixed; left: 0; top: 0; width: 272px; transform: translateX(-100%); transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: var(--mfs-shadow-lg); }`
  - `.sidebar.is-open { transform: translateX(0); }`
  - `.sidebar-scrim { position: fixed; inset: 0; z-index: 25; display: block; opacity: 0; pointer-events: none; background: rgba(8, 23, 16, 0.45); transition: opacity 0.2s ease; }`
  - `.sidebar-scrim.is-open { opacity: 1; pointer-events: auto; }`
  - Clicking scrim closes sidebar (`onClick={() => setSidebarOpen(false)}`)
  - Clicking nav item closes sidebar on mobile (`onClick={() => setSidebarOpen(false)}`)

**Sidebar styling (expanded state):**
- Width: 264px desktop, 240px tablet, 272px mobile drawer
- Background: `#ffffff` with right border `1px solid var(--mfs-border)`
- Sticky on desktop (`position: sticky; top: 0; height: 100vh`)
- Flex column layout
- Nav scrollable with custom scrollbar styling

**Navigation states:**
- Default nav item: `color: #475569`, padding `10px 12px`, radius `9px`, gap `12px`
- Hover: `color: var(--mfs-text)`, background `#f1f5f9`, icon color changes to `#64748b`
- Active: `color: #15803d`, font-weight `600`, background `#f0fdf4`. Left accent bar via `::before`: `width: 3px; height: 18px; background: #43a047; border-radius: 999px; left: 0; top: 50%; transform: translateY(-50%)`
- Active icon: `color: #43a047`
- Active chevron shown on right: `<Icon name="chevron-right" size={15} className="nav-chevron" />`

**Nav structure:** Roles-based filtering from `navItems` array. Each item has path, label, icon, roles, subtitle. Subtitle shown in topbar.

**Accessibility (observed):**
- Nav has `aria-label="Main navigation"`
- Active link has `aria-current="page"`
- Menu button has `aria-label="Open navigation menu"`
- Scrim has `aria-hidden="true"`
- Keyboard accessible (native links/buttons)

**Requirement for future implementations:** The design system requires EVERY sidebar to be collapsible. Current implementation has mobile drawer collapse; for full compliance with the design system rules, implementations should support expanded/collapsed states on desktop (icon rail) with tooltips, smooth transitions, and preference persistence where appropriate. The documented patterns (transitions, states, accessibility) must be followed.

---

## 8. No Top Navigation Bar Rule

**STRICT RULE:** A conventional top navigation bar must NEVER be introduced.

**What exists (NOT a navigation bar):**
The `.topbar` (`src/components/Layout.tsx:177-210`) contains:
- Menu button (mobile only)
- Page heading (title + subtitle from current route/nav item) - contextual page header
- Date chip, divider, user info - utility/contextual elements

These are page-specific/contextual elements within the main content area shell, NOT navigation links. The primary navigation is entirely in the sidebar.

**Prohibited:**
- Horizontal nav menu across top
- Full-width navbar with nav links
- Duplicating sidebar nav in topbar
- Creating top-navbar components

**Main structure:** Sidebar + main content area only. No conventional top navigation bar.

---

## 9. Cards, KPIs & Dashboard Widgets

**Card patterns:**

**Panel** (`.panel`): `padding: 20px; background: var(--mfs-surface); border: 1px solid var(--mfs-border); border-radius: 14px; box-shadow: var(--mfs-shadow-sm)`. Header with `.panel-header` (flex, space-between), `.panel-title` (15px/600/-0.01em), `.panel-subtitle` (12px/muted).

**Stat card** (`.stat-card`): `padding: 18px; background: var(--mfs-surface); border: 1px solid var(--mfs-border); border-radius: 12px; box-shadow: var(--mfs-shadow-sm)`. Hover changes border to `#cbd5e1`. Top row has icon container + context label. Value is large (28px/700/-0.03em). Label and hint below.

**Stat icon container:** `width: 36px; height: 36px; background: #f1f5f9; color: #64748b; border-radius: 8px; display: flex; align-items: center; justify-content: center`

**Stat grid:** `display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px` (responsive to 16px at 1200px, 1fr at 640px)

**Action card:** Button-like card in grid. Padding `14px`, gap `12px`, radius `11px`, border `var(--mfs-border)`, bg white. Hover: background `#f8fafc`, border `#cbd5e1`, shadow, translateY(-1px). Icon container `36px x 36px`, radius `9px`. Arrow animates on hover (`translateX(2px)`).

**Hero section:** Gradient-free white card with border, radius `16px`, padding `28px 32px`, flex layout. Eyebrow uppercase with tracking, large title with negative tracking, muted description. Actions on right (stack on mobile).

**Workflow list:** Vertical timeline with connecting line. Each step has marker circle (36px) and body. Connecting line is `2px solid #e2e8f0` between markers.

---

## 10. Tables & Data Presentation

**Observed patterns:** Tables use standard HTML tables with custom styling in page components. Common patterns:
- Container with border, radius, overflow handling
- Header cells with muted color, uppercase or semibold styling
- Row hover states
- Padding in cells
- Status badges inline

**Responsive:** Tables may need overflow-x handling on small screens (use `overflow-x: auto` on table container). The design system requires responsive tables with overflow handling or alternative mobile presentations.

*(Specific table styles vary by page; follow general card/panel patterns and ensure horizontal scroll with proper styling.)*

---

## 11. Buttons & Interactive Components

**Button base** (`.button`): 
- `display: inline-flex; align-items: center; justify-content: center; gap: 8px`
- `padding: 10px 16px; font-size: 13px; font-weight: 600; line-height: 1.2`
- `border-radius: 9px; border: 1px solid transparent`
- Transitions: transform, box-shadow, background, border-color, color (0.16s ease)
- Disabled: `opacity: 0.65; cursor: not-allowed`

**Button variants:**
| Variant | Styles | Source |
|---|---|---|
| `.button-primary` | `color: #ffffff; background: #43a047; box-shadow: 0 8px 20px -12px rgba(46, 125, 50, 0.5)`. Hover: `background: #388e3c; box-shadow: 0 10px 24px -12px rgba(46, 125, 50, 0.6); transform: translateY(-1px)`. | `src/styles/ui.css:438-448` |
| `.button-secondary` | `color: #334155; background: #ffffff; border-color: var(--mfs-border); box-shadow: var(--mfs-shadow-sm)`. Hover: `color: var(--mfs-text); background: #f8fafc; border-color: #cbd5e1; transform: translateY(-1px)`. | `src/styles/ui.css:450-462` |
| `.button-small` | `padding: 7px 11px; font-size: 12px; border-radius: 8px` | `src/styles/ui.css:565-569` |

**Icon button** (`.icon-button`): Square button 38x38, radius 9px, border, muted color, hover changes to text color with background `#f1f5f9`.

**Sign out button:** Full width in sidebar footer, secondary style variant.

**Interaction:** Subtle lift on hover for primary/secondary (`translateY(-1px)`). Transitions are quick (0.16s).

---

## 12. Forms & Validation

**Form elements** inherit font-family from body. Common patterns observed:
- Inputs/selects/textareas styled consistently
- Labels with appropriate weight/size
- Focus states use global `:focus-visible` (green outline)
- Validation/error states use semantic colors

*(Specific form styles may be defined in page/component styles; follow the general patterns: clear labels, adequate spacing, proper focus states, error messages in red/warning colors.)*

---

## 13. Modals, Drawers, Notifications & Overlays

**Sidebar scrim:** Overlay behind mobile sidebar (rgba(8, 23, 16, 0.45)), fades in/out.

**Toast notifications** (`.toast-viewport`): Fixed bottom-right, max-width 380px. Each toast has colored left accent bar, icon in colored circle, title/message, close button, progress bar animation. Variants: success, error, warning, info with corresponding colors.

**Animations:** Toast slides in with `translateY(12px) scale(0.98)` to visible, slides out similarly. Progress bar scales down over duration.

**Modals/drawers:** Follow similar overlay patterns with proper z-indexing and focus management (accessibility required).

---

## 14. Icons & Imagery

**Icon system:** Custom `Icon` component (`src/components/Icon.tsx`) with icon name type. Sizes vary (13-22px common). Icons are inline-flex, inherit color.

**Common icons used:** grid, clipboard, activity, folder, pen, receipt, users, shield, menu, calendar, chevron-right, log-out, search, download, printer, alert-circle, etc.

**Avatars:** Initials in circular/squared containers with background `#eef2f7`, border `#e2e8f0`, colored text `#475569`. Sizes 34px (topbar) and 36px (sidebar).

**Logos/branding:** Shield icon in green circle for brand mark.

**Images:** Should preserve aspect ratios; use `object-fit` as needed. Borders/radii follow design system.

---

## 15. Borders, Shadows & Radii

**Border radius scale:** `8px` (sm), `12px` (default), `16px` (lg). Specific components use 9px, 10px, 11px, 13px, 14px, 999px for pills.

**Borders:** `1px solid var(--mfs-border)` (#e5e7eb) standard. Some states use colored borders (e.g., error `#fecaca`).

**Shadows:**
- `--mfs-shadow-sm`: `0 1px 2px rgba(15, 23, 42, 0.05)` - subtle
- `--mfs-shadow`: `0 1px 3px rgba(15, 23, 42, 0.06), 0 14px 34px -20px rgba(15, 23, 42, 0.2)` - default cards
- `--mfs-shadow-lg`: `0 24px 60px -24px rgba(15, 23, 42, 0.3)` - elevated (sidebars, toasts)

**Focus rings:** `:focus-visible { outline: 2px solid #4caf50; outline-offset: 2px; }`

**Dividers:** `1px solid var(--mfs-border)`

---

## 16. Responsive Design Specifications

**Breakpoints (observed):**
| Breakpoint | Target | Changes |
|---|---|---|
| `max-width: 1200px` | Smaller desktops | Stat grid gap reduced to 16px |
| `max-width: 1024px` | Tablets/small laptops | Sidebar width 240px, content padding 24px, dashboard grid becomes single column |
| `max-width: 900px` | Tablets | Mobile menu appears, sidebar becomes off-canvas drawer (272px, transform), scrim shown, topbar padding reduced, date chip hidden, content padding 20px 18px |
| `max-width: 720px` | Large phones/small tablets | Active case stacks vertically, form actions stack, pending items wrap, case gate adjustments |
| `max-width: 640px` | Phones | Topbar user info/divider hidden, topbar title smaller (16px), content padding 16px 14px, hero stacks, grids become single column, toasts adjust |

**Responsive requirements (must follow):**
- No horizontal scrolling
- Touch-friendly controls (adequate padding/gaps)
- Sidebar: desktop sticky/expanded, mobile drawer
- Grids adapt (3-col → 2-col → 1-col as appropriate)
- Typography scales down appropriately
- Tables need horizontal scroll containers
- Modals/dropdowns fit viewport
- Images preserve aspect ratios

---

## 17. Interaction & Animation Standards

**Transitions:** Most use `0.16s ease` or `0.2s ease`. Sidebar transform uses `0.25s cubic-bezier(0.16, 1, 0.3, 1)`. Toasts use custom cubic-bezier.

**Hover effects:** Subtle - background/border color changes, slight translateY(-1px) on buttons/cards, icon color changes, arrow movement.

**Active states:** Clear visual indication (background color, accent bar, font weight).

**Focus states:** Global green outline for keyboard navigation.

**Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables animations/transitions (`src/styles/ui.css:1777-1786`).

**Loading states:** Skeleton animations with shimmer effect (`skeleton-wave` keyframes).

---

## 18. Accessibility Requirements

**Observed:**
- Semantic HTML structure
- ARIA labels on nav, menu button, scrim
- `aria-current="page"` on active nav
- Focus-visible styles
- Keyboard accessible interactive elements
- Color contrast appears reasonable for text/background combinations
- Touch targets adequate size (buttons/controls)

**Required for all implementations:**
- Keyboard navigation support
- Visible focus indicators
- Proper ARIA attributes where needed
- Sufficient color contrast
- Adequate touch target sizes (minimum ~44x44px recommended)
- Screen reader friendly labels
- Respect `prefers-reduced-motion`

---

## 19. Reusable Component Specifications

**Layout components:**
- `Layout` - App shell with sidebar, topbar, content area
- `ProtectedRoute` - Route protection
- `Icon` - Icon system

**Common patterns to reuse:**
- `.panel` with `.panel-header`, `.panel-title`, `.panel-subtitle`
- `.section-heading` pattern
- `.button` variants
- `.card`-like surfaces with consistent borders/shadows/radii
- Stat cards, action cards
- Toast system via context
- Form layouts following existing patterns

---

## 20. Verified Implementation Examples

**Sidebar structure (from Layout.tsx):** Brand mark with shield icon, nav with role filtering, user card with initials, sign out button. Active state has left accent bar.

**Button usage:** Primary for main actions, secondary for alternatives. Small buttons for table actions.

**Card patterns:** White backgrounds, subtle borders, soft shadows, consistent padding.

---

## 21. Design Do's & Don'ts

**Do:**
- Use CSS variables for colors/spacing where possible
- Follow Inter font family
- Use collapsible sidebar (mobile drawer pattern minimum; support full collapse on desktop per requirements)
- Keep no conventional top navigation bar
- Use subtle shadows and consistent radii
- Apply negative tracking to headings
- Use uppercase + tracking for small labels
- Provide proper focus states
- Make layouts responsive
- Use semantic colors for states

**Don't:**
- Add horizontal top navigation
- Use heavy gradients or drop shadows
- Apply arbitrary letter-spacing everywhere
- Create fixed-width layouts without responsiveness
- Ignore mobile breakpoints
- Use different font families without justification
- Over-animate
- Clutter with unnecessary decorations

---

## 22. How To Apply This Design System To A New Application

1. **Read this document first** before implementing UI
2. **Inspect target app** - understand framework, routing, existing patterns
3. **Set up design tokens** - Copy CSS variables from `src/styles/ui.css` to target
4. **Import Inter font** - Add Google Fonts import
5. **Implement app shell** - Sidebar + main column (no top nav). Make sidebar collapsible (mobile drawer minimum, desktop collapse preferred)
6. **Reuse components** - Create Layout, follow patterns
7. **Apply typography** - Use documented sizes/weights/tracking
8. **Apply spacing** - Use consistent padding/margins
9. **Make responsive** - Follow breakpoint patterns
10. **Preserve business logic** - Don't change APIs/routes/permissions
11. **Test** - Check all breakpoints

**Adaptation notes:** Different business needs ≠ different visual identity. Keep colors, typography, spacing, component patterns consistent. Only change content/navigation labels to fit the new application.

---

## 23. Mandatory Instructions For AI Coding Agents

1. **Design consistency:** This document is the authoritative visual reference
2. **Collapsible sidebar:** EVERY dashboard must have a collapsible sidebar (desktop expanded/collapsed + mobile drawer). Current codebase has mobile drawer; ensure full compliance
3. **No top navbar:** Conventional top navigation bars are PROHIBITED
4. **Responsiveness:** All pages/components must adapt to 320px+ viewports without breaking
5. **Typography precision:** Maintain Inter, documented sizes/weights/line-heights/letter-spacing
6. **Spacing consistency:** Use design tokens and documented patterns
7. **Component reuse:** Reuse patterns; create reusable components
8. **No arbitrary redesign:** Don't introduce unrelated conventions
9. **Business logic preservation:** Don't alter routes/APIs/permissions/data models
10. **Evidence-based:** Use verified values; label assumptions
11. **Accessibility:** Keyboard nav, focus states, contrast, touch targets
12. **Quality assurance:** Test and fix visual/responsive issues
13. **Framework flexibility:** Adapt to target framework without losing identity
14. **Maintainability:** Prefer clean, reusable implementations
15. **Scope discipline:** Only change what's needed for UI consistency

---

## 24. Verification & Quality Assurance Checklist

### Responsive Layout
- [ ] Test at 320px, 375px, 480px, 640px, 720px, 900px, 1024px, 1200px, 1280px+
- [ ] No horizontal overflow
- [ ] All content accessible
- [ ] Grids adapt correctly
- [ ] Tables scroll properly on mobile
- [ ] Forms usable on small screens
- [ ] Modals/dropdowns fit viewport
- [ ] Sidebar: expanded/collapsed/mobile states work

### Typography & Alignment
- [ ] Inter font loads correctly
- [ ] Font sizes match scale
- [ ] Letter spacing correct (especially uppercase labels, headings)
- [ ] Headings wrap naturally
- [ ] Icons aligned with text
- [ ] Buttons/controls aligned
- [ ] Tables/numbers aligned

### Visual Consistency
- [ ] Colors match tokens
- [ ] Spacing consistent
- [ ] Borders/radii correct
- [ ] Shadows correct
- [ ] All states work (hover/focus/active/disabled)
- [ ] No top navigation bar
- [ ] Sidebar collapsible

### Functional Integrity
- [ ] Routes work
- [ ] Auth/permissions intact
- [ ] Forms/APIs work
- [ ] No regressions

---

## 25. Known Limitations, Unknown Values & Inferred Recommendations

**Verified from codebase:**
- All values in sections above extracted from actual files
- Sidebar is mobile-collapsible via drawer (desktop is sticky expanded)
- No top navigation bar exists - confirmed
- Inter font, green color scheme, specific spacing/sizing confirmed

**Unknown/inferred:**
- **Desktop sidebar collapse:** Current implementation doesn't have icon-rail collapse on desktop - the design system REQUIREMENT says every sidebar must be collapsible. New implementations must add this. Use patterns from mobile (transitions, states) adapted for desktop.
- **Exact table styles:** Vary by page; follow general patterns
- **Some component variants:** May exist not fully inspected
- **Form validation styles:** Need to follow semantic color patterns

**Recommendations:**
- When adding desktop collapse: store preference in localStorage, use smooth transitions, show tooltips on collapsed state, ensure ARIA attributes
- Maintain the established green palette as brand color
- Keep animations subtle and respect reduced motion
- Test thoroughly across all breakpoints

---

**Document generated:** Based on inspection of Mthunzi Funeral Services dashboard codebase  
**Source files:** `src/components/Layout.tsx`, `src/styles/ui.css`, `src/index.css`, `src/App.tsx`, `src/main.tsx`  
**Status:** Implementation-ready design specification
