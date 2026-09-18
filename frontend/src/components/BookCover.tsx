import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/** Cover image with a graceful placeholder: most books here have no cover yet. */
export function BookCover({
  url,
  title,
  className,
}: {
  url: string | null;
  title: string;
  className?: string;
}) {
  const { t } = useTranslation();

  if (!url) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-md bg-muted text-muted-foreground',
          className,
        )}
      >
        <BookOpen className="size-8" aria-hidden />
        <span className="px-2 text-center text-xs">{t('catalog.noCover')}</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={title}
      loading="lazy"
      className={cn('rounded-md bg-muted object-cover', className)}
    />
  );
}
