# QueueCare --- Phased Delivery Plan

This file breaks the delivery phases in PLAN.md §16 into tasks you can
work through and tick off. PLAN.md stays the reference for *what* to
build and *why*; this file covers *in what order* and *when each phase
is done*.

## How to use this plan

- Work the phases in order. Start the next phase only after the current
  one meets its exit criteria, unless "Can run in parallel" says
  otherwise.
- Settle a phase's "Decide first" items before writing its code. Record
  each answer under PLAN.md §19.
- Every task follows the Definition of Done in PLAN.md §17.
- End every phase with lint, type-check, tests and production build
  passing in CI.

## Overview

| Phase | Name | Main outcome | Depends on |
|---|---|---|---|
| 0 | Product discovery | Validated workflow and MVP rules | --- |
| 1 | Project foundation | Running skeleton, CI, design tokens | --- (can start during Phase 0) |
| 2 | Data model and security | Schema, login, roles, clinic isolation | 0, 1 |
| 3 | Queue domain service | Correct, concurrency-safe queue API | 2 |
| 4 | Patient experience | QR code → token → live status | 3 |
| 5 | Receptionist panel | Reception runs the queue end to end | 3 |
| 6 | Doctor panel | Full patient → reception → doctor flow | 5 |
| 7 | Clinic admin panel | Clinic configures itself | 3 |
| 8 | Notifications and live updates | Reliable updates, optional email | 4, 5, 7 |
| 9 | Hardening and pilot | Pilot release at one clinic | 4--8 |
| 10 | Commercialization | Repeatable onboarding and billing | 9 |

### Milestones

- **M1 --- Queue engine (end of Phase 3):** the whole queue lifecycle
  works through the API, backed by concurrency tests.
- **M2 --- MVP feature-complete (end of Phases 4--7):** the patient,
  receptionist, doctor and clinic admin panels work against the real
  API.
- **M3 --- Pilot release (end of Phase 9):** deployed, monitored and
  running at the pilot clinic.

### Phase order

``` text
     P0 Discovery      P1 Foundation
           └───────┬─────────┘
                   ▼
         P2 Data and security
                   ▼
        P3 Queue domain service  ── M1
                   │
      ┌────────────┼────────────┐
      ▼            ▼            ▼
 P4 Patient  P5 Reception   P7 Admin
      │            ▼            │
      │        P6 Doctor        │
      │            │            │
      └────────────┼────────────┘  ── M2
                   ▼
   P8 Notifications and live updates
                   ▼
        P9 Hardening and pilot  ── M3
                   ▼
         P10 Commercialization
```

Phases 4, 5 and 7 all depend only on Phase 3, so they can run in
parallel. PLAN.md §12.9 builds the Receptionist UI before the Patient
UI, while §16 does the opposite. Decide in Phase 0: build Patient first
if most pilot patients will scan the QR code, or Receptionist first if
most will be walk-ins.

## Decisions to settle, and when

Taken from PLAN.md §19 and §12.14.

| Decision | Needed before |
|---|---|
| One queue per service or one per doctor? Can several doctors serve one service? | Phase 2 |
| Which patient details are collected (name, phone, nothing)? | Phase 2 |
| Is the wait-time target fixed (20 min) or set per service? | Phase 2 |
| How do queues reset each day, and what do token labels look like (e.g. `A-101`)? | Phase 3 |
| FIFO only, or priority for appointments, seniors or emergencies in v1? | Phase 3 |
| What happens when a called patient does not arrive (grace period, no-show action)? | Phase 3 |
| Can skipped patients rejoin, and at what position? | Phase 3 |
| Can patients cancel their own token? | Phase 3 |
| What does pausing mean for patients already waiting? | Phase 3 |
| Can patients join remotely, or only at the clinic? | Phase 3 |
| Is the English / हिंदी / मराठी toggle in v1? | Phase 4 |
| Build the Patient UI or the Receptionist UI first? | Phase 4 |
| Print token slips (thermal printer or browser print)? | Phase 5 |
| How long is patient data kept? | Phase 9 |

------------------------------------------------------------------------

## Phase 0 --- Product discovery

**Goal:** Confirm the real queue workflow before coding any business
rules.\
**Reference:** PLAN.md §2, §9, §12.14, §19

### Tasks

- [ ] Interview 3--5 clinics (owner, receptionist and at least one
  doctor at each).
- [ ] Observe at least one full queue session at the likely pilot
  clinic.
- [ ] Record baseline numbers at the pilot clinic: average wait,
  patients per day, share of walk-ins, how often patients ask "how
  long?".
- [ ] Answer every decision in the table above that is needed before
  Phase 2 or Phase 3.
- [ ] Confirm the token states and transitions in PLAN.md §9, plus the
  recall, skip, requeue and no-show rules.
- [ ] Draw workflow diagrams: patient journey, reception day, doctor
  consultation.
- [ ] Choose the pilot clinic and agree on success criteria using the
  pilot metrics in PLAN.md §2.
- [ ] Update the MVP scope in PLAN.md §4 if anything moves in or out.

### Exit criteria

- All "before Phase 2" and "before Phase 3" decisions are answered in
  PLAN.md §19.
- Workflow diagrams are reviewed with the pilot clinic.
- Pilot clinic is agreed, with baseline metrics recorded.

------------------------------------------------------------------------

## Phase 1 --- Project foundation

**Goal:** A running, tested skeleton with the QueueCare look in place,
which needs only Docker on the host.\
**Reference:** PLAN.md §5, §6, §7, §12.3, §12.12, §14, Email and
Notifications\
**Can run in parallel:** with Phase 0, because the stack is already
chosen.

### Tasks

Setup

- [ ] Initialize Next.js (App Router) with TypeScript in strict mode.
- [ ] Add Tailwind CSS, shadcn/ui and Lucide React.
- [ ] Create the folder layout from PLAN.md §7 (current layout:
  `FOLDER_STRUCTURE.md`).

Docker

- [ ] Dockerfile with `dev`, `builder`, `runner` and `e2e` stages
  (`runner` uses the Next.js standalone output).
- [ ] docker-compose with `db`, `app` (hot reload through Compose Watch),
  and `web` + `e2e` under the `test` profile.
- [ ] `.dockerignore` that keeps `node_modules`, `.next` and `.env` files
  out of images.

Design system

- [ ] Add the QueueCare color, radius and font tokens from PLAN.md
  §12.12 as a `@theme` block in `src/app/globals.css` (Tailwind v4).
- [ ] Load Plus Jakarta Sans, Inter and Noto Sans Devanagari through
  `next/font/google`.
- [ ] Write `GUI_RULES.md` from PLAN.md §12 (tokens, components, layout,
  accessibility).
- [ ] Convert the older mockups (owner dashboard, doctors, profiles) to
  the QueueCare palette before their phases start.

Data

- [ ] Run PostgreSQL 17 in Docker Compose, with a `queuecare_dev` and a
  separate `queuecare_test` database.
- [ ] Add Prisma with one shared client in `src/lib/db`.

Configuration and errors

- [ ] Validate environment variables with Zod at startup. Required:
  `DATABASE_URL` and the auth secret. Optional: `RESEND_API_KEY`,
  `EMAIL_FROM`.
- [ ] Add `.env.example` and keep `.env` files with secrets out of git.
- [ ] Add an `AppError` class, the error codes from PLAN.md §14, and one
  helper that turns errors into the response shape in PLAN.md §11.
- [ ] Attach a request ID to each API request and its log lines.
- [ ] Add `GET /api/health`, which checks the database connection.

Quality

- [ ] Configure ESLint, Prettier and a `typecheck` script.
- [ ] Set up Vitest, React Testing Library and Playwright, each with one
  passing smoke test.
- [ ] Add CI (GitHub Actions) that runs lint, type-check, tests, build
  and end-to-end tests through docker compose on every pull request.
- [ ] Write the README: Docker-only setup, commands, environment
  variables, running tests.

### Exit criteria

- `docker compose up --watch` serves a placeholder page in QueueCare
  fonts and colors, with only Docker installed on the host.
- `/api/health` reports the database as healthy.
- CI passes on the main branch.

------------------------------------------------------------------------

## Phase 2 --- Data model and security foundation

**Goal:** A protected base: schema, login, roles and clinic isolation.\
**Reference:** PLAN.md §3, §8, §13\
**Decide first:** queue per service or per doctor, patient details
collected, wait-target scope.

### Tasks

Schema

- [ ] Model Clinic, User, ClinicMembership, Service, Queue, QueueToken,
  AuditEvent, OutboxEvent and IdempotencyRecord (PLAN.md §8).
- [ ] Add enums for staff role, token status (PLAN.md §9) and queue
  status (`OPEN`, `PAUSED`, `CLOSED`).
- [ ] Store the platform Super Admin role on the user, separate from
  clinic memberships.
- [ ] Add the constraints and indexes from PLAN.md §8, including
  `@@unique([queueId, sequenceNumber])` and a unique `publicTokenId`.
- [ ] Store each queue's date in the clinic's timezone and document the
  rule.
- [ ] Create the first migration.
- [ ] Write a seed script: one demo clinic, three services, one user per
  role, an open queue for today, default queue settings.

Authentication

- [ ] Set up Auth.js (or the chosen alternative) with secure session
  cookies.
- [ ] Hash passwords with a strong algorithm (for example argon2id or
  bcrypt).
- [ ] Build login and logout. Let clinic admins reset a staff password;
  self-service reset by email comes in Phase 8.
- [ ] Rate-limit login attempts.

Authorization

- [ ] Add server helpers: `requireSession()`,
  `requireClinicRole(clinicId, roles)` and `requirePlatformAdmin()`.
- [ ] Load each resource first, then check that the user belongs to that
  resource's clinic. Never trust a clinic ID, role or owner sent by the
  client.
- [ ] Protect the `(staff)`, `(clinic-admin)` and `(platform-admin)`
  route groups. Page redirects are a convenience only; every API handler
  checks access again.
- [ ] Add Unauthorized, 404 and error pages.

Shared building blocks

- [ ] `recordAudit(tx, event)`: writes an audit event inside the
  caller's transaction.
- [ ] Idempotency helper: stores key, request fingerprint and result;
  returns the stored result on retry; rejects the same key with a
  different request.
- [ ] Rate limiter for public endpoints, backed by the database or
  memory. If memory, document that it only works on a single instance.

### Tests

- Unit: every role-and-action permission decision.
- Integration: a user from clinic A cannot read or change clinic B's
  data.
- Integration: migrations apply to an empty database, and the seed runs
  twice without errors.
- Integration: the same idempotency key returns the same result; the
  same key with a different body returns `IDEMPOTENCY_CONFLICT`.

### Exit criteria

- Each seeded user can log in and lands on their role's home route.
- Cross-clinic access tests pass.

------------------------------------------------------------------------

## Phase 3 --- Queue domain service

**Goal:** A correct, concurrency-safe queue API, finished before any
polished UI.\
**Reference:** PLAN.md §9, §10, §11, §14\
**Decide first:** FIFO or priority, no-show handling and grace period,
skip and requeue position, patient cancellation, paused-queue behavior,
remote joining, daily reset and token labels.

### Tasks

Rules

- [ ] Write the allowed-transition table in `src/features/queue/` and
  reject every other transition.
- [ ] Keep all queue logic in the queue service. Route handlers only
  authenticate, validate, call the service and map errors.

Operations

- [ ] Get or create today's queue for a service, using the clinic's
  timezone.
- [ ] Join queue: check that the queue is open and the service active.
  In one transaction, allocate the sequence number, create the token
  with an unguessable `publicTokenId`, write the audit event (and an
  outbox event when a notification applies), and store the idempotency
  result.
- [ ] Allocate sequence numbers with an atomic counter, for example
  `UPDATE ... SET next_sequence = next_sequence + 1 RETURNING` through
  Prisma raw SQL. Keep the unique constraint as a final guard and turn a
  conflict into a clear error.
- [ ] Generate display labels (for example `A-101`) in the format chosen
  in Phase 0.
- [ ] Call next: claim the next eligible token with a row lock
  (`FOR UPDATE SKIP LOCKED`) or a conditional update. Re-check the queue
  status inside the transaction. Return `409` if another request claimed
  it first.
- [ ] Recall, skip, requeue and cancel according to the Phase 0
  policies. Recall must not create a new token.
- [ ] Start and complete a consultation. Block a second active
  consultation for the same doctor if policy allows only one.
- [ ] Pause, resume and close a queue.
- [ ] Position: count the waiting tokens ahead, ignoring tokens that are
  no longer waiting.
- [ ] ETA: return a range, plus a "rough estimate" flag when there is
  little data.

API

- [ ] Build the public, receptionist and doctor endpoints from PLAN.md
  §11.
- [ ] Validate every request body with Zod.
- [ ] Public token status returns only: token label, status, people
  ahead, ETA range, service name, clinic name and last-updated time.

### Tests

- Unit: every allowed and blocked transition, position, ETA, pause and
  close rules.
- Integration, run against real PostgreSQL (locking cannot be tested
  with mocks):
  - 50 simultaneous joins produce 50 unique sequence numbers.
  - The same idempotency key twice returns the same token.
  - Two simultaneous Call Next requests never call the same token.
  - A paused or closed queue rejects joins with `QUEUE_PAUSED` or
    `QUEUE_CLOSED`.
  - If any step fails, no token, audit or outbox row is saved.
  - Staff from another clinic get `FORBIDDEN`.

### Exit criteria

- The full lifecycle (join → call → start → complete, plus skip and
  recall) works through the API.
- All concurrency and idempotency tests pass in CI. **Milestone M1.**

------------------------------------------------------------------------

## Phase 4 --- Patient experience

**Goal:** A patient goes from QR code to a live token on their phone,
with no login.\
**Reference:** PLAN.md §12.5 (ticket stub), §12.8 (patient panel),
§12.10, §12.11\
**Decide first:** language toggle in v1.

### Tasks

- [ ] `/q/[clinicSlug]`: clinic name, open or closed status, today's
  hours and active services.
- [ ] Service selection, then a confirmation screen with an explicit
  **Join queue** button. Scanning the code or choosing a service never
  creates a token.
- [ ] Generate the idempotency key when the confirmation screen opens
  and keep it in `sessionStorage`, so a double tap or a retry does not
  create a second token.
- [ ] After joining, redirect to `/token/[publicTokenId]`.
- [ ] Token page: ticket stub as the hero, people ahead, ETA range,
  "updated X min ago".
- [ ] Poll for status (start at 10--15 seconds; stop while the tab is
  hidden).
- [ ] States: your turn, in consultation, completed, skipped, cancelled,
  queue paused, queue closed, token not found.
- [ ] Accessibility: `aria-live="polite"` on the status area, body text
  at least 16px, tap targets at least 48px, reduced motion respected.
- [ ] Language toggle (English / हिंदी / मराठी), if confirmed for v1.
- [ ] Short privacy notice on the join screen.
- [ ] A temporary QR code pointing at `/q/[clinicSlug]` for testing.
  Proper QR management comes in Phase 7.

### Tests

- E2E: open clinic page → choose service → join → see token status.
- E2E: double-clicking Join creates one token.
- E2E: a paused queue shows the paused state and blocks joining.
- Layout checks at 390px (main target) and 1280px.

### Exit criteria

- A real phone can scan the QR code and follow its token through to
  completion.

------------------------------------------------------------------------

## Phase 5 --- Receptionist panel

**Goal:** Reception runs a full day's queue without paper.\
**Reference:** PLAN.md §12.5, §12.6, §12.7, §12.8 (receptionist panel),
§12.10\
**Decide first:** token slip printing.

### Tasks

App shell (shared by all staff panels)

- [ ] Full sidebar at `lg`, icon rail at `md`, slate top bar with bottom
  tab bar below `md` (PLAN.md §12.6).
- [ ] Header with page title, queue status, search, notifications and
  user menu.
- [ ] Navigation built from the user's role.

Live queue (`/receptionist/queue`)

- [ ] Now serving ticket with grace countdown, **Call next** (keyboard
  `N`), Recall and Skip. Read the grace period and wait target from
  clinic settings (seeded values until Phase 7).
- [ ] Up next ticket rows; the waited time turns `#B4532A` above the
  wait target.
- [ ] Disable Call next while the queue is paused or empty, and show
  why.
- [ ] On a `409` conflict, refresh the queue and say that another staff
  member already acted.
- [ ] Pause and resume with a confirmation and a page banner.

Other pages

- [ ] Register walk-in drawer (`/receptionist/walk-in`) with the minimum
  fields and an idempotency key.
- [ ] Dashboard (`/receptionist`): four KPI cards, queue flow chart,
  waiting-by-service donut, recent activity from audit events, compact
  queue card (PLAN.md §12.7).
- [ ] Queue history (`/receptionist/history`) and token details.

Behavior

- [ ] Optimistic updates with rollback and an error toast.
- [ ] Confirmation for destructive actions; Undo toast for reversible
  ones.
- [ ] Poll the staff queue.
- [ ] Loading, empty, error and success states on every page.

### Tests

- E2E: register a walk-in → call next → recall → skip.
- E2E: two receptionists press Call next at the same moment and get
  different tokens or a clear conflict message.
- Keyboard-only run through the live queue.
- Layout checks at 390px, 834px and 1280px.

### Exit criteria

- One receptionist can run a seeded day's queue using only the panel.

------------------------------------------------------------------------

## Phase 6 --- Doctor panel

**Goal:** Complete the staff workflow from arrival to finished
consultation.\
**Reference:** PLAN.md §3 (Doctor), §12.8 (doctor panel)

### Tasks

- [ ] Doctor dashboard (`/doctor`): current patient, up next,
  availability toggle.
- [ ] My queue (`/doctor/queue`), showing only the tokens this doctor
  may see.
- [ ] Current consultation (`/doctor/consultation`) with Start and
  Complete. Show only name, token and service --- no medical data.
- [ ] Consultation history (`/doctor/history`) with minimal fields.
- [ ] Availability, delay and break (`/doctor/availability`). A break
  shows a banner on the reception and patient screens.

### Tests

- E2E: reception calls → doctor starts → doctor completes → patient page
  shows Done.
- Integration: a doctor cannot start a second consultation when policy
  allows only one.
- Integration: a doctor cannot open admin routes or another clinic's
  data.

### Exit criteria

- Patient → reception → doctor → completed works end to end on seeded
  data.

------------------------------------------------------------------------

## Phase 7 --- Clinic admin panel

**Goal:** A clinic can set itself up and run without developer help.\
**Reference:** PLAN.md §3 (Clinic Owner), §12.8 (admin panel)\
**Can run in parallel:** with Phases 4--6 once Phase 3 is done.

### Tasks

- [ ] Services (`/admin/services`): create, edit and soft-disable,
  keeping history.
- [ ] Doctors and staff (`/admin/doctors`, `/admin/staff`): add, edit,
  deactivate, reset password. Invitations produce a copyable link for
  now; email delivery comes in Phase 8.
- [ ] Accept staff invitation page.
- [ ] Roles and permissions (`/admin/roles`).
- [ ] Clinic profile, opening hours and holidays (`/admin/settings`).
- [ ] Queue settings: maximum size, grace period, wait target, no-show
  action.
- [ ] QR code (`/admin/qr-code`): permanent link to `/q/[clinicSlug]`,
  PNG/SVG download and a printable poster.
- [ ] Analytics (`/admin/analytics`) covering the pilot metrics in
  PLAN.md §2, built with Recharts.
- [ ] Audit log (`/admin/audit`) with filters for date, staff member and
  action.
- [ ] Admin dashboard (`/admin/dashboard`).
- [ ] Only clinic admins can change settings, checked on the server.

### Tests

- E2E: admin creates a service → it appears on the patient page.
- E2E: admin changes the grace period → the reception countdown uses
  the new value.
- Integration: receptionists and doctors get `FORBIDDEN` on admin
  endpoints.
- Integration: disabling a service keeps its past tokens and analytics.

### Exit criteria

- A new clinic can be configured from the admin panel alone; only the
  first admin account is created by a developer. With Phases 4--6 done,
  this is **Milestone M2.**

------------------------------------------------------------------------

## Phase 8 --- Notifications and live updates

**Goal:** Reliable status updates and, if the pilot needs them, email
notifications.\
**Reference:** PLAN.md §5 (Real-time updates), §10 (Outbox and
notifications), Email and Notifications

### Tasks

- [ ] Measure polling load and how up to date screens feel; tune the
  interval.
- [ ] Outbox worker: picks up unprocessed events, is safe to run twice,
  retries with bounded backoff and stores a cleaned-up `lastError`.
- [ ] Resend integration on the server only, using `RESEND_API_KEY` and
  an `EMAIL_FROM` address on a verified domain.
- [ ] Emails: staff invitation and password reset first. Token
  confirmation and turn notification only if pilot clinics want them.
- [ ] Mock email sender for local development; never send real patient
  email from a dev environment.
- [ ] Add Server-Sent Events only if pilot feedback needs them and the
  hosting supports long-lived connections.

### Tests

- Integration: processing the same event twice sends one email.
- Integration: an email failure leaves the token in place and is retried
  later.
- Integration: an event stops retrying after the maximum number of
  attempts and is flagged.

### Exit criteria

- Status updates stay accurate under pilot-like load.
- Staff invitations and password resets arrive by email.

------------------------------------------------------------------------

## Phase 9 --- Hardening and pilot

**Goal:** Ship a release the pilot clinic can rely on, then learn from
real use.\
**Reference:** PLAN.md §13, §14, §15, §17

### Tasks

Quality and security

- [ ] Complete the E2E suite listed in PLAN.md §15.
- [ ] Run concurrency, access-control and rate-limit tests against a
  production-like environment.
- [ ] Accessibility checks (for example axe with Playwright), keyboard
  runs and contrast checks.
- [ ] Security review against PLAN.md §13: access control, cross-clinic
  access, XSS, injection, CSRF and brute force.

Operations

- [ ] Deploy with managed PostgreSQL, HTTPS and secure cookies.
- [ ] Turn on automatic backups and do one real restore test.
- [ ] Monitoring: error logs with request IDs, health-check alerts,
  counts of failed queue actions and outbox events.
- [ ] Write a rollback plan that covers both the app version and
  database migrations.

Privacy

- [ ] Write the data retention and deletion policy and enforce it (for
  example a scheduled cleanup of old patient names).
- [ ] Write an incident response checklist.

Pilot

- [ ] Train the clinic staff and give them a one-page guide for
  reception and doctors.
- [ ] Print and place the QR posters.
- [ ] Run the pilot for the agreed period and track the pilot metrics
  against the Phase 0 baseline.
- [ ] Review feedback weekly and fix the most important issues first.

### Exit criteria

- The pilot release is live, monitored and has a tested rollback.
  **Milestone M3.**
- Pilot results are recorded against the success criteria from Phase 0.

------------------------------------------------------------------------

## Phase 10 --- Commercialization

**Goal:** Onboard more clinics without custom work.\
**Reference:** PLAN.md §12.8 (Platform super admin), §13\
**Start only when:** the pilot meets its success criteria.

### Tasks

- [ ] Review Indian privacy and data-protection requirements with
  qualified counsel before commercial launch.
- [ ] Self-service clinic signup and setup wizard.
- [ ] Super Admin panel: dashboard, clinics, users, plans and
  subscriptions, billing overview, activity logs, support and settings.
- [ ] Pricing and subscription billing.
- [ ] Support workflow and help content.
- [ ] Multi-branch support and advanced analytics, only when customers
  ask for them.

### Exit criteria

- A new clinic can sign up, configure itself and start a queue without
  developer help.
