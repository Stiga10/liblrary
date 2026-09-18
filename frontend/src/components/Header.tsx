import { Languages, LogOut, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { authClient, useSession } from '@/lib/auth-client';
import { applyTheme, getInitialTheme, type Theme } from '@/lib/theme';
import { useState } from 'react';

export function Header() {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const { data: session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  }

  async function handleSignOut() {
    await authClient.signOut();
    navigate('/');
  }

  const onAdmin = location.pathname.startsWith('/admin');

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
        <Link to="/" className="mr-auto">
          <span className="block text-lg font-semibold text-primary">{t('app.title')}</span>
          <span className="block text-xs text-muted-foreground">{t('app.tagline')}</span>
        </Link>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => void i18n.changeLanguage(i18n.language === 'bg' ? 'en' : 'bg')}
          aria-label={t('nav.language')}
        >
          <Languages className="size-4" aria-hidden />
          {i18n.language === 'bg' ? 'EN' : 'BG'}
        </Button>

        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={t('nav.theme')}>
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>

        {session ? (
          <>
            {!onAdmin && (
              // A link, not a button: middle-click and "open in new tab" should work.
              <Link
                to="/admin"
                className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                {t('nav.admin')}
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={() => void handleSignOut()}>
              <LogOut className="size-4" aria-hidden />
              {t('nav.logout')}
            </Button>
          </>
        ) : (
          <Link
            to="/login"
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            {t('nav.login')}
          </Link>
        )}
      </div>
    </header>
  );
}
