# QueueCare --- Architecture

How the system is built and why. This file expands
[PLAN.md §6](PLAN.md#6-architecture). For the repository layout, see
[FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md).

Last updated: 30 Oct 2026 (Phase 1).

## 1. Overview

QueueCare is a **modular monolith**: one Next.js application that
serves the pages and the API. Code is split into modules inside
`src/features/`, but everything ships and deploys as one unit.
PostgreSQL holds all state.

| Part | Technology |
|---|---|
| App framework | Next.js 16.4 (App Router, Turbopack, Cache Components on), React 19.3 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4, shadcn/ui, Lucide icons |
| Validation | Zod 4 |
| Database | PostgreSQL 17 |
| ORM | Prisma 7.10 with `@prisma/adapter-pg` |
| Tests | Vitest 5, React Testing Library, Playwright 1.64 |
| Runtime | Node 26, in Docker |

## 2. Layers

``` text
      Patient · Receptionist · Doctor · Clinic admin
                          │
                          ▼
   UI ............................ src/app (pages, layouts), src/components
                          │  fetch / form submit
                          ▼
   Route handlers ................ src/app/api/**/route.ts
                          │  withApiHandler(): request ID + error mapping
                          ▼
   Access + validation ........... session, role, clinic membership (Phase 2), Zod
                          │
                          ▼
   Domain services ............... src/features/<module>
                          │
                          ▼
   Data access ................... Prisma client from getDb() (src/lib/db)
                          │  @prisma/adapter-pg
                          ▼
   PostgreSQL .................... source of truth
     ├── audit events
     └── outbox events ──► outbox worker (Phase 8) ──► email (optional)
```

| Layer | Does | Does not |
|---|---|---|
| UI | Shows data, captures actions, handles loading/empty/error states | Hold business rules or call the database |
| Route handlers | Wrap with `withApiHandler()`, check access, validate input, call one service, return a safe response | Contain queue logic |
| Access + validation | Check session, role, clinic membership and resource ownership on the server; parse input with Zod | Trust a clinic ID, role or owner sent by the client |
| Domain services | Enforce queue and clinic rules; run transactions; write audit and outbox events | Know about HTTP requests or React |
| Data access | One Prisma client per process; raw SQL only where row locks need it | Hold business rules |
| PostgreSQL | Persist state; enforce foreign keys and unique constraints as the final guard | --- |

## 3. Example request: a patient joins a queue

`POST /api/queues/[queueId]/tokens` (built in Phase 3; rules in
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
  │                        │                            │ check queue OPEN,          │
  │                        │                            │ service active             │
  │                        │                            │ next sequence (atomic)     │
  │                        │                            │ insert QueueToken          │
  │                        │                            │ insert AuditEvent          │
  │                        │                            │ insert OutboxEvent*        │
  │                        │                            │ insert IdempotencyRecord   │
  │                        │                            │ COMMIT ───────────────────►│
  │                        │◄───────────────────────────┤ token label, position, ETA │
  │◄───────────────────────┤ 201 + publicTokenId        │                            │
  │ redirect to /token/[publicTokenId], then poll status                             │

* only when a notification applies
```

1. The confirmation screen creates the idempotency key when it opens, so
   a double tap or retry sends the same key.
2. `withApiHandler()` gives the request an ID and turns any thrown error
   into the standard error response.
3. The public endpoint is rate-limited and the body is validated with
   Zod before any database work.
4. The queue service checks the idempotency key. The same key with the
   same request returns the original token; the same key with a
   different request returns `IDEMPOTENCY_CONFLICT`.
5. In **one transaction**, the service checks the queue is open and the
   service active, allocates the next sequence number with an atomic
   counter (`UPDATE ... RETURNING`), creates the token with an
   unguessable `publicTokenId`, and writes the audit, outbox and
   idempotency rows. If any step fails, nothing is saved.
6. The unique constraint on `(queueId, sequenceNumber)` is the last
   guard against duplicates.
7. The response contains only what the patient needs. The phone then
   polls `GET /api/public/tokens/[publicTokenId]`.

Call Next follows the same pattern. It claims a waiting token with a row
lock (`FOR UPDATE SKIP LOCKED`) or a conditional update, so two
receptionists can never call the same token. A request that loses the
race gets `409`.

## 4. Modules

Each folder in `src/features/` owns its rules and its database access.
Other modules use its exported service functions only.

| Module | Owns | Phase |
|---|---|---|
| `auth` | Sessions, `requireSession()`, `requireClinicRole()`, `requirePlatformAdmin()` | 2 |
| `audit` | Writing audit events inside the caller's transaction; reading them for history | 2 |
| `clinics` | Clinic profile, opening hours, holidays, queue settings | 2--7 |
| `services` | Clinic services (create, edit, soft-disable) | 3--7 |
| `queue` | Queues, tokens, state transitions, sequence allocation, Call Next, position, ETA | 3 |
| `staff` | Memberships, staff accounts, invitations | 2, 7 |
| `analytics` | KPIs and reports from tokens and audit events | 5, 7 |

Dependency direction: `src/app` → `src/features` → `src/lib`. Nothing in
`src/lib` imports from `src/features`, and components never import the
database client.

## 5. Cross-cutting concerns

**Errors.** `src/lib/errors/` defines `AppError` and the stable codes in
`ERROR_CODES` (from [PLAN.md §14](PLAN.md#14-error-handling-and-observability)).
`toErrorResponse()` turns an error into the shape below. Unknown errors
become `INTERNAL_ERROR` with a generic message; stack traces and
database errors never reach the client.

``` json
{ "error": { "code": "QUEUE_PAUSED", "message": "This queue is temporarily paused." } }
```

**Request IDs.** Every API request handled by `withApiHandler()` gets a
request ID that appears in its log lines, so a reported problem can be
traced.

**Environment.** `getEnv()` in `src/lib/env.ts` validates environment
variables with Zod. It runs on first use, not at import, so
`next build` works without a database. Code never reads `process.env`
directly.

**Authorization and tenant isolation (Phase 2).** Every protected
handler loads the resource first, then checks that the user belongs to
that resource's clinic and has the right role. Hiding a button is not
security. See [PLAN.md §3](PLAN.md#3-users-and-permissions) and
[§13](PLAN.md#13-authentication-security-and-privacy).

**Logging and privacy.** Never log passwords, session tokens, API keys
or more patient data than needed.

## 6. Data

- **PostgreSQL is the source of truth** for queue state, audit events,
  outbox events and idempotency records.
- **Prisma 7** connects through the `@prisma/adapter-pg` driver adapter.
  `getDb()` in `src/lib/db` creates the client on first use and reuses
  it.
- The client is generated into `src/generated/prisma` (not committed).
- `prisma.config.ts` holds the schema path, migrations path and database
  URL. `prisma/schema.prisma` has the datasource and generator now; the
  models arrive in Phase 2 ([PLAN.md §8](PLAN.md#8-database-design)).
- Schema changes go through Prisma migrations only.
- Two databases run in the same container: `queuecare_dev` for
  development and `queuecare_test` for automated tests.

## 7. Runtime and Docker

The host needs only Docker. Node, PostgreSQL and the Playwright browsers
all run in containers.

``` text
 default profile                       profile: test
 ───────────────                       ─────────────
 browser ──► localhost:3000            e2e  (target: e2e)
                   │                   Playwright
                   ▼                        │  http://web:3000
 app  (target: dev)                         ▼
 next dev + Compose Watch              web  (target: runner)
                   │                   node server.js (standalone)
                   │                        │
                   ▼                        ▼
 db  (postgres:17-alpine, volume: pgdata)
     ├── queuecare_dev    ◄── app  (DATABASE_URL)
     └── queuecare_test   ◄── web, and integration tests in app (TEST_DATABASE_URL)
```

| Service | Built from | Purpose |
|---|---|---|
| `db` | `postgres:17-alpine` | Database on port 5432, data in the `pgdata` volume. `docker/postgres/init.sql` creates `queuecare_test` next to `queuecare_dev`. Has a health check. |
| `app` | Dockerfile target `dev` | `npm run dev` on port 3000. Compose Watch copies source changes into the container and rebuilds when `package.json` or `package-lock.json` change. |
| `web` | Dockerfile target `runner` | Production build (Next.js standalone, `node server.js`, non-root user) against `queuecare_test`. Health check on `/api/health`. Profile `test`. |
| `e2e` | Dockerfile target `e2e` | Playwright image; runs the end-to-end tests against `http://web:3000`. Profile `test`. |

Dockerfile stages: `base` → `deps` (install packages) → `dev` /
`builder` (`prisma generate`, `next build`) → `runner`; plus `e2e`.

Compose Watch is used instead of a bind mount. On Windows, bind mounts
do not pass file-change events into the container reliably, and the
container needs its own Linux `node_modules`.

Common commands (full list in the README):

| Task | Command |
|---|---|
| Start development | `docker compose up --watch` |
| Lint, type-check, unit and integration tests | `docker compose exec app npm run lint` (or `typecheck`, `test`) |
| Create a migration | `docker compose exec app npx prisma migrate dev` |
| End-to-end tests | `docker compose --profile test run --rm e2e` |
| Stop test services | `docker compose --profile test down` |

## 8. Environments

| Environment | Runs as | Database | Notes |
|---|---|---|---|
| Development | `app` service (`dev` target) | `queuecare_dev` | Hot reload through Compose Watch. |
| Test (local and CI) | `app` for unit/integration, `web` + `e2e` for end-to-end | `queuecare_test` | CI runs the same compose commands as a developer. |
| Production (Phase 9) | `runner` image on the hosting platform | Managed PostgreSQL with backups | One image promoted through environments; settings come from environment variables. Migrations run as a release step, not on app start. |

## 9. Live updates

Start with polling ([PLAN.md §5](PLAN.md#5-recommended-technology-stack)).
The patient token page and staff queue screens poll their status
endpoints and stop while the tab is hidden. Server-Sent Events come
later only if pilot feedback needs them and the host supports
long-lived connections. No Redis or message broker until measured needs
justify it.

Queue data must always be fresh: do not wrap queue reads in
`use cache`.

## 10. Background work (Phase 8)

Queue actions that need a follow-up (for example an email) write an
`OutboxEvent` row in the same transaction. A worker picks up unprocessed
events, sends them, marks them processed, and retries failures with
bounded backoff. Processing is idempotent, and an email failure never
undoes a committed token. How the worker runs is decided in Phase 8;
the simplest fit is a `worker` service in docker-compose built from the
same image.

## 11. Architecture decisions

| # | Decision | Why |
|---|---|---|
| 1 | **Modular monolith** in one Next.js app | Small team and one pilot clinic. Modules keep code separate without the cost of services. Split only when measured needs justify it. |
| 2 | **PostgreSQL is the source of truth** | Queue correctness depends on transactions, row locks and unique constraints. Audit, outbox and idempotency live in the same database so they commit together. |
| 3 | **Polling before SSE** | Simple, works on any host, enough for clinic-scale traffic. Revisit with pilot data. |
| 4 | **Prisma 7 with `@prisma/adapter-pg`** | Typed queries and migrations. Raw SQL through Prisma for the few places that need row locks. Pinned to stable 7.10.1. |
| 5 | **Next.js standalone output in Docker** | Small runner image that starts with `node server.js` and runs as a non-root user. The same image serves tests and production. |
| 6 | **Docker-only development** | A new developer needs only Docker. Node 26 and PostgreSQL 17 versions are fixed by the images, so every machine and CI run match. |
| 7 | **Cache Components left on** (Next.js 16 default) | Pages and handlers that read the database run at request time. Queue data is never cached. |
| 8 | **Environment and database read lazily** | `getEnv()` and `getDb()` run on first use, so `next build` succeeds without a database. |
