import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { deleteCover, storeCover, uploadCover } from '../middleware/upload.js';
import { errors } from '../lib/errors.js';
import { createBookSchema, listBooksQuerySchema, updateBookSchema } from '../schemas/book.js';
import { idParamSchema } from '../schemas/common.js';
import * as books from '../services/books.js';

const router = Router();

// --- public (CLAUDE.md section 6) ---

router.get('/', validate({ query: listBooksQuerySchema }), async (req, res) => {
  res.json(await books.list(req.validated.query));
});

router.get('/:id', validate({ params: idParamSchema }), async (req, res) => {
  res.json(await books.getById(req.validated.params.id));
});

// --- admin ---

router.post('/', requireAdmin, validate({ body: createBookSchema }), async (req, res) => {
  res.status(201).json(await books.create(req.validated.body));
});

router.put(
  '/:id',
  requireAdmin,
  validate({ params: idParamSchema, body: updateBookSchema }),
  async (req, res) => {
    res.json(await books.update(req.validated.params.id, req.validated.body));
  },
);

router.delete('/:id', requireAdmin, validate({ params: idParamSchema }), async (req, res) => {
  await books.remove(req.validated.params.id);
  res.status(204).end();
});

// Multipart, so it sits outside the JSON body parser. multer runs after requireAdmin:
// an unauthenticated request must never get as far as writing a file.
router.post(
  '/:id/cover',
  requireAdmin,
  validate({ params: idParamSchema }),
  uploadCover,
  async (req, res) => {
    if (!req.file) throw errors.noFileUploaded();
    const id = req.validated.params.id;
    const url = await storeCover(id, req.file.buffer);
    const { book, previousCover } = await books.setCover(id, url);
    // Only remove the old file once the new one is committed to the database.
    await deleteCover(previousCover);
    res.json(book);
  },
);

export default router;
