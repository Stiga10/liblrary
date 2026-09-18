import { useTranslation } from 'react-i18next';
import { AvailabilityBadge } from '@/components/AvailabilityBadge';
import { BookCover } from '@/components/BookCover';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { Book } from '@/lib/types';

export function BookDetailsDialog({
  book,
  onClose,
}: {
  book: Book | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={book !== null} onOpenChange={(open) => !open && onClose()}>
      {book && (
        <DialogContent closeLabel={t('common.close')}>
          <DialogTitle>{book.title}</DialogTitle>

          <div className="flex flex-col gap-4 sm:flex-row">
            <BookCover
              url={book.coverImageUrl}
              title={book.title}
              className="aspect-[2/3] w-full shrink-0 sm:w-40"
            />

            <dl className="min-w-0 flex-1 space-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">{t('book.author')}</dt>
                <dd className="font-medium">{book.author}</dd>
              </div>

              {book.isbn && (
                <div>
                  <dt className="text-xs text-muted-foreground">{t('book.isbn')}</dt>
                  <dd className="font-mono text-xs">{book.isbn}</dd>
                </div>
              )}

              <div>
                <dt className="mb-1 text-xs text-muted-foreground">{t('book.availability')}</dt>
                <dd>
                  <AvailabilityBadge
                    available={book.availableQuantity}
                    total={book.totalQuantity}
                  />
                </dd>
              </div>
            </dl>
          </div>

          {book.description && (
            <div className="mt-4">
              <h4 className="mb-1 text-xs text-muted-foreground">{t('book.description')}</h4>
              <p className="text-sm leading-relaxed">{book.description}</p>
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
