import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookPlus, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AvailabilityBadge } from '@/components/AvailabilityBadge';
import { BookCover } from '@/components/BookCover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';
import { useDebounce } from '@/hooks/useDebounce';
import { ApiError } from '@/lib/api';
import type { Book } from '@/lib/types';
import { BookFormDialog } from './BookFormDialog';
import { IssueLoanDialog } from './IssueLoanDialog';
import { useAdminBooks, useDeleteBook } from './queries';

export function BooksTab() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const { data, isPending, isError, refetch } = useAdminBooks(debounced);
  const del = useDeleteBook();

  const [editing, setEditing] = useState<Book | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [issuing, setIssuing] = useState<Book | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleDelete(book: Book) {
    setActionError(null);
    if (!window.confirm(t('admin.confirmDeleteBook', { title: book.title }))) return;
    try {
      await del.mutateAsync(book.id);
    } catch (err) {
      // The API refuses deletion when loan history exists; show its reason verbatim.
      setActionError(err instanceof ApiError ? err.message : t('admin.deleteFailed'));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('catalog.search')}
            aria-label={t('catalog.search')}
            className="pl-9"
          />
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden />
          {t('admin.addBook')}
        </Button>
      </div>

      {actionError && (
        <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {actionError}
        </p>
      )}

      {isPending ? (
        <TableSkeleton />
      ) : isError ? (
        <ErrorState
          message={t('catalog.error')}
          onRetry={() => void refetch()}
          retryLabel={t('catalog.retry')}
        />
      ) : data.items.length === 0 ? (
        <EmptyState message={t('catalog.empty')} hint={search ? t('catalog.emptyHint') : undefined} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t('book.cover')}</th>
                <th className="px-3 py-2 font-medium">{t('book.title')}</th>
                <th className="px-3 py-2 font-medium">{t('book.author')}</th>
                <th className="px-3 py-2 font-medium">{t('book.availability')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((book) => (
                <tr key={book.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <BookCover url={book.coverImageUrl} title={book.title} className="h-14 w-10" />
                  </td>
                  <td className="px-3 py-2 font-medium">{book.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">{book.author}</td>
                  <td className="px-3 py-2">
                    {/* Links to the loan history of this title. */}
                    <Link
                      to={`/admin/loans?status=all&bookId=${book.id}`}
                      aria-label={t('admin.viewBookLoans', { title: book.title })}
                      className="inline-block hover:opacity-80"
                    >
                      <AvailabilityBadge
                        available={book.availableQuantity}
                        total={book.totalQuantity}
                      />
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('loans.issue')}
                        disabled={book.availableQuantity <= 0}
                        onClick={() => setIssuing(book)}
                      >
                        <BookPlus className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('common.edit')}
                        onClick={() => {
                          setEditing(book);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('common.delete')}
                        onClick={() => void handleDelete(book)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BookFormDialog book={editing} open={formOpen} onClose={() => setFormOpen(false)} />
      <IssueLoanDialog book={issuing} open={issuing !== null} onClose={() => setIssuing(null)} />
    </div>
  );
}
