---
name: api-endpoint
description: Template for adding or changing a REST endpoint in backend/ of the Biblioteka project — Zod schema, route, service, Better Auth protection, uniform error shape, transactions for loan issuing, cover uploads. Use for any work on an Express route, validation, authentication, or server-side business logic.
---

# New endpoint (Express 5 + Zod 4 + Prisma 7 + Better Auth)

Every route passes through the same four layers. Do not mix responsibilities — a Prisma call inside a
route file is a violation that `code-reviewer` looks for.

```
schemas/  →  routes/  →  services/  →  Prisma
 (what)      (HTTP)      (logic)       (data)
```

## 1. Zod schema — `backend/src/schemas/<resource>.ts`

The schema is the source of truth for the rules. Messages are in Bulgarian because they reach the user
through the form.

```ts
// ⚠️ Mirror of frontend/src/lib/schemas.ts — changes must be applied in both places.
import { z } from 'zod';

export const createBookSchema = z.object({
  title:         z.string().trim().min(1, 'Заглавието е задължително.').max(255),
  author:        z.string().trim().min(1, 'Авторът е задължителен.').max(255),
  description:   z.string().trim().max(5000).optional(),
  isbn:          z.string().trim().regex(/^[\d-]{10,20}$/, 'Невалиден ISBN.').optional(),
  totalQuantity: z.coerce.number().int().min(0, 'Бройката не може да е отрицателна.'),
});

export const updateBookSchema = createBookSchema.partial();
export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export type CreateBookInput = z.infer<typeof createBookSchema>;
```

`z.coerce.number()` is mandatory for fields arriving from `multipart/form-data` or a query string —
everything there is a string.

## 2. Route — `backend/src/routes/<resource>.ts`

A route only validates, calls a service, and responds. No logic.

```ts
import { Router } from 'express';
import { validate } from '../middleware/validate';
import { requireAdmin } from '../middleware/requireAdmin';
import { createBookSchema, idParamSchema } from '../schemas/book';
import * as books from '../services/books';

const router = Router();

// public
router.get('/', async (req, res) => {
  const result = await books.list({
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    page:   Number(req.query.page) || 1,
    limit:  Math.min(Number(req.query.limit) || 24, 100),   // always cap the limit
  });
  res.json(result);
});

// admin
router.post('/', requireAdmin, validate({ body: createBookSchema }), async (req, res) => {
  const book = await books.create(req.validated.body);
  res.status(201).json(book);
});

router.delete('/:id', requireAdmin, validate({ params: idParamSchema }), async (req, res) => {
  await books.remove(req.validated.params.id);
  res.status(204).end();
});

export default router;
```

Express 5 catches rejected promises from async handlers automatically — **do not wrap everything in
try/catch**. Throw an `AppError` and let the error handler format it.

## 3. Service — `backend/src/services/<resource>.ts`

This is where the logic and **all transactions** live.

```ts
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

// Availability is ALWAYS computed — there is no column for it (CLAUDE.md §5.1)
export async function list({ search, page, limit }: ListParams) {
  const where = search
    ? { OR: [
        { title:       { contains: search } },
        { author:      { contains: search } },
        { description: { contains: search } },
      ] }
    : {};

  const [rows, total] = await Promise.all([
    prisma.book.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { title: 'asc' },
      include: { _count: { select: { loans: { where: { status: 'ACTIVE' } } } } },
    }),
    prisma.book.count({ where }),
  ]);

  return {
    items: rows.map(({ _count, ...b }) => ({
      ...b,
      activeLoans:       _count.loans,
      availableQuantity: b.totalQuantity - _count.loans,
    })),
    total, page, limit,
  };
}
```

`include: { _count: ... }` is the required approach — **never** load the books and then run a `count`
in a loop. That is an N+1 and `code-reviewer` rejects it.

### Issuing a loan — the only place with an explicit lock

```ts
export async function issue({ bookId, readerId }: IssueInput) {
  const days = Number(process.env.LOAN_PERIOD_DAYS ?? 14);
  const dueDate = new Date(Date.now() + days * 86_400_000);

  return prisma.$transaction(async (tx) => {
    // Locks the book row until the transaction ends. Without this, two concurrent
    // requests hand out the last copy twice.
    await tx.$queryRaw`SELECT id FROM Book WHERE id = ${bookId} FOR UPDATE`;

    const book = await tx.book.findUnique({ where: { id: bookId } });
    if (!book) throw new AppError(404, 'BOOK_NOT_FOUND', 'Книгата не е намерена.');

    const active = await tx.loan.count({ where: { bookId, status: 'ACTIVE' } });
    if (book.totalQuantity - active <= 0)
      throw new AppError(409, 'NO_COPIES_AVAILABLE', 'Няма свободни екземпляри от тази книга.');

    const reader = await tx.reader.findUnique({ where: { id: readerId } });
    if (!reader) throw new AppError(404, 'READER_NOT_FOUND', 'Читателят не е намерен.');

    return tx.loan.create({ data: { bookId, readerId, dueDate } });
  });
}
```

### Returning — idempotent

```ts
export async function markReturned(loanId: number) {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) throw new AppError(404, 'LOAN_NOT_FOUND', 'Заемането не е намерено.');
  if (loan.status === 'RETURNED')
    throw new AppError(409, 'LOAN_ALREADY_RETURNED', 'Това заемане вече е върнато.');

  return prisma.loan.update({
    where: { id: loanId },
    data: { status: 'RETURNED', returnDate: new Date() },
  });
}
```

### Overdue — computed, not stored

```ts
const isOverdue = (loan: Loan) => loan.status === 'ACTIVE' && loan.dueDate < new Date();

// the ?status=overdue filter translates to:
const where = { status: 'ACTIVE', dueDate: { lt: new Date() } };
```

Never write a cron job that walks loans and stamps `OVERDUE`.

### Changing quantity — never below active loans

```ts
export async function update(id: number, data: UpdateBookInput) {
  if (data.totalQuantity !== undefined) {
    const active = await prisma.loan.count({ where: { bookId: id, status: 'ACTIVE' } });
    if (data.totalQuantity < active)
      throw new AppError(409, 'QUANTITY_BELOW_ACTIVE_LOANS',
        `В момента са заети ${active} екземпляра — бройката не може да е под тази стойност.`);
  }
  return prisma.book.update({ where: { id }, data });
}
```

## 4. Errors — one shape for the whole API

```ts
// lib/errors.ts
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

// index.ts — the LAST middleware
app.use((err, _req, res, _next) => {
  if (err instanceof AppError)
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  if (err instanceof ZodError)
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Невалидни данни.', fields: err.flatten().fieldErrors } });
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Възникна неочаквана грешка.' } });
});
```

No bare `throw new Error()` in a route — the client would get a 500 with no code, leaving the UI unable
to react meaningfully.

## 5. Protection — Better Auth

`backend/src/middleware/requireAdmin.ts`:

```ts
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../lib/auth';

export async function requireAdmin(req, res, next) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) throw new AppError(401, 'UNAUTHENTICATED', 'Необходим е вход.');
  if (session.user.role !== 'ADMIN') throw new AppError(403, 'FORBIDDEN', 'Няма достъп.');
  req.user = session.user;
  next();
}
```

**Middleware order in `index.ts` is critical** (confirmed against the Better Auth documentation):

```ts
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.all('/api/auth/*splat', toNodeHandler(auth));   // BEFORE express.json()
app.use(express.json());
app.use('/api/books', booksRouter);
app.use('/api/readers', readersRouter);
app.use('/api/loans', loansRouter);
app.use('/uploads', express.static('uploads'));
app.use(errorHandler);                               // last
```

Two things break auth silently: `express.json()` placed before the handler (it consumes the raw
stream), and `/api/auth/*` instead of `/api/auth/*splat` (Express 5 rejects the old wildcard).

## 6. Cover upload

```ts
// middleware/upload.ts
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export const uploadCover = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    ALLOWED.includes(file.mimetype)
      ? cb(null, true)
      : cb(new AppError(400, 'INVALID_FILE_TYPE', 'Позволени са само JPEG, PNG и WebP.')),
}).single('cover');
```

Mandatory afterwards: `sharp(buffer).resize(600, 900, { fit: 'inside' }).webp({ quality: 82 })`, saved
under a **generated** name (`${id}-${randomUUID()}.webp`), never under `file.originalname` — that is
path traversal. Delete the old file only after the new one is written successfully.

## 7. Final check (there are no automated tests — do this by hand)

```bash
# public list
curl -s localhost:3000/api/books | jq '.items[0]'

# admin without a session → 401 with a code, not a 500
curl -s -X POST localhost:3000/api/books -H 'content-type: application/json' -d '{}' | jq

# log in and make an authenticated request
curl -s -c /tmp/c.txt -X POST localhost:3000/api/auth/sign-in/email \
  -H 'content-type: application/json' \
  -d '{"email":"admin@biblioteka.local","password":"..."}'
curl -s -b /tmp/c.txt -X POST localhost:3000/api/loans \
  -H 'content-type: application/json' -d '{"bookId":1,"readerId":1}' | jq
```

Also verify: issuing with 0 available → `409 NO_COPIES_AVAILABLE`; a double return →
`409 LOAN_ALREADY_RETURNED`; `availableQuantity` in `GET /api/books` drops immediately after issuing.
