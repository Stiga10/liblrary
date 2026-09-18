import { Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookCard } from '@/features/catalog/BookCard';
import { BookDetailsDialog } from '@/features/catalog/BookDetailsDialog';
import { useBooks } from '@/features/catalog/useBooks';
import { Input } from '@/components/ui/input';
import { BookGridSkeleton, EmptyState, ErrorState } from '@/components/ui/states';
import { useDebounce } from '@/hooks/useDebounce';
import type { Book } from '@/lib/types';

export function CatalogPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Book | null>(null);
  const debounced = useDebounce(search, 300);

  const { data, isPending, isError, refetch } = useBooks(debounced);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-semibold">{t('catalog.title')}</h1>
        {data && (
          <span className="text-sm text-muted-foreground">
            {t('catalog.count', { count: data.total })}
          </span>
        )}
      </div>

      <div className="relative">
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

      {/* Four states, in order. data is undefined while isPending, so the early
          returns must come before any access to it. */}
      {isPending ? (
        <BookGridSkeleton />
      ) : isError ? (
        <ErrorState
          message={t('catalog.error')}
          onRetry={() => void refetch()}
          retryLabel={t('catalog.retry')}
        />
      ) : data.items.length === 0 ? (
        <EmptyState message={t('catalog.empty')} hint={search ? t('catalog.emptyHint') : undefined} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map((book) => (
            <BookCard key={book.id} book={book} onOpen={setSelected} />
          ))}
        </div>
      )}

      <BookDetailsDialog book={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
