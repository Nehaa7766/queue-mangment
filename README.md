# QueueCare

Clinic queue management. Patients scan a clinic QR code to join a queue and follow their token on their phone. Reception, doctors and clinic admins run the queue from role-based dashboards.

## Requirements

Only **Docker** (Docker Desktop on Windows and macOS). Node.js, PostgreSQL and the browsers for end-to-end tests all run in containers.

## Quick start

```bash
docker compose up --watch
```

This starts PostgreSQL and the Next.js dev server. Open <http://localhost:3000>.

`--watch` copies your edits into the container as you save, and rebuilds the container when `package-lock.json` or `prisma/schema.prisma` changes.

The first time, create the tables and the demo clinic:

```bash
docker compose exec app sh -c 'npm run db:deploy && npx prisma db seed'
```

Check the app and database are up:

```bash
curl http://localhost:3000/api/health
# {"status":"ok","database":"ok"}
```

If port 3000 is taken on your machine, pick another: `APP_PORT=3100 docker compose up --watch`. The same works for `DB_PORT` (default 5442) and `WEB_PORT` (default 3001).

## Demo data

The seed creates **Demo Clinic** (`/q/demo-clinic`) with three services (General `A`, Pediatrics `B`, Dental `C`) and an open queue for each, today. Staff accounts all use the password `queuecare-dev`:

| Email | Role | Lands on |
|---|---|---|
| `reception@demo-clinic.test` | Receptionist | `/receptionist` |
| `doctor@demo-clinic.test` | Doctor | `/doctor` |
| `admin@demo-clinic.test` | Clinic admin | `/admin/dashboard` |
| `superadmin@queuecare.test` | Platform super admin | `/super-admin/dashboard` |

These are development accounts only. Never seed them into production.

In development the sign-in page lists them under **Demo accounts**: pick a role to fill in its email and password, then press **Open my counter**. A production build hides the list unless the server sets `DEMO_LOGINS=true`, which is meant for a demo server that runs the seed's database.

## Everyday commands

Run these while `docker compose up --watch` is running in another terminal.

| Task | Command |
|---|---|
| Lint | `docker compose exec app npm run lint` |
| Type-check | `docker compose exec app npm run typecheck` |
| Format code | `docker compose exec app npm run format` |
| Unit and integration tests | `docker compose exec app npm test` |
| Create a migration | `docker compose run --rm -v ./prisma:/app/prisma app npx prisma migrate dev --name <name>` (mounts `prisma/` so the new migration lands in your repo; Watch only syncs into the container) |
| Migrate and seed the test database | `docker compose exec app sh -c 'DATABASE_URL=$TEST_DATABASE_URL npm run db:deploy && DATABASE_URL=$TEST_DATABASE_URL npx prisma db seed'` |
| Production build and end-to-end tests | `docker compose --profile test run --rm e2e` (migrate and seed the test database first) |
| Stop everything | `docker compose --profile test down` |
| Stop and delete the database | `docker compose --profile test down --volumes` |

The end-to-end run builds the production image (`web`, on <http://localhost:3001>) and runs Playwright against it at phone, tablet and desktop widths. The report is saved to `playwright-report/`.

## Containers

| Service | What it runs |
|---|---|
| `db` | PostgreSQL 17 with two databases, `queuecare_dev` and `queuecare_test`, on host port 5442 so it doesn't clash with a locally installed PostgreSQL |
| `app` | Next.js dev server with hot reload (Dockerfile target `dev`) |
| `worker` | Calls `/api/internal/outbox/process` every 10 seconds to send queued emails (staff invitations, password resets) |
| `retention` | Calls `/api/internal/retention/run` once a day to clear old patient names |
| `web` | Production build, `node server.js` (target `runner`, `test` profile only) |
| `e2e` | Playwright with browsers preinstalled (target `e2e`, `test` profile only) |

## Environment variables

Compose sets the database URLs, auth secrets and the internal job secret for the containers, using development-only values. To add other values, copy `.env.example` to `.env`. Never commit `.env`.

Email: without `RESEND_API_KEY`, development keeps emails in memory and logs one redacted line per email, so no real email is sent. To send real email, set `RESEND_API_KEY` and `EMAIL_FROM` (an address on a domain verified with Resend) in `.env`.

## Documentation

| Document | Contents |
|---|---|
| [docs/PLAN.md](docs/PLAN.md) | Full product and technical plan |
| [docs/PHASES.md](docs/PHASES.md) | Delivery phases with tasks and exit criteria |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, request flow and Docker setup |
| [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md) | Where each kind of code lives |
| [docs/GUI_RULES.md](docs/GUI_RULES.md) | Design tokens and UI rules |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Deploying, backups and restore, rollback, monitoring, incidents |
| [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md) | Security findings and their status |
| [docs/PRIVACY.md](docs/PRIVACY.md) | What patient data is kept, and for how long |
| [docs/STAFF_GUIDE.md](docs/STAFF_GUIDE.md) | One-page guides for reception and doctors |

## Tech stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Better Auth, Prisma 7, PostgreSQL 17, Zod, Recharts, Vitest, React Testing Library and Playwright.
