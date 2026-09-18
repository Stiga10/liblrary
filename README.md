# Biblioteka — Library Management System

Public catalog plus a protected admin panel for a school or community library.
Books are entered by hand, covers are uploaded by hand, and availability is always
computed rather than stored.

The architecture, invariants and delegation rules live in [CLAUDE.md](CLAUDE.md).
Read that before changing anything.

## Stack

MySQL 8.4 LTS · Prisma 7 · Express 5 · Better Auth · Vite + React 19 ·
Tailwind CSS v4 · TanStack Query v5 · Zod 4 · react-i18next (bg/en)

No Docker, no containers: MySQL runs as a plain user process.

## First-time setup

MySQL is installed into `~/.local/mysql-biblioteka/` and needs neither root nor
systemd.

```bash
# 1. database (once)
./scripts/mysql.sh install     # downloads MySQL 8.4 (~77 MB) and unpacks it
./scripts/mysql.sh init        # writes my.cnf and initialises the datadir
./scripts/mysql.sh start

# create the database and a user for Prisma
./scripts/mysql.sh cli -e "CREATE DATABASE IF NOT EXISTS biblioteka \
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"

# 2. backend
cd backend
cp .env.example .env           # then fill in DATABASE_URL and BETTER_AUTH_SECRET
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed                   # admin account + 15 Bulgarian titles + 5 readers
npm run dev                    # http://localhost:3000

# 3. frontend (second terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                    # http://localhost:5174
```

Generate the auth secret with `openssl rand -base64 32`.

## Daily use

```bash
./scripts/mysql.sh start       # or: status / stop / restart / cli / logs
cd backend  && npm run dev
cd frontend && npm run dev
```

Sign in with the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` values from
`backend/.env`. **Change the seeded password before using this anywhere real.**

## Remote machines

Vite binds to all interfaces so the app is reachable from another computer. Two
things follow:

- The dev server is visible to anyone on the network. Set `VITE_HOST=127.0.0.1` to
  restrict it to loopback.
- `CORS_ORIGIN` in `backend/.env` is a comma-separated list and must contain the
  address the browser actually uses, or sign-in fails with `INVALID_ORIGIN` even
  though the page loads.

## Layout

```
scripts/mysql.sh     manage the local MySQL process
backend/
  prisma/            schema, migrations, seed
  src/schemas/       Zod schemas — source of truth for validation
  src/services/      business logic and transactions
  src/routes/        HTTP only: validate, delegate, respond
frontend/
  src/lib/schemas.ts MIRROR of backend/src/schemas — keep both in sync
  src/features/      catalog/ and admin/
  src/locales/       bg.json and en.json, always updated together
```

## Verification

There is no automated test suite; this is deliberate. Every change is accepted
against the manual checklist in [CLAUDE.md](CLAUDE.md) §9.

Useful checks:

```bash
# availability is computed, not stored
curl -s 'localhost:3000/api/books?limit=3' | jq '.items[] | {title, availableQuantity}'

# admin routes reject anonymous callers
curl -s -X POST localhost:3000/api/books -H 'content-type: application/json' -d '{}' | jq

# mirrored Zod schemas and i18n keys are in sync
node scripts/check-mirrors.mjs
```
