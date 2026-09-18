// Admin reporting. Everything here is derived at query time; nothing is precomputed.
import { prisma } from '../lib/prisma.js';

export async function summary() {
  const now = new Date();

  const [bookCount, totalCopies, readerCount, activeLoans, overdueLoans, returnedLoans] =
    await Promise.all([
      prisma.book.count(),
      prisma.book.aggregate({ _sum: { totalQuantity: true } }),
      prisma.reader.count(),
      prisma.loan.count({ where: { status: 'ACTIVE' } }),
      prisma.loan.count({ where: { status: 'ACTIVE', dueDate: { lt: now } } }),
      prisma.loan.count({ where: { status: 'RETURNED' } }),
    ]);

  // Most-borrowed titles, all time. groupBy keeps this to one query rather than
  // counting per book.
  const grouped = await prisma.loan.groupBy({
    by: ['bookId'],
    _count: { bookId: true },
    orderBy: { _count: { bookId: 'desc' } },
    take: 10,
  });

  const books = grouped.length
    ? await prisma.book.findMany({
        where: { id: { in: grouped.map((g) => g.bookId) } },
        select: { id: true, title: true, author: true },
      })
    : [];
  const byId = new Map(books.map((b) => [b.id, b]));

  const copies = totalCopies._sum.totalQuantity ?? 0;

  return {
    books: bookCount,
    totalCopies: copies,
    availableCopies: copies - activeLoans,
    readers: readerCount,
    activeLoans,
    overdueLoans,
    returnedLoans,
    topBorrowed: grouped
      .map((g) => {
        const book = byId.get(g.bookId);
        return book ? { ...book, loanCount: g._count.bookId } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  };
}

const CSV_COLUMNS = [
  'id',
  'book_title',
  'book_author',
  'reader_name',
  'reader_card',
  'borrow_date',
  'due_date',
  'return_date',
  'status',
  'days_overdue',
] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Quote when the value could break the row, and double any embedded quotes.
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function isoDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

export async function loansCsv() {
  const loans = await prisma.loan.findMany({
    orderBy: { borrowDate: 'desc' },
    include: {
      book: { select: { title: true, author: true } },
      reader: { select: { fullName: true, cardNumber: true } },
    },
  });

  const now = Date.now();
  const rows = loans.map((l) => {
    const overdue =
      l.status === 'ACTIVE' && l.dueDate.getTime() < now
        ? Math.floor((now - l.dueDate.getTime()) / 86_400_000)
        : 0;
    return [
      l.id,
      l.book.title,
      l.book.author,
      l.reader.fullName,
      l.reader.cardNumber,
      isoDate(l.borrowDate),
      isoDate(l.dueDate),
      isoDate(l.returnDate),
      l.status,
      overdue,
    ]
      .map(csvCell)
      .join(',');
  });

  // The UTF-8 BOM is not optional: without it Excel reads Cyrillic as mojibake
  // (CLAUDE.md section 6).
  return '﻿' + [CSV_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
}
