// Layout for the admin area. Each section is a real route with its own URL, so it
// can be linked, bookmarked, opened in a new tab and reached with the back button.
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const SECTIONS = ['dashboard', 'books', 'readers', 'loans'] as const;

export function AdminPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('nav.admin')}</h1>

      <nav className="flex flex-wrap gap-1 border-b border-border pb-2" aria-label={t('nav.admin')}>
        {SECTIONS.map((section) => (
          <NavLink
            key={section}
            to={section}
            // NavLink supplies isActive, so the current section needs no local state.
            className={({ isActive }) =>
              cn(
                'inline-flex h-8 items-center rounded-md px-3 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground',
              )
            }
          >
            {t(`admin.tabs.${section}`)}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
