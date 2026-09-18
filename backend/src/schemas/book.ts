// ⚠️ Mirror of frontend/src/lib/schemas.ts — changes must be applied in both places.
// Validation messages are user-facing Bulgarian: they are shown next to form fields.
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

export const createBookSchema = z.object({
  title: z.string().trim().min(1, 'Заглавието е задължително.').max(255, 'Заглавието е до 255 знака.'),
  author: z.string().trim().min(1, 'Авторът е задължителен.').max(255, 'Авторът е до 255 знака.'),
  description: optionalText(5000, (s) => s.max(5000, 'Описанието е до 5000 знака.')),
  isbn: optionalText(20, (s) => s.regex(/^[\d-]{10,20}$/, 'Невалиден ISBN.')),
  // Query strings and multipart bodies deliver everything as text, hence coerce.
  totalQuantity: z.coerce
    .number()
    .int('Бройката трябва да е цяло число.')
    .min(0, 'Бройката не може да е отрицателна.'),
});

export const updateBookSchema = createBookSchema.partial();

export const listBooksQuerySchema = z.object({
  search: z.string().trim().max(255).optional(),
  author: z.string().trim().max(255).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
export type ListBooksQuery = z.infer<typeof listBooksQuerySchema>;
