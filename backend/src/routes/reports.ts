import { Router } from 'express';
import { requireAdmin } from '../middleware/requireAdmin.js';
import * as reports from '../services/reports.js';

const router = Router();

router.use(requireAdmin);

router.get('/summary', async (_req, res) => {
  res.json(await reports.summary());
});

router.get('/loans.csv', async (_req, res) => {
  const csv = await reports.loansCsv();
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="loans-${stamp}.csv"`);
  res.send(csv);
});

export default router;
