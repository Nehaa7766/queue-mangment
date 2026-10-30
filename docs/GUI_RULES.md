# QueueCare --- GUI Rules

The design contract every screen must follow. It condenses
[PLAN.md §12](PLAN.md#12-gui-plan-and-ui-design-queuecare) into rules
and Tailwind class names. For screen-by-screen content (panels, pages,
routes, the receptionist reference screen), use PLAN.md §12.7--§12.9.
Keep the two files consistent: change both in the same pull request.

## 1. Brand

- Product name: **QueueCare**.
- Look: "slate sidebar, terracotta action". Calm cream page, white
  cards, one terracotta button per screen for the most important action.
- Logo block: 36px slate square with a sand "Q", then the product name.
- Light theme only in v1.

## 2. Colors

Tokens live in `src/app/globals.css` (`@theme`, Tailwind v4). Use the
class names below --- never raw hex values in components. Tailwind's
built-in `slate-*` and `stone-*` scales are removed so they cannot be
mixed up with the brand colors; do not use other built-in palettes
(`gray-*`, `zinc-*`, etc.) either.

### Brand

| Class name | Hex | Use |
|---|---|---|
| `charcoal` | `#2A2D34` | Body text, headings, dark accents |
| `slate` | `#475C6C` | Active nav item, ticket stub, chart line, avatars, links |
| `slate-hover` | `#5A7182` | Hover on slate surfaces |
| `slate-tint` | `#E6ECF0` | Info banners, slate icon circles, chart area fill |
| `slate-muted` | `#DCE3E8` | Small labels on slate |
| `stone` | `#8A8583` | Decoration only (chart segments, dividers). **Never text.** |
| `sand` | `#EED7A1` | Highlights, badges on dark, accents on slate |
| `cream` | `#F7EFD2` | Icon tiles, chart tracks, waiting ticket stubs, hover tint |
| `terracotta` | `#CD8B62` | Primary action, count badges, "current" highlight |
| `terracotta-text` | `#B4532A` | "Over target" numbers, bad trends (readable terracotta) |

### Surfaces and shadcn/ui roles

| Class name | Value | Use |
|---|---|---|
| `background` | `#FBF7EC` | Page background |
| `foreground` | charcoal | Default text |
| `card` | `#FFFFFF` | Cards |
| `border` | `#E9E2D0` | Card borders, inputs |
| `input` | same as `border` | Form field borders |
| `divider` | `#F3EEDF` | Row dividers inside cards |
| `muted-foreground` | `#5F5A57` | Secondary text, labels, captions (passes 4.5:1 on white and cream) |
| `muted` | `#F3EEDF` | **Background only** (shadcn role) --- not a text color |
| `primary` / `primary-foreground` | terracotta / charcoal | Primary buttons |
| `secondary` | slate-tint | Secondary surfaces |
| `accent` | cream | Hover states |
| `destructive` | `#B91C1C` | Destructive actions and errors |
| `ring` | slate | Focus rings |

### Status styles

Always pair a status color with a text label.

| Style | Classes | Used for |
|---|---|---|
| Waiting / Called | `bg-status-wait text-status-wait-foreground` | `WAITING`, `CALLED` |
| In consultation | `bg-slate text-white` | `IN_SERVICE` |
| Done / Available | `bg-status-done text-status-done-foreground` | `COMPLETED`, doctor available |
| No-show / Emergency | `bg-status-miss text-status-miss-foreground` | `SKIPPED` |
| Paused / Off | `bg-status-off text-status-off-foreground` | `CANCELLED`, queue `PAUSED` / `CLOSED`, doctor off |

This mapping (from PLAN.md §12.2) is implemented in the status pills
(`src/components/queue/status-pill.tsx`,
`src/components/patient/status-pill.tsx`). Change it there and here
together.

### Color rules

- Never put white text on terracotta, sand or cream --- use charcoal.
- Terracotta fill marks the **single** most important action on screen.
- Good trends: `text-status-done-foreground` (green) with ↗. Bad trends:
  `text-terracotta-text` with ↘. Never color alone.
- `stone` is for non-text decoration only.

## 3. Typography

| Role | Font | Classes |
|---|---|---|
| Page title | Plus Jakarta Sans | `font-display text-[26px] font-bold` |
| Token, patient hero | Plus Jakarta Sans | `font-display text-[56px] sm:text-[64px] font-extrabold tabular-nums` |
| Token, ticket stub | Plus Jakarta Sans | `font-display font-extrabold tabular-nums`, 28--52px |
| Card title | Plus Jakarta Sans | `font-display text-base font-bold` |
| KPI value | Plus Jakarta Sans | `font-display text-[26px] font-bold tabular-nums` |
| Body, list rows | Inter | `text-sm`, weight 400--600 |
| Labels, buttons | Inter | 13--15px, `font-medium` or `font-semibold` |
| Section labels ("UP NEXT") | Inter | `text-[11px] font-semibold uppercase tracking-[0.06em]` (up to `0.08em`) |
| Captions, timestamps | Inter | `text-xs` |
| Hindi / Marathi | Noto Sans Devanagari | Automatic fallback in `font-sans` |

- `font-sans` (Inter, then Noto Sans Devanagari) is the default; use
  `font-display` only for titles, tokens and KPI values.
- Use `tabular-nums` on tokens, times, counts and table numbers.
- Patient screens: body text at least 16px (`text-base`).

## 4. Spacing, shape, elevation

- 8px spacing grid. Card padding 16--20px (`p-4`--`p-5`). Gap between
  cards 14px (`gap-3.5`).
- Cards: `rounded-card border border-border bg-card`, **no shadow**.
- Buttons: `rounded-btn`. Heights: 36px compact (`h-9`), 40--48px
  default (`h-10`--`h-12`), 52--56px phone primary (`h-13`--`h-14`).
- Pills and badges: `rounded-full`.
- Icon tiles: 38px, 10px radius, `bg-cream text-slate`.
- Tap targets: at least 48px (`min-h-12`) on phones and patient screens.

## 5. Signature components

Build these once in `src/components/queue/` and reuse them.

### Ticket stub --- "Now serving"

The main identity element; it echoes the printed token slip.

- Stub: `bg-slate`; label in `text-slate-muted`; token in white; room in
  `text-sand`.
- Perforation: 2px dashed border in the page color, with two 18px
  half-circle notches at top and bottom.
- "Called" tag uses the Waiting / Called status style.
- Grace bar: 6px tall, `bg-cream` track, `bg-terracotta` fill.
- Buttons: **Call next** = `bg-terracotta text-charcoal` with an `N`
  shortcut hint. Recall and Skip = white with a border.
- Phone: stub on top, perforation runs horizontally.
- Patient token page uses the same stub as the hero.

### Mini ticket rows --- "Up next"

- First row: slate stub, white token, subtitle ends with "· next up".
- Other rows: cream stub, charcoal token.
- Waited time turns `text-terracotta-text` when over the clinic's wait
  target (default 20 min, from queue settings).
- Desktop: small "Details" button. Phone: the whole row is tappable.

### KPI card

- Left: label (13px, `text-muted-foreground`) and value (26px bold).
  Right: cream icon tile.
- Trend line below: colored arrow and number (`↗ +4`) plus a muted
  comparison (`vs last hour`).

### Other shared components

Status pill, token chip, count badge (`bg-terracotta text-charcoal`),
data list row, activity row (34px colored icon circle, title, subtitle,
time), donut chart with center total, line chart, bar chart, side
drawer, modal, toast with Undo, banner (paused / offline / doctor on
break), skeleton loader, empty state, form fields with inline
validation, toggle, select.

## 6. Layout

| Width | Navigation | Notes |
|---|---|---|
| Phone, below 768px (default) | Slate top bar (logo, clinic name, bell) + bottom tab bar | Tabs are the nav items marked `tab: true` in `src/components/layout/staff-nav.ts` (at most four per role), plus Profile (the account menu). Reception and admin get the raised terracotta Walk-in button in the middle. Reception: Overview · Queue · Walk-in · History · Profile. Now serving first, full-width 56px Call next. KPIs 2 × 2. Charts hidden. |
| Tablet, `md` (768--1023px) | 72px slate icon rail; active icon on cream; badges stay | Search becomes an icon button. KPIs stay 4 across. Two-column grids stack or go 2-up. |
| Desktop, `lg` (1024px+) | 236px white sidebar with right border | Grouped sections with uppercase labels. Active item `bg-slate text-white`; hover `bg-cream`. |

- Desktop header: 26px page title with a status line under it on the
  left; search (240px), bell, avatar + name + role on the right.
- Content padding 22--26px on the page background.
- Patient screens are mobile-first, have no staff navigation and no
  login.

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
