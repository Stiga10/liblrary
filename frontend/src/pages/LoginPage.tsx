import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { authClient, useSession } from '@/lib/auth-client';
import { loginSchema, type LoginInput } from '@/lib/schemas';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session, isPending: sessionPending } = useSession();
  const [formError, setFormError] = useState<string | null>(null);

  // Where AdminRoute wanted to send them before the login form intervened.
  // Only in-app paths are honoured, so this cannot be used as an open redirect.
  const rawFrom = (location.state as { from?: string } | null)?.from;
  const from = rawFrom?.startsWith('/admin') ? rawFrom : '/admin';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (!sessionPending && session) return <Navigate to={from} replace />;

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });
    if (error) {
      // Better Auth returns English codes; the message shown must be localized.
      setFormError(
        error.code === 'INVALID_EMAIL_OR_PASSWORD'
          ? t('login.invalidCredentials')
          : t('login.failed'),
      );
      return;
    }
    navigate(from, { replace: true });
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card className="p-6">
        <h1 className="mb-1 text-lg font-semibold">{t('login.title')}</h1>
        <p className="mb-5 text-sm text-muted-foreground">{t('login.subtitle')}</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email">{t('login.email')}</Label>
            <Input id="email" type="email" autoComplete="username" {...register('email')} />
            {errors.email && (
              <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="password">{t('login.password')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          {formError && (
            <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              {formError}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            <LogIn className="size-4" aria-hidden />
            {isSubmitting ? t('common.loading') : t('nav.login')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
