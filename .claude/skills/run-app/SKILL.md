---
name: run-app
description: Starts the whole Biblioteka stack — local MySQL 8.4, the Express backend on 3000 and the Vite frontend on 5174 — and smoke-tests it. Use when asked to run, start, launch, restart or review the app, when a change needs checking in the real UI, when the API must be reachable, or when the stack is already up and something is not responding. Also covers stopping it and driving a real browser without root.
---

# Running Biblioteka

Three processes, started in this order. MySQL first: the backend crashes on boot
without it, and `tsx watch` does not retry.

Ports: MySQL `3306`, backend `3000`, frontend `5174`. 5173 belongs to another
project on this machine — do not fall back to it.

## 1. MySQL

```bash
./scripts/mysql.sh status          # STOPPED or RUNNING + version
./scripts/mysql.sh start           # ~2 s; prints "Ready. Version: 8.4.9"
```

Healthy status reports `charset=utf8mb4` and `collation=utf8mb4_0900_ai_ci`.
Anything else means Cyrillic will be mangled — stop and fix the charset before
going further, because data written meanwhile is already wrong.

Startup failures surface only in the log, not on stdout:

```bash
tail -f ~/.local/mysql-biblioteka/data/error.log
```

## 2. Schema and data

```bash
cd backend
npx prisma migrate status          # expect "Database schema is up to date!"
```

Check for seeded rows before re-seeding — `npm run seed` on a populated
database is not what you want:

```bash
./scripts/mysql.sh cli -e "SELECT (SELECT COUNT(*) FROM Book) AS books, \
  (SELECT COUNT(*) FROM Reader) AS readers, (SELECT COUNT(*) FROM Loan) AS loans, \
  (SELECT COUNT(*) FROM user) AS users;"
```

A seeded database holds 20 books, 5 readers, 11 loans and 1 admin.

## 3. The two dev servers

Both are long-running. Launch them detached, each with its own log:

```bash
cd backend  && nohup npm run dev > "$LOGDIR/backend.log"  2>&1 &
cd frontend && nohup npm run dev > "$LOGDIR/frontend.log" 2>&1 &
```

Vite prints its ready banner with the LAN addresses. **The backend prints no
ready line** — do not wait for one, it never comes. Confirm it with a request
instead (step 4).

## 4. Smoke test — is it actually serving?

```bash
curl -s "http://127.0.0.1:3000/api/books?limit=2"      # direct
curl -s "http://127.0.0.1:5174/api/books?limit=1"      # through the Vite proxy
```

Both must return JSON with readable Cyrillic and a computed `availableQuantity`.
The second one also proves the proxy is wired, which is what keeps the session
cookie first-party.

**Always URL-encode Cyrillic search terms.** A raw term in the URL returns an
empty body and reads exactly like a broken search:

```bash
curl -s -G --data-urlencode "search=Ганьо" "http://127.0.0.1:3000/api/books"
```

Admin routes must answer `401` with no session — `/api/readers`, `/api/loans`,
`/api/reports/summary` and `POST /api/books`.

## 5. Signing in as the admin

Credentials come from `backend/.env`. Better Auth checks the `Origin` header
against `CORS_ORIGIN`, so **send `Origin` or sign-in fails with
`INVALID_ORIGIN`** even against loopback:

```bash
EMAIL=$(grep SEED_ADMIN_EMAIL backend/.env | cut -d'"' -f2)
PASS=$(grep SEED_ADMIN_PASSWORD backend/.env | cut -d'"' -f2)
curl -s -c cookies.txt -X POST -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:5174' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  http://127.0.0.1:3000/api/auth/sign-in/email
```

Reuse `-b cookies.txt -H 'Origin: http://localhost:5174'` on every admin call.

## 6. Checking the invariants (section 5 of CLAUDE.md)

Each must answer `409` with a Bulgarian message, never `500`. Exercise them on a
**throwaway book**, not on seeded data:

| Action | Expected code |
|---|---|
| Issue a loan when 0 copies are free | `NO_COPIES_AVAILABLE` |
| `PUT` a `totalQuantity` below active loans | `QUANTITY_BELOW_ACTIVE_LOANS` |
| Return an already-returned loan | `LOAN_ALREADY_RETURNED` |
| Delete a book that has loan history | `BOOK_HAS_LOAN_HISTORY` |

**Clean up through SQL, not the API** — the last row above is exactly why the
API refuses, so the test book cannot be deleted the way it was created:

```bash
./scripts/mysql.sh cli -e "DELETE FROM Loan WHERE bookId=<id>; DELETE FROM Book WHERE id=<id>;"
```

Leaving it behind pollutes the catalog the user is about to review.

## 7. Driving a real browser (no root)

Chromium is present under `~/.cache/ms-playwright/` but misses system libraries,
and `sudo` needs a password here. Unpack the libraries into a directory instead —
`apt-get download` and `dpkg -x` need no privileges. The full package list is in
CLAUDE.md section 9; it takes about a minute and survives until `/tmp` is cleared.

```bash
export LD_LIBRARY_PATH=$(find /tmp/chromedeps/root -name '*.so*' -printf '%h\n' | sort -u | paste -sd:)
```

Then drive `chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell`
with `playwright-core`. Three traps, each already paid for:

- **A `dialog` handler must respond.** With none, Playwright auto-dismisses and
  all is well; with one that only logs, `window.confirm` blocks forever and every
  click times out.
- **`getComputedStyle` returns `oklch(...)` verbatim**, so reading it as RGB
  yields nonsense contrast ratios. Paint the colour into a 1×1 canvas and read the
  pixel back to get sRGB.
- **Mutating through `page.request` bypasses React**, leaving TanStack Query's
  cache legitimately stale. Drive the UI when the point is that the UI updates.

**Look at the screenshot.** A served 200 and a mounted React tree are different
claims; a blank frame means the app failed to start, not that it started.

## Stopping

```bash
pkill -f 'tsx watch src/index.ts'     # backend
pkill -f 'vite'                       # frontend
./scripts/mysql.sh stop               # database last
```

## When something does not respond

- **Backend exits at once** → MySQL is down, or `DATABASE_URL` is missing from
  `backend/.env`. Read `backend.log`; the thrown message names which.
- **`P1001: Can't reach database server`** → `./scripts/mysql.sh start`.
- **Frontend loads, sign-in fails with `INVALID_ORIGIN`** → the address in the
  browser is absent from `CORS_ORIGIN`. It is a comma-separated list and must
  contain the LAN address too, not just `localhost`.
- **Page never opens from another machine** → Vite bound to loopback. It defaults
  to `host: true` here; `VITE_HOST` overrides it.
- **`Cannot find module '../generated/prisma/client.js'`** → run
  `npx prisma generate`. The client lives in `src/generated/prisma`, which is
  gitignored, so a fresh checkout has none.
