// Express 5 bootstrap.
//
// MIDDLEWARE ORDER IS LOAD-BEARING (CLAUDE.md section 7):
//   1. cors with credentials - the session cookie must be allowed to travel
//   2. Better Auth handler - needs the RAW request stream, so it must come
//      BEFORE express.json(), which would consume it
//   3. express.json() - for our own routes
//   4. application routes
//   5. static uploads
//   6. the single error handler, last
//
// The route pattern is '/api/auth/*splat', not '/api/auth/*': Express 5 rejects the
// old bare wildcard.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { allowedOrigins, auth } from './lib/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import booksRouter from './routes/books.js';
import readersRouter from './routes/readers.js';
import loansRouter from './routes/loans.js';
import reportsRouter from './routes/reports.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

const origins = allowedOrigins();
app.use(cors({ origin: origins, credentials: true }));

// Must precede express.json(). Do not move.
app.all('/api/auth/*splat', toNodeHandler(auth));

// Request log. Deliberately after the auth handler (which needs the raw stream) and
// before the routes. Mutations are logged with their status so a destructive call
// can always be traced back to a caller, which is exactly what was missing when
// seed rows disappeared during UI testing.
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    const started = Date.now();
    res.on('finish', () => {
      console.log(
        `${new Date().toISOString()} ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started}ms)`,
      );
    });
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/books', booksRouter);
app.use('/api/readers', readersRouter);
app.use('/api/loans', loansRouter);
app.use('/api/reports', reportsRouter);

app.use('/uploads', express.static('uploads', { maxAge: '7d' }));

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`Allowed origins: ${origins.join(', ')}`);
});
