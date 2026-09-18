// ⚠️ Mirror of frontend/src/lib/schemas.ts — changes must be applied in both places.
import { z } from 'zod';

export const issueLoanSchema = z.object({
  bookId: z.coerce.number().int().positive('Изберете книга.'),
  readerId: z.coerce.number().int().positive('Изберете читател.'),
  // Optional override of the default period from LOAN_PERIOD_DAYS.
  dueDate: z.coerce.date().optional(),
});

// 'overdue' is a query-time filter, never a stored status. See CLAUDE.md section 5.2.
export const listLoansQuerySchema = z.object({
  status: z.enum(['active', 'returned', 'overdue']).optional(),
  readerId: z.coerce.number().int().positive().optional(),
  bookId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type IssueLoanInput = z.infer<typeof issueLoanSchema>;
export type ListLoansQuery = z.infer<typeof listLoansQuerySchema>;
