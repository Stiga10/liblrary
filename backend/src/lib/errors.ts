// Single error vocabulary for the whole API. See CLAUDE.md section 6.
//
// Every client-facing failure must be an AppError so the response always has the
// shape { error: { code, message } } and the UI can react to `code`. The `message`
// is user-facing Bulgarian and is displayed verbatim by the frontend.

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errors = {
  bookNotFound: () => new AppError(404, 'BOOK_NOT_FOUND', 'Книгата не е намерена.'),
  readerNotFound: () => new AppError(404, 'READER_NOT_FOUND', 'Читателят не е намерен.'),
  loanNotFound: () => new AppError(404, 'LOAN_NOT_FOUND', 'Заемането не е намерено.'),
  noCopiesAvailable: () =>
    new AppError(409, 'NO_COPIES_AVAILABLE', 'Няма свободни екземпляри от тази книга.'),
  loanAlreadyReturned: () =>
    new AppError(409, 'LOAN_ALREADY_RETURNED', 'Това заемане вече е върнато.'),
  quantityBelowActiveLoans: (active: number) =>
    new AppError(
      409,
      'QUANTITY_BELOW_ACTIVE_LOANS',
      `В момента са заети ${active} екземпляра — бройката не може да е под тази стойност.`,
    ),
  bookHasActiveLoans: () =>
    new AppError(409, 'BOOK_HAS_ACTIVE_LOANS', 'Книгата има активни заемания и не може да бъде изтрита.'),
  // Distinct from the active case: nothing is lent out, but the loan history
  // references this book and deleting it would erase that record.
  bookHasLoanHistory: (count: number) =>
    new AppError(
      409,
      'BOOK_HAS_LOAN_HISTORY',
      `Книгата има ${count} записа в историята на заеманията и не може да бъде изтрита.`,
    ),
  readerHasLoanHistory: (count: number) =>
    new AppError(
      409,
      'READER_HAS_LOAN_HISTORY',
      `Читателят има ${count} записа в историята на заеманията и не може да бъде изтрит.`,
    ),
  readerHasActiveLoans: () =>
    new AppError(409, 'READER_HAS_ACTIVE_LOANS', 'Читателят има активни заемания и не може да бъде изтрит.'),
  isbnTaken: () => new AppError(409, 'ISBN_TAKEN', 'Книга с този ISBN вече съществува.'),
  cardNumberTaken: () => new AppError(409, 'CARD_NUMBER_TAKEN', 'Читател с този номер на карта вече съществува.'),
  unauthenticated: () => new AppError(401, 'UNAUTHENTICATED', 'Необходим е вход.'),
  forbidden: () => new AppError(403, 'FORBIDDEN', 'Няма достъп.'),
  invalidFileType: () =>
    new AppError(400, 'INVALID_FILE_TYPE', 'Позволени са само JPEG, PNG и WebP.'),
  fileTooLarge: () => new AppError(400, 'FILE_TOO_LARGE', 'Файлът е по-голям от 5 MB.'),
  noFileUploaded: () => new AppError(400, 'NO_FILE_UPLOADED', 'Не е избран файл.'),
};
