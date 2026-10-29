# Clinic Queue Management System --- End-to-End Project Plan

## 1. Project Overview

**Project name:** Clinic Queue Management System\
**Brand name:** QueueCare (see Section 12 for the UI design)\
**Product goal:** Reduce uncertainty and manual work around clinic
waiting queues. Patients can join a clinic queue by scanning a permanent
QR code, while clinic staff manage the queue through role-specific
dashboards.

### Problem to solve

Patients often do not know how long they must wait or whether their turn
is near. Reception staff manage queues manually, and doctors may not
have a clear view of the next patient.

### Proposed solution

-   Patients scan a clinic QR code, select a service, and explicitly
    join the queue.
-   Patients receive a token and can check their status from their
    phone.
-   Receptionists register walk-ins and manage the waiting list.
-   Doctors call, start, and complete consultations.
-   Clinic owners configure services, staff, hours, and queue policies.
-   Platform administrators manage clinics and subscriptions after the
    product is validated.

### Product principles

-   Solve a real workflow problem before adding advanced features.
-   Keep patient onboarding simple; no patient account is required for
    the MVP.
-   Treat PostgreSQL as the source of truth.
-   Protect clinic data through tenant isolation and server-side
    authorization.
-   Never promise an exact waiting time; show an estimate or range.
-   Keep the first release small enough to pilot with a real clinic.

## 2. Goals and Success Measures

### MVP goals

1.  A patient can join a queue using a clinic QR code.
2.  A patient can safely refresh and view their token status.
3.  Reception can add walk-in patients and manage queue states.
4.  Doctors can start and complete a consultation.
5.  Clinic admins can manage services, staff, and opening hours.
6.  Queue operations remain correct when multiple staff members act at
    nearly the same time.
7.  The system is usable on phones, tablets, and desktop computers.

### Pilot metrics

-   Time required for a patient to join the queue.
-   Number of duplicate or failed token creations.
-   Average and median waiting time.
-   Number of skipped, cancelled, and completed tokens.
-   Reception staff feedback and reduction in manual queue questions.
-   Staff-reported usability issues.
-   Reliability of queue actions and status updates.

## 3. Users and Permissions

### Patient

-   View public clinic details and active services.
-   Join an open queue.
-   View their token, status, people ahead, and approximate waiting
    time.
-   View their turn and completion status.

### Receptionist

-   View the queue for their assigned clinic.
-   Register walk-ins.
-   Call next, recall, skip, or requeue a token according to policy.
-   Pause and resume a queue if authorized.
-   View permitted queue history.

### Doctor

-   View their assigned queue or patients.
-   Start and complete consultations.
-   Update availability and expected delay if allowed.
-   View only the minimum history needed for queue operations.

### Clinic Owner / Admin

-   Manage clinic profile, services, staff, and permissions.
-   Configure opening hours, holidays, and queue policies.
-   Manage the clinic's permanent QR code.
-   View operational analytics and audit activity.

### Platform Super Admin

-   Manage clinic accounts, users, plans, subscriptions, and platform
    support.
-   Access sensitive clinic information only when necessary and
    authorized.
-   Have administrative actions audited.

**Authorization rule:** Hiding a button is not security. Every protected
API request must verify authentication, role, clinic membership, and
resource ownership on the server.

## 4. MVP Scope

### Included

-   Clinic public page and service selection.
-   QR-based queue joining.
-   Patient token status page.
-   Receptionist live queue and walk-in registration.
-   Call Next, Recall, Skip, and approved requeue behavior.
-   Doctor queue, Start Consultation, and Complete Consultation.
-   Clinic service and staff management.
-   Clinic opening hours and queue pause/resume.
-   Basic operational analytics.
-   Audit trail for important staff actions.
-   Responsive layouts, loading/empty/error states, and automated tests.

### Excluded from the first MVP

-   Electronic medical records, diagnoses, prescriptions, and medical
    triage.
-   Complex appointment booking and calendar synchronization.
-   Online payments and insurance claims.
-   SMS or WhatsApp notifications until the workflow is validated.
-   Multiple branches, advanced enterprise reporting, and complex
    billing.
-   Microservices or a dedicated real-time infrastructure before
    necessary.

## 5. Recommended Technology Stack

### Frontend

-   Next.js App Router.
-   React and TypeScript.
-   Tailwind CSS.
-   shadcn/ui.
-   Lucide icons.
-   Recharts for useful analytics.
-   React Hook Form and Zod for forms where appropriate.
-   Plus Jakarta Sans, Inter, and Noto Sans Devanagari via
    `next/font/google`.

### Backend

-   Next.js Route Handlers for the initial modular monolith.
-   A dedicated queue service layer for business rules.
-   Zod validation for incoming request data.
-   A maintained authentication/session solution.
-   Server-side role and tenant authorization.

### Data and operations

-   PostgreSQL.
-   Prisma ORM and migrations.
-   Vitest for unit/integration tests.
-   React Testing Library for UI tests.
-   Playwright for critical end-to-end workflows.
-   A hosting platform that supports the chosen Next.js deployment
    model.
-   Managed PostgreSQL with backups and a documented restore process.

### Real-time updates

-   Start with polling at a reasonable interval for the patient status
    page and staff queue.
-   Consider Server-Sent Events when the deployment supports long-lived
    connections reliably.
-   Add a dedicated real-time service or message broker only when
    measured needs justify it.
-   PostgreSQL remains the source of truth.


## Recommended Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js App Router | Application pages and routing |
| Language | TypeScript | Type safety and maintainable code |
| Styling | Tailwind CSS | Responsive styling |
| UI components | shadcn/ui | Reusable interface components |
| Icons | Lucide React | Consistent icons |
| Backend/API | Next.js Route Handlers | API endpoints and server-side logic |
| Database | PostgreSQL | Store clinics, users, queues, tokens, and audit events |
| ORM and migrations | Prisma | Database access and schema migrations |
| Validation | Zod | Validate API requests and form data |
| Authentication | Auth.js or another maintained session solution | Login and session management |
| Forms | React Hook Form + Zod | Form state and validation |
| Charts | Recharts | Operational dashboards and analytics |
| Unit testing | Vitest | Test queue rules and business logic |
| Component testing | React Testing Library | Test React components |
| End-to-end testing | Playwright | Test complete user workflows |

### Stack rules
- Prefer the dependencies already installed in the repository where suitable.
- Keep the initial application as a modular monolith.
- Do not add microservices, Redis, or a dedicated real-time service until measured requirements justify them.
- PostgreSQL is the source of truth for queue state.
- Use Prisma migrations for database changes.
- Keep secrets in environment variables or a secret manager; never commit real credentials.

## Email and Notifications

**Recommended email provider: Resend.** Email is optional for the MVP; joining the queue must work even if a patient does not provide an email address.

### Email use cases
- Staff invitation emails.
- Optional patient token confirmation.
- Optional queue or turn notifications, if validated with pilot clinics.

### Implementation rules
- Integrate the Resend SDK on the server only.
- Keep the Resend API key in an environment variable named `RESEND_API_KEY`.
- Configure `EMAIL_FROM` using a sender address on a domain verified with Resend.
- Never expose the API key to browser code or commit it to source control.
- Do not send email directly from a client component.
- For durable post-commit notifications, write an OutboxEvent in the same database transaction as the relevant queue action, then process it with a background worker.
- Make notification processing idempotent and retry transient failures with bounded backoff.
- Email failure must not roll back a successfully created queue token.
- Do not include unnecessary sensitive patient information in email content or logs.
- In local development, use a test sender or mock email service and do not send real patient notifications.

### Environment variables example

```env
DATABASE_URL="your_postgresql_connection_string"
RESEND_API_KEY="your_resend_api_key"
EMAIL_FROM="Clinic Queue <notifications@your-verified-domain.com>"
```

These are example values only. Use real values in local environment configuration or a secret manager, and keep `.env` files containing secrets out of version control. Verify the sending domain with Resend before production email delivery.

## 6. Architecture

Use a **modular monolith** for the first release. Keep modules separated
in code without deploying them as independent services.

Detailed architecture --- layers, an example request flow, the Docker
setup and the architecture decisions: see `ARCHITECTURE.md`.

``` text
Patient / Receptionist / Doctor / Clinic Admin
                    |
                 Next.js UI
                    |
        Route Handlers / API Layer
                    |
    Authentication + Authorization + Validation
                    |
       Domain Services / Business Rules
       |            |             |
   Queue Service  Clinic Service  Staff Service
       |            |             |
       +--------- Prisma ----------+
                    |
               PostgreSQL
                    |
        Audit Events / Outbox Events
                    |
        Background Worker (when needed)
                    |
          Email Provider (optional)
```

### Responsibilities

-   **UI:** Present data and capture user actions.
-   **API layer:** Authenticate, authorize, validate, call services, and
    return safe responses.
-   **Domain services:** Enforce queue and clinic rules.
-   **Database:** Persist the source of truth and enforce constraints.
-   **Outbox worker:** Process durable post-commit work, such as email
    notifications.
-   **Audit log:** Record important staff and administrative actions.

Do not put all queue logic directly in React components or API route
files.

## 7. Repository Structure

Current, annotated layout: see `FOLDER_STRUCTURE.md`.

``` text
clinic-queue-management/
├── .github/
│   └── workflows/
├── docker/
│   └── postgres/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── FOLDER_STRUCTURE.md
│   ├── GUI_RULES.md
│   ├── PHASES.md
│   └── PLAN.md
├── Dockerfile
├── docker-compose.yml
├── README.md
├── package.json
├── prisma.config.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
│   └── images/
└── src/
    ├── app/
    │   ├── (public)/
    │   │   ├── q/[clinicSlug]/page.tsx
    │   │   └── token/[publicTokenId]/page.tsx
    │   ├── (auth)/
    │   │   └── login/page.tsx
    │   ├── (staff)/
    │   │   ├── receptionist/
    │   │   └── doctor/
    │   ├── (clinic-admin)/
    │   │   └── admin/
    │   ├── (platform-admin)/
    │   │   └── super-admin/
    │   └── api/
    ├── components/
    │   ├── ui/
    │   ├── layout/
    │   ├── queue/
    │   ├── forms/
    │   └── charts/
    ├── features/
    │   ├── auth/
    │   ├── clinics/
    │   ├── services/
    │   ├── queue/
    │   ├── staff/
    │   ├── analytics/
    │   └── audit/
    ├── lib/
    │   ├── auth/
    │   ├── db/
    │   ├── validation/
    │   └── errors/
    └── tests/
        ├── unit/
        ├── integration/
        └── e2e/
```

Adapt this structure to the existing repository rather than moving or
rewriting files without a clear need.

## 8. Database Design

Use UUIDs or similarly non-guessable identifiers for internal/public
references as appropriate. Public token lookup should use an unguessable
identifier, not an incrementing database ID.

### Core models

**Clinic** - id - name - slug (unique) - timezone - address/contact
fields as required - opening-hours configuration - status - createdAt,
updatedAt

**User** - id - name - email (unique where applicable) - password hash
or external identity fields - status - createdAt, updatedAt

**ClinicMembership** - id - clinicId - userId - role - status - unique
constraint on clinicId + userId

**Service** - id - clinicId - name - description (optional) -
estimatedDurationMinutes - isActive - createdAt, updatedAt

**Queue** - id - clinicId - serviceId - queueDate or operating-session
identifier - status (OPEN, PAUSED, CLOSED) - next sequence allocation
strategy - createdAt, updatedAt

**QueueToken** - id - publicTokenId (unique, unguessable) - queueId -
sequenceNumber - tokenNumber (display label, e.g. A-101) - serviceId -
status - joinedAt - calledAt (optional) - serviceStartedAt (optional) -
completedAt (optional) - skippedAt (optional) - createdByUserId
(optional for public joins) - idempotency key or linked idempotency
record - createdAt, updatedAt

**QueueEvent / AuditEvent** - id - clinicId - queueId/tokenId where
applicable - actorUserId (nullable for system/public action where
appropriate) - action - previousState / newState where useful - minimal
metadata - createdAt

**OutboxEvent** - id - eventType - aggregateId - payload - createdAt -
processedAt - attemptCount - lastError (sanitized)

**IdempotencyRecord** (if not stored directly on the token) - id -
scope - idempotencyKey - request fingerprint - response reference -
createdAt - unique constraint on scope + idempotencyKey

### Database rules

-   Use foreign keys and appropriate indexes.
-   Enforce unique clinic slugs and membership constraints.
-   Enforce `@@unique([queueId, sequenceNumber])`.
-   Add indexes for queueId + status + sequenceNumber, clinicId +
    createdAt, and publicTokenId.
-   Define queue-date and timezone semantics before implementation.
-   Use migrations; do not manually edit production database schemas.
-   Never rely on a database sequence alone to enforce all queue
    business rules.
-   Keep personally identifiable information to a minimum.

## 9. Queue Business Rules

Write these rules down and test them before building the complete UI.

1.  Scanning a QR code does not create a token.
2.  Selecting a service does not create a token.
3.  A token is created only after the patient explicitly confirms Join
    Queue.
4.  Only active services and open queues can accept new tokens.
5.  Repeated requests with the same idempotency key must not create
    duplicate tokens.
6.  Each queue sequence number must be unique.
7.  Call Next selects the next eligible waiting token according to the
    agreed policy.
8.  A token cannot be called twice concurrently.
9.  Only valid state transitions are permitted.
10. A doctor cannot start a second active consultation if the clinic
    policy permits only one at a time.
11. Paused or closed queues must follow clearly defined behavior.
12. Skipping, recalling, requeuing, and cancelling must follow
    documented clinic policies.
13. ETA is an estimate, not a guarantee.
14. Queue position must exclude states that are no longer waiting.
15. Every consequential staff action must be audited.
16. Queue operations must be safe when two staff members act at the same
    time.
17. Patient status endpoints must return only the minimum information
    required.
18. Notification failure must not undo a successfully committed token
    creation.

### State transitions

``` text
WAITING -> CALLED -> IN_SERVICE -> COMPLETED
   |          |
   |          +-> SKIPPED -> WAITING (only if policy permits)
   +-> CANCELLED
```

Define recall behavior separately: recalling a called token should not
create a second token. Do not permit arbitrary transitions from the UI.

## 10. Concurrency, Idempotency, and Reliability

### Token allocation

-   Perform sequence allocation and token creation in a transaction.
-   Use an appropriate row lock, atomic counter, or other database-safe
    allocation strategy.
-   Keep the unique queueId + sequenceNumber constraint as a final
    integrity guard.
-   Handle uniqueness conflicts safely and return a meaningful response.
-   Test concurrent requests; `$transaction()` alone does not guarantee
    serialized allocation.

### Call Next

-   Use transaction-safe selection/locking or a conditional atomic
    update so only one staff request can claim a waiting token.
-   Re-check queue status and authorization within the operation.
-   Record the state transition and audit event atomically.
-   Return a conflict response if the token was already claimed or the
    queue state changed.

### Idempotency

-   Require an idempotency key for token creation.
-   Scope keys to the clinic/queue and caller or public flow as
    appropriate.
-   Store enough information to return the original result for a safe
    retry.
-   Reject reuse of the same key with a materially different request.

### Outbox and notifications

-   Commit token, audit event, and outbox event in the same database
    transaction when applicable.
-   Process the outbox asynchronously.
-   Retry transient email failures with bounded backoff.
-   Make worker processing idempotent.
-   Do not store secrets or sensitive patient data in logs.

## 11. API Plan

All request bodies must be validated. Protected endpoints must enforce
server-side authorization and tenant isolation.

### Public endpoints

-   `GET /api/public/clinics/[clinicSlug]` --- safe public clinic
    details and active services.
-   `POST /api/queues/[queueId]/tokens` --- join an open queue.
-   `GET /api/public/tokens/[publicTokenId]` --- minimal token status.

### Receptionist endpoints

-   `GET /api/queues/[queueId]/tokens` --- permitted queue view.
-   `POST /api/queues/[queueId]/call-next` --- call next eligible token.
-   `POST /api/tokens/[tokenId]/recall` --- recall according to policy.
-   `POST /api/tokens/[tokenId]/skip` --- skip a token.
-   `POST /api/tokens/[tokenId]/requeue` --- requeue only if policy
    permits.
-   `POST /api/queues/[queueId]/pause` --- pause queue.
-   `POST /api/queues/[queueId]/resume` --- resume queue.
-   `POST /api/queues/[queueId]/walk-ins` --- create walk-in token with
    required minimum data.

### Doctor endpoints

-   `GET /api/doctor/queue` --- queue visible to the current doctor.
-   `POST /api/tokens/[tokenId]/start` --- start consultation.
-   `POST /api/tokens/[tokenId]/complete` --- complete consultation.
-   `POST /api/doctor/availability` --- update availability if allowed.

### Clinic admin endpoints

-   `GET/POST /api/clinics/[clinicId]/services`
-   `PATCH/DELETE /api/services/[serviceId]` (soft-disable where history
    must be preserved)
-   `GET/POST /api/clinics/[clinicId]/staff`
-   `PATCH /api/clinics/[clinicId]/settings`
-   `GET /api/clinics/[clinicId]/analytics`
-   `GET /api/clinics/[clinicId]/audit`

Use consistent HTTP status codes and a stable error shape, for example:

``` json
{
  "error": {
    "code": "QUEUE_PAUSED",
    "message": "This queue is temporarily paused."
  }
}
```

Do not return stack traces or internal database errors to clients.

## 12. GUI Plan and UI Design (QueueCare)

**Brand name:** QueueCare. This section is the UI design reference for
implementation, merged from `queuecare-design-spec.md` (last updated
30 Oct 2026). Keep `GUI_RULES.md` as the shared design contract and keep
it consistent with this section.

### 12.1 UI goals

-   Patients see their token, position and estimated wait on a phone
    with **no login**.
-   Reception can call, recall, skip and register walk-ins in **one or
    two clicks**.
-   Doctors see only what they need: current patient, up next, a status
    toggle.
-   Owners manage clinic setup and read analytics.
-   The product looks professional and can be demoed in 30 seconds.

### 12.2 Color palette

Six base colors, used in the "slate sidebar / terracotta action"
combination.

| Token | Hex | Role |
|---|---|---|
| `charcoal` | `#2A2D34` | Body text, headings, dark accents, donut segment |
| `slate` | `#475C6C` | Active nav item, ticket stub, chart line, avatars, links |
| `stone` | `#8A8583` | Decorative only (chart segment, dividers). **Not for text** (fails contrast on white) |
| `sand` | `#EED7A1` | Highlights, badges on dark, accents on slate |
| `cream` | `#F7EFD2` | Icon tiles, chart tracks, waiting ticket stubs, hover tint |
| `terracotta` | `#CD8B62` | Primary action (Call next, + Walk-in), count badges, "current" highlight |

#### Supporting neutrals

| Token | Hex | Use |
|---|---|---|
| `page` | `#FBF7EC` | Page background |
| `surface` | `#FFFFFF` | Cards |
| `border` | `#E9E2D0` | Card borders, inputs |
| `divider` | `#F3EEDF` | Row dividers inside cards |
| `muted` | `#5F5A57` | Secondary text, labels, captions (passes 4.5:1 on white and cream) |
| `slate-tint` | `#E6ECF0` | Info banners, slate icon circles, chart area fill |
| `terracotta-text` | `#B4532A` | "Over target" numbers, bad trends (readable terracotta for text) |
| `on-slate-muted` | `#DCE3E8` | Small labels on slate |

#### Status colors (always paired with a text label)

| Status | Background | Text |
|---|---|---|
| Waiting / Called | `#F6EFA6` | `#5C5410` |
| In consultation | `#475C6C` | `#FFFFFF` |
| Done / Available | `#DCFCE7` | `#15803D` |
| No-show / Emergency | `#FEE2E2` | `#B91C1C` |
| Paused / Off | `#F1ECE4` | `#5F5A57` |

Proposed mapping to the token states in Section 9 (confirm before
implementation):

| Token / queue state | Status style | Label |
|---|---|---|
| `WAITING` | Waiting / Called | Waiting |
| `CALLED` | Waiting / Called | Called |
| `IN_SERVICE` | In consultation | In consultation |
| `COMPLETED` | Done / Available | Done |
| `SKIPPED` | No-show / Emergency | Skipped / No-show |
| `CANCELLED` | Paused / Off | Cancelled |
| Queue `PAUSED` / `CLOSED` | Paused / Off | Paused / Closed |

#### Usage rules

-   Never put white text on terracotta, sand or cream --- use charcoal.
-   Terracotta fill = the single most important action on screen.
-   Good trends are green `#15803D`; bad trends are `#B4532A`. Always
    add an arrow (↗ ↘), never color alone.
-   `stone` is only for non-text decoration.

### 12.3 Typography

| Role | Font | Size / weight |
|---|---|---|
| Page title | Plus Jakarta Sans | 26px / 700 |
| Token (hero, patient screen) | Plus Jakarta Sans | 56–64px / 800 |
| Token (ticket stub) | Plus Jakarta Sans | 28–52px / 800 |
| Card title | Plus Jakarta Sans | 16px / 700 |
| KPI value | Plus Jakarta Sans | 26px / 700 |
| Body, list rows | Inter | 14px / 400–600 |
| Labels, buttons | Inter | 13–15px / 500–600 |
| Section labels (sidebar, "UP NEXT") | Inter | 11px / 600, uppercase, 0.06–0.08em tracking |
| Captions, timestamps | Inter | 12px / 400 |
| Hindi / Marathi | Noto Sans Devanagari | fallback |

-   Use `font-variant-numeric: tabular-nums` on tokens, times, counts
    and table numbers.
-   Minimum 16px body text on patient screens.

### 12.4 Spacing, shape, elevation

-   8px spacing grid. Card padding 16–20px. Gap between cards 14px.
-   Cards: `12px` radius, `1px solid #E9E2D0`, no shadow.
-   Buttons: `8–10px` radius. Height 36px (compact), 40–48px (default),
    52–56px (phone primary).
-   Pills and badges: fully rounded.
-   Icon tiles: 38px, `10px` radius, cream background, slate icon.
-   Tap targets: 48px minimum on phone and patient screens.

### 12.5 Signature components

#### Ticket stub --- "Now serving"

The main identity element. Echoes the printed token slip.

``` text
┌──────────┬╌┬────────────────────────────────────────────┐
│ NOW      ┊ │ Priya R.                    [Called 1:42]  │
│ SERVING  ┊ │ General · Dr. Anjali Shah                  │
│  A-17    ┊ │ ▓▓▓▓▓░░░░░░░  3:18 left before auto-skip   │
│ Room 2   ┊ │ [   Call next  N  ] [ Recall ] [  Skip  ]  │
└──────────┴╌┴────────────────────────────────────────────┘
  slate stub    white body
```

-   Stub: slate background, label `#DCE3E8`, token white, room in sand.
-   Perforation: `2px dashed` border in the page color, plus two 18px
    half-circle notches at top and bottom.
-   Called tag: Waiting status colors.
-   Grace bar: 6px, cream track, terracotta fill.
-   Buttons: **Call next** = terracotta fill + charcoal text + `N`
    shortcut. Recall / Skip = white with border.
-   Phone: stub sits on top, perforation runs horizontally.

#### Mini ticket rows --- "Up next"

``` text
┌──────┬╌┬──────────────────────────┬─────────┐
│ A-18 ┊ │ Arjun M.                 │    24m  │  ← slate stub (next up)
│      ┊ │ General · next up        │  waited │     wait > target = #B4532A
└──────┴╌┴──────────────────────────┴─────────┘
┌──────┬╌┬──────────────────────────┬─────────┐
│ B-08 ┊ │ Sana K.                  │    19m  │  ← cream stub
│      ┊ │ Pediatrics               │  waited │
└──────┴╌┴──────────────────────────┴─────────┘
```

-   First row: slate stub + white token, subtitle adds "· next up".
-   Other rows: cream stub + charcoal token.
-   Waited value turns `#B4532A` when over the clinic's target (default
    20 min, from Admin › Queue rules).
-   Desktop adds a small "Details" button; on phone the whole row is
    tappable.

#### KPI card

-   Label (13px muted) + value (26px bold) on the left, cream icon tile
    on the right.
-   Trend line below: `↗ +4` (colored) + `vs last hour` (muted).

#### Other components

-   Status pill, token chip, count badge (terracotta, charcoal text).
-   Data list row, activity row (34px colored icon circle + title +
    subtitle + time).
-   Donut chart with center total and legend with counts.
-   Line chart (two series, dual axis), bar chart.
-   Side drawer, modal, toast with Undo, banner (paused / offline /
    doctor on break).
-   Skeleton loader, empty state, form fields with inline validation,
    toggle, select.

### 12.6 Layout

#### Desktop (1024px and up)

-   **Sidebar** 236px, white, right border.
    -   Logo block: 36px slate square with sand "Q", product name, panel
        name, collapse arrow.
    -   Grouped sections with uppercase labels.
    -   Active item: slate fill, white text. Hover: cream.
-   **Header row** inside content: 26px page title (+ status line under
    it) on the left; search (240px), bell, avatar + name + role on the
    right.
-   Content padding 22–26px on `#FBF7EC`.

#### Tablet (768–1023px)

-   Sidebar collapses to a 72px icon rail (slate), active icon on cream,
    badges stay.
-   Search becomes an icon button.
-   KPI cards stay 4 across, compact.
-   Two-column grids collapse to stacked or 2-up.

#### Phone (under 768px)

-   Slate top bar: logo, queue status pill, bell.
-   **Bottom tab bar**: Overview · Queue · Walk-in (raised terracotta
    FAB) · History · Profile.
-   Now serving ticket first, full-width 56px Call next button.
-   KPIs 2 × 2. Alert banner directly under KPIs. Charts are hidden.

Tailwind: `md:` = icon rail, `lg:` = full sidebar, below `md` = bottom
tabs.

### 12.7 Receptionist dashboard (R1) --- reference screen

``` text
┌ Sidebar ┐┌───────────────────────────────────────────────────────────┐
│ Q Queue ││ Dashboard                          [search] (bell) NS Neha │
│  Care   ││ ● Queue open · Thu, 29 Oct                                 │
│         ││ [Waiting 20] [Served 52] [Avg wait 18m] [No-shows 3]       │
│ MAIN    ││ ┌ Queue flow overview ────────┐ ┌ Waiting by service ──┐   │
│ ■ Dash  ││ │ line chart (waiting + wait) │ │ donut + legend       │   │
│   Live  ││ └─────────────────────────────┘ └──────────────────────┘   │
│   Walk  ││ ┌ Recent activity ────────────┐ ┌ Queue ───────────────┐   │
│ QUEUE   ││ │ called / walk-in / no-show  │ │ Now serving ticket   │   │
│ PEOPLE  ││ │ break / resumed             │ │ UP NEXT ticket rows  │   │
│ ACCOUNT ││ └─────────────────────────────┘ └──────────────────────┘   │
└─────────┘└───────────────────────────────────────────────────────────┘
```

| Block | Content |
|---|---|
| KPIs | Waiting now (vs last hour), Served today, Average wait, No-shows (vs same weekday) |
| Queue flow overview | Patients waiting (slate line + light fill) and avg wait in minutes (terracotta line); range: Today / 7 days / 30 days |
| Waiting by service | Donut: slate, terracotta, sand, stone, charcoal; center total |
| Recent activity | Token called, walk-in registered, no-show (terracotta icon), doctor break (sand icon), queue paused/resumed |
| Queue | Compact Now serving ticket + 4 Up next ticket rows + "Open live queue" |

Sidebar groups: **Main** (Dashboard, Live queue, Register walk-in) ·
**Queue** (Pause and resume, Queue history, Token details) · **People**
(Patients today, Doctors on duty) · **Account** (My profile, Logout).

### 12.8 Panels, pages and routes

#### Patient panel --- mobile-first, no login, no staff sidebar

1.  Clinic landing page
2.  Service selection
3.  Join queue confirmation
4.  My token / queue status (ticket stub as hero)
5.  Your turn notification
6.  Visit completed
7.  Queue closed / unavailable

Routes: `/q/[clinicSlug]`, `/token/[publicTokenId]`

#### Receptionist panel --- desktop-first

1.  Overview dashboard
2.  Live queue management
3.  Register walk-in patient (drawer)
4.  Call next patient
5.  Recall patient
6.  Skip patient
7.  Pause / resume queue
8.  Queue history
9.  Token details

Routes: `/receptionist`, `/receptionist/queue`, `/receptionist/walk-in`,
`/receptionist/history`

#### Doctor panel

1.  Doctor dashboard
2.  My queue
3.  Current consultation
4.  Start consultation
5.  Complete consultation
6.  Consultation history
7.  Availability management
8.  Delay / break management

Routes: `/doctor`, `/doctor/queue`, `/doctor/consultation`,
`/doctor/history`, `/doctor/availability`

Show only name, token and service. No medical data.

#### Clinic admin / owner panel

1.  Admin dashboard
2.  Services management
3.  Doctors management (profile cards)
4.  Staff management
5.  Role and permission management
6.  Clinic profile
7.  Opening hours and holidays
8.  Queue settings (max size, grace period, wait target, no-show
    action)
9.  QR code management
10. Analytics and reports
11. Audit activity
12. Clinic account settings

Routes: `/admin/dashboard`, `/admin/services`, `/admin/doctors`,
`/admin/staff`, `/admin/roles`, `/admin/settings`, `/admin/qr-code`,
`/admin/analytics`, `/admin/audit`

#### Platform super admin --- build after MVP validation

1.  Platform dashboard
2.  Clinic management
3.  User management
4.  Plans and subscriptions
5.  Billing overview
6.  Platform activity logs
7.  Support / issue management
8.  Platform settings

Routes: `/super-admin/dashboard`, `/super-admin/clinics`,
`/super-admin/users`, `/super-admin/subscriptions`,
`/super-admin/billing`, `/super-admin/activity`,
`/super-admin/support`, `/super-admin/settings`

#### Authentication and common

Login · Forgot password · Reset password · Accept staff invitation ·
Unauthorized · 404 · Error page · Loading and offline states

### 12.9 UI build order

| Priority | Panel | First pages |
|---|---|---|
| 1 | Receptionist | Dashboard ✅ designed, Live queue, Walk-in |
| 2 | Patient | Clinic landing, Service selection, Token status |
| 3 | Doctor | Dashboard, My queue, Current consultation |
| 4 | Clinic admin | Dashboard, Services, Staff, QR code |
| 5 | Common | Auth, permissions, error states |
| 6 | Super admin | Clinics, Subscriptions, Platform dashboard |

### 12.10 Key interactions

-   **Live updates** without reload (polling first, per Section 5);
    brief highlight on changed numbers and pills.
-   **Call next**: keyboard shortcut `N`; disabled only while paused or
    empty (show reason on hover).
-   **Grace countdown** on the called token, then Recall / Skip /
    Re-queue.
-   **Optimistic UI** with rollback and an error toast.
-   **Estimates** shown as a range ("20–30 min"), "rough estimate" label
    when data is thin, "updated X min ago".
-   **Confirm** destructive actions (skip, close queue); reversible ones
    get an Undo toast.
-   **Language toggle** English / हिंदी / मराठी on the patient panel.

### 12.11 Accessibility

-   Text contrast ≥ 4.5:1. Never color alone for status --- always a
    label or arrow.
-   Visible focus rings; full keyboard navigation on staff panels.
-   Icon-only buttons have `aria-label`.
-   Accessible dialogs, drawers and modals.
-   `aria-live="polite"` on the patient status region and the Now
    serving card.
-   Respect `prefers-reduced-motion` (skip pulse and vibration).

### 12.12 Tailwind tokens

The project uses Tailwind v4, so these tokens live in the `@theme` block
of `src/app/globals.css`, not in `tailwind.config.js`. The snippet below
is the original token list; see `GUI_RULES.md` for the class names to
use.

``` js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        charcoal: '#2A2D34',
        slate: { DEFAULT: '#475C6C', tint: '#E6ECF0', hover: '#5A7182', muted: '#DCE3E8' },
        stone: '#8A8583',
        sand: '#EED7A1',
        cream: '#F7EFD2',
        terracotta: { DEFAULT: '#CD8B62', text: '#B4532A' },
        page: '#FBF7EC',
        line: { DEFAULT: '#E9E2D0', soft: '#F3EEDF' },
        muted: '#5F5A57',
        status: {
          waitBg: '#F6EFA6', waitText: '#5C5410',
          doneBg: '#DCFCE7', doneText: '#15803D',
          missBg: '#FEE2E2', missText: '#B91C1C',
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        sans: ['Inter', '"Noto Sans Devanagari"', 'sans-serif'],
      },
      borderRadius: { card: '12px', btn: '10px' },
    },
  },
};
```

Stack: Next.js, Tailwind CSS, shadcn/ui, Lucide icons, Recharts. Fonts
via `next/font/google`.

### 12.13 UI quality rules and per-screen definition of done

-   Every button must work.
-   Uses the tokens above (colors, fonts, radius, spacing).
-   Works at 390px, 834px and 1280px.
-   Every data-driven page includes loading, empty, error, and success
    states.
-   Forms need labels and client/server validation.
-   Passes keyboard navigation and contrast checks.
-   Covered by a Playwright test for its main flow.
-   Use mock data only when clearly identified during development.
-   Do not redesign unrelated pages during a scoped task.

### 12.14 Open design questions

-   Wait-time target: fixed 20 min or per service?
-   Print token slip: thermal printer size or browser print?
-   Priority tokens (seniors, emergencies) in v1?
-   Multi-language toggle in v1?
-   Earlier screens (Owner dashboard, Doctors, My profile, Patient
    profile) still need converting to this palette.
-   The UI build order (12.9) puts Receptionist before Patient, while
    the delivery phases (Section 16) build Patient (Phase 4) before
    Receptionist (Phase 5). Confirm which order to follow.

## 13. Authentication, Security, and Privacy

-   Use a maintained authentication solution and secure session
    handling.
-   Hash passwords using a reputable password hashing algorithm if
    password authentication is used.
-   Protect against broken access control, cross-tenant access, CSRF
    where relevant, XSS, injection, and brute-force abuse.
-   Validate and normalize input; use ORM parameterization and safe
    query patterns.
-   Rate-limit public token creation and other abuse-prone endpoints.
-   Do not trust client-supplied clinic IDs, roles, or ownership.
-   Enforce clinic membership and resource-level permissions on the
    server.
-   Use secure cookies and HTTPS in production.
-   Keep secrets in environment variables or a secret manager.
-   Do not expose database IDs, credentials, tokens, or stack traces
    unnecessarily.
-   Avoid collecting diagnosis, prescription, or other medical details
    in the MVP.
-   Define data retention, deletion, backup, and incident response
    policies.
-   Review applicable Indian privacy and data-protection requirements
    with qualified counsel before commercial deployment.

## 14. Error Handling and Observability

Create typed application errors such as: - `VALIDATION_ERROR` -
`UNAUTHENTICATED` - `FORBIDDEN` - `CLINIC_NOT_FOUND` - `QUEUE_CLOSED` -
`QUEUE_PAUSED` - `TOKEN_NOT_FOUND` - `INVALID_STATE_TRANSITION` -
`IDEMPOTENCY_CONFLICT` - `RATE_LIMITED` - `INTERNAL_ERROR`

Rules: - Map known errors to safe user-facing messages. - Log unexpected
errors with a correlation/request ID. - Never log passwords, session
tokens, or unnecessary patient information. - Track API error rates,
queue action failures, outbox failures, and database health. - Provide
health checks and a documented backup/restore process.

## 15. Testing Strategy

### Unit tests

-   Queue state transition rules.
-   Queue position and ETA calculations.
-   Opening-hours and pause rules.
-   Role and permission decisions.
-   Input validation and error mapping.

### Integration tests

-   Token creation persists expected records.
-   Duplicate idempotency key returns the original result.
-   Concurrent joins do not allocate duplicate sequence numbers.
-   Concurrent Call Next requests cannot call the same token twice.
-   Cross-clinic access is rejected.
-   Audit/outbox records commit consistently with the main action.

### End-to-end tests

-   Patient scans/opens QR, selects service, joins, and views token
    status.
-   Receptionist registers a walk-in and calls next.
-   Doctor starts and completes a consultation.
-   Admin creates a service and manages staff.
-   Closed/paused queue prevents joining.
-   Unauthorized roles cannot perform restricted actions.
-   Error, empty, loading, and mobile layouts work at 390px, 834px, and
    1280px.

Run lint, TypeScript checks, relevant tests, and a production build
before merging.

## 16. Delivery Phases

For a task-by-task breakdown of each phase, with tests, exit criteria
and the decisions each phase needs first, see `PHASES.md`.

### Phase 0 --- Product discovery

-   Interview 3--5 clinics.
-   Observe actual queue workflows.
-   Confirm FIFO or any priority rules, walk-in requirements, doctor
    assignment, skip grace period, opening hours, and notification
    preferences.
-   Choose one pilot clinic and define measurable success criteria.
-   **Deliverable:** validated MVP scope and workflow diagrams.

### Phase 1 --- Project foundation

-   Inspect repository and current dependencies.
-   Configure Next.js, TypeScript, Tailwind, shadcn/ui, Prisma, and
    PostgreSQL.
-   Add environment validation, linting, formatting, error handling, and
    test setup.
-   Add `GUI_RULES.md`, `PLAN.md`, and README.
-   Configure the QueueCare Tailwind tokens and fonts (Section 12.12).
-   **Deliverable:** running skeleton with a tested database connection.

### Phase 2 --- Data model and security foundation

-   Implement migrations and seed development data.
-   Build authentication and clinic membership.
-   Add server-side RBAC and tenant isolation.
-   Add audit and idempotency primitives.
-   **Deliverable:** protected, tested foundation.

### Phase 3 --- Queue domain service

-   Implement join queue, sequence allocation, status transitions,
    position calculation, and pause/close rules.
-   Implement safe concurrent Call Next.
-   Add audit/outbox writes and stable error codes.
-   Write unit and integration tests before polishing UI.
-   **Deliverable:** reliable queue API and concurrency tests.

### Phase 4 --- Patient experience

-   Build clinic landing page and service selection.
-   Build Join Queue interaction and confirmation.
-   Build token status page with approximate ETA.
-   Add closed, completed, unavailable, loading, and error states.
-   **Deliverable:** working QR-to-token journey.

### Phase 5 --- Receptionist panel

-   Build dashboard and live queue.
-   Add walk-in registration, Call Next, Recall, Skip, Pause/Resume, and
    history.
-   Add safe confirmations and feedback.
-   **Deliverable:** receptionist can run the queue end to end.

### Phase 6 --- Doctor panel

-   Build assigned queue, current patient, Start Consultation, Complete
    Consultation, and availability controls.
-   Enforce state transitions and role restrictions.
-   **Deliverable:** complete staff workflow.

### Phase 7 --- Clinic admin panel

-   Build service, staff, opening hours, queue policy, QR, analytics,
    and audit pages.
-   Ensure only clinic admins can change settings.
-   **Deliverable:** clinic can configure and operate itself.

### Phase 8 --- Notifications and live updates

-   Begin with polling.
-   Add outbox worker and email notifications only if needed.
-   Add SSE or another supported live-update mechanism if pilot feedback
    justifies it.
-   **Deliverable:** reliable status updates and optional notifications.

### Phase 9 --- Hardening and pilot

-   Run end-to-end, concurrency, access-control, and responsive tests.
-   Test backup restoration and deployment configuration.
-   Fix issues from clinic staff feedback.
-   Monitor queue errors and patient confusion.
-   **Deliverable:** pilot-ready release with rollback plan.

### Phase 10 --- Commercialization

-   Add onboarding, clinic setup, support workflows, pricing, and
    subscription billing after demand is validated.
-   Add platform Super Admin capabilities.
-   Consider multi-branch support and advanced analytics only when
    customer needs justify them.
-   **Deliverable:** repeatable onboarding and sustainable product
    operations.

## 17. Definition of Done

A feature is complete only when: - Acceptance criteria are documented. -
Authorization and tenant isolation are enforced server-side. - Input
validation and safe error responses exist. - Loading, empty, error, and
success states are handled. - Unit/integration/E2E tests are added at
the appropriate level. - Relevant lint, type-check, tests, and build
pass. - UI is responsive and accessible. - Audit records exist for
important state-changing actions. - No unrelated working functionality
was removed. - Documentation and environment examples are updated. -
Known limitations and follow-up tasks are recorded.

## 18. First Implementation Checklist

-   [ ] Interview clinics and confirm queue workflow.
-   [ ] Confirm token states and skip/requeue rules.
-   [ ] Create repository and `GUI_RULES.md`.
-   [ ] Initialize Next.js, TypeScript, Tailwind, and shadcn/ui.
-   [ ] Add QueueCare design tokens and fonts (Section 12.12).
-   [ ] Configure PostgreSQL and Prisma.
-   [ ] Define schema and first migration.
-   [ ] Add authentication and clinic membership.
-   [ ] Implement and test Queue Service.
-   [ ] Implement safe token allocation and idempotency.
-   [ ] Build patient QR journey.
-   [ ] Build receptionist live queue.
-   [ ] Build doctor workflow.
-   [ ] Build clinic admin configuration.
-   [ ] Add audit, error handling, and basic analytics.
-   [ ] Run security and concurrency tests.
-   [ ] Pilot with one clinic and gather feedback.
-   [ ] Prioritize improvements from real usage.

## 19. Product Decisions to Confirm Before Coding

-   Does the clinic use FIFO, or are appointments/emergencies
    prioritized?
-   Can a service be handled by multiple doctors?
-   Does each doctor have a separate queue or share a service queue?
-   What happens when a patient is called but does not arrive?
-   Can skipped patients rejoin, and where in the order?
-   Can patients cancel their token?
-   Can patients join remotely or only while physically at the clinic?
-   Is phone number collection required, optional, or avoided?
-   What does a paused queue mean for already waiting patients?
-   How are queue sessions reset each day and token labels generated?
-   What data should be retained and for how long?

**Important:** Treat these as product decisions to validate with pilot
clinics, not assumptions to hard-code. Start with the smallest workflow
that solves the validated problem.
