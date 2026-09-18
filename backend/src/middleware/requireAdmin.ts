// Gate for every admin route. See CLAUDE.md section 6 for which routes are public.
import type { Request, RequestHandler } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../lib/auth.js';
import { errors } from '../lib/errors.js';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export const requireAdmin: RequestHandler = async (req: Request, _res, next) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw errors.unauthenticated();
    // Checking the role, not merely the presence of a session: a non-admin account
    // must not reach admin routes.
    if ((session.user as { role?: string }).role !== 'ADMIN') throw errors.forbidden();
    req.user = session.user as unknown as SessionUser;
    next();
  } catch (err) {
    next(err);
  }
};
