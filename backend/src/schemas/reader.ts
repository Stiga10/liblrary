// ⚠️ Mirror of frontend/src/lib/schemas.ts — changes must be applied in both places.
import { z } from 'zod';

// An untouched optional form input arrives as '' — that means "not provided", not
// "invalid". Without this the ISBN regex rejects an empty field and the form refuses
// to submit with no obvious reason why.
const optionalText = (max: number, extra?: (s: z.ZodString) => z.ZodString) => {
  const base = extra ? extra(z.string().trim()) : z.string().trim().max(max);
  return z
    .union([z.literal(''), base])
    .transform((v) => (v === '' ? undefined : v))
    .optional();
};

export const createReaderSchema = z.object({
  fullName: z.string().trim().min(1, 'Името е задължително.').max(255, 'Името е до 255 знака.'),
  phone: optionalText(30, (s) => s.regex(/^[\d\s+()-]{6,30}$/, 'Невалиден телефон.')),
  email: optionalText(255, (s) => s.email('Невалиден имейл.').max(255)),
  cardNumber: optionalText(50, (s) => s.max(50, 'Номерът на картата е до 50 знака.')),
});

export const updateReaderSchema = createReaderSchema.partial();

export const listReadersQuerySchema = z.object({
  search: z.string().trim().max(255).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateReaderInput = z.infer<typeof createReaderSchema>;
export type UpdateReaderInput = z.infer<typeof updateReaderSchema>;
export type ListReadersQuery = z.infer<typeof listReadersQuerySchema>;
