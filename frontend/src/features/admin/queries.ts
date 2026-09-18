// All admin data access in one file so the invalidation rules are visible together.
//
// Rule that matters (frontend-engineer rule 5): a mutation touching loans MUST
// invalidate BOTH ['loans'] and ['books'] - availability is derived from loans, so
// the catalog is stale the moment a loan changes.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Book, Loan, Paginated, Reader, Summary } from '@/lib/types';
import type { CreateBookInput, CreateReaderInput, IssueLoanInput } from '@/lib/schemas';

// --- books ---

export function useAdminBooks(search: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}&limit=100` : '?limit=100';
  return useQuery({
    queryKey: ['books', search],
    queryFn: () => api.get<Paginated<Book>>(`/books${qs}`),
    placeholderData: (prev) => prev,
  });
}

export function useCreateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookInput) => api.post<Book>('/books', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['books'] }),
  });
}

export function useUpdateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: CreateBookInput & { id: number }) =>
      api.put<Book>(`/books/${id}`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['books'] }),
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/books/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['books'] }),
  });
}

export function useUploadCover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => {
      const body = new FormData();
      body.append('cover', file);
      return api.post<Book>(`/books/${id}/cover`, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['books'] }),
  });
}

// --- readers ---

export function useReaders(search = '') {
  const qs = search ? `?search=${encodeURIComponent(search)}&limit=100` : '?limit=100';
  return useQuery({
    queryKey: ['readers', search],
    queryFn: () => api.get<Paginated<Reader>>(`/readers${qs}`),
    placeholderData: (prev) => prev,
  });
}

export function useCreateReader() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReaderInput) => api.post<Reader>('/readers', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['readers'] }),
  });
}

export function useUpdateReader() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: CreateReaderInput & { id: number }) =>
      api.put<Reader>(`/readers/${id}`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['readers'] }),
  });
}

export function useDeleteReader() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/readers/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['readers'] }),
  });
}

// --- loans ---

export function useLoans(
  status?: 'active' | 'returned' | 'overdue',
  readerId?: number,
  bookId?: number,
) {
  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  if (readerId) qs.set('readerId', String(readerId));
  if (bookId) qs.set('bookId', String(bookId));
  const suffix = qs.toString() ? `?${qs}` : '';

  return useQuery({
    // The key must carry every filter, or switching filters serves the wrong cache.
    queryKey: ['loans', status ?? 'all', readerId ?? null, bookId ?? null],
    queryFn: () => api.get<Paginated<Loan>>(`/loans${suffix}`),
    placeholderData: (prev) => prev,
  });
}

export function useIssueLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: IssueLoanInput) => api.post<Loan>('/loans', input),
    onSuccess: () => {
      // Both, always: availability is computed from active loans.
      void qc.invalidateQueries({ queryKey: ['loans'] });
      void qc.invalidateQueries({ queryKey: ['books'] });
      void qc.invalidateQueries({ queryKey: ['summary'] });
    },
  });
}

export function useReturnLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.put<Loan>(`/loans/${id}/return`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['loans'] });
      void qc.invalidateQueries({ queryKey: ['books'] });
      void qc.invalidateQueries({ queryKey: ['summary'] });
    },
  });
}

// --- reports ---

export function useSummary() {
  return useQuery({
    queryKey: ['summary'],
    queryFn: () => api.get<Summary>('/reports/summary'),
  });
}
