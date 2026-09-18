---
name: ui-screen
description: Template for a new screen or component in frontend/ of the Biblioteka project — shadcn/ui components, Tailwind v4 theme and OKLCH tokens, light/dark, TanStack Query v5 hooks, Zod-backed forms, bilingual UI (bg/en), mandatory loading/empty/error states. Use for any React UI work.
---

# New screen (React 19 + Tailwind v4 + shadcn/ui + TanStack Query v5)

## 1. Theme and color tokens

The theme is defined **once** in `frontend/src/index.css` via the Tailwind v4 `@theme` directive. Never
write hard-coded colors (`bg-blue-600`, `#1e40af`) in a component — only semantic tokens.

```css
@import "tailwindcss";

@layer base {
  :root {
    --background:  oklch(1 0 0);
    --foreground:  oklch(0.145 0 0);
    --primary:     oklch(0.45 0.12 250);      /* deep blue — calm, library-like */
    --primary-foreground: oklch(0.99 0 0);
    --muted:       oklch(0.96 0.005 250);
    --muted-foreground: oklch(0.52 0.01 250);
    --border:      oklch(0.91 0.01 250);
    --success:     oklch(0.62 0.15 150);      /* book available */
    --warning:     oklch(0.72 0.16 75);       /* last copy */
    --destructive: oklch(0.58 0.20 25);       /* out of stock / overdue */
    --radius: 0.625rem;
  }

  .dark {
    --background:  oklch(0.15 0.01 250);
    --foreground:  oklch(0.96 0 0);
    --primary:     oklch(0.68 0.13 250);      /* lighter in dark mode — contrast requires it */
    --primary-foreground: oklch(0.15 0.01 250);
    --muted:       oklch(0.23 0.01 250);
    --muted-foreground: oklch(0.68 0.01 250);
    --border:      oklch(0.28 0.01 250);
    --success:     oklch(0.70 0.15 150);
    --warning:     oklch(0.78 0.15 75);
    --destructive: oklch(0.65 0.19 25);
  }
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-destructive: var(--destructive);
  --radius-lg: var(--radius);
}
```

Contrast rule: in dark mode `--primary` becomes **lighter**, not darker. The reverse produces unreadable
text on a dark background — item 11 of the manual checklist in CLAUDE.md.

## 2. Adding a shadcn component

```bash
cd frontend
npx shadcn@latest add button card dialog input table badge select skeleton sonner
```

Components land in `src/components/ui/` and **are owned by this project** — edit them freely. Do not
treat them as a dependency and do not bulk-upgrade them.

## 3. Bilingual UI — mandatory

No user-facing string is written directly in JSX. Keys live in `src/locales/bg.json` and
`src/locales/en.json` — **both are updated in the same pass**.

```json
// bg.json
{
  "catalog": {
    "title": "Каталог",
    "search": "Търсене по заглавие, автор или описание…",
    "available": "Налични: {{available}} от {{total}}",
    "unavailable": "Изчерпана",
    "lastCopy": "Последен екземпляр",
    "empty": "Няма намерени книги.",
    "error": "Каталогът не можа да се зареди."
  },
  "loans": { "issue": "Заеми", "return": "Върни", "overdue": "Просрочена", "dueOn": "Срок: {{date}}" }
}
```

```tsx
const { t } = useTranslation();
<Badge>{t('catalog.available', { available, total })}</Badge>
```

Dates and numbers go through the locale, never through manual formatting:
```tsx
new Intl.DateTimeFormat(i18n.language === 'bg' ? 'bg-BG' : 'en-GB').format(dueDate)
```

## 4. Query hook — one file per resource

`src/features/catalog/useBooks.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export function useBooks(search: string) {
  return useQuery({
    queryKey: ['books', search],
    queryFn: () => api.get(`/books${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    staleTime: 30_000,
    gcTime: 5 * 60_000,                // v5 name; cacheTime no longer exists
    placeholderData: (prev) => prev,   // v5 replacement for keepPreviousData — list does not flicker while searching
  });
}
```

Mutations **always** invalidate the affected keys — otherwise the catalog count does not update after a
loan is issued (item 5 of the manual checklist):

```ts
export function useIssueLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: IssueLoanInput) => api.post('/loans', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['books'] });   // availability changed
      qc.invalidateQueries({ queryKey: ['loans'] });
      toast.success(t('loans.issued'));
    },
    onError: (e: ApiError) => toast.error(e.message),  // message already comes localized from the API
  });
}
```

## 5. Every screen has four states

A missing empty or error state is the most common oversight. The required skeleton:

```tsx
export function CatalogPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const { data, isPending, isError, refetch } = useBooks(debounced);

  if (isPending) return <BookGridSkeleton />;                       // 1. loading
  if (isError)   return <ErrorState onRetry={refetch} message={t('catalog.error')} />;  // 2. error
  if (!data.items.length) return <EmptyState message={t('catalog.empty')} />;           // 3. empty

  return (                                                          // 4. data
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.items.map((book) => <BookCard key={book.id} book={book} />)}
    </div>
  );
}
```

In TanStack Query v5, `data` is `undefined` while `isPending` is `true` — which is why the early return
comes before any access to `data`, rather than using `data?.items`.

## 6. Displaying availability — one component, one rule

```tsx
function AvailabilityBadge({ available, total }: { available: number; total: number }) {
  const { t } = useTranslation();
  if (available === 0)
    return <Badge className="bg-destructive text-white">{t('catalog.unavailable')}</Badge>;
  if (available === 1)
    return <Badge className="bg-warning text-black">{t('catalog.lastCopy')}</Badge>;
  return <Badge className="bg-success text-white">{t('catalog.available', { available, total })}</Badge>;
}
```

Do not repeat this logic in both the admin table and the catalog card — one component, used in both
places.

## 7. Forms — the same Zod schema as the API

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createBookSchema } from '../../lib/schemas';   // mirror of backend/src/schemas

const form = useForm<CreateBookInput>({
  resolver: zodResolver(createBookSchema),
  defaultValues: { title: '', author: '', totalQuantity: 1 },
});
```

Server-side errors (the `fields` object in a `VALIDATION_ERROR` response) are mapped back onto the
fields:
```ts
Object.entries(err.fields ?? {}).forEach(([name, msgs]) =>
  form.setError(name as keyof CreateBookInput, { message: msgs[0] }));
```

Cover upload is a `FormData` request to `POST /api/books/:id/cover`, separate from the book's JSON. Show
a local preview via `URL.createObjectURL(file)` and revoke it in cleanup.

## 8. Accessibility and responsiveness — the non-negotiable minimum

- Every image has an `alt` (the book title); covers use `loading="lazy"`.
- Dialogs use shadcn's `Dialog`, which handles focus trapping and `Esc`. Do not build your own modal
  out of a `div`.
- Every input has an associated `<Label htmlFor>`; icon-only buttons get an `aria-label` via `t()`.
- Admin tables scroll horizontally on phones: `<div className="overflow-x-auto">`.
- The catalog grid starts at one column: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- Never signal overdue status by color alone — add text or an icon.

## 9. Protected routes

```tsx
function AdminRoute({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <FullPageSpinner />;
  if (!session || session.user.role !== 'ADMIN') return <Navigate to="/login" replace />;
  return children;
}
```

`src/lib/api.ts` must always send cookies, or the session will not travel:
```ts
fetch(url, { ...options, credentials: 'include' })
```

## 10. Before you call it done

1. Are loading, empty, and error states all present? (not just the happy path)
2. Is every string going through `t()`? Switch to EN — is anything left in Bulgarian?
3. Switch light/dark — is everything readable?
4. Narrow to 375px — does anything overflow?
5. After a mutation, does the screen update without a manual refresh?
6. If you changed a Zod schema, did you also change `backend/src/schemas/`?
