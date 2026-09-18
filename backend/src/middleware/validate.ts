// Zod validation middleware. Parsed output lands on req.validated so handlers never
// touch the raw, untyped req.body / req.query / req.params.
import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

export interface ValidatedRequest<B = unknown, Q = unknown, P = unknown> {
  body: B;
  query: Q;
  params: P;
}

declare global {
  namespace Express {
    interface Request {
      validated: ValidatedRequest<any, any, any>;
    }
  }
}

export function validate(schemas: {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}): RequestHandler {
  return (req, _res, next) => {
    // Throwing ZodError is intentional: the single error handler turns it into a
    // 400 VALIDATION_ERROR with per-field messages.
    req.validated = {
      body: schemas.body ? schemas.body.parse(req.body) : undefined,
      query: schemas.query ? schemas.query.parse(req.query) : undefined,
      params: schemas.params ? schemas.params.parse(req.params) : undefined,
    };
    next();
  };
}
