import { Router } from 'express';
import { query } from '../db.js';
import { ah, text } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';
import { answer, GREETING } from '../services/assistant.js';
import { campusInfo } from '../data/campusInfo.js';

const router = Router();

// Public tracking by issue number. Returns status-only information, never reporter data.
router.get('/issues/track/:id', ah(async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Enter a valid issue number' });
  const { rows } = await query(
    `SELECT id, status, category, priority, assigned_to, location, created_at, updated_at, resolved_at FROM issues WHERE id = $1`,
    [id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'No complaint found with that number' });
  const resp = await query(
    'SELECT id, message, created_at FROM issue_responses WHERE issue_id = $1 ORDER BY created_at, id',
    [id],
  );
  res.json({ issue: { ...rows[0], responses: resp.rows } });
}));

router.get(
  '/health',
  ah(async (_req, res) => {
    await query('SELECT 1');
    res.json({ status: 'ok' });
  }),
);

// Available to any signed-in user (student or admin).
router.get('/campus-info', requireAuth, (_req, res) => res.json({ items: campusInfo }));

router.post('/assistant', requireAuth, (req, res) => {
  const message = text(req.body?.message, 'message', { max: 1000 });
  res.json(answer(message));
});

router.get('/assistant/greeting', requireAuth, (_req, res) => res.json({ text: GREETING }));

export default router;
