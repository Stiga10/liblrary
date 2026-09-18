// Shapes returned by the API. Mirrors what the services in backend/src/services
// actually send, including the two derived fields the database does not store.
export interface Book {
  id: number;
  title: string;
  author: string;
  description: string | null;
  coverImageUrl: string | null;
  isbn: string | null;
  totalQuantity: number;
  createdAt: string;
  updatedAt: string;
  activeLoans: number;      // derived
  availableQuantity: number; // derived: totalQuantity - activeLoans
}

export interface Reader {
  id: number;
  fullName: string;
  phone: string | null;
  email: string | null;
  cardNumber: string | null;
  createdAt: string;
  activeLoans: number;
}

export interface Loan {
  id: number;
  bookId: number;
  readerId: number;
  borrowDate: string;
  dueDate: string;
  returnDate: string | null;
  status: 'ACTIVE' | 'RETURNED';
  isOverdue: boolean;   // derived from dueDate, never stored
  daysOverdue: number;  // derived
  book: Pick<Book, 'id' | 'title' | 'author' | 'coverImageUrl'>;
  reader: Pick<Reader, 'id' | 'fullName' | 'phone' | 'cardNumber'>;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface Summary {
  books: number;
  totalCopies: number;
  availableCopies: number;
  readers: number;
  activeLoans: number;
  overdueLoans: number;
  returnedLoans: number;
  topBorrowed: { id: number; title: string; author: string; loanCount: number }[];
}
