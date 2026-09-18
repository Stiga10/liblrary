---
name: db-schema
description: Procedure for every database change in the Biblioteka project — schema.prisma, migrations, indexes, seed data. Use when adding or changing a model or field, adding an index, changing an enum, when a migration fails, when Cyrillic text is mangled in MySQL, or when the Prisma client will not generate. Covers Prisma 7 + MySQL 8.4 specifics.
---

# Changing the database (Prisma 7 + MySQL 8.4)

The database is the riskiest part of this project — a mistake here only becomes visible once the data
is already corrupted. Work through the steps in order; do not skip any.

## Step 0 — Check the state before touching anything

```bash
./scripts/mysql.sh status         # is the database up?
cd backend && npx prisma migrate status
```

MySQL is a local process under the user account (no Docker, no root). If it is not running, use
`./scripts/mysql.sh start`; if startup fails, read `~/.local/mysql-biblioteka/data/error.log`.

If a migration is pending, apply it first. Never stack a new change on top of an unapplied one.

## Step 1 — Edit `backend/prisma/schema.prisma`

The generator block is fixed for Prisma 7 — `output` is **required**, and the client no longer goes
into `node_modules`:

```prisma
generator client {
  provider = "prisma-client"          // NOT prisma-client-js (being removed)
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "mysql"
  // No `url` here: Prisma 7 removed it. Setting it fails with P1012.
}
```

The connection string moved to `backend/prisma.config.ts`, which is what Migrate reads:

```ts
import { defineConfig, env } from 'prisma/config';
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: env('DATABASE_URL') },
});
```

PrismaClient no longer derives its own connection either — it needs an explicit driver adapter
(`@prisma/adapter-mariadb` for MySQL). See `backend/src/lib/prisma.ts`.

Imports follow the generator output path:
```ts
import { PrismaClient } from '../generated/prisma/client.js';   // NOT from '@prisma/client'
```

## Step 2 — MySQL rules for fields

| Situation | Correct | Wrong |
|---|---|---|
| Short text that gets indexed | `String @db.VarChar(255)` | `String` with no length, `@db.Text` |
| Long text (description) | `String? @db.Text` | `@db.VarChar(5000)` |
| URL / path | `String? @db.VarChar(500)` | `@db.Text` if it will be indexed |
| Money / exact numbers | `Decimal @db.Decimal(10,2)` | `Float` |
| Date without time | `DateTime @db.Date` | `String` |

**Do not add indexes speculatively.** Add one only when there is a real query that filters or sorts by
that field. In this project the real needs are:

```prisma
@@index([title])              // catalog search
@@index([author])             // search / filter by author
@@index([bookId, status])     // counting active loans per book — the hot path
@@index([readerId, status])   // "what does this reader currently hold"
@@index([status, dueDate])    // overdue report
```

`@@index([bookId, status])` is the load-bearing one — without it, every catalog page load does a full
scan of `Loan`.

**MySQL caps index key length.** A `@db.Text` column cannot be indexed directly; if it ever seems
necessary, first question whether the query really requires it (in the MVP, search is `LIKE` — see §6 of
CLAUDE.md).

## Step 3 — Cyrillic

The database and the connection are `utf8mb4`. Verify this before blaming the code:

```bash
./scripts/mysql.sh cli -e "SELECT @@character_set_database, @@collation_database;"
# expected: utf8mb4 | utf8mb4_0900_ai_ci
```

Configured in `~/.local/mysql-biblioteka/my.cnf`:
```ini
[mysqld]
character-set-server = utf8mb4
collation-server     = utf8mb4_0900_ai_ci
```
After changing this, restart: `./scripts/mysql.sh stop && ./scripts/mysql.sh start`.
The change does **not** affect already-created tables — convert those with `ALTER TABLE ... CONVERT TO`.

If you see `????` instead of Bulgarian text, the problem is the collation or the `DATABASE_URL`, not
Prisma.

## Step 4 — Migration

```bash
npx prisma migrate dev --name descriptive_name_in_english
```

**Read the generated SQL before moving on** —
`backend/prisma/migrations/<timestamp>_*/migration.sql`. If it contains `DROP COLUMN`, `DROP TABLE`, or
`NOT NULL` on an existing column without a `DEFAULT`, stop and tell the user exactly which data will be
lost. Never run a destructive migration silently.

When adding a `NOT NULL` column to a table that already holds rows, it must have `@default(...)` or the
migration fails.

## Step 5 — Generate the client and refresh the Better Auth tables

```bash
npx prisma generate
```

Better Auth keeps its tables (`user`, `session`, `account`, `verification`) in the same schema.

**Do not use `npx @better-auth/cli generate`** — that package is deprecated and its last release
(1.4.21) produces a schema that is missing fields the installed better-auth needs, which then fails at
runtime rather than at migrate time. Ask the library what it expects instead:

```bash
cat > probe.ts <<'TS'
import { getAuthTables } from 'better-auth/db';
import { auth } from './src/lib/auth.js';
console.log(JSON.stringify(getAuthTables((auth as any).options), null, 2));
TS
npx tsx probe.ts && rm probe.ts
```

Reconcile any differences into `schema.prisma` by hand, then migrate. Known gotchas:

- `account.issuer` is **required** since better-auth 1.7 and is easy to miss.
- Do not put a prefix length on an index over a plain `String` column
  (`@@index([userId(length: 191)])`): Prisma maps `String` to `VARCHAR(191)` already, so the prefix is
  redundant and makes every subsequent `migrate dev` re-emit `CREATE INDEX`, which then fails with
  `Duplicate key name`. Only `@db.Text` columns need a prefix, as `verification.identifier` does.

## Step 6 — Seed

`backend/prisma/seed.ts` must be **idempotent** — runnable repeatedly without duplicating rows. Use
`upsert`, not `create`:

```ts
await prisma.book.upsert({
  where: { isbn: '9789542831234' },
  update: {},
  create: { title: 'Под игото', author: 'Иван Вазов', totalQuantity: 5 },
});
```

The admin account is created **through the Better Auth API**, not by a direct insert — otherwise the
password hash and the linked `account` row will be wrong. Public sign-up is disabled, so the seed
builds its own instance that permits it rather than opening the public route:

```ts
const seedAuth = createAuth({ allowSignUp: true });
await seedAuth.api.signUpEmail({ body: { email, password, name: 'Администратор' } });
await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
```

Guard against the half-created case: if a `user` row exists with **no** linked `account`, it has no
password and can never sign in. Delete and recreate it instead of reporting success — a failed sign-up
leaves exactly that wreckage behind.

Seed data should use Bulgarian titles and names — that way Cyrillic handling is exercised from minute
zero.

## Step 7 — Verify

```bash
npx prisma studio        # is the data visible, are the relations right
```

And always: issue one loan through the UI or API and check that `availableQuantity` changes. A schema
that looks correct in Studio can still break the availability computation.

## Invariants the schema must NOT violate

1. There is no `availableQuantity` column — it is computed. If someone asks for one, refuse and explain.
2. `LoanStatus` contains only `ACTIVE` and `RETURNED`. There is no `OVERDUE` — it is derived.
3. `Loan.bookId` and `Loan.readerId` use `onDelete: Restrict`, not `Cascade`. Loan history is not
   deleted along with a book.
4. `dueDate` is required (`DateTime`, not nullable). A loan without a due date can never be overdue.
5. Any new table holding Bulgarian text uses `@db.VarChar(n)` or `@db.Text` — never a bare `String` on
   an indexed field.

The full model is in CLAUDE.md §4; the invariants are in §5.
