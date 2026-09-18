import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';

/**
 * Client-side gate. It hides the UI, it does not secure anything: every admin
 * endpoint is independently protected by requireAdmin on the server, which is what
 * actually enforces access.
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { data: session, isPending } = useSession();
  const location = useLocation();

  if (isPending) {
    return <p className="p-10 text-center text-muted-foreground">{t('common.loading')}</p>;
  }
  if (!session || (session.user as { role?: string }).role !== 'ADMIN') {
    // Remember where they were heading, so a deep link like
    // /admin/loans?status=overdue survives the trip through the login form.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}
