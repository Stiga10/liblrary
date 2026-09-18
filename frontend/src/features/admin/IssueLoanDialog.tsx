import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import type { Book } from '@/lib/types';
import { useAdminBooks, useIssueLoan, useReaders } from './queries';

export function IssueLoanDialog({
  book,
  open,
  onClose,
}: {
  book: Book | null; // preselected when opened from a book row
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const issue = useIssueLoan();
  const { data: books } = useAdminBooks('');
  const { data: readers } = useReaders('');

  const [bookId, setBookId] = useState<number | ''>('');
  const [readerId, setReaderId] = useState<number | ''>('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setBookId(book?.id ?? '');
    setReaderId('');
  }, [open, book]);

  // Only books with a free copy can be issued; showing the rest invites a 409.
  const available = useMemo(
    () => (books?.items ?? []).filter((b) => b.availableQuantity > 0),
    [books],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (bookId === '' || readerId === '') {
      setFormError(t('admin.selectBookAndReader'));
      return;
    }
    try {
      await issue.mutateAsync({ bookId: Number(bookId), readerId: Number(readerId) });
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('admin.saveFailed'));
    }
  }

  const selectClass =
    'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogTitle>{t('admin.issueLoan')}</DialogTitle>
        <DialogDescription>{t('admin.issueLoanHint')}</DialogDescription>

        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <div>
            <Label htmlFor="loanBook">{t('admin.book')}</Label>
            <select
              id="loanBook"
              className={selectClass}
              value={bookId}
              onChange={(e) => setBookId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">— {t('admin.chooseBook')} —</option>
              {available.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} — {b.author} ({b.availableQuantity}/{b.totalQuantity})
                </option>
              ))}
            </select>
            {available.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">{t('admin.noAvailableBooks')}</p>
            )}
          </div>

          <div>
            <Label htmlFor="loanReader">{t('admin.reader')}</Label>
            <select
              id="loanReader"
              className={selectClass}
              value={readerId}
              onChange={(e) => setReaderId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">— {t('admin.chooseReader')} —</option>
              {(readers?.items ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                  {r.cardNumber ? ` (${r.cardNumber})` : ''}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs text-muted-foreground">{t('admin.duePeriodNote')}</p>

          {formError && (
            <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={issue.isPending}>
              {issue.isPending ? t('common.loading') : t('loans.issue')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
