// ⚠️ Mirror of backend/src/schemas/*.ts — changes must be applied in both places.
// The project is two independent folders (CLAUDE.md section 8), so these rules are
// duplicated on purpose. If a rule drifts, the form accepts input the API rejects.
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
  totalQuantity: z.coerce
    .number()
    .int('Бройката трябва да е цяло число.')
    .min(0, 'Бройката не може да е отрицателна.'),
});

export const updateBookSchema = createBookSchema.partial();

export const createReaderSchema = z.object({
  fullName: z.string().trim().min(1, 'Името е задължително.').max(255, 'Името е до 255 знака.'),
  phone: optionalText(30, (s) => s.regex(/^[\d\s+()-]{6,30}$/, 'Невалиден телефон.')),
  email: optionalText(255, (s) => s.email('Невалиден имейл.').max(255)),
  cardNumber: optionalText(50, (s) => s.max(50, 'Номерът на картата е до 50 знака.')),
});

export const updateReaderSchema = createReaderSchema.partial();

export const issueLoanSchema = z.object({
  bookId: z.coerce.number().int().positive('Изберете книга.'),
  readerId: z.coerce.number().int().positive('Изберете читател.'),
  dueDate: z.coerce.date().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Невалиден имейл.'),
  password: z.string().min(1, 'Паролата е задължителна.'),
});

// Two types per schema, because z.coerce makes input and output differ:
//   *FormInput  - what the inputs hold before coercion (a number field is unknown)
//   *Input      - what the API receives after coercion
// react-hook-form needs both: <TFieldValues, TContext, TTransformedValues>.
export type CreateBookFormInput = z.input<typeof createBookSchema>;
export type CreateBookInput = z.output<typeof createBookSchema>;
export type UpdateBookInput = z.output<typeof updateBookSchema>;
export type CreateReaderInput = z.output<typeof createReaderSchema>;
export type IssueLoanInput = z.output<typeof issueLoanSchema>;
export type LoginInput = z.output<typeof loginSchema>;
