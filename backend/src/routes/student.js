import { Router } from 'express';
import { query } from '../db.js';
import { HttpError, ah, parseId, rating, text } from '../utils.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { assess } from '../services/classifier.js';
import { ISSUE_SELECT, toStudentIssue } from '../services/issues.js';

const router = Router();
router.use(requireAuth, requireRole('student'));

function readReport(body) {
  const description = text(body?.description, 'description', { max: 2000 });
  const severity = rating(body?.severity, 'severity');
  const impact = rating(body?.impact, 'impact');
  return { description, severity, impact, ...assess(description, severity, impact) };
}

// Live "AI assessment" shown on the report form. Nothing is stored.
router.post('/preview', (req, res) => {
  const a = readReport(req.body);
  res.json({
    category: a.category,
    category_label: a.category_label,
    location: a.location,
    urgency: a.urgency,
    score: a.score,
    priority: a.priority,
    assigned_to: a.assigned_to,
    can_submit: a.category !== 'UNKNOWN',
  });
});

// Submit an issue. Category, priority and routing are decided server-side.
router.post(
  '/',
  ah(async (req, res) => {
    const a = readReport(req.body);
    if (a.category === 'UNKNOWN') {
      throw new HttpError(
        422,
        "We couldn't identify a category. Add more detail, such as Wi-Fi, projector, water leakage or bus.",
      );
    }

    const { rows } = await query(
      `INSERT INTO issues
         (reporter_id, description, category, priority, score, location, assigned_to, severity, impact, urgency)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [req.user.id, a.description, a.category, a.priority, a.score, a.location, a.assigned_to, a.severity, a.impact, a.urgency],
    );
    const created = await query(`${ISSUE_SELECT} WHERE i.id = $1`, [rows[0].id]);
    res.status(201).json({ issue: toStudentIssue(created.rows[0]) });
  }),
);

// Only the caller's own issues, ever.
router.get(
  '/',
  ah(async (req, res) => {
    const { rows } = await query(
      `${ISSUE_SELECT} WHERE i.reporter_id = $1 ORDER BY i.created_at DESC, i.id DESC`,
      [req.user.id],
    );
    res.json({ items: rows.map(toStudentIssue) });
  }),
);

router.get(
  '/summary',
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status = 'Open')::int        AS open,
              count(*) FILTER (WHERE status = 'In Progress')::int AS in_progress,
              count(*) FILTER (WHERE status = 'Resolved')::int    AS resolved
       FROM issues WHERE reporter_id = $1`,
      [req.user.id],
    );
    res.json(rows[0]);
  }),
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    const { rows } = await query(`${ISSUE_SELECT} WHERE i.id = $1 AND i.reporter_id = $2`, [id, req.user.id]);
    // 404 (not 403) so students can't probe which ids exist.
    if (!rows[0]) throw new HttpError(404, 'Issue not found');
    const resp = await query(
      'SELECT id, message, created_at FROM issue_responses WHERE issue_id = $1 ORDER BY created_at, id',
      [id],
    );
    res.json({ issue: { ...toStudentIssue(rows[0]), responses: resp.rows } });
  }),
);

export default router;
