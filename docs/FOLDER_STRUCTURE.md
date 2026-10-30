# QueueCare --- Folder Structure

This file shows how the repository is laid out after Phases 1--10 of
[PHASES.md](PHASES.md). Everything listed here exists. Folders are
described once; only files you are likely to look for are named.

For how the layers fit together, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Tree

``` text
queue-mangment/
├── .github/workflows/ci.yml        # CI: lint, types, tests, production build and E2E, all through docker compose
├── docker/postgres/
│   ├── init.sql                    # creates queuecare_test next to queuecare_dev
│   ├── backup.sh                   # pg_dump in custom format, timestamped
│   └── restore.sh                  # restore into a named database; refuses to overwrite without --force
├── docs/
│   ├── ARCHITECTURE.md             # layers, request flows, Docker services, decisions
│   ├── COMMERCIAL.md               # what is built for selling, decisions still open
│   ├── FOLDER_STRUCTURE.md         # this file
│   ├── GUI_RULES.md                # design contract for every screen
│   ├── PHASES.md                   # phase-by-phase delivery plan and progress
│   ├── PLAN.md                     # full product and technical plan
│   ├── PRIVACY.md                  # patient data kept, retention, deletion
│   ├── RUNBOOK.md                  # deploy, backups, restore drill, rollback, incidents
│   ├── SECURITY_REVIEW.md          # security findings and their status
│   └── STAFF_GUIDE.md              # one-page guides for reception and doctors
├── prisma/
│   ├── schema.prisma               # data model; the connection URL lives in prisma.config.ts
│   ├── seed.sql                    # demo clinic, staff logins, pilot plan; refuses non-local databases
│   └── migrations/                 # init, auth (Better Auth tables), phases_6_to_10
├── public/                         # static files served as-is
├── src/
│   ├── proxy.ts                    # Next.js 16 proxy: early redirect to /login for staff areas without a session cookie
│   ├── app/                        # App Router: pages, layouts, route handlers
│   │   ├── layout.tsx              # root layout: fonts, toaster
│   │   ├── page.tsx                # home page (design preview)
│   │   ├── globals.css             # Tailwind v4 design tokens (@theme)
│   │   ├── error.tsx, not-found.tsx
│   │   ├── (public)/               # patients, no login
│   │   │   ├── q/[clinicSlug]/                 # clinic landing and service list
│   │   │   ├── q/[clinicSlug]/join/[queueId]/  # explicit "Join queue" confirmation
│   │   │   └── token/[publicTokenId]/          # live token status
│   │   ├── (auth)/                 # login, unauthorized, forgot-password, reset-password, accept-invite/[token]
│   │   ├── (staff)/                # shared staff shell; requires a clinic membership
│   │   │   ├── receptionist/       # dashboard, queue, walk-in, history, tokens/[tokenId]
│   │   │   └── doctor/             # dashboard, queue, consultation, history, availability
│   │   ├── (clinic-admin)/admin/   # dashboard, services, doctors, staff, roles, settings, qr-code (+ poster), analytics, audit
│   │   ├── (platform-admin)/super-admin/  # dashboard (analytics), clinics, users, plans, subscriptions, billing, activity, support, settings — with create/edit/delete
│   │   ├── (onboarding)/           # signup (+ pending), support tickets for clinic staff
│   │   └── api/
│   │       ├── health/             # GET /api/health; outbox counts only with the job token
│   │       ├── auth/[...all]/      # Better Auth endpoints
│   │       ├── public/             # clinic view, token status, patient cancel
│   │       ├── queues/[queueId]/   # tokens (GET staff, POST join), call-next, walk-ins, pause, resume
│   │       ├── tokens/[tokenId]/[action]/  # recall, skip, requeue, cancel, start, complete
│   │       ├── doctor/             # queue view, availability
│   │       ├── clinics/[clinicId]/ # queues/today, dashboard, and the admin APIs (services, staff, members, doctors, settings, holidays, invitations, analytics, audit)
│   │       ├── services/[serviceId]/       # edit or disable one service
│   │       ├── invitations/[token]/accept/ # accept a staff invitation
│   │       ├── platform/           # super admin APIs: clinics (+ slug check, subscription), users (+ password reset), plans, support tickets, settings, activity
│   │       ├── onboarding/         # signup, slug availability
│   │       ├── support/tickets/    # tickets from clinic staff
│   │       └── internal/           # outbox/process, retention/run (bearer INTERNAL_JOB_SECRET)
│   ├── components/
│   │   ├── ui/                     # shadcn/ui primitives
│   │   ├── shell/                  # SHARED app shell for every signed-in panel: AppShell, sidebar + drawer, top bar, PageHeader strip, help card
│   │   ├── dashboard/              # SHARED dashboard blocks: StatCard, DashboardCard + StatStrip, HighlightCard, SparkCard (+ client Sparkline), ListRow, tone.ts
│   │   ├── layout/                 # staff wiring of the shell: StaffShell, StaffChrome, bottom tabs, account menu, BrandMark + BrandName; staff-nav.ts holds every staff menu
│   │   ├── queue/                  # reception: now serving ticket, up-next rows, status pills, live queue, walk-in form
│   │   ├── charts/                 # Recharts: reception queue flow (joined/served bars, average-wait line)
│   │   ├── patient/                # patient screens, ticket hero, join form; messages.ts holds all patient text
│   │   ├── doctor/                 # doctor screens, availability form, break and delay banners
│   │   ├── admin/                  # admin managers and forms, opening hours editor, QR actions
│   │   ├── platform/               # super admin: platform-chrome.tsx (wires AppShell), form-kit.tsx (form fields + dialogs), delete-button.tsx (type-to-confirm), *-forms.tsx, data-table, ListCard (section-card.tsx), range tabs, charts/
│   │   ├── onboarding/             # signup wizard, support ticket form
│   │   └── auth/                   # login ticket (login-ticket.tsx, ticket-meta.tsx, login-form.tsx), forgot and reset password forms, auth-shell, sign-out button
│   ├── features/                   # domain modules; business rules live here
│   │   ├── queue/
│   │   │   ├── contracts.ts        # SHARED: API paths and request/response shapes for queue screens
│   │   │   ├── service.ts          # every queue write: join, walk-in, call next, token actions, pause/resume
│   │   │   ├── queries.ts          # reads for Server Components (public and staff views)
│   │   │   ├── views.ts            # maps rows to contract shapes
│   │   │   ├── token-status.ts, queue-rules.ts, position.ts, eta.ts, token-label.ts  # pure rules
│   │   │   ├── clinic-time.ts      # clinic-timezone day and opening hours
│   │   │   └── http.ts             # route helpers: UUIDs, JSON body, idempotency key, clientIp()
│   │   ├── doctor/                 # availability, serving doctors, doctor panel queries
│   │   ├── clinics/                # clinic settings, opening hours, holidays, QR
│   │   ├── services/               # service admin
│   │   ├── staff/                  # staff admin, admin password reset
│   │   ├── invitations/            # invitation tokens (hash only), create and accept
│   │   ├── analytics/              # reception dashboard, admin analytics, audit log
│   │   ├── audit/record-audit.ts   # recordAudit(tx, event)
│   │   ├── notifications/
│   │   │   ├── events.ts           # SHARED: outbox event types and payloads, enqueueOutboxEvent()
│   │   │   ├── outbox-worker.ts    # processOutboxBatch(): claim, send, retry, strip links
│   │   │   ├── templates.ts        # invitation and password reset emails
│   │   │   └── password-reset.ts   # queues the reset email for Better Auth
│   │   ├── retention/              # clears old patient names; internal job auth
│   │   ├── platform/               # clinics, users, subscriptions, billing, support, settings, platform audit
│   │   └── onboarding/             # self-service signup, slug checks
│   ├── generated/prisma/           # Prisma client output (gitignored, made by `prisma generate`)
│   ├── lib/
│   │   ├── auth/                   # Better Auth instance, session, guards, permission matrix, staff context, role→home
│   │   ├── db/index.ts             # getDb(): lazy Prisma client with @prisma/adapter-pg
│   │   ├── email/                  # sender interface: Resend, or in-memory for dev and tests
│   │   ├── errors/                 # AppError, ERROR_STATUS, toErrorResponse(), withApiHandler()
│   │   ├── env.ts                  # getEnv(): Zod-validated environment, read lazily
│   │   ├── idempotency.ts          # idempotency keys and request fingerprints
│   │   ├── rate-limit.ts           # in-memory fixed-window limiter (single instance)
│   │   ├── log.ts                  # structured error logs
│   │   └── utils.ts                # cn() helper
│   └── tests/
│       ├── setup-dom.ts
│       ├── unit/                   # Vitest; one folder per area (queue, patient, receptionist, doctor, admin, auth, ...)
│       ├── integration/            # Vitest against queuecare_test; one folder per area
│       └── e2e/                    # Playwright; auth.setup.ts saves the receptionist session, auth-state.ts gives each sign-in spec its own client address
├── .dockerignore, .env.example, .gitignore, .prettierignore, .prettierrc.json
├── AGENTS.md                       # generated by Next.js 16 --- keep at root
├── components.json                 # shadcn/ui settings
├── Dockerfile                      # stages: base, deps, dev, builder, runner, e2e
├── docker-compose.yml              # services: db, app, worker, retention; web and e2e in the test profile
├── eslint.config.mjs
├── next.config.ts                  # standalone output, cacheComponents, security headers and CSP
├── package.json, package-lock.json
├── playwright.config.ts            # setup project, then 390 / 834 / 1280 px projects
├── prisma.config.ts                # Prisma 7 config: schema, migrations, seed, datasource URL
├── README.md                       # setup and commands --- start here
├── tsconfig.json
└── vitest.config.mts               # unit (jsdom) and integration (node, test database) projects
```

`README.md` and `AGENTS.md` stay at the root: GitHub shows the README
on the repository page, and `next dev` re-creates `AGENTS.md` at the
root. All other Markdown documentation goes in `docs/`.

## Where does new code go?

| You are adding... | Put it in | Notes |
|---|---|---|
| A page or layout | `src/app/<route group>/...` | Pages load data and render; no business rules. Session and database reads sit under `<Suspense>` (cacheComponents is on). |
| An API endpoint | `src/app/api/.../route.ts` | Keep it thin: `withApiHandler()`, Zod, a guard on the **loaded** resource's clinic, then a feature function. |
| A queue rule or operation | `src/features/queue/` | All queue writes go through `service.ts`. Never in React components or route files. |
| A change to what queue screens send or receive | `src/features/queue/contracts.ts` | Shared by the API and the patient, reception and doctor screens. Add fields; don't change existing ones. |
| A new email or outbox event | `src/features/notifications/events.ts` | Add the type and payload, write it with `enqueueOutboxEvent()` in the same transaction, then handle it in `outbox-worker.ts`. |
| Other business rules or queries | `src/features/<module>/` | Get the client with `getDb()` from `src/lib/db`. Record staff changes with `recordAudit()`. |
| A staff menu link | `src/components/layout/staff-nav.ts` | Set `tab: true` to show it in the phone tab bar (keep to four per role). |
| A dashboard card, chart card or KPI | `src/components/dashboard/` | Reuse StatCard, DashboardCard, HighlightCard, SparkCard. Keep charts in small client components; cards that take an icon component must stay server components, because functions can't be passed from a server page to a client component. |
| A reusable UI piece | `src/components/<area>/` | shadcn/ui primitives in `ui/`; QueueCare pieces by area. |
| A component used by one page only | Next to that page | Move it to `src/components/` once a second page needs it. |
| A new error type | `src/lib/errors/app-error.ts` | Add a stable code and its HTTP status to `ERROR_STATUS`. |
| A new environment variable | `src/lib/env.ts` and `.env.example` | Add it to the Zod schema; never read `process.env` directly elsewhere. Add development values to `docker-compose.yml`. |
| A schema change | `prisma/schema.prisma` + a new migration | Create the migration from the host against `localhost:5442` (see README), so the migration file lands in the repository. |
| A form | the component | Give every `<form onSubmit>` `method="post"`; `src/tests/unit/forms-post.test.ts` fails otherwise. |
| A unit test | `src/tests/unit/<area>/` | |
| An integration test | `src/tests/integration/<area>/` | Runs against `queuecare_test`. Create rows with unique names and clean up only your own. |
| An end-to-end test | `src/tests/e2e/` | Sign in at most once per spec, with `test.use(clientAddress(n))`, or reuse the saved receptionist session. |
| Documentation | `docs/` | Link to PLAN.md sections instead of copying them. |

### Rules

- Features may import from `src/lib/`. `src/lib/` should not import
  from `src/features/`. Known exception: `src/lib/auth/auth.ts` imports
  the password reset email from `src/features/notifications/`, because
  Better Auth needs it as a callback.
- One feature calls another through its exported functions, not by
  reaching into its internals.
- Components never import Prisma or `src/lib/db`. Known exception:
  `src/components/platform/platform-session.ts` (a server-only session
  loader) reads the user's name and email; move it to
  `src/features/platform/` when you next touch it.
- Do not commit `src/generated/`; `prisma generate` rebuilds it.
- Adapt this layout when there is a clear need, and update this file in
  the same change.
