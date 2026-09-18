import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';
import { useDebounce } from '@/hooks/useDebounce';
import { ApiError } from '@/lib/api';
import type { Reader } from '@/lib/types';
import { ReaderFormDialog } from './ReaderFormDialog';
import { useDeleteReader, useReaders } from './queries';

export function ReadersTab() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const { data, isPending, isError, refetch } = useReaders(debounced);
  const del = useDeleteReader();

  const [editing, setEditing] = useState<Reader | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleDelete(reader: Reader) {
    setActionError(null);
    if (!window.confirm(t('admin.confirmDeleteReader', { name: reader.fullName }))) return;
    try {
      await del.mutateAsync(reader.id);
    } catch (err) {
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
            placeholder={t('admin.searchReaders')}
            aria-label={t('admin.searchReaders')}
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
          {t('admin.addReader')}
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
          message={t('admin.readersError')}
          onRetry={() => void refetch()}
          retryLabel={t('catalog.retry')}
        />
      ) : data.items.length === 0 ? (
        <EmptyState message={t('admin.noReaders')} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t('reader.fullName')}</th>
                <th className="px-3 py-2 font-medium">{t('reader.cardNumber')}</th>
                <th className="px-3 py-2 font-medium">{t('reader.phone')}</th>
                <th className="px-3 py-2 font-medium">{t('reader.email')}</th>
                <th className="px-3 py-2 font-medium">{t('admin.activeLoans')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((reader) => (
                <tr key={reader.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{reader.fullName}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {reader.cardNumber ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{reader.phone ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{reader.email ?? '—'}</td>
                  <td className="px-3 py-2">
                    {reader.activeLoans > 0 ? (
                      // Links straight to what this reader is holding.
                      <Link
                        to={`/admin/loans?status=active&readerId=${reader.id}`}
                        aria-label={t('admin.viewReaderLoans', { name: reader.fullName })}
                      >
                        <Badge className="bg-primary text-primary-foreground hover:opacity-80">
                          {reader.activeLoans}
                        </Badge>
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('common.edit')}
                        onClick={() => {
                          setEditing(reader);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('common.delete')}
                        onClick={() => void handleDelete(reader)}
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

      <ReaderFormDialog reader={editing} open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
