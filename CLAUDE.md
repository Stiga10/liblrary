# Biblioteka — Library Management System

Orchestrator for this project. This file is the source of truth for architecture, rules, and how work
is divided. Read all of it before writing any code.

The requirements originate from [text.md](text.md) (written in Bulgarian). Where this file disagrees
with text.md, **this file wins** — the differences are deliberate decisions made with the user and are
called out explicitly below.

---

## 1. What we are building

A web application for managing a school/community library:

- **Public area (no login):** catalog with cover images, search across title/author/description,
  availability status `Available: 3 of 5`, book detail view.
- **Admin panel (protected):** book nomenclature, readers, issuing and returning loans, overdue reports.

One administrator (or a few), with no public sign-up.

---

## 2. Stack — fixed, not to be changed without an explicit decision

| Layer | Technology | Note |
|---|---|---|
| Database | **MySQL 8.4 LTS** (local, no Docker) | 8.0 is EOL as of 2026-04-30 — not used |
| ORM | **Prisma 7** | `prisma-client` generator, not `prisma-client-js` |
| Backend | **Express 5** + TypeScript | native async error handling |
| Auth | **Better Auth** + Prisma adapter | Auth.js is in security-patch mode |
| Validation | **Zod 4** | schemas are the source of truth for the rules |
| Frontend | **Vite + React 19** | |
| UI | **Tailwind CSS v4 + shadcn/ui** | OKLCH tokens, `@theme`, light/dark |
| Data layer | **TanStack Query v5** | `gcTime` (not `cacheTime`), `placeholderData` |
| Icons | **Lucide React** | |
| i18n | **react-i18next** | `bg` (default) + `en` |
| Covers | **local upload** (multer + sharp) | no Cloudinary, no external API |

### Explicitly out of scope (do not propose, do not add)

- ❌ **Automated tests** — no Vitest/Playwright/Jest. Verification is manual (see §9).
- ❌ **External metadata APIs** (Open Library, Google Books) — every book is entered manually by the
  administrator, every cover is uploaded manually.
- ❌ **Reservations and waiting lists.**
- ❌ **Barcode/QR scanning.**
- ❌ **Public user registration** — accounts are created by the seed script / an admin.
- ❌ **PostgreSQL/MongoDB** — the database is MySQL. (text.md proposes PostgreSQL; overridden. MongoDB
  was evaluated and rejected: Prisma 7 has no MongoDB support, transactions require a replica set, and
  there are no migrations or foreign keys.)
- ❌ **Docker / docker-compose / Kubernetes** — no containers in this project. MySQL runs as a plain
  process (§9). Do not propose a `docker-compose.yml` and do not write `docker` commands.

---

## 3. Directory layout

Two **independent** folders, each with its own `package.json` and `npm`. No monorepo, no workspaces.

```
biblioteka/
├── CLAUDE.md                  ← this file
├── text.md                    ← original requirements, in Bulgarian (never edited)
├── scripts/
│   └── mysql.sh               ← start / stop / status / cli for the local MySQL (no Docker)
├── .claude/
│   ├── skills/                ← procedures (db-schema, api-endpoint, ui-screen)
│   └── agents/                ← executors (backend, frontend, db, review)
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── index.ts           ← Express bootstrap (middleware order is critical, §7)
│   │   ├── lib/
│   │   │   ├── auth.ts        ← Better Auth configuration
│   │   │   ├── prisma.ts      ← singleton client
│   │   │   └── errors.ts      ← AppError + single error handler
│   │   ├── generated/prisma/  ← Prisma 7 generates HERE (not into node_modules)
│   │   ├── middleware/
│   │   │   ├── requireAdmin.ts
│   │   │   ├── validate.ts    ← Zod middleware
│   │   │   └── upload.ts      ← multer + sharp
│   │   ├── schemas/           ← Zod schemas — SOURCE OF TRUTH
│   │   ├── routes/            ← books, readers, loans, reports
│   │   └── services/          ← business logic + transactions
│   └── uploads/covers/        ← uploaded covers (gitignored)
└── frontend/
    ├── src/
    │   ├── main.tsx
    │   ├── index.css          ← @import "tailwindcss" + @theme tokens
    │   ├── lib/
    │   │   ├── api.ts         ← fetch wrapper, credentials: 'include'
    │   │   ├── auth-client.ts ← Better Auth React client
    │   │   ├── query.ts       ← QueryClient
    │   │   └── schemas.ts     ← MIRROR of backend/src/schemas (§8)
    │   ├── locales/{bg,en}.json
    │   ├── components/ui/     ← shadcn components (owned by this project)
    │   ├── components/        ← BookCard, BookDialog, LoanForm, ...
    │   ├── features/          ← catalog/, admin-books/, admin-readers/, admin-loans/
    │   └── pages/
    └── vite.config.ts
```

---

## 4. Data model

Better Auth owns four tables (`user`, `session`, `account`, `verification`), and `user.role` is an
additional field whose value is `ADMIN`.

**Do not run `npx @better-auth/cli generate`.** That package is deprecated (last release 1.4.21) and
emits a schema missing fields the installed better-auth requires — it omits `account.issuer`, which
fails at sign-up with ``Unknown argument `issuer` ``. Derive the field list from the library itself:

```ts
import { getAuthTables } from 'better-auth/db';
getAuthTables(auth.options);   // authoritative: fields, types, required, references
```

Re-run that after upgrading better-auth and reconcile any differences into `schema.prisma` by hand.

```prisma
model Book {
  id            Int      @id @default(autoincrement())
  title         String   @db.VarChar(255)
  author        String   @db.VarChar(255)
  description   String?  @db.Text
  coverImageUrl String?  @db.VarChar(500)
  isbn          String?  @db.VarChar(20)
  totalQuantity Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  loans         Loan[]

  @@index([title])
  @@index([author])
}

model Reader {
  id         Int      @id @default(autoincrement())
  fullName   String   @db.VarChar(255)
  phone      String?  @db.VarChar(30)
  email      String?  @db.VarChar(255)
  cardNumber String?  @unique @db.VarChar(50)
  createdAt  DateTime @default(now())
  loans      Loan[]

  @@index([fullName])
}

model Loan {
  id         Int        @id @default(autoincrement())
  bookId     Int
  readerId   Int
  borrowDate DateTime   @default(now())
  dueDate    DateTime
  returnDate DateTime?
  status     LoanStatus @default(ACTIVE)

  book   Book   @relation(fields: [bookId], references: [id], onDelete: Restrict)
  reader Reader @relation(fields: [readerId], references: [id], onDelete: Restrict)

  @@index([bookId, status])
  @@index([readerId, status])
  @@index([status, dueDate])
}

enum LoanStatus {
  ACTIVE
  RETURNED
}
```

---

## 5. Availability invariants — LOAD-BEARING RULES

This is where systems like this break silently. Every rule below is mandatory.

1. **`availableQuantity` is NEVER stored in the database.** It is always computed as
   `totalQuantity − count(loans WHERE bookId = ? AND status = 'ACTIVE')`.
   A duplicated count in a column will drift out of sync with reality sooner or later.

2. **`OVERDUE` is NOT a database value.** The enum contains only `ACTIVE` and `RETURNED`.
   Being overdue is derived: `status === 'ACTIVE' && dueDate < now`. A stored OVERDUE status requires a
   cron job and goes stale the moment the clock moves.
   *(This is a deliberate divergence from text.md, which has OVERDUE in the enum.)*

3. **Issuing a book happens inside a transaction with a row lock:**
   ```ts
   await prisma.$transaction(async (tx) => {
     await tx.$queryRaw`SELECT id FROM Book WHERE id = ${bookId} FOR UPDATE`;
     const active = await tx.loan.count({ where: { bookId, status: 'ACTIVE' } });
     const book = await tx.book.findUniqueOrThrow({ where: { id: bookId } });
     if (book.totalQuantity - active <= 0) throw new AppError(409, 'NO_COPIES_AVAILABLE');
     return tx.loan.create({ data: { bookId, readerId, dueDate } });
   });
   ```
   Without `FOR UPDATE`, two concurrent requests hand out the last copy twice.

4. **`totalQuantity` cannot drop below the number of active loans.** Checked in `PUT /api/books/:id`,
   returns `409 QUANTITY_BELOW_ACTIVE_LOANS`.

5. **Returning is idempotent and one-directional.** Only `ACTIVE → RETURNED`, setting
   `returnDate = now()`. A second return returns `409 LOAN_ALREADY_RETURNED`, never a 500.

6. **A book with active loans cannot be deleted.** `onDelete: Restrict` plus a service-level check →
   `409 BOOK_HAS_ACTIVE_LOANS`. Same for readers.

7. **The default loan period is 14 days**, configured in one place (`LOAN_PERIOD_DAYS` in env), never
   scattered across the code.

---

## 6. API contract

Every error response has the same shape. The `message` is user-facing Bulgarian, because it is
displayed as-is by the UI:
```json
{ "error": { "code": "NO_COPIES_AVAILABLE", "message": "Няма свободни екземпляри." } }
```

### Public (no authentication)
- `GET /api/books?search=&author=&page=&limit=` — books with computed `availableQuantity`
- `GET /api/books/:id`

### Auth (handled by Better Auth itself)
- `ALL /api/auth/*splat` — sign-in, sign-out, get-session

### Admin (require a valid session with role `ADMIN`)
- `POST /api/books` · `PUT /api/books/:id` · `DELETE /api/books/:id`
- `POST /api/books/:id/cover` — multipart upload, `≤ 5 MB`, only `image/jpeg|png|webp`
- `GET /api/readers?search=` · `POST /api/readers` · `PUT /api/readers/:id` · `DELETE /api/readers/:id`
- `GET /api/loans?status=active|returned|overdue&readerId=&bookId=`
- `POST /api/loans` — issue a loan (invariant §5.3)
- `PUT /api/loans/:id/return` — return a loan (invariant §5.5)
- `GET /api/reports/summary` — book count, active loans, overdue count, top 10 titles
- `GET /api/reports/loans.csv` — CSV export with a UTF-8 BOM (without it Excel mangles Cyrillic)

### Error codes

`NO_COPIES_AVAILABLE` · `QUANTITY_BELOW_ACTIVE_LOANS` · `LOAN_ALREADY_RETURNED` ·
`BOOK_HAS_ACTIVE_LOANS` · `BOOK_HAS_LOAN_HISTORY` · `READER_HAS_ACTIVE_LOANS` ·
`READER_HAS_LOAN_HISTORY` · `ISBN_TAKEN` · `CARD_NUMBER_TAKEN` · `BOOK_NOT_FOUND` ·
`READER_NOT_FOUND` · `LOAN_NOT_FOUND` · `UNAUTHENTICATED` · `FORBIDDEN` · `INVALID_FILE_TYPE` ·
`FILE_TOO_LARGE` · `NO_FILE_UPLOADED` · `VALIDATION_ERROR` · `NOT_FOUND` · `INTERNAL_ERROR`

**Deleting is restricted by history, not just by active loans.** `Loan.bookId` and `Loan.readerId`
are `ON DELETE RESTRICT`, so the database refuses the delete while *any* loan row points at the
record — returned ones included, which is the point: loan history outlives the book. A service that
checks only `status: 'ACTIVE'` therefore lets a constraint violation through as a bare 500. Both
counts are checked, and `errorHandler` maps Prisma `P2002` / `P2003` / `P2014` as a last resort so a
missed check can never surface as an unhandled 500.

### Search
MVP: server-side `LIKE %term%` across `title`, `author`, `description`, plus instant client-side
filtering of the already-loaded list. **Do not** introduce MySQL FULLTEXT without an explicit need —
with Cyrillic, `innodb_ft_min_token_size` (default 3) and Bulgarian word forms produce surprising
results.

---

## 7. Pitfalls confirmed by research (do not skip these)

1. **Better Auth must be mounted BEFORE `express.json()`** — it needs the raw request stream.
   ```ts
   app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
   app.all('/api/auth/*splat', toNodeHandler(auth));  // BEFORE json()
   app.use(express.json());                            // after auth
   app.use('/api/books', booksRouter);
   ```
2. **Express 5 does not accept `/*` as a wildcard.** Write `/api/auth/*splat`, not `/api/auth/*`.
3. **Prisma 7 requires `output` in the generator block**, and the client is no longer generated into
   `node_modules`:
   ```prisma
   generator client {
     provider = "prisma-client"
     output   = "../src/generated/prisma"
   }
   ```
   The import is `from '../generated/prisma/client'`, **not** `from '@prisma/client'`.
4. **MySQL + Cyrillic:** the database and columns are `utf8mb4` / `utf8mb4_0900_ai_ci`. Configured in
   `~/.local/mysql-biblioteka/my.cnf` (see §9) and in `DATABASE_URL`.
5. **MySQL `VarChar` lengths:** MySQL caps index key length — do not index `Text` columns and do not
   put `@db.VarChar(1000)` on an indexed field.
6. **TanStack Query v5:** `cacheTime` was renamed to `gcTime`, `keepPreviousData` was replaced by
   `placeholderData`. `data` is `undefined` while `isPending` is `true`.
   There is no v6 on npm: `latest` is 5.x. Do not "upgrade" to a version that does not exist.
7. **CORS + cookies:** frontend fetches must use `credentials: 'include'`, otherwise the session does
   not travel.

---

## 8. The accepted cost of the two-folder layout

Zod schemas live in two places: `backend/src/schemas/` (source of truth) and
`frontend/src/lib/schemas.ts` (a copy).

**Rule:** if you change a validation rule in one folder, change it in the other in the same pass.
Every schema file carries this header comment:
```ts
// ⚠️ Mirror of backend/src/schemas/book.ts — changes must be applied in both places.
```
The `code-reviewer` agent checks specifically for this drift, and `node scripts/check-mirrors.mjs`
does it mechanically — it compares the shared schemas with comments and formatting stripped, and
verifies that `bg.json` and `en.json` hold the same key set. Run it after touching either side.

---

## 9. Commands and manual verification

MySQL runs as an **ordinary process under the user account** — no Docker, no root, no systemd. The
installation lives entirely in `~/.local/mysql-biblioteka/` and is managed through `scripts/mysql.sh`.

```bash
# database
./scripts/mysql.sh start           # starts mysqld on 127.0.0.1:3306
./scripts/mysql.sh status          # is it running, which version
./scripts/mysql.sh cli             # interactive mysql client
./scripts/mysql.sh stop
tail -f ~/.local/mysql-biblioteka/data/error.log    # when startup fails

# backend
cd backend
npm run dev                        # tsx watch src/index.ts
npx prisma migrate dev --name <name>
npx prisma generate
npx prisma studio                  # visual inspection of the data
npm run seed                       # admin account + sample books/readers

# frontend
cd frontend
npm run dev
```

### Driving a real browser (optional, no root needed)

Playwright browsers are present under `~/.cache/ms-playwright/`, but Chromium is missing system
libraries and `sudo` needs a password here. Both can be worked around without root: `apt-get download`
needs no privileges, and `dpkg -x` unpacks into a directory of your choosing.

```bash
mkdir -p /tmp/chromedeps/{debs,root} && cd /tmp/chromedeps/debs
apt-get download libatk1.0-0 libatk-bridge2.0-0 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libxkbcommon0 libasound2 libatspi2.0-0 libcups2 libpango-1.0-0 \
  libpangocairo-1.0-0 libcairo2 libnspr4 libnss3 libdrm2 libxshmfence1 libxrender1 \
  libwayland-server0 libxcb-randr0 libxi6
for d in *.deb; do dpkg -x "$d" /tmp/chromedeps/root; done
export LD_LIBRARY_PATH=$(find /tmp/chromedeps/root -name '*.so*' -printf '%h\n' | sort -u | paste -sd:)
```

Then drive `chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell` with
`playwright-core`. Two traps cost real time:

- **Register a `dialog` handler that actually responds.** With no handler Playwright auto-dismisses,
  which is fine; with a handler that only logs, `window.confirm` blocks forever and every click times
  out.
- **`getComputedStyle` returns `oklch(...)` verbatim**, so parsing it as RGB gives nonsense contrast
  ratios. Paint the colour into a 1×1 canvas and read back the pixel to get sRGB.
- Mutating data through `page.request` bypasses React, so TanStack Query's cache is legitimately
  stale afterwards. Drive the UI when testing that the UI updates.

Since there are no automated tests, **every feature is accepted through this manual checklist**:

1. The catalog loads without logging in and shows correct availability.
2. Search finds by title, by author, and by a word from the description — in Cyrillic.
3. Accessing `/admin` without a session redirects to login.
4. Issuing a book with 0 available is refused with a meaningful message, not a 500.
5. Issuing a loan decreases the catalog count immediately (no manual refresh).
6. Returning restores the count; a second return breaks nothing.
7. Changing `totalQuantity` below the number of active loans is refused.
8. A book past its `dueDate` shows as overdue without anything being run manually.
9. Cover upload: an oversized file and a non-image are both rejected.
10. Switching BG/EN leaves no untranslated text behind.
11. Light/dark shows no unreadable contrast.

---

## 10. Delegation — who does what

I (the orchestrator) break the task down and hand it to a specialized agent. I do not write code myself
that falls inside someone else's area.

| Area | Agent | Skill the agent loads |
|---|---|---|
| `schema.prisma`, migrations, indexes, seed | **db-architect** | `db-schema` |
| Express routes, services, Better Auth, upload | **backend-engineer** | `api-endpoint` |
| React screens, shadcn, Query hooks, i18n, theme | **frontend-engineer** | `ui-screen` |
| Review of finished code | **code-reviewer** | — |

Delegation rules:

- **Database changes always go first.** The schema is changed by `db-architect` before backend or
  frontend touch anything.
- **One agent = one folder.** `backend-engineer` never touches `frontend/`, and vice versa. If a task
  needs both, split it in two.
- **Run `code-reviewer` after each completed vertical slice** (database → API → UI), not after every
  file.
- Agents run **in parallel only when their files do not overlap** — typically backend and frontend once
  the schema is settled.

---

## 11. Roadmap

**Phase 0 — Skeleton**
Local MySQL 8.4 in `~/.local/mysql-biblioteka/` + `scripts/mysql.sh` · `backend/` with Express 5 + TS +
Prisma 7 · `frontend/` with Vite + React 19 + Tailwind v4 + shadcn init · `.env.example` in both places.

**Ports:** backend `3000`, MySQL `3306`, frontend **`5174`** — `5173` is already taken by another
project on this machine, so Vite is pinned to `5174` (`server.port` in `vite.config.ts`).

**This is a remote development machine** (the editor runs over VS Code Server; the browser is on a
different computer). Two consequences, both already configured:

1. **Bind to all interfaces, not loopback.** Vite defaults to `127.0.0.1`, which is unreachable from
   another machine — the page simply never opens. `vite.config.ts` sets `host: process.env.VITE_HOST ?? true`.
   The API already listens on all interfaces. Set `VITE_HOST=127.0.0.1` to restrict it when working
   locally.
2. **`CORS_ORIGIN` is a comma-separated list** and must contain the address the browser actually uses.
   Better Auth checks the `Origin` header against it and rejects anything else with `INVALID_ORIGIN` —
   so reaching the app by LAN address while the list holds only `localhost` fails at sign-in even
   though the page loads. Both the CORS middleware and `trustedOrigins` read this one list
   (`allowedOrigins()` in `src/lib/auth.ts`).

Reachable at `http://localhost:5174` (through the editor's port forwarding) or directly at
`http://<machine-ip>:5174`.

**Phase 1 — Database and auth**
`schema.prisma` (§4) · first migration · Better Auth + Prisma adapter · `requireAdmin` · seed with one
admin and ~15 Bulgarian titles plus a few readers.

**Phase 2 — Backend API**
Zod schemas · books CRUD with computed availability · readers CRUD · loans (issue with a transaction,
return) · cover upload · reports (summary + CSV) · single error handler.

**Phase 3 — Public catalog**
Layout + header · BookCard with an availability badge · search (server + instant client) · detail
dialog · i18n bg/en · light/dark.

**Phase 4 — Admin panel**
Login · protected routes · books table plus add/edit form with upload · readers · issue a loan · active
loans table with "Return" · dashboard with the reports.

**Phase 5 — Wrap-up**
The full §9 checklist green · `README.md` with setup instructions · `code-reviewer` passes with no
critical findings.

---

## 12. Code style

- TypeScript `strict: true` in both folders. No `any` — use `unknown` plus Zod parsing when needed.
- Business logic lives in `services/`; routes only validate and respond. No Prisma access in a route file.
- File names, variables, columns, and API fields are **in English**. User-facing text goes **through
  i18n**, never hard-coded in JSX.
- Every client-facing error goes through `AppError` with a code from §6. No bare `throw new Error()` in
  a route.
- Comments only where the "why" is not visible from the code — for example at the `FOR UPDATE` lock.
- Documentation and code comments are in English. Bulgarian appears only in `locales/bg.json`, in Zod
  error messages, and in `AppError` messages — all of which are user-facing strings.
