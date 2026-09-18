import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Book, Paginated } from '@/lib/types';

export function useBooks(search: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}&limit=100` : '?limit=100';
  return useQuery({
    queryKey: ['books', search],
    queryFn: () => api.get<Paginated<Book>>(`/books${qs}`),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    // Keeps the previous page visible while a new search resolves, so the grid does
    // not blink to a skeleton on every keystroke.
    placeholderData: (prev) => prev,
  });
}
