// Book nomenclature. All availability arithmetic lives here; routes never compute it.
import { prisma } from '../lib/prisma.js';
import { errors } from '../lib/errors.js';
import type { CreateBookInput, ListBooksQuery, UpdateBookInput } from '../schemas/book.js';

// The single source of availability (CLAUDE.md section 5.1): never a stored column,
// and never a count issued per row. _count with a filtered relation keeps it to one query.
const withActiveLoanCount = {
  _count: { select: { loans: { where: { status: 'ACTIVE' as const } } } },
} as const;

type BookRow = { totalQuantity: number; _count: { loans: number } };

function shape<T extends BookRow>({ _count, ...book }: T) {
  return {
    ...book,
    activeLoans: _count.loans,
    availableQuantity: book.totalQuantity - _count.loans,
  };
}

export async function list({ search, author, page, limit }: ListBooksQuery) {
  const filters = [];
  if (search) {
    filters.push({
      OR: [
        { title: { contains: search } },
        { author: { contains: search } },
        { description: { contains: search } },
      ],
    });
  }
  if (author) filters.push({ author: { contains: author } });
  const where = filters.length ? { AND: filters } : {};

  const [rows, total] = await Promise.all([
    prisma.book.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { title: 'asc' },
      include: withActiveLoanCount,
    }),
    prisma.book.count({ where }),
  ]);

  return { items: rows.map(shape), total, page, limit };
}

export async function getById(id: number) {
  const book = await prisma.book.findUnique({ where: { id }, include: withActiveLoanCount });
  if (!book) throw errors.bookNotFound();
  return shape(book);
}

export async function create(data: CreateBookInput) {
  if (data.isbn) {
    const clash = await prisma.book.findUnique({ where: { isbn: data.isbn } });
    if (clash) throw errors.isbnTaken();
  }
  const book = await prisma.book.create({ data, include: withActiveLoanCount });
  return shape(book);
}

export async function update(id: number, data: UpdateBookInput) {
  const existing = await prisma.book.findUnique({ where: { id } });
  if (!existing) throw errors.bookNotFound();

  if (data.isbn && data.isbn !== existing.isbn) {
    const clash = await prisma.book.findUnique({ where: { isbn: data.isbn } });
    if (clash) throw errors.isbnTaken();
  }

  // Invariant 5.4: stock may not fall below what is already lent out, or the
  // computed availability would go negative.
  if (data.totalQuantity !== undefined) {
    const active = await prisma.loan.count({ where: { bookId: id, status: 'ACTIVE' } });
    if (data.totalQuantity < active) throw errors.quantityBelowActiveLoans(active);
  }

  const book = await prisma.book.update({ where: { id }, data, include: withActiveLoanCount });
  return shape(book);
}

export async function remove(id: number) {
  const existing = await prisma.book.findUnique({ where: { id } });
  if (!existing) throw errors.bookNotFound();

  // Invariant 5.6. The FK is ON DELETE RESTRICT, which blocks deletion when ANY
  // loan references the book - returned ones included, since loan history is meant
  // to outlive the book. Both cases are checked here so the client gets a usable
  // code instead of a raw constraint violation surfacing as a 500.
  const active = await prisma.loan.count({ where: { bookId: id, status: 'ACTIVE' } });
  if (active > 0) throw errors.bookHasActiveLoans();

  const history = await prisma.loan.count({ where: { bookId: id } });
  if (history > 0) throw errors.bookHasLoanHistory(history);

  await prisma.book.delete({ where: { id } });
}

export async function setCover(id: number, coverImageUrl: string) {
  const existing = await prisma.book.findUnique({ where: { id } });
  if (!existing) throw errors.bookNotFound();
  const book = await prisma.book.update({
    where: { id },
    data: { coverImageUrl },
    include: withActiveLoanCount,
  });
  return { book: shape(book), previousCover: existing.coverImageUrl };
}
