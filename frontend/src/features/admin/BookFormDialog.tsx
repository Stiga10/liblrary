import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input, Label, Textarea } from '@/components/ui/input';
import { BookCover } from '@/components/BookCover';
import {
  createBookSchema,
  type CreateBookFormInput,
  type CreateBookInput,
} from '@/lib/schemas';
import { ApiError } from '@/lib/api';
import type { Book } from '@/lib/types';
import { useCreateBook, useUpdateBook, useUploadCover } from './queries';

export function BookFormDialog({
  book,
  open,
  onClose,
}: {
  book: Book | null; // null = create
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const create = useCreateBook();
  const update = useUpdateBook();
  const uploadCover = useUploadCover();

  const [formError, setFormError] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const form = useForm<CreateBookFormInput, unknown, CreateBookInput>({
    resolver: zodResolver(createBookSchema),
    defaultValues: { title: '', author: '', description: '', isbn: '', totalQuantity: 1 },
  });

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setCoverFile(null);
    form.reset(
      book
        ? {
            title: book.title,
            author: book.author,
            description: book.description ?? '',
            isbn: book.isbn ?? '',
            totalQuantity: book.totalQuantity,
          }
        : { title: '', author: '', description: '', isbn: '', totalQuantity: 1 },
    );
  }, [open, book, form]);

  // Object URLs must be revoked or the blob leaks for the page's lifetime.
  useEffect(() => {
    if (!coverFile) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  async function onSubmit(values: CreateBookInput) {
    setFormError(null);
    // Empty optional strings must not be sent as '' - the ISBN regex would reject it.
    const payload: CreateBookInput = {
      ...values,
      description: values.description?.trim() || undefined,
      isbn: values.isbn?.trim() || undefined,
    };

    try {
      const saved = book
        ? await update.mutateAsync({ id: book.id, ...payload })
        : await create.mutateAsync(payload);

      if (coverFile) await uploadCover.mutateAsync({ id: saved.id, file: coverFile });
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        // Map field-level server errors back onto the inputs that caused them.
        if (err.fields) {
          for (const [name, messages] of Object.entries(err.fields)) {
            if (messages?.[0]) {
              form.setError(name as keyof CreateBookFormInput, { message: messages[0] });
            }
          }
        }
        setFormError(err.message); // already localized by the API
      } else {
        setFormError(t('admin.saveFailed'));
      }
    }
  }

  const busy = form.formState.isSubmitting || uploadCover.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogTitle>{book ? t('admin.editBook') : t('admin.addBook')}</DialogTitle>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <div>
            <Label htmlFor="title">{t('book.title')}</Label>
            <Input id="title" {...form.register('title')} />
            {form.formState.errors.title && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="author">{t('book.author')}</Label>
            <Input id="author" {...form.register('author')} />
            {form.formState.errors.author && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.author.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">{t('book.description')}</Label>
            <Textarea id="description" {...form.register('description')} />
            {form.formState.errors.description && (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="isbn">{t('book.isbn')}</Label>
              <Input id="isbn" {...form.register('isbn')} placeholder="9789542805013" />
              {form.formState.errors.isbn && (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.isbn.message}</p>
              )}
            </div>
            <div className="w-28">
              <Label htmlFor="totalQuantity">{t('book.quantity')}</Label>
              <Input id="totalQuantity" type="number" min={0} {...form.register('totalQuantity')} />
              {form.formState.errors.totalQuantity && (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.totalQuantity.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="cover">{t('book.cover')}</Label>
            <div className="flex items-start gap-3">
              <BookCover
                url={preview ?? book?.coverImageUrl ?? null}
                title={form.watch('title') || t('book.cover')}
                className="h-28 w-20 shrink-0"
              />
              <div className="space-y-2">
                <input
                  ref={fileInput}
                  id="cover"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                  <Upload className="size-4" aria-hidden />
                  {t('admin.chooseFile')}
                </Button>
                <p className="text-xs text-muted-foreground">{t('admin.coverHint')}</p>
                {coverFile && <p className="text-xs">{coverFile.name}</p>}
              </div>
            </div>
          </div>

          {formError && (
            <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
