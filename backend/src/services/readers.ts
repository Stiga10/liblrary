// Library members. Kept deliberately thin - readers carry no derived state.
import { prisma } from '../lib/prisma.js';
import { errors } from '../lib/errors.js';
import type { CreateReaderInput, ListReadersQuery, UpdateReaderInput } from '../schemas/reader.js';

const withActiveLoanCount = {
  _count: { select: { loans: { where: { status: 'ACTIVE' as const } } } },
} as const;

type ReaderRow = { _count: { loans: number } };

function shape<T extends ReaderRow>({ _count, ...reader }: T) {
  return { ...reader, activeLoans: _count.loans };
}

export async function list({ search, page, limit }: ListReadersQuery) {
  const where = search
    ? {
        OR: [
          { fullName: { contains: search } },
          { phone: { contains: search } },
          { email: { contains: search } },
          { cardNumber: { contains: search } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.reader.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { fullName: 'asc' },
      include: withActiveLoanCount,
    }),
    prisma.reader.count({ where }),
  ]);

  return { items: rows.map(shape), total, page, limit };
}

export async function getById(id: number) {
  const reader = await prisma.reader.findUnique({ where: { id }, include: withActiveLoanCount });
  if (!reader) throw errors.readerNotFound();
  return shape(reader);
}

export async function create(data: CreateReaderInput) {
  if (data.cardNumber) {
    const clash = await prisma.reader.findUnique({ where: { cardNumber: data.cardNumber } });
    if (clash) throw errors.cardNumberTaken();
  }
  const reader = await prisma.reader.create({ data, include: withActiveLoanCount });
  return shape(reader);
}

export async function update(id: number, data: UpdateReaderInput) {
  const existing = await prisma.reader.findUnique({ where: { id } });
  if (!existing) throw errors.readerNotFound();

  if (data.cardNumber && data.cardNumber !== existing.cardNumber) {
    const clash = await prisma.reader.findUnique({ where: { cardNumber: data.cardNumber } });
    if (clash) throw errors.cardNumberTaken();
  }

  const reader = await prisma.reader.update({ where: { id }, data, include: withActiveLoanCount });
  return shape(reader);
}

export async function remove(id: number) {
  const existing = await prisma.reader.findUnique({ where: { id } });
  if (!existing) throw errors.readerNotFound();

  const active = await prisma.loan.count({ where: { readerId: id, status: 'ACTIVE' } });
  if (active > 0) throw errors.readerHasActiveLoans();

  // Same reasoning as books: the FK restricts on returned loans too.
  const history = await prisma.loan.count({ where: { readerId: id } });
  if (history > 0) throw errors.readerHasLoanHistory(history);

  await prisma.reader.delete({ where: { id } });
}
