import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { issueLoanSchema, listLoansQuerySchema } from '../schemas/loan.js';
import { idParamSchema } from '../schemas/common.js';
import * as loans from '../services/loans.js';

const router = Router();

// Loan records name borrowers, so they are admin-only throughout.
router.use(requireAdmin);

router.get('/', validate({ query: listLoansQuerySchema }), async (req, res) => {
  res.json(await loans.list(req.validated.query));
});

router.post('/', validate({ body: issueLoanSchema }), async (req, res) => {
  res.status(201).json(await loans.issue(req.validated.body));
});

router.put('/:id/return', validate({ params: idParamSchema }), async (req, res) => {
  res.json(await loans.markReturned(req.validated.params.id));
});

export default router;
