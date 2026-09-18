import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { createReaderSchema, type CreateReaderInput } from '@/lib/schemas';
import { ApiError } from '@/lib/api';
import type { Reader } from '@/lib/types';
import { useCreateReader, useUpdateReader } from './queries';

export function ReaderFormDialog({
  reader,
  open,
  onClose,
}: {
  reader: Reader | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const create = useCreateReader();
  const update = useUpdateReader();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<CreateReaderInput>({
    resolver: zodResolver(createReaderSchema),
    defaultValues: { fullName: '', phone: '', email: '', cardNumber: '' },
  });

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    form.reset(
      reader
        ? {
            fullName: reader.fullName,
            phone: reader.phone ?? '',
            email: reader.email ?? '',
            cardNumber: reader.cardNumber ?? '',
          }
        : { fullName: '', phone: '', email: '', cardNumber: '' },
    );
  }, [open, reader, form]);

  async function onSubmit(values: CreateReaderInput) {
    setFormError(null);
    const payload: CreateReaderInput = {
      fullName: values.fullName,
      phone: values.phone?.trim() || undefined,
      email: values.email?.trim() || undefined,
      cardNumber: values.cardNumber?.trim() || undefined,
    };
    try {
      if (reader) await update.mutateAsync({ id: reader.id, ...payload });
      else await create.mutateAsync(payload);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) {
          for (const [name, messages] of Object.entries(err.fields)) {
            if (messages?.[0]) form.setError(name as keyof CreateReaderInput, { message: messages[0] });
          }
        }
        setFormError(err.message);
      } else {
        setFormError(t('admin.saveFailed'));
      }
    }
  }

  const fields = [
    { name: 'fullName', label: t('reader.fullName'), type: 'text' },
    { name: 'phone', label: t('reader.phone'), type: 'tel' },
    { name: 'email', label: t('reader.email'), type: 'email' },
    { name: 'cardNumber', label: t('reader.cardNumber'), type: 'text' },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogTitle>{reader ? t('admin.editReader') : t('admin.addReader')}</DialogTitle>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
          {fields.map((f) => (
            <div key={f.name}>
              <Label htmlFor={f.name}>{f.label}</Label>
              <Input id={f.name} type={f.type} {...form.register(f.name)} />
              {form.formState.errors[f.name] && (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors[f.name]?.message}
                </p>
              )}
            </div>
          ))}

          {formError && (
            <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
