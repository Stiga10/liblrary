import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  // Requests go through the Vite dev proxy, so this stays same-origin.
  baseURL: window.location.origin,
  basePath: '/api/auth',
});

export const { signIn, signOut, useSession } = authClient;
