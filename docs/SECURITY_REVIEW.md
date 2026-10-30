# Security Review --- Phase 9

Review of the codebase against PLAN.md §13 before the pilot. Date: 30 Oct
2026. Scope: everything under `src/`, `prisma/`, `next.config.ts`,
`docker-compose.yml` and the Dockerfile as of Phases 1--5.

Updated the same day after Phases 6--10 landed: statuses below reflect
the fixes applied since, and finding 16 was added. The code from Phases
6, 7, 8 and 10 has **not** had its own review yet (see the last
section).

**Severity:** High = fix before the pilot. Medium = fix before more
than one clinic or more than one app instance. Low = harden when
convenient. Info = accepted, recorded so nobody re-raises it.

## Summary

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Sign-in rate limit falls back to one shared bucket for everyone | High | **Fixed** --- `TRUSTED_IP_HEADER` |
| 2 | Seed script can create known-password accounts in any database | High | **Fixed** --- seed refuses other databases |
| 3 | Public join rate limit trusts a spoofable `X-Forwarded-For` | Medium | **Partly fixed** --- key source fixed; per-queue cap still a clinic setting |
| 4 | Rate limits live in process memory | Medium | Open --- documented |
| 5 | Rate limiter sweep is O(n) per request under a key flood | Low | Open --- patch below |
| 6 | Staff POST endpoints rely on SameSite cookies alone for CSRF | Low | Open --- patch below |
| 7 | Unknown errors log the full error message | Low | Open --- patch below |
| 8 | Patient names kept forever | Medium | **Fixed** --- retention job |
| 9 | Idempotency fingerprints are hashes of the patient's name | Low | **Fixed** --- retention job |
| 10 | No security headers | Medium | **Fixed** --- `next.config.ts` |
| 11 | Health check would expose operational detail if extended naively | Low | **Fixed** --- details need the job token |
| 12 | CSP allows inline scripts | Info | Accepted --- trade-off below |
| 13 | Existence of a queue or clinic ID is visible before sign-in | Info | Accepted |
| 14 | Anonymous GET of a clinic page creates today's queues | Info | Accepted |
| 15 | Public token and cancel endpoints have no rate limit | Info | Accepted |
| 16 | Forms submitted before hydration put passwords in the URL | High | **Fixed** --- `method="post"` on every form |

Checked and fine: SQL injection, tenant isolation, error responses,
XSS sinks, user enumeration, session lifetime and deactivation, request
ID handling. Details under "What passed".

## Fixed after the review

### 1. Sign-in rate limit fell back to one shared bucket --- High, fixed

`src/lib/auth/auth.ts` (the `advanced.ipAddress` option) and
`src/lib/env.ts`.

Better Auth limits sign-in to 5 attempts a minute per client IP. When it
can't work out the client IP it uses **one bucket for every caller**
(`node_modules/better-auth/dist/api/rate-limiter/index.mjs`,
`NO_TRUSTED_IP_KEY`). In production, anyone sending 5 bad passwords a
minute would have locked **all staff at all clinics** out of sign-in.

**Fix:** a new optional `TRUSTED_IP_HEADER` environment variable (for
example `x-forwarded-for`) is passed to Better Auth as
`advanced.ipAddress.ipAddressHeaders`. Set it only when the app sits
behind a proxy that **overwrites** that header (docs/RUNBOOK.md,
"Reverse proxy"); without a proxy, leave it unset and accept the shared
bucket rather than trust a header the attacker controls. The E2E `web`
service sets it, so each sign-in spec gets its own bucket.

### 2. Seed could create known-password accounts anywhere --- High, fixed

`prisma/seed.sql`, registered in `prisma.config.ts`.

The seed creates a super admin and three staff accounts with the
published password `queuecare-dev`, and `npx prisma db seed` runs
against whatever `DATABASE_URL` points at.

**Fix:** the first statement after `BEGIN;` is a guard block:

```sql
DO $guard$
BEGIN
  IF current_database() NOT IN ('queuecare_dev', 'queuecare_test') THEN
    RAISE EXCEPTION 'Refusing to seed %: demo accounts are for local databases only.', current_database();
  END IF;
END $guard$;
```

Verified: both local databases still seed, and a scratch database is
refused with that message.

### 3. Public join rate limit trusted `X-Forwarded-For` --- Medium, partly fixed

`clientIp()` in `src/features/queue/http.ts`, used by the public join,
invitation accept and signup endpoints.

The 20-joins-a-minute limit was keyed on the **first**
`X-Forwarded-For` entry, which the client controls, so a script could
create unlimited tokens.

**Fixed:** `clientIp()` now reads only the header named in
`TRUSTED_IP_HEADER` and takes its **last** entry (the one the proxy
appended). Without a trusted proxy it ignores every client header and
returns one shared `unknown` key. Unit tests cover all three cases
(`src/tests/unit/queue/http.test.ts`).

**Still open:** there is no per-queue ceiling independent of the client
address. The cap today is `Clinic.maxQueueSize`, which admins can now
set in Admin › Settings but which is unlimited by default. Ask pilot
clinics to set it, or add a second limiter keyed on `queueId` alone (for
example 120 joins a minute).

### 16. Forms submitted before hydration put passwords in the URL --- High, fixed

Seen on `/login` during Phase 10 testing: clicking "Sign in" before
React hydrated made the browser submit the form natively as a GET, so
the address bar (and any proxy or server access log) got
`/login?email=…&password=…`. The same applied to every form handled by
`onSubmit`, including reset password, accept invitation and signup.

**Fix:** all 18 `<form onSubmit>` elements now have `method="post"`, so
an early submit carries the fields in the request body. Search forms
that are meant to GET are unchanged.
`src/tests/unit/forms-post.test.ts` scans every component and fails if a
script-handled form lacks `method="post"`; it was checked against a
deliberately bad form.

### Accessibility, from the same review

Two staff controls had an `aria-label` that didn't match their visible
text (axe `label-content-name-mismatch`, serious): the account menu
trigger in `src/components/layout/staff-navigation.tsx` and the "Up
next" row link in `src/components/queue/mini-ticket-row.tsx`. Both now
take their accessible name from visible text plus screen-reader-only
text. Fixed.

## Open findings

### 4. Rate limits live in process memory --- Medium

`src/lib/rate-limit.ts` and Better Auth's default memory storage.

Correct for the single-instance pilot. Each extra instance multiplies
the allowed rate, and a restart resets every count. Before scaling out,
move both to the database (Better Auth: `rateLimit.storage: "database"`
plus its `rateLimit` table) or to Redis once it is justified (PLAN.md
§5).

### 5. Rate limiter sweep is O(n) per request --- Low

`src/lib/rate-limit.ts:33`.

Once the map holds more than 10,000 keys, **every** request walks the
whole map. Since the finding 3 fix, clients can't choose their own key,
so a flood needs that many real addresses behind the proxy; the risk is
lower but the fix is still cheap.

**Patch:** sweep at most once per window (remember `lastSweepAt`), and
refuse new keys when the map is at a hard cap (for example 50,000) by
treating them as limited.

### 6. CSRF protection relies on SameSite cookies --- Low

`src/lib/errors/api-handler.ts:52` (`withApiHandler`) and
`src/features/queue/http.ts:32` (`readJsonBody`).

Staff endpoints are protected by Better Auth's `SameSite=Lax`, `HttpOnly`
session cookie, which browsers don't send on cross-site POSTs. That is
sufficient today. The residual risks: a sibling subdomain counts as
same-site, and `readJsonBody` parses JSON whatever the `Content-Type`, so
a cross-site `text/plain` form would be accepted if a cookie ever got
through.

**Patch (defence in depth):** in `withApiHandler`, reject non-GET
requests whose `Origin` header is present and differs from
`new URL(getEnv().BETTER_AUTH_URL).origin` (403 `FORBIDDEN`); in
`readJsonBody`, require `content-type: application/json` when a body is
sent.

### 7. Unknown errors log the full message --- Low

`src/lib/errors/api-handler.ts:41` → `src/lib/log.ts`.

Clients never see internal errors. The server log, however, gets the raw
message and stack. Some Prisma validation errors include the argument
values, which can contain a patient's name.

**Patch:** in `logError`, for `Prisma.PrismaClientValidationError` and
`PrismaClientKnownRequestError`, log `name`, `code` and `meta.target`
only, not `message`.

## Fixed in Phase 9

### 8. Patient names were kept forever --- fixed

`src/features/retention/retention.ts`, `POST /api/internal/retention/run`.

A job clears `queue_tokens.patient_name` once the visit is older than the
clinic's `patientDataRetentionDays` (default 30, an assumption to confirm;
docs/PRIVACY.md). It works in batches of 500, is safe to rerun, and writes one
`retention.patient_names_cleared` audit event per clinic with the count.
It must be scheduled (docs/RUNBOOK.md, "Scheduled jobs").

### 9. Idempotency fingerprints hash the patient's name --- fixed

`src/lib/idempotency.ts:27`.

The fingerprint is a SHA-256 of the request body, which includes the
optional name. Names are low-entropy, so a dictionary could reverse it.
The retention job now deletes idempotency records older than 2 days;
they are only needed for retries on the same queue day.

### 10. Security headers --- fixed

`next.config.ts`. Every response now carries:

| Header | Value | Why |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'`, scripts/styles self + inline, `img-src 'self' data: blob:`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` | Limits where code and data can come from |
| `X-Frame-Options` | `DENY` | Clickjacking, for browsers without `frame-ancestors` |
| `X-Content-Type-Options` | `nosniff` | No MIME sniffing |
| `Referrer-Policy` | `same-origin` | Patient token URLs are bearer links; never leak them to other sites |
| `Permissions-Policy` | camera, microphone, geolocation, payment, USB off | Nothing in the app needs them |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolates the window from cross-origin openers |
| `Strict-Transport-Security` | `max-age=31536000` | Browsers ignore it over HTTP (RFC 6797 §8.1), so it only acts on HTTPS deployments. No `includeSubDomains`/`preload`: those affect the whole domain |

`X-Powered-By` is removed. Verified on a dev server: every page, the
join flow, sign-in and the staff pages load with no CSP violations and
no console errors. `src/tests/e2e/security.spec.ts` checks the headers,
and that production has no `'unsafe-eval'`.

### 11. Health check --- fixed

`src/app/api/health/route.ts`. The public answer stays
`{status, database}`. Outbox counts (`pending`, `failed`,
`oldestPendingAgeSeconds`; never payloads or errors) appear only with
`Authorization: Bearer <INTERNAL_JOB_SECRET>`.

## Accepted

### 12. CSP allows inline scripts

Next.js streams inline `<script>` tags for the React Server Components
payload. Blocking them needs a per-request nonce, and the Next.js docs
(`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`)
state that nonces force every page to render dynamically and are
**incompatible with Partial Prerendering**, which `cacheComponents`
relies on. Hash-based SRI is experimental and doesn't cover inline
scripts. So `script-src` keeps `'unsafe-inline'`. The real defence
against XSS is React's escaping: there is no `dangerouslySetInnerHTML`,
`innerHTML` or `eval` anywhere in `src/`. Revisit if a page ever renders
user HTML.

### 13. Existence of an ID is visible before sign-in

Staff routes load the resource before authorizing (for example
`src/app/api/queues/[queueId]/call-next/route.ts:15`), so a signed-out
caller gets 404 for an unknown queue and 401 for a real one. IDs are
UUIDs (v7 for queues: 74 random bits), so they can't be enumerated.

### 14. Clinic page GET creates today's queues

`src/features/queue/queries.ts:61`. An anonymous visit creates at most
one queue row per active service per day, idempotently. Harmless.

### 15. Public token endpoints have no rate limit

`GET /api/public/tokens/[id]` and `/cancel`. The ID is a UUID v4 (122
random bits) and is the only credential. Guessing is infeasible, so a
limit adds little. Add a generous per-IP limit on cancel if abuse shows
up.

## What passed

| Area | Result | Evidence |
|---|---|---|
| SQL injection | Pass | All raw SQL uses Prisma tagged templates with bound parameters (`src/features/queue/service.ts:227`, `:254`, `:269`, `:392`). No `$queryRawUnsafe` or `$executeRawUnsafe` anywhere. Route IDs are UUID-validated (`src/features/queue/http.ts:11`). |
| Tenant isolation | Pass | Every staff handler loads the resource, then calls `requireClinicPermission` with **its** clinic ID (`src/lib/auth/guards.ts`); service writes re-check with `assertSameClinic`. `src/tests/integration/security/security.test.ts` proves 403 for another clinic's staff and 401 when signed out on 7 endpoints. |
| Authentication | Pass | Better Auth, `HttpOnly` + `SameSite=Lax` cookies, `Secure` when `BETTER_AUTH_URL` is HTTPS (`src/lib/auth/auth.ts`), public sign-up off, 12-hour sessions. Deactivated users can't start a session and lose access on the next request (`src/lib/auth/session.ts`, `guards.ts`). |
| User enumeration | Pass | Sign-in shows one message for a wrong email or password. |
| Error leakage | Pass | Unknown errors return `INTERNAL_ERROR` with a request ID (`src/lib/errors/api-handler.ts:29`); the error page shows only a digest (`src/app/error.tsx`). |
| XSS | Pass | No HTML injection sinks in `src/`; all text goes through React escaping. |
| Request ID | Pass | Caller-supplied IDs are accepted only if they match `^[\w-]{1,64}$`. |
| Public data | Pass | The token status returns only the fields in `PublicTokenView` --- no patient name, no internal IDs (integration test). |
| Internal jobs | Pass | `/api/internal/*` needs `Authorization: Bearer <INTERNAL_JOB_SECRET>`, compared in constant time over SHA-256 digests (`src/features/retention/internal-job-auth.ts`); 503 when no secret is set. |
| Secrets | Pass | Real secrets come from the environment; compose holds dev-only values, labelled as such. `.env*` is git-ignored. |

## Not yet reviewed

The code from Phases 6, 7, 8 and 10 has **not** had a dedicated
security pass. It was built with the same patterns (load the resource,
then authorize against its clinic; Zod; transactions; audit) and has
integration tests for access rules, but nobody has reviewed it with
fresh eyes. Rerun this review before the pilot, covering:

- **Doctor (Phase 6):** `/api/doctor/*`, availability changes, and what
  the patient notice reveals (it should never name a doctor).
- **Clinic admin (Phase 7):** every `/api/clinics/[clinicId]/*` admin
  route and `/api/services/*`. Staff invitations: only the SHA-256 hash
  of the token is stored, links expire after 7 days and work once.
  Admin role changes: admins can't change their own role, and a clinic
  can't lose its last active admin. Admin password reset is refused for
  people who also work at another clinic.
- **Email (Phase 8):** the outbox worker's handling of one-time links
  (removed from the stored payload after sending), the password reset
  flow and its per-address limits, and email template escaping.
- **Platform (Phase 10):** every `/api/platform/*` endpoint, the signup
  endpoint (it reveals whether an email already has an account; the rate
  limit of 5 an hour is the only mitigation), and support tickets.

Resolved from the previous list: the Phase 8 outbox endpoint already
uses `checkInternalJobAuth` from
`src/features/retention/internal-job-auth.ts`, so there is one
implementation of the internal job check.
