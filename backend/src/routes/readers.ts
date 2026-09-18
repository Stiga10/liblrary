import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  createReaderSchema,
  listReadersQuerySchema,
  updateReaderSchema,
} from '../schemas/reader.js';
import { idParamSchema } from '../schemas/common.js';
import * as readers from '../services/readers.js';

const router = Router();

// Readers are personal data: every route is admin-only, including reads.
router.use(requireAdmin);

router.get('/', validate({ query: listReadersQuerySchema }), async (req, res) => {
  res.json(await readers.list(req.validated.query));
});

router.get('/:id', validate({ params: idParamSchema }), async (req, res) => {
  res.json(await readers.getById(req.validated.params.id));
});

router.post('/', validate({ body: createReaderSchema }), async (req, res) => {
  res.status(201).json(await readers.create(req.validated.body));
});

router.put(
  '/:id',
  validate({ params: idParamSchema, body: updateReaderSchema }),
  async (req, res) => {
    res.json(await readers.update(req.validated.params.id, req.validated.body));
  },
);

router.delete('/:id', validate({ params: idParamSchema }), async (req, res) => {
  await readers.remove(req.validated.params.id);
  res.status(204).end();
});

export default router;
