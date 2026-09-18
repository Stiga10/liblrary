import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle, BookCopy, BookOpen, Download, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { ErrorState, TableSkeleton } from '@/components/ui/states';
import { cn } from '@/lib/utils';
import { useSummary } from './queries';

/**
 * A statistic tile. Every tile links to the page that lists what it counts, so the
 * dashboard is a way into the data rather than a dead end.
 */
function Stat({
  icon,
  label,
  value,
  to,
  tone = 'default',
}: {
  icon: ReactNode;
  label: string;
  value: number;
  to: string;
  tone?: 'default' | 'warn';
}) {
  const warn = tone === 'warn' && value > 0;
  return (
    <Link to={to} className="group focus-visible:outline-none">
      <Card
        className={cn(
          'h-full p-4 transition-colors group-hover:border-primary',
          'group-focus-visible:ring-2 group-focus-visible:ring-ring',
        )}
      >
        <div className="mb-2 flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <p className={cn('text-2xl font-semibold', warn && 'text-destructive')}>{value}</p>
      </Card>
    </Link>
  );
}

export function DashboardTab() {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useSummary();

  if (isPending) return <TableSkeleton rows={4} />;
  if (isError) {
    return (
      <ErrorState
        message={t('admin.summaryError')}
        onRetry={() => void refetch()}
        retryLabel={t('catalog.retry')}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={<BookOpen className="size-4" />}
          label={t('admin.stats.books')}
          value={data.books}
          to="/admin/books"
        />
        <Stat
          icon={<BookCopy className="size-4" />}
          label={t('admin.stats.availableCopies')}
          value={data.availableCopies}
          to="/admin/books"
        />
        <Stat
          icon={<Users className="size-4" />}
          label={t('admin.stats.readers')}
          value={data.readers}
          to="/admin/readers"
        />
        <Stat
          icon={<AlertTriangle className="size-4" />}
          label={t('admin.stats.overdue')}
          value={data.overdueLoans}
          to="/admin/loans?status=overdue"
          tone="warn"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat
          icon={<BookCopy className="size-4" />}
          label={t('admin.stats.totalCopies')}
          value={data.totalCopies}
          to="/admin/books"
        />
        <Stat
          icon={<BookOpen className="size-4" />}
          label={t('admin.stats.activeLoans')}
          value={data.activeLoans}
          to="/admin/loans?status=active"
        />
        <Stat
          icon={<BookOpen className="size-4" />}
          label={t('admin.stats.returnedLoans')}
          value={data.returnedLoans}
          to="/admin/loans?status=returned"
        />
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="mr-auto font-medium">{t('admin.topBorrowed')}</h3>
          {/* A plain anchor: the browser handles Content-Disposition and sends the
              session cookie. A fetch would need blob plumbing for no benefit. */}
          <a
            href="/api/reports/loans.csv"
            className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
          >
            <Download className="size-4" aria-hidden />
            {t('admin.exportCsv')}
          </a>
        </div>

        {data.topBorrowed.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.noLoans')}</p>
        ) : (
          <ol className="divide-y divide-border text-sm">
            {data.topBorrowed.map((book, i) => (
              <li key={book.id}>
                <Link
                  to={`/admin/loans?status=all&bookId=${book.id}`}
                  className="flex items-center gap-2 py-1.5 hover:text-primary"
                >
                  <span className="w-5 text-right text-muted-foreground">{i + 1}.</span>
                  <span className="mr-auto font-medium">{book.title}</span>
                  <span className="hidden text-muted-foreground sm:inline">{book.author}</span>
                  <span className="w-10 text-right font-medium">{book.loanCount}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
