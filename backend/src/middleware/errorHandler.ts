// The one place that turns thrown errors into HTTP responses.
// Response shape is fixed by CLAUDE.md section 6:
//   { "error": { "code": "...", "message": "..." } }
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { AppError, errors } from '../lib/errors.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Ресурсът не е намерен.' },
  });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  if (err instanceof ZodError) {
    // Field-level messages let the frontend attach errors to the right inputs.
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Невалидни данни.',
        fields: err.flatten().fieldErrors,
      },
    });
    return;
  }

  if (err instanceof MulterError) {
    const mapped =
      err.code === 'LIMIT_FILE_SIZE' ? errors.fileTooLarge() : errors.invalidFileType();
    res.status(mapped.status).json({ error: { code: mapped.code, message: mapped.message } });
    return;
  }

  // Safety net for constraint violations that slip past a service-level check.
  // A bare 500 here would leave the UI with nothing actionable to show, so map the
  // two Prisma codes that can realistically reach this point.
  const code = (err as { code?: string }).code;
  if (code === 'P2003' || code === 'P2014') {
    res.status(409).json({
      error: {
        code: 'REFERENCED_BY_OTHER_RECORDS',
        message: 'Записът е свързан с други записи и не може да бъде изтрит.',
      },
    });
    return;
  }
  if (code === 'P2002') {
    res.status(409).json({
      error: { code: 'DUPLICATE_VALUE', message: 'Вече съществува запис с тази стойност.' },
    });
    return;
  }

  // Unknown failures are logged in full but never leaked to the client.
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Възникна неочаквана грешка.' },
  });
};
