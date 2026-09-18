// Lending. This file holds the one genuinely concurrency-sensitive operation in the
// application, so read CLAUDE.md section 5 before changing anything here.
import { prisma } from '../lib/prisma.js';
import { errors } from '../lib/errors.js';
import type { IssueLoanInput, ListLoansQuery } from '../schemas/loan.js';

const loanInclude = {
  book: { select: { id: true, title: true, author: true, coverImageUrl: true } },
  reader: { select: { id: true, fullName: true, phone: true, cardNumber: true } },
} as const;

type LoanRow = { status: string; dueDate: Date; returnDate: Date | null };

// Overdue is DERIVED, never stored (invariant 5.2). No cron job stamps this.
function shape<T extends LoanRow>(loan: T) {
  const isOverdue = loan.status === 'ACTIVE' && loan.dueDate.getTime() < Date.now();
  return {
    ...loan,
    isOverdue,
    daysOverdue: isOverdue
      ? Math.floor((Date.now() - loan.dueDate.getTime()) / 86_400_000)
      : 0,
  };
}

export function loanPeriodDays() {
  const raw = Number(process.env.LOAN_PERIOD_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : 14;
}

export async function list({ status, readerId, bookId, page, limit }: ListLoansQuery) {
  // 'overdue' is a filter over ACTIVE rows, not a status value in the database.
  const statusFilter =
    status === 'active'
      ? { status: 'ACTIVE' as const }
      : status === 'returned'
        ? { status: 'RETURNED' as const }
        : status === 'overdue'
          ? { status: 'ACTIVE' as const, dueDate: { lt: new Date() } }
          : {};

  const where = {
    ...statusFilter,
    ...(readerId ? { readerId } : {}),
    ...(bookId ? { bookId } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.loan.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      // Active first, then soonest due: the admin table wants urgent rows on top.
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      include: loanInclude,
    }),
    prisma.loan.count({ where }),
  ]);

  return { items: rows.map(shape), total, page, limit };
}

/**
 * Issue a book.
 *
 * The availability check and the insert MUST be atomic. Without the row lock, two
 * requests arriving together both read "1 available" and both create a loan, handing
 * out a copy that does not exist. SELECT ... FOR UPDATE serialises them: the second
 * transaction blocks until the first commits, then re-reads and correctly refuses.
 */
export async function issue({ bookId, readerId, dueDate }: IssueLoanInput) {
  const due = dueDate ?? new Date(Date.now() + loanPeriodDays() * 86_400_000);

  const loan = await prisma.$transaction(async (tx) => {
    // Lock the book row for the duration of this transaction. Do not remove.
    await tx.$queryRaw`SELECT id FROM Book WHERE id = ${bookId} FOR UPDATE`;

    const book = await tx.book.findUnique({ where: { id: bookId } });
    if (!book) throw errors.bookNotFound();

    const reader = await tx.reader.findUnique({ where: { id: readerId } });
    if (!reader) throw errors.readerNotFound();

    const active = await tx.loan.count({ where: { bookId, status: 'ACTIVE' } });
    if (book.totalQuantity - active <= 0) throw errors.noCopiesAvailable();

    return tx.loan.create({ data: { bookId, readerId, dueDate: due }, include: loanInclude });
  });

  return shape(loan);
}

/**
 * Mark a loan returned. Idempotent in the sense that matters: a second attempt is a
 * clean 409 with a code the UI can act on, never a 500 and never a double stock bump.
 */
export async function markReturned(loanId: number) {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) throw errors.loanNotFound();
  if (loan.status === 'RETURNED') throw errors.loanAlreadyReturned();

  const updated = await prisma.loan.update({
    where: { id: loanId },
    data: { status: 'RETURNED', returnDate: new Date() },
    include: loanInclude,
  });

  return shape(updated);
}
