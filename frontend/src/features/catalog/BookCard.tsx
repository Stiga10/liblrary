import { useTranslation } from 'react-i18next';
import { AvailabilityBadge } from '@/components/AvailabilityBadge';
import { BookCover } from '@/components/BookCover';
import { Card } from '@/components/ui/card';
import type { Book } from '@/lib/types';

export function BookCard({ book, onOpen }: { book: Book; onOpen: (book: Book) => void }) {
  const { t } = useTranslation();

  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => onOpen(book)}
        className="flex flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${book.title} — ${t('catalog.details')}`}
      >
        {/* Capped height: an uncovered book would otherwise be 560px tall at 375px
            wide, leaving one card per screen. */}
        <BookCover
          url={book.coverImageUrl}
          title={book.title}
          className="aspect-[2/3] max-h-72 w-full sm:max-h-none"
        />
        <div className="flex flex-1 flex-col gap-1 p-3">
          <h3 className="line-clamp-2 font-medium leading-snug">{book.title}</h3>
          <p className="line-clamp-1 text-sm text-muted-foreground">{book.author}</p>
          {book.description && (
            <p className="line-clamp-2 mt-1 text-xs text-muted-foreground">{book.description}</p>
          )}
          <div className="mt-auto pt-2">
            <AvailabilityBadge
              available={book.availableQuantity}
              total={book.totalQuantity}
            />
          </div>
        </div>
      </button>
    </Card>
  );
}
