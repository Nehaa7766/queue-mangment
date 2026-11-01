# QueueCare --- Architecture

How the system is built and why. This file expands
[PLAN.md §6](PLAN.md#6-architecture). For the repository layout, see
[FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md).

Last updated: 30 Oct 2026 (Phases 1--10 built).

## 1. Overview

QueueCare is a **modular monolith**: one Next.js application that
serves the pages and the API. Code is split into modules inside
`src/features/`, but everything ships and deploys as one unit.
PostgreSQL holds all state.

| Part | Technology |
|---|---|
| App framework | Next.js 16.4 (App Router, Turbopack, Cache Components on), React 19.3 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4, shadcn/ui, Lucide icons, Recharts |
| Authentication | Better Auth 1.7, email and password, sessions stored in PostgreSQL |
| Validation | Zod 4 |
| Database | PostgreSQL 17 |
| ORM | Prisma 7.10 with `@prisma/adapter-pg` |
| Email | Resend (optional; an in-memory sender in development and tests) |
| Tests | Vitest 5, React Testing Library, Playwright 1.64 with axe-core |
| Runtime | Node 26, in Docker |

Who uses it:

| User | Area | Home after sign-in |
|---|---|---|
| Patient | `/q/[clinicSlug]`, `/token/[publicTokenId]` | No account |
| Receptionist | `/receptionist/*` | `/receptionist` |
| Doctor | `/doctor/*` | `/doctor` |
| Clinic admin | `/admin/*`, plus the reception screens | `/admin/dashboard` |
| Platform super admin | `/super-admin/*` | `/super-admin/dashboard` |
| New clinic | `/signup` | Pending approval |

## 2. Layers

``` text
   Patient · Receptionist · Doctor · Clinic admin · Super admin
                          │
                          ▼
   proxy.ts ...................... no session cookie on a staff area? → /login
                          │
                          ▼
   UI ............................ src/app (pages, layouts), src/components
                          │  Server Components call feature queries;
                          │  client components fetch the API
                          ▼
   Route handlers ................ src/app/api/**/route.ts
                          │  withApiHandler(): request ID + error mapping
                          ▼
   Access + validation ........... Better Auth session, clinic membership,
                          │        permission matrix, Zod, rate limits
                          ▼
   Domain services ............... src/features/<module>
                          │
                          ▼
   Data access ................... Prisma client from getDb() (src/lib/db)
                          │  @prisma/adapter-pg
                          ▼
   PostgreSQL .................... source of truth
     ├── audit events (clinic) and platform audit events
     └── outbox events ──► worker ──► email (Resend)
```

| Layer | Does | Does not |
|---|---|---|
| Proxy | Redirects to `/login` when a staff area has no session cookie | Decide access; it only saves a round trip |
| UI | Shows data, captures actions, handles loading/empty/error states | Hold business rules or call the database |
| Route handlers | Wrap with `withApiHandler()`, check access, validate input, call one service, return a safe response | Contain queue logic |
| Access + validation | Check session, role, clinic membership and resource ownership on the server; parse input with Zod | Trust a clinic ID, role or owner sent by the client |
| Domain services | Enforce queue and clinic rules; run transactions; write audit and outbox events | Know about HTTP requests or React |
| Data access | One Prisma client per process; raw SQL only where row locks need it | Hold business rules |
| PostgreSQL | Persist state; enforce foreign keys and unique constraints as the final guard | --- |

## 3. Example request: a patient joins a queue

`POST /api/queues/[queueId]/tokens` (rules in
[PLAN.md §9](PLAN.md#9-queue-business-rules) and
[§10](PLAN.md#10-concurrency-idempotency-and-reliability)).

``` text
Phone                Route handler               Queue service                PostgreSQL
  │ POST + Idempotency-Key │                            │                            │
  ├───────────────────────►│ request ID, rate limit,    │                            │
  │                        │ Zod-validate body          │                            │
  │                        ├───────────────────────────►│ key seen before?           │
  │                        │                            ├───────────────────────────►│
  │                        │                            │◄── yes: return stored result
  │                        │                            │                            │
  │                        │                            │ BEGIN                      │
  │                        │                            │ today's queue? clinic open?│
  │                        │                            │ not a holiday?             │
  │                        │                            │ next sequence (atomic,     │
  │                        │                            │ locks the queue row)       │
  │                        │                            │ queue OPEN, service active,│
  │                        │                            │ under max size             │
  │                        │                            │ insert QueueToken          │
  │                        │                            │ insert AuditEvent          │
  │                        │                            │ insert IdempotencyRecord   │
  │                        │                            │ COMMIT ───────────────────►│
  │                        │◄───────────────────────────┤ token label, public ID     │
  │◄───────────────────────┤ 201 + publicTokenId        │                            │
  │ redirect to /token/[publicTokenId], then poll status                             │
```

1. The confirmation screen creates the idempotency key when it opens and
   keeps it in `sessionStorage`, so a double tap or retry sends the same
   key.
2. `withApiHandler()` gives the request an ID and turns any thrown error
   into the standard error response.
3. The public endpoint is rate-limited (20 joins a minute per client and
   queue) and the body is validated with Zod before any database work.
4. The queue service checks the idempotency key. The same key with the
   same request returns the original token; the same key with a
   different request returns `IDEMPOTENCY_CONFLICT`.
5. In **one transaction**, the service:
   - refuses patients unless the queue is **today's**, the clinic is
     inside its opening hours, and today is not a clinic holiday
     (`QUEUE_CLOSED`). Reception walk-ins skip this check.
   - allocates the next sequence number with an atomic counter
     (`UPDATE ... RETURNING`), which also locks the queue row so the
     waiting count is exact;
   - checks the queue is open, the service active and the queue under
     its maximum size;
   - creates the token with an unguessable `publicTokenId` (UUID v4) and
     writes the audit and idempotency rows.

   If any step fails, nothing is saved.
6. The unique constraint on `(queueId, sequenceNumber)` is the last
   guard against duplicates.
7. The response contains only what the patient needs. The phone then
   polls `GET /api/public/tokens/[publicTokenId]`.

Call Next claims the lowest waiting token with `FOR UPDATE SKIP LOCKED`,
so two receptionists can never call the same token. A request that
loses the race gets `409`. Other token actions (recall, skip, requeue,
cancel, start, complete) use a conditional update on the token's
current status and also return `409` if someone else changed it first.

## 4. Modules

Each folder in `src/features/` owns its rules and its database access.
Other modules use its exported functions only.

| Module | Owns |
|---|---|
| `queue` | Queues, tokens, state transitions, sequence allocation, Call Next, position, ETA, public and staff views. `contracts.ts` is the shared API contract for the queue screens. |
| `doctor` | Doctor availability (available, on break, off duty, announced delay), which doctors serve a service, the doctor panel views |
| `clinics` | Clinic profile, opening hours, holidays, queue settings, QR code |
| `services` | Clinic services (create, edit, soft-disable) |
| `staff` | Members, roles, deactivation, admin password reset |
| `invitations` | Staff invitations: random token (only its hash is stored), accept flow |
| `analytics` | Reception dashboard, admin analytics, audit log reads |
| `audit` | `recordAudit()` inside the caller's transaction |
| `notifications` | Outbox event contract, the outbox worker, email templates, password reset email |
| `retention` | Clearing old patient names, deleting old messages and announcements; bearer check for internal jobs |
| `messaging` | Patient ↔ clinic chats and announcements: routing rule, sends, reads, inbox, live updates over Server-Sent Events with PostgreSQL LISTEN/NOTIFY. See [MESSAGING.md](MESSAGING.md). |
| `platform` | Super admin: clinics, users, subscriptions, billing overview, support tickets, settings, platform audit |
| `onboarding` | Self-service clinic signup |

Authentication and authorization live in `src/lib/auth/`:

- `auth.ts` --- the Better Auth instance, created on first use.
- `session.ts` --- `getSessionUser()`.
- `guards.ts` --- `requireSession()`, `requireClinicPermission()`,
  `requirePlatformAdmin()`, `assertSameClinic()`.
- `permissions.ts` --- the role × action matrix.
- `staff-context.ts` --- the signed-in staff member and their clinic.
- `home.ts` --- where each role lands after sign-in.

Dependency direction: `src/app` → `src/features` → `src/lib`. The one
exception is `src/lib/auth/auth.ts`, which imports the password reset
email from `src/features/notifications/` as a Better Auth callback.

## 5. Cross-cutting concerns

**Errors.** `src/lib/errors/` defines `AppError` and the stable codes in
`ERROR_STATUS` (from [PLAN.md §14](PLAN.md#14-error-handling-and-observability),
plus `QUEUE_NOT_FOUND`). `toErrorResponse()` turns an error into the
shape below. Unknown errors become `INTERNAL_ERROR` with a generic
message; stack traces and database errors never reach the client.

``` json
{ "error": { "code": "QUEUE_PAUSED", "message": "This queue is temporarily paused.", "requestId": "…" } }
```

**Request IDs.** Every API request handled by `withApiHandler()` gets a
request ID. It is returned in the `x-request-id` header and appears in
the log lines. A caller's own ID is kept only if it is short and plain.

**Environment.** `getEnv()` in `src/lib/env.ts` validates environment
variables with Zod. It runs on first use, not at import, so
`next build` works without a database or secrets. Code never reads
`process.env` directly.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Session signing; the app's public URL (also used for QR codes and email links) |
| `INTERNAL_JOB_SECRET` | Bearer token for `/api/internal/*`; without it those endpoints refuse every request |
| `TRUSTED_IP_HEADER` | Header the reverse proxy overwrites with the client address, e.g. `x-forwarded-for`. Leave unset without a proxy. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Real email; `EMAIL_FROM` is required when the key is set |

**Authentication.** Better Auth with email and password. Sessions are
rows in PostgreSQL and last 12 hours. Public sign-up through Better Auth
is off; staff accounts come from invitations, the seed, or clinic
signup. Deactivated users cannot start a session. Secure cookies are on
when `BETTER_AUTH_URL` is HTTPS.

**Authorization and tenant isolation.** Every protected handler loads
the resource first, then checks that the user belongs to that resource's
clinic, that the membership, user and clinic are all active, and that
the role allows the action. Hiding a button is not security. See
[PLAN.md §3](PLAN.md#3-users-and-permissions) and
[§13](PLAN.md#13-authentication-security-and-privacy).

**Rate limits.** Sign-in (5 a minute), password reset requests, public
joins, invitation acceptance and signup are limited per client address.
The client address comes **only** from `TRUSTED_IP_HEADER`, using the
last entry (the one the proxy appended). Without a trusted proxy every
caller shares one key, because any other header can be forged. All
limits are kept in memory, so they work on a single instance only.

**Security headers.** `next.config.ts` sends a Content Security Policy,
`X-Content-Type-Options`, `X-Frame-Options: DENY`,
`Referrer-Policy: same-origin`, a restrictive `Permissions-Policy`,
`Cross-Origin-Opener-Policy` and HSTS. The CSP keeps
`'unsafe-inline'` for scripts: nonces would force every page to render
per request, which turns off Partial Prerendering. Everything else is
locked to this origin. Details in
[SECURITY_REVIEW.md](SECURITY_REVIEW.md).

**Forms.** Every form handled by `onSubmit` also has `method="post"`,
so a submit before the page hydrates never puts fields in the URL.
`src/tests/unit/forms-post.test.ts` enforces this.

**Logging and privacy.** Never log passwords, session tokens, API keys
or more patient data than needed. Patient names are cleared after the
clinic's retention period (section 10).

## 6. Data

- **PostgreSQL is the source of truth** for queue state, sessions,
  audit and platform audit events, outbox events and idempotency
  records.
- **Prisma 7** connects through the `@prisma/adapter-pg` driver adapter.
  `getDb()` in `src/lib/db` creates the client on first use and reuses
  it.
- The client is generated into `src/generated/prisma` (not committed).
- `prisma.config.ts` holds the schema path, migrations path, seed
  command and database URL. Models are described in
  [PLAN.md §8](PLAN.md#8-database-design); three migrations exist
  (`init`, `auth`, `phases_6_to_10`).
- Schema changes go through Prisma migrations only. Production applies
  them as a release step (`prisma migrate deploy`), not on app start.
- `prisma/seed.sql` creates the demo clinic and staff logins. It refuses
  to run on any database other than `queuecare_dev` and
  `queuecare_test`.
- Inside a transaction, read through the transaction client. Opening a
  second pooled connection per request can exhaust the pool under load.

## 7. Runtime and Docker

The host needs only Docker. Node, PostgreSQL and the Playwright browsers
all run in containers.

``` text
 default profile                                    profile: test
 ───────────────                                    ─────────────
 browser ──► localhost:3000                         e2e  (target: e2e)
                   │                                Playwright + axe-core
                   ▼                                     │  http://web:3000
 app  (target: dev) ◄── worker   (every 10 s)            ▼
 next dev + Compose Watch                           web  (target: runner)
                   ▲── retention (once a day)       node server.js (standalone)
                   │                                     │
                   ▼                                     ▼
 db  (postgres:17-alpine, host port 5442, volume: pgdata)
     ├── queuecare_dev    ◄── app  (DATABASE_URL)
     └── queuecare_test   ◄── web, and integration tests in app (TEST_DATABASE_URL)
```

| Service | Built from | Purpose |
|---|---|---|
| `db` | `postgres:17-alpine` | Database on host port 5442 (container port 5432; override with `DB_PORT`), so it doesn't clash with a locally installed PostgreSQL. Data in the `pgdata` volume. `docker/postgres/init.sql` creates `queuecare_test` next to `queuecare_dev`. |
| `app` | Dockerfile target `dev` | `npm run dev` on port 3000 (`APP_PORT`). Compose Watch copies source changes into the container and rebuilds when `package-lock.json` or `prisma/schema.prisma` change. |
| `worker` | `curlimages/curl` | Calls `POST /api/internal/outbox/process` every 10 seconds with the job secret. |
| `retention` | `curlimages/curl` | Calls `POST /api/internal/retention/run` once a day with the job secret. |
| `web` | Dockerfile target `runner` | Production build (Next.js standalone, `node server.js`, non-root user) against `queuecare_test`, on host port 3001 (`WEB_PORT`). Sets `TRUSTED_IP_HEADER=x-forwarded-for`, as if behind a proxy. Health check on `/api/health`. Profile `test`. |
| `e2e` | Dockerfile target `e2e` | Playwright image with `@playwright/test` and `@axe-core/playwright`; runs the end-to-end tests against `http://web:3000`. Profile `test`. |

Dockerfile stages: `base` → `deps` (install packages) → `dev` /
`builder` (`prisma generate`, `next build`) → `runner`; plus `e2e`.

Compose Watch is used instead of a bind mount. On Windows, bind mounts
do not pass file-change events into the container reliably, and the
container needs its own Linux `node_modules`. Watch only copies files
**into** the container, so create migrations from the host (see the
README).

**E2E and the sign-in limit.** Sign-in allows 5 attempts a minute per
client address. Because `web` trusts `X-Forwarded-For`, each spec that
signs in calls `test.use(clientAddress(n))` from
`src/tests/e2e/auth-state.ts` to get its own address. The reception
specs reuse one saved session from `auth.setup.ts`.

## 8. Environments

| Environment | Runs as | Database | Notes |
|---|---|---|---|
| Development | `app`, `worker`, `retention` | `queuecare_dev` | Hot reload through Compose Watch. Email stays in memory unless `RESEND_API_KEY` is set. |
| Test (local and CI) | `app` for unit and integration tests, `web` + `e2e` for end-to-end | `queuecare_test` | CI runs the same compose commands as a developer, and migrates and seeds the test database before E2E. |
| Production | `runner` image on the hosting platform, plus a scheduler for the two internal jobs | Managed PostgreSQL with backups | One image promoted through environments; settings come from environment variables. See [RUNBOOK.md](RUNBOOK.md). |

## 9. Live updates

Polling for queue screens
([PLAN.md §5](PLAN.md#5-recommended-technology-stack)). Messaging uses
Server-Sent Events backed by PostgreSQL LISTEN/NOTIFY (one extra database
connection per server process); see [MESSAGING.md](MESSAGING.md).

| Screen | Interval |
|---|---|
| Patient token page | 15 s |
| Reception live queue | 10 s |
| Reception dashboard | 30 s |
| Doctor screens | 15 s |

Polling pauses while the tab is hidden and refreshes when it becomes
visible again. With 50 patients waiting this is a few requests a
second. Consider Server-Sent Events only if pilot staff notice lag and
the host supports long-lived connections. No Redis or message broker
until measured needs justify it.

Queue data must always be fresh: do not wrap queue reads in
`use cache`.

**Doctor notices.** The reception live queue shows a banner when a
doctor serving the service is on a break, running late, or when no
doctor is on duty. Waiting patients see "The doctor is on a short
break" or "running about N min late", never a doctor's name.

## 10. Background work

**Outbox and email.** Code that needs an email writes an `OutboxEvent`
with `enqueueOutboxEvent()` in the same transaction as the change that
caused it (event types in `src/features/notifications/events.ts`:
staff invitations and password resets). The `worker` service calls
`/api/internal/outbox/process`, which:

1. claims due events with `FOR UPDATE SKIP LOCKED`, so two workers never
   take the same event;
2. sends each one (Resend, using the event ID as the idempotency key;
   in memory in development and tests);
3. marks it processed and removes the one-time link from the stored
   payload;
4. on failure, retries with backoff from 1 minute up to 1 hour, and
   flags the event as failed after 8 attempts.

An email failure never undoes the change that queued it. Patient emails
are not sent in v1.

**Retention.** The `retention` service calls
`/api/internal/retention/run` once a day. It clears patient names on
tokens older than the clinic's `patientDataRetentionDays` (default 30,
minimum 1), in batches, with one audit event per clinic. It also deletes
idempotency records older than 2 days, because their fingerprints hash
the patient's name. See [PRIVACY.md](PRIVACY.md).

Both endpoints require `Authorization: Bearer ${INTERNAL_JOB_SECRET}`
(constant-time compare). `/api/health` adds outbox `pending` and
`failed` counts only when called with the same token.

## 11. Platform and onboarding

- **Super admin** (`/super-admin/*`, `SUPER_ADMIN` platform role only):
  approve, suspend or reactivate clinics; deactivate users; manage
  plans and subscriptions; review support tickets; change platform
  settings. Every write records a `PlatformAuditEvent` in the same
  transaction. Clinic actions stay in `AuditEvent`.
- **Signup** (`/signup`): one transaction creates the clinic, its first
  service, the admin user and login, the membership, and a trial
  subscription on the `pilot` plan. New clinics start **inactive
  (pending approval)** until a super admin approves them. Signups can be
  switched off with the `signupsEnabled` setting.
- **Billing:** subscriptions are managed by hand. No payment provider is
  connected; see [COMMERCIAL.md](COMMERCIAL.md).
- **Support:** signed-in clinic staff open tickets at `/support`
  (linked from the account menu).

## 12. Architecture decisions

| # | Decision | Why |
|---|---|---|
| 1 | **Modular monolith** in one Next.js app | Small team and one pilot clinic. Modules keep code separate without the cost of services. Split only when measured needs justify it. |
| 2 | **PostgreSQL is the source of truth** | Queue correctness depends on transactions, row locks and unique constraints. Sessions, audit, outbox and idempotency live in the same database so they commit together. |
| 3 | **Polling before SSE** | Simple, works on any host, enough for clinic-scale traffic. Revisit with pilot data. |
| 4 | **Prisma 7 with `@prisma/adapter-pg`** | Typed queries and migrations. Raw SQL through Prisma for the few places that need row locks. Pinned to stable 7.10.1. |
| 5 | **Next.js standalone output in Docker** | Small runner image that starts with `node server.js` and runs as a non-root user. The same image serves tests and production. |
| 6 | **Docker-only development** | A new developer needs only Docker. Node 26 and PostgreSQL 17 versions are fixed by the images, so every machine and CI run match. |
| 7 | **Cache Components left on** (Next.js 16 default) | Static shells prerender; pages and handlers that read the session or database run at request time under `<Suspense>`. Queue data is never cached. |
| 8 | **Environment and database read lazily** | `getEnv()`, `getDb()` and the auth instance are created on first use, so `next build` succeeds without a database or secrets. |
| 9 | **Better Auth, not Auth.js** | Auth.js v5 is still in beta. Better Auth is stable, supports Next.js 16, keeps sessions in PostgreSQL and includes password hashing and sign-in rate limits. |
| 10 | **Transactional outbox for email** | An email is sent only if the change that caused it commits, and a failed send never undoes that change. The worker is a tiny `curl` loop calling an internal endpoint, so no second Node process or queue service is needed. |
| 11 | **CSP without nonces** | Nonces would turn off Partial Prerendering. `'unsafe-inline'` for scripts is the trade-off; all other sources stay same-origin. |
| 12 | **Client address only from a trusted proxy header** | Any other header can be forged. Without a proxy, one shared rate-limit key is safer than a key the attacker chooses. |
| 13 | **Manual subscriptions, no payment provider yet** | Prices and the provider are product decisions still open. The data model is ready for either. |
