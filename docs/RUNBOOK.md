# QueueCare --- Operations Runbook

How to deploy, back up, restore, roll back and watch QueueCare in
production, and what to do when something goes wrong. Written for
whoever runs the pilot deployment.

## What runs in production

| Part | What it is |
|---|---|
| App | The Docker image built from the `runner` stage of the Dockerfile: Next.js standalone server, `node server.js`, port 3000, runs as a non-root user. |
| Database | PostgreSQL 17. Use a managed service with automatic daily backups and point-in-time recovery if available. |
| Reverse proxy | Terminates HTTPS in front of the app (load balancer, Caddy, nginx, or the hosting platform's edge). |
| Scheduled jobs | Outbox worker (every 10 seconds) and data retention (daily). Both are HTTP calls to `/api/internal/*`. |

Run **one** app instance for the pilot. Rate limits are kept in memory
(docs/SECURITY_REVIEW.md, finding 4).

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://user:password@host:5432/queuecare` |
| `BETTER_AUTH_SECRET` | Yes | At least 32 random characters: `openssl rand -base64 32`. Changing it signs every staff member out. |
| `BETTER_AUTH_URL` | Yes | The public **https** URL, e.g. `https://queue.example.com`. Must be HTTPS in production, or session cookies aren't marked `Secure`. |
| `INTERNAL_JOB_SECRET` | Yes | At least 32 random characters. Protects `/api/internal/*` and the detailed health check. |
| `RESEND_API_KEY`, `EMAIL_FROM` | For email | Phase 8. `EMAIL_FROM` must use a domain verified with Resend. |
| `DEMO_LOGINS` | No | Leave unset. `true` lists the seeded demo accounts and their password on the sign-in page; only for a demo server. |
| `TRUSTED_IP_HEADER` | Behind a proxy | Once SECURITY_REVIEW finding 1 is patched: the header your proxy **overwrites** with the client IP, usually `x-forwarded-for`. |

Keep secrets in the platform's secret manager. Never reuse the
development values from `docker-compose.yml`.

## Reverse proxy

- Serve only HTTPS; redirect HTTP to HTTPS.
- **Overwrite** `X-Forwarded-For` with the real client address (don't
  append to what the client sent). Rate limits key on it.
- Pass the `Host` header through unchanged.
- Allow request bodies of at least 1 MB; no API request is larger.

## Releasing a new version

Every release follows the same order. Write down the image tags as you
go; you need them to roll back.

1. **Build** both images from the same commit:

   ```bash
   SHA=$(git rev-parse --short HEAD)
   docker build --target runner  -t queuecare:$SHA .
   docker build --target builder -t queuecare-migrate:$SHA .
   ```

   The `runner` image has no Prisma CLI; the `builder` image has it and is
   used only for migrations.

2. **Back up** the database (next section). Keep this backup until the
   release has run cleanly for a week.
3. **Migrate** --- a release step, never on app start:

   ```bash
   docker run --rm -e DATABASE_URL="$DATABASE_URL" queuecare-migrate:$SHA npx prisma migrate deploy
   ```

4. **Deploy** `queuecare:$SHA` with the environment above.
5. **Check:**
   - `curl -fsS https://<host>/api/health` returns `{"status":"ok","database":"ok"}`.
   - Sign in as a staff member, open the live queue.
   - Open `/q/<clinic-slug>` on a phone.
6. **Watch** errors and the outbox for 30 minutes (see "Monitoring").

**Never run `npx prisma db seed` against production.** It creates demo
accounts with a published password (SECURITY_REVIEW finding 2).

### Writing migrations that can be rolled back

Prisma has no automatic down migrations, so roll back the **app**, not the
schema. Make every migration safe for the previous app version:

- Add columns as nullable or with a default; add tables freely.
- Rename or drop in two releases: first stop using the old column, then
  drop it in a later release.
- Never change the meaning of an existing column in place.

## Backups

**Managed PostgreSQL:** turn on automatic daily backups with at least
30 days of retention, plus point-in-time recovery if offered. Take a
manual dump before every release:

```bash
docker run --rm postgres:17-alpine pg_dump "$DATABASE_URL" -Fc --no-owner > queuecare-$(date -u +%Y%m%dT%H%M%SZ).dump
```

**Docker Compose database** (local, or a single-server pilot):

```bash
sh docker/postgres/backup.sh queuecare_dev backups
# prints e.g. backups/queuecare_dev-20261030T101500Z.dump
```

Store dumps encrypted, off the database server, with the same 30-day
expiry as the patient-name retention (docs/PRIVACY.md). Backups contain
patient names until they expire.

## Restore drill

Do this once before the pilot and then monthly. It proves the backups
work and shows how long a restore takes. It never touches the source
database.

```bash
# 1. Back up the source database.
FILE=$(sh docker/postgres/backup.sh queuecare_dev backups)

# 2. Restore into a separate database. Refuses if the name exists.
sh docker/postgres/restore.sh "$FILE" queuecare_restore_drill

# 3. Compare row counts; they must match.
for db in queuecare_dev queuecare_restore_drill; do
  docker compose exec -T db psql -U queuecare -d "$db" -tAc \
    "SELECT '$db', (SELECT count(*) FROM clinics), (SELECT count(*) FROM users), (SELECT count(*) FROM queue_tokens), (SELECT count(*) FROM _prisma_migrations)"
done

# 4. Point a dev server at the copy and sign in (optional).

# 5. Remove the copy.
docker compose exec -T db psql -U queuecare -d postgres -c "DROP DATABASE queuecare_restore_drill"
```

Write down the date, dump size, restore time and whether the counts
matched.

**Restoring for real** (data loss or corruption): stop the app, restore
the chosen dump into a **new** database, check it as in step 3, then point
`DATABASE_URL` at it and start the app. Replacing a database in place
needs `restore.sh <file> <db> --force`, which drops it first --- only do
that with a second person checking the command.

## Rolling back

| Problem | Do this |
|---|---|
| New app version misbehaves, migration was additive | Redeploy the previous `queuecare:<sha>` image. The old code ignores new columns and tables. |
| A migration itself is wrong | Fix forward: write a new migration that corrects it, release it. |
| A migration destroyed data | Stop the app. Restore the pre-release backup into a new database, redeploy the previous image against it. Anything written since the backup is lost; tell the clinics which window to re-enter by hand. |

## Scheduled jobs

Both jobs are idempotent: running them twice is harmless.

| Job | Schedule | Call |
|---|---|---|
| Outbox (emails) | Every 10 seconds | `POST /api/internal/outbox/process` |
| Data retention | Daily, at night clinic time (e.g. 02:30 IST) | `POST /api/internal/retention/run` |

```bash
curl -fsS -X POST -H "Authorization: Bearer $INTERNAL_JOB_SECRET" \
  https://<host>/api/internal/retention/run
# {"clinics":1,"patientNamesCleared":12,"idempotencyRecordsDeleted":340}
```

`docker-compose.yml` runs the outbox loop as the `worker` service. For
retention use the platform's cron (or a host crontab entry with the
command above). A 503 means `INTERNAL_JOB_SECRET` isn't set on the app; a
401 means the caller's token is wrong.

## Monitoring and alerts

| Check | How | Alert when |
|---|---|---|
| App and database up | `GET /api/health` every minute | Not 200 three times in a row |
| Outbox | `GET /api/health` with `Authorization: Bearer $INTERNAL_JOB_SECRET` returns `outbox.pending`, `outbox.failed`, `outbox.oldestPendingAgeSeconds` | `failed > 0`, or `oldestPendingAgeSeconds > 600` |
| Server errors | App logs are one JSON object per line with `level`, `message`, `requestId` | More than 5 `"Unhandled API error"` lines in 5 minutes |
| Retention job | The job's own exit status | Non-200, or it didn't run for 2 days |
| Backups | The provider's backup status | A daily backup missing |
| Database | Provider metrics | Disk above 80%, connections above 80% of the limit |

Every API response has an `x-request-id` header, and error bodies
include `requestId`. When a clinic reports a problem, ask for the time
and, if they have it, the reference shown on the error page; search the
logs for it.

## Incident response

Use this when patient or staff data may have been exposed, someone has
access they shouldn't, or the service is down during clinic hours.

1. **Note the time** and open an incident log. Write down every action,
   with times.
2. **Assess:** what is affected (which clinics, what data, since when)?
   Is it still happening?
3. **Contain:**
   - Leaked staff password: deactivate the user (clinic admin panel or
     `UPDATE users SET status = 'INACTIVE' WHERE email = '...'`).
     Their sessions stop working on the next request.
   - Leaked `BETTER_AUTH_SECRET`: rotate it and redeploy. Everyone is
     signed out.
   - Leaked `INTERNAL_JOB_SECRET`: rotate it in the app and in the job
     schedulers.
   - Leaked database password: rotate it at the provider, update
     `DATABASE_URL`, redeploy.
   - Abuse of public joining: set a maximum queue size for the clinic
     and pause the affected queue.
4. **Preserve evidence:** export the relevant logs and audit events
   (`audit_events`, `platform_audit_events`) before they rotate.
5. **Fix** the cause, release, and confirm with the checks above.
6. **Tell people:** the affected clinic owners, in plain language, the
   same day. If personal data was exposed, the DPDP Act may require
   notifying the Data Protection Board of India and the people affected
   --- involve counsel immediately (docs/PRIVACY.md).
7. **Review** within a week: what happened, why, what changes. Add the
   lessons to this runbook.

## Common tasks

| Task | How |
|---|---|
| Remove one patient's name now | `UPDATE queue_tokens SET patient_name = NULL WHERE public_token_id = '<id from their link>';` |
| Deactivate a staff member | Clinic admin panel (Phase 7), or `UPDATE clinic_memberships SET status = 'INACTIVE' WHERE ...` |
| Check migration state | `docker run --rm -e DATABASE_URL=... queuecare-migrate:<sha> npx prisma migrate status` |
