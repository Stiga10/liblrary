// Better Auth configuration. See CLAUDE.md section 7, pitfalls 1 and 2 for the
// mounting rules in Express 5 - they are easy to get wrong and fail silently.
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './prisma.js';

/**
 * Public sign-up is disabled: the library has no self-service registration
 * (CLAUDE.md section 2). The seed script needs to create the first administrator,
 * so it builds its own instance with `allowSignUp: true` rather than leaving the
 * public /api/auth/sign-up/email route open.
 */
export function createAuth({ allowSignUp = false }: { allowSignUp?: boolean } = {}) {
  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'mysql' }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
    basePath: '/api/auth',
    // Comma-separated so a remote dev box can be reached by LAN address as well as
    // by localhost. Better Auth rejects any other Origin with INVALID_ORIGIN, which
    // is the point - keep this list to the addresses actually used.
    trustedOrigins: allowedOrigins(),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !allowSignUp,
      minPasswordLength: 8,
    },
    user: {
      additionalFields: {
        // Defaults to USER on purpose: a privileged default would be dangerous if
        // sign-up were ever re-enabled. The seed promotes the first account to ADMIN.
        role: { type: 'string', defaultValue: 'USER', input: false, required: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      defaultCookieAttributes: {
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  });
}

export function allowedOrigins(): string[] {
  return (process.env.CORS_ORIGIN ?? 'http://localhost:5174')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export const auth = createAuth();
export type Auth = typeof auth;
