Преди да преминем към архитектурния план и създаването на файловете, направих проучване на водещите софтуери за управление на библиотеки (като Koha, OpenBiblio и съвременни headless CMS базирани системи). Извлякох най-добрите практики от тях, за да изградим максимално функционално, чисто и лесно за поддръжка приложение.

**Анализ и най-добри практики от проучването**

* **Централизирано управление на наличността:** Вместо твърдо да се отбелязва дали една книга е "заета" или "свободна", водещите системи използват общ брой налични копия (*total_quantity*) и моментално изчисляват наличните (*available_quantity = total_quantity - active_loans*). Това позволява една и съща книга да има повече от един физически екземпляр.
* **Автоматично проследяване на заеманията:** Модулът за заемане следи за крайни срокове (напр. стандартен срок от 14 или 30 дни) и статус (*Active* / *Returned*), което позволява бързо филтриране на забавени книги.
* **Бързо търсене (Client-side & Server-side):** Комбинация от индексирано търсене в базата данни и моментално филтриране по заглавие, автор и ключови думи в описанието в реално време на фронтенда.
* **Удобство за потребителя:** Неригистрираните посетители виждат корица, детайли и статус "В наличност: X броя", без да се налага да влизат в системата.

---

**Препоръчана база данни**

За този стек (**Node.js + React + Tailwind**) най-подходящият избор е **PostgreSQL** (използвайки Prisma ORM или Supabase / Render / ElephantSQL за безплатен cloud хостинг) поради релационната природа на данните (връзка между Книги, Заемания и Администратори). Ако предпочитате NoSQL, **MongoDB (Atlas)** също е отличен и гъвкав избор.

---

По-долу е съдържанието, което можете директно да копирате и поставите във вашия **`CLAUDE.md`** файл. Текстът е напълно форматиран за Claude Code / AI асистенти, така че да разполагат с пълното техническо задание и структура.

```markdown
# Software Requirement Specification & Architecture Plan: Library Management System

## System Overview
A full-stack Web Application for library management built with Node.js, React.js, Tailwind CSS, and PostgreSQL/MongoDB. The system features an open public catalog and a protected Administrative Panel for book nomenclature and lending management.

---

## Technical Stack
- **Frontend:** React.js (Vite / Next.js), Tailwind CSS, Lucide React (Icons), Axios
- **Backend:** Node.js (Express.js)
- **Database:** PostgreSQL with Prisma ORM (or MongoDB with Mongoose)
- **Authentication:** JWT (JSON Web Tokens) with HTTP-only cookies/headers
- **File Storage:** Cloudinary / Local Storage for book cover images

---

## Data Architecture & Models

### 1. User Model (Admin Only)
- `id` (Primary Key / ObjectId)
- `username` (String, Unique)
- `password_hash` (String, bcrypt)
- `role` (Enum: `ADMIN`)
- `created_at` (Timestamp)

### 2. Book Model (Nomenclature)
- `id` (Primary Key / ObjectId)
- `title` (String, Required, Indexed)
- `author` (String, Required, Indexed)
- `description` (Text, Indexed)
- `cover_image_url` (String)
- `isbn` (String, Optional)
- `total_quantity` (Integer, Min: 0)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### 3. Loan Model (Lending History)
- `id` (Primary Key / ObjectId)
- `book_id` (Foreign Key -> Book.id)
- `borrower_name` (String, Required)
- `borrower_phone` (String, Optional)
- `borrow_date` (Date, Default: Now)
- `due_date` (Date, Optional)
- `return_date` (Date, Nullable)
- `status` (Enum: `ACTIVE`, `RETURNED`, `OVERDUE`)

---

## System Architecture Diagram



[Image of Database schema entity relationship diagram]



```

+------------------+          +------------------+          +------------------+
|      Users       |          |      Books       |          |      Loans       |
+------------------+          +------------------+          +------------------+
| id (PK)          |          | id (PK)          |1       * | id (PK)          |
| username         |          | title            |----------| book_id (FK)     |
| password_hash    |          | author           |          | borrower_name    |
| role             |          | description      |          | borrow_date      |
+------------------+          | cover_image_url  |          | return_date      |
| total_quantity   |          | status           |
+------------------+          +------------------+

```

---

## REST API Endpoint Design

### Public Routes (No Authentication Required)
- `GET /api/books` - Get all books with computed `available_quantity`. Supports query parameters: `?search=term&author=term`
- `GET /api/books/:id` - Get details of a single book.

### Auth Routes
- `POST /api/auth/login` - Authenticate admin & return JWT token.
- `POST /api/auth/logout` - Invalidate session/token.

### Admin Routes (Protected - Requires Valid JWT)
- `POST /api/books` - Create new book entry (supports image upload).
- `PUT /api/books/:id` - Edit book details and quantity.
- `DELETE /api/books/:id` - Remove a book entry.
- `GET /api/loans` - Get all loan records (Filterable: active, returned).
- `POST /api/loans` - Issue a book to a user (Decreases available stock check).
- `PUT /api/loans/:id/return` - Mark a loaned book as returned.

---

## Key Features & UI Workflow

### 1. Public Visitor View (No Login)
- **Header:** System logo, search bar, Admin Login button.
- **Catalog Grid:** Cards displaying cover image, title, author, brief description, and stock tag (`Available: X / Y`).
- **Search & Filter:** Instant search input filtering across Title, Author, and Description fields simultaneously.
- **Book Details Modal:** Full view of the book description and current availability.

### 2. Admin Dashboard (Protected Route)
- **Nomenclature Management:**
  - Add/Edit form with fields: Title, Author, Description, Image Upload/URL, Quantity.
  - Table view of books with direct action buttons (Edit, Delete, Issue Loan).
- **Lending Module (Issue Book):**
  - Form to record: Borrower Name, Selected Book (dropdown/search), Borrow Date.
  - Automatic validation ensuring `available_quantity > 0` before issuing.
- **Active Loans Table:**
  - Shows current active borrowings with status indicators.
  - One-click "Mark as Returned" action that updates the stock automatically.

---

## Development Roadmap & Execution Steps

1. **Setup Project Environment:**
   - Initialize Express API with JSON Middleware, CORS, and Database Client (Prisma/Mongoose).
   - Initialize Vite React project with Tailwind CSS and React Router.
2. **Backend Development:**
   - Build Database schemas and run migrations.
   - Implement JWT authentication middleware.
   - Build CRUD operations for Books and Loans logic.
3. **Frontend Development:**
   - Build public layout (Header, Search, Book Grid/Cards).
   - Build Admin Login view & Auth Context.
   - Build Admin Dashboard (Book Management & Loan Tracking Modal/Forms).
4. **Integration & Search Optimization:**
   - Connect Frontend components with Express endpoints.
   - Implement real-time client-side and server-side multi-parameter search filtering.

```
