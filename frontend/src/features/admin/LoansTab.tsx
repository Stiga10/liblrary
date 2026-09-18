import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, BookPlus, RotateCcw } from 'lucide-react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';
import { ApiError } from '@/lib/api';
import { dateFormatter } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Loan } from '@/lib/types';
import { IssueLoanDialog } from './IssueLoanDialog';
import { useAdminBooks, useLoans, useReaders, useReturnLoan } from './queries';

const FILTERS = ['active', 'overdue', 'returned', 'all'] as const;
type Filter = (typeof FILTERS)[number];

const isFilter = (v: string | null): v is Filter =>
  v !== null && (FILTERS as readonly string[]).includes(v);

/** Swap the status while keeping any readerId / bookId narrowing intact. */
function withStatus(params: URLSearchParams, status: Filter): string {
  const next = new URLSearchParams(params);
  next.set('status', status);
  return `?${next}`;
}

export function LoansTab() {
  const { t } = useTranslation();
  // The filter lives in the URL (?status=overdue) so a view can be linked and
  // bookmarked, and the back button moves between filters.
  const [params] = useSearchParams();
  const raw = params.get('status');
  const filter: Filter = isFilter(raw) ? raw : 'active';
  // Set when arriving from a reader row or a book row, so the page can be linked
  // straight to "what this reader holds" / "history of this book".
  const readerId = Number(params.get('readerId')) || undefined;
  const bookId = Number(params.get('bookId')) || undefined;

  const { data, isPending, isError, refetch } = useLoans(
    filter === 'all' ? undefined : filter,
    readerId,
    bookId,
  );
  const ret = useReturnLoan();

  // Resolve the narrowed-by name from the cached lists rather than from the first
  // result row: a book with no loans yields an empty list and would show a bare id.
  const { data: allBooks } = useAdminBooks('');
  const { data: allReaders } = useReaders('');
  const narrowedName = readerId
    ? allReaders?.items.find((r) => r.id === readerId)?.fullName
    : allBooks?.items.find((b) => b.id === bookId)?.title;

  const [issuing, setIssuing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleReturn(loan: Loan) {
    setActionError(null);
    try {
      await ret.mutateAsync(loan.id);
    } catch (err) {
      // A second return is a clean 409 from the API, not a crash.
      setActionError(err instanceof ApiError ? err.message : t('admin.returnFailed'));
    }
  }

  const fmt = dateFormatter();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            // Real links, so each filter has its own address and history entry.
            // Any reader/book narrowing is carried over rather than dropped.
            <NavLink
              key={f}
              to={{ pathname: '/admin/loans', search: withStatus(params, f) }}
              className={cn(
                'inline-flex h-8 items-center rounded-md px-3 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {t(`admin.filter.${f}`)}
            </NavLink>
          ))}
        </div>
        <Button onClick={() => setIssuing(true)}>
          <BookPlus className="size-4" aria-hidden />
          {t('admin.issueLoan')}
        </Button>
      </div>

      {/* Make a narrowed list obvious, and give a one-click way out of it. */}
      {(readerId || bookId) && (
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            {readerId
              ? t('admin.filteredByReader', { name: narrowedName ?? `#${readerId}` })
              : t('admin.filteredByBook', { title: narrowedName ?? `#${bookId}` })}
          </span>
          <NavLink
            to={`/admin/loans?status=${filter}`}
            className="ml-auto underline underline-offset-2 hover:text-primary"
          >
            {t('admin.clearFilter')}
          </NavLink>
        </div>
      )}

      {actionError && (
        <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {actionError}
        </p>
      )}

      {isPending ? (
        <TableSkeleton />
      ) : isError ? (
        <ErrorState
          message={t('admin.loansError')}
          onRetry={() => void refetch()}
          retryLabel={t('catalog.retry')}
        />
      ) : data.items.length === 0 ? (
        <EmptyState message={t('admin.noLoans')} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t('book.title')}</th>
                <th className="px-3 py-2 font-medium">{t('admin.reader')}</th>
                <th className="px-3 py-2 font-medium">{t('admin.borrowed')}</th>
                <th className="px-3 py-2 font-medium">{t('admin.due')}</th>
                <th className="px-3 py-2 font-medium">{t('admin.status')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((loan) => (
                <tr key={loan.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className="font-medium">{loan.book.title}</span>
                    <span className="block text-xs text-muted-foreground">{loan.book.author}</span>
                  </td>
                  <td className="px-3 py-2">
                    {loan.reader.fullName}
                    {loan.reader.cardNumber && (
                      <span className="block font-mono text-xs text-muted-foreground">
                        {loan.reader.cardNumber}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {fmt.format(new Date(loan.borrowDate))}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {fmt.format(new Date(loan.dueDate))}
                  </td>
                  <td className="px-3 py-2">
                    {/* Overdue is never signalled by colour alone: icon + text too. */}
                    {loan.isOverdue ? (
                      <Badge className="bg-destructive text-destructive-foreground">
                        <AlertTriangle className="size-3" aria-hidden />
                        {t('loans.overdue')} ({t('admin.daysLate', { count: loan.daysOverdue })})
                      </Badge>
                    ) : loan.status === 'ACTIVE' ? (
                      <Badge className="bg-success text-success-foreground">{t('loans.active')}</Badge>
                    ) : (
                      <Badge className="bg-muted text-muted-foreground">{t('loans.returned')}</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {loan.status === 'ACTIVE' && (
                      <Button
                        variant="success"
                        size="sm"
                        disabled={ret.isPending}
                        onClick={() => void handleReturn(loan)}
                      >
                        <RotateCcw className="size-4" aria-hidden />
                        {t('loans.return')}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <IssueLoanDialog book={null} open={issuing} onClose={() => setIssuing(false)} />
    </div>
  );
}
