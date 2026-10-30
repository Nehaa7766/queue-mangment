# QueueCare --- GUI Rules

The design contract every screen must follow. It condenses
[PLAN.md §12](PLAN.md#12-gui-plan-and-ui-design-queuecare) into rules
and Tailwind class names. For screen-by-screen content (panels, pages,
routes), use PLAN.md §12.7--§12.9. Keep the two files consistent: change
both in the same pull request.

## 1. Brand

- Product name: **QueueCare**.
- Look: **mocha on white** over a warm off-white page, in the style of a
  modern admin template. White cards with thin borders and a soft
  shadow; mocha for the brand, the active menu item and the main action.
- Logo: `BrandMark` --- the owner's ringing bell picture
  (`src/components/layout/queuecare-bell.png`, used exactly as supplied)
  on a rounded white tile, next to `BrandName`, the wordmark
  "Queue**Care**" with "Care" in mocha. Both are in
  `src/components/layout/brand-mark.tsx`. On mocha backgrounds keep the
  white tile and use an all-white wordmark. The browser tab icon is the
  same bell padded to a square: `src/app/icon.png`. The picture is
  162 × 148 px, so don't show it larger than about 64px.
- Light theme only in v1.

## 2. Colors

Tokens live in `src/app/globals.css` (`@theme`, Tailwind v4). Use the
class names below --- never raw hex values in components (charts take
hex values from `TONE_HEX` in `src/components/dashboard/tone.ts`).
Tailwind's built-in `slate-*` and `stone-*` scales are removed; don't use
other built-in palettes (`gray-*`, `zinc-*`, etc.) either.

### Brand

The palette is warm: off-white `#F2EDEA`, blush `#E7CEC9`, dusty rose
`#D5B3A7`, tan `#B98F76` and mocha `#86614F`. Mocha is the brand
colour; the three light shades are for charts and accents only, because
they fail contrast as text on white.

| Class name | Hex | Use |
|---|---|---|
| `brand` | `#86614F` | Mocha: logo, active nav marker, main buttons, ticket stub, highlight card, chart series 1. White text on it is 5.5:1 |
| `brand-hover` | `#765444` | Hover on mocha surfaces |
| `brand-tint` | `#F5ECE8` | Active nav item background, brand icon circles, badges (mocha text on it is 4.7:1) |
| `brand-muted` | `#F2EDEA` | Small text on mocha (labels on the ticket stub and highlight card) |
| `tan`, `rose`, `blush` | `#B98F76`, `#D5B3A7`, `#E7CEC9` | Chart series 2--4, accent lines. **Never text** |
| `danger-text` | `#B42318` | "Over target" numbers, bad trends |
| `tone-amber`, `tone-green`, `tone-red` | `#D97706`, `#16A34A`, `#DC2626` | Status-meaning lines under stat cards and footer stats. **Not for small text** --- use `TONE_TEXT` |

### Surfaces and shadcn/ui roles

| Class name | Value | Use |
|---|---|---|
| `background` | `#F2EDEA` | Warm off-white page background, behind the cards |
| `foreground` | `#2E2522` | Default text (warm ink) |
| `card` | `#FFFFFF` | Cards, sidebar, top bar, page header strip |
| `border` | `#E8DFDB` | Card borders, separators |
| `input` | `#D6CBC6` | Form field borders |
| `divider` | `#F3EEEB` | Row dividers and header lines inside cards |
| `muted-foreground` | `#6E625C` | Secondary text, labels, captions (5.9:1 on white, 5.1:1 on the page) |
| `muted` | `#F4EFED` | **Background only**: icon circles, progress tracks |
| `primary` / `primary-foreground` | mocha / white | Primary buttons |
| `secondary` | `#F4EFED` | Secondary surfaces |
| `accent` | `#F4EFED` | Hover states |
| `destructive` | `#B91C1C` | Destructive actions and errors |
| `ring` | mocha | Focus rings |

### Status styles

Always pair a status color with a text label.

| Style | Classes | Used for |
|---|---|---|
| Waiting / Called | `bg-status-wait text-status-wait-foreground` (amber) | `WAITING`, `CALLED` |
| In consultation | `bg-brand text-white` | `IN_SERVICE` |
| Done / Available | `bg-status-done text-status-done-foreground` | `COMPLETED`, doctor available |
| No-show / Emergency | `bg-status-miss text-status-miss-foreground` | `SKIPPED` |
| Paused / Off | `bg-status-off text-status-off-foreground` | `CANCELLED`, queue `PAUSED` / `CLOSED`, doctor off |

This mapping is implemented in the status pills
(`src/components/queue/status-pill.tsx`,
`src/components/patient/status-pill.tsx`). Change it there and here
together.

### Color rules

- Mocha fill marks the **single** most important action on screen, plus
  the one highlight card on a dashboard.
- White text on mocha; mocha text on white or `brand-tint`.
- Good trends: `text-status-done-foreground` with ↗. Bad trends:
  `text-danger-text` with ↘. Never color alone.

## 3. Typography

| Role | Font | Classes |
|---|---|---|
| Page title (header strip) | Inter | `text-lg font-semibold` |
| Card title | Inter | `text-[15px] font-semibold` |
| Stat / KPI value | Plus Jakarta Sans | `font-display text-2xl font-bold tabular-nums` |
| Highlight value | Plus Jakarta Sans | `font-display text-3xl font-bold tabular-nums` |
| Token, patient hero | Plus Jakarta Sans | `font-display text-[56px] sm:text-[64px] font-extrabold tabular-nums` |
| Token, ticket stub | Plus Jakarta Sans | `font-display font-extrabold tabular-nums`, 28--52px |
| Body, list rows | Inter | `text-sm`, weight 400--600 |
| Section labels ("MAIN", "UP NEXT") | Inter | `text-[11px] font-semibold uppercase tracking-[0.08em]` |
| Captions, timestamps | Inter | `text-xs` |
| Hindi / Marathi | Noto Sans Devanagari | Automatic fallback in `font-sans` |

- `font-sans` (Inter, then Noto Sans Devanagari) is the default; use
  `font-display` only for numbers, tokens and the logo.
- Use `tabular-nums` on tokens, times, counts and table numbers.
- Patient screens: body text at least 16px (`text-base`).

## 4. Spacing, shape, elevation

- 8px spacing grid. Card padding 20px (`p-5`); card headers
  `px-5 py-4` with a `border-divider` line. Gap between cards 20px
  (`gap-5`).
- Cards: `rounded-card border border-border bg-card shadow-card` (10px
  radius, soft shadow).
- Buttons: `rounded-btn` (8px). Heights: 36px compact (`h-9`), 40--48px
  default (`h-10`--`h-12`), 52--56px phone primary (`h-13`--`h-14`).
- Pills, badges and avatars: `rounded-full`.
- Icon circles: 44px `bg-muted text-muted-foreground` on stat cards;
  `bg-brand-tint text-brand` for brand accents.
- Tap targets: at least 48px (`min-h-12`) on phones and patient screens.

## 5. Components

Shared dashboard building blocks live in `src/components/dashboard/`.
Use them instead of one-off cards so every panel looks the same.

| Component | Looks like | Use for |
|---|---|---|
| `StatCard` | Grey icon circle, big value, label; caption with a value; thin coloured progress line | The row of four KPIs at the top of a dashboard |
| `DashboardCard` + `StatStrip` | White card with a titled header; optional footer of numbers, each over a coloured line | Charts, lists, tables, forms |
| `HighlightCard` | Mocha top with a big number and a white wave chart; white list below; uppercase footer link | The one thing that matters most right now (e.g. Now serving). One per dashboard |
| `SparkCard` | Title and value on top; coloured sparkline and a trend note below | Per-service or per-metric trends |
| `ListRow`, `TokenBadge` | Leading badge, title and subtitle, value on the right | Lists inside cards |
| `tone.ts` | `TONE_BAR`, `TONE_TEXT`, `TONE_HEX` | Consistent accent colours |

### Ticket stub --- "Now serving"

The main identity element; it echoes the printed token slip.

- Stub: `bg-brand`; label in `text-brand-muted`; token in white; room in
  `text-brand-muted`.
- Perforation: 2px dashed border in the page color, with two 18px
  half-circle notches at top and bottom.
- "Called" tag uses the Waiting / Called status style.
- Grace bar: 6px tall, `bg-muted` track, `bg-brand` fill.
- Buttons: **Call next** = primary (mocha, white text) with an `N`
  shortcut hint. Recall and Skip = white with a border.
- Phone: stub on top, perforation runs horizontally.
- Patient token page uses the same stub as the hero.

### Up next rows

- First row: mocha stub, white token, subtitle ends with "· next up".
- Other rows: `bg-muted` stub, dark token.
- Waited time turns `text-danger-text` when over the clinic's wait
  target (default 20 min, from queue settings).
- Desktop: small "Details" button. Phone: the whole row is tappable.

### Other shared components

Status pill, token badge, count badge, list row, activity row, charts
(paired bars, lines, donut, sparkline), tables (muted header row,
divider rows), side drawer, modal, toast with Undo, banner (paused /
offline / doctor on break), skeleton loader, empty state, form fields
with inline validation, toggle, select.

Super admin pieces (`src/components/platform/`):

- **Icon row actions** (`icon-action.tsx`): every table row's actions sit
  on one line as square icon buttons, View first. The accessible name
  says what and whom ("Edit Asha Admin"); the tooltip gives the short
  name, or why the action is unavailable.
- **Pager** (`pagination.tsx`): "Showing 11–20 of 57" with numbered page
  links on wider screens and "Page 2 of 6" on phones. Links keep the
  page's other filters; changing a filter goes back to page 1.
- **Add and edit sheets** (`form-kit.tsx`): a side panel with a pinned
  footer. When a check fails, the footer says so and the first bad field
  gets focus, since the field may be scrolled out of view.
- **Clinic avatar** (`clinic-avatar.tsx`): the clinic's logo, or its
  first letter when none is uploaded.
- **Invite link** (`invite-link.tsx`): shown once after adding an admin
  by email, with a copy button; only its hash is stored.

## 6. Layout

Every signed-in panel uses the shared shell in
`src/components/shell/` (`AppShell`). Staff panels wire it up in
`src/components/layout/staff-chrome.tsx`; the platform panel has its own
wiring with its own menu.

| Part | What it is |
|---|---|
| Sidebar (desktop, `lg`+) | White, 256px, right border. Logo block on top; grouped links with uppercase section labels; active link `bg-brand-tint text-brand` with a mocha marker on the edge; hover `bg-accent`. "Need help?" card and a Sign out button at the bottom (clinic staff). Collapses to a 76px icon rail (labels become tooltips, Sign out becomes an icon) with the round handle on its right edge; the choice is remembered per browser. |
| Top bar (all widths) | White, 64px, sticky. Menu button below `lg` only ("Open menu": opens the sidebar as a drawer), the panel's quick action as a mocha pill (e.g. "New walk-in"), then on the right: search, full screen (desktop), bell, avatar with name and role. |
| Page header strip | White strip under the top bar: "Title &#124; Home › Section › Page" on the left; today's date (from `sm` up) and the page's own actions on the right. Use `PageHeader` with `breadcrumbs` and `actions`. |
| Content | Light grey page, 16px padding on phones and 24px from `md`. |
| Phone (below `md`) | Bottom tab bar with the items marked `tab: true` in `src/components/layout/staff-nav.ts` (at most four), the raised mocha Walk-in button for reception and admin, and Profile. |

Typical dashboard grid: four stat cards across (2 × 2 on phones); a wide
chart card next to the mocha highlight card; a row of spark cards; then
lists.

Patient screens are mobile-first, have no staff navigation and no login.

The sign-in page uses its own "ticket" layout (`src/components/auth/login-ticket.tsx`): a decorative date-and-shift stub (hidden from screen readers) joined to the sign-in form, whose button reads "Open my counter". In development, or with `DEMO_LOGINS=true`, a dashed "Demo accounts" box under the button lists one seeded account per panel; choosing one fills in the email and password without signing in. The other auth pages (forgot and reset password, no access, errors) keep the split `AuthShell` layout.

## 7. Interactions

- **Live updates** without reload (polling first); briefly highlight
  numbers and pills that change.
- **Call next**: keyboard shortcut `N`. Disabled only while the queue is
  paused or empty, and the reason is shown.
- **Grace countdown** on the called token, then Recall / Skip /
  Re-queue.
- **Optimistic UI** with rollback and an error toast.
- **Estimates** as a range ("20--30 min"), a "rough estimate" label when
  data is thin, and "updated X min ago". Never promise an exact time.
- **Confirm** destructive actions (skip, close queue). Reversible
  actions get an Undo toast instead.
- **Language toggle** English / हिंदी / मराठी on the patient panel, if
  confirmed for v1.

## 8. Accessibility

- Text contrast at least 4.5:1. Status is never shown by color alone.
- Visible focus rings (`ring`); full keyboard navigation on staff
  panels.
- Icon-only buttons have an `aria-label`.
- A control with visible text takes its accessible name from that text.
  Don't add an `aria-label` that replaces it; add `sr-only` text for
  extra context instead (e.g. "24m" on screen, "24 minutes" for screen
  readers). axe flags a mismatch as serious.
- Dialogs, drawers and modals are accessible (focus trap, Escape to
  close, labelled).
- `aria-live="polite"` on the patient status area and the Now serving
  card.
- Respect `prefers-reduced-motion` (no pulse or vibration).
- Charts are decoration for numbers already shown as text; hide pure
  shapes (sparklines, waves) from screen readers.

## 9. Definition of done for every screen

- [ ] Every button works.
- [ ] Uses only the tokens and classes in this file.
- [ ] Works at 390px, 834px and 1280px.
- [ ] Data-driven pages have loading, empty, error and success states.
- [ ] Forms have labels and both client and server validation.
- [ ] Passes keyboard navigation and contrast checks.
- [ ] Covered by a Playwright test for its main flow.
- [ ] Mock data, if any, is clearly marked as mock.
- [ ] No unrelated pages were redesigned in the same change.
