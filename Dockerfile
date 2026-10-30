# syntax=docker/dockerfile:1

ARG NODE_VERSION=26
# Must match the exact @playwright/test version in package.json.
ARG PLAYWRIGHT_VERSION=1.64.1

# ---- base: Node runtime shared by the app stages ----
FROM node:${NODE_VERSION}-slim AS base
# OpenSSL for the Prisma CLI's schema engine.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- deps: node_modules from the lockfile ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- dev: hot-reloading dev server (docker compose up --watch) ----
FROM deps AS dev
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- builder: production build ----
FROM deps AS builder
COPY . .
RUN npx prisma generate && npm run build

# ---- runner: small production image, no dev dependencies ----
FROM base AS runner
ENV NODE_ENV=production \
  PORT=3000 \
  HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

# ---- e2e: Playwright with browsers preinstalled ----
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble AS e2e
ARG PLAYWRIGHT_VERSION
WORKDIR /e2e
COPY package.json /tmp/app-package.json
# Only the E2E packages, at the versions package.json pins.
RUN npm init -y > /dev/null \
  && AXE_VERSION=$(node -p "require('/tmp/app-package.json').devDependencies['@axe-core/playwright']") \
  && npm install --no-audit --no-fund \
    @playwright/test@${PLAYWRIGHT_VERSION} \
    "@axe-core/playwright@${AXE_VERSION}"
COPY playwright.config.ts ./
COPY src/tests/e2e ./src/tests/e2e
CMD ["npx", "playwright", "test"]
