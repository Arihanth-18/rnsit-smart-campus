import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { HttpError, ah, parseId, text } from '../utils.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { loginFor, authLimiter } from './auth.js';
import { ISSUE_SELECT, toAdminIssue } from '../services/issues.js';
import { routes, categoryNames } from '../services/classifier.js';

const STATUSES = ['Open', 'In Progress', 'Resolved'];
const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];

const router = Router();

// Separate admin sign-in (only accepts role=admin accounts).
router.post('/auth/login', authLimiter, loginFor('admin'));

// Everything below needs an admin token.
router.use(requireAuth, requireRole('admin'));

router.get('/auth/me', (req, res) => res.json({ user: req.user }));

// All issues with filters: ?status=&priority=&q=&limit=&offset=
router.get(
  '/issues',
  ah(async (req, res) => {
    const where = [];
    const params = [];
    const add = (sql, v) => {
      params.push(v);
      where.push(sql.replace('?', `$${params.length}`));
    };

    const { status, priority } = req.query;
    if (status && status !== 'All') {
      if (!STATUSES.includes(status)) throw new HttpError(422, 'Invalid status filter');
      add('i.status = ?', status);
    }
    if (priority && priority !== 'All') {
      if (!PRIORITIES.includes(priority)) throw new HttpError(422, 'Invalid priority filter');
      add('i.priority = ?', priority);
    }
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const like = `%${req.query.q.trim().slice(0, 100).replace(/[\\%_]/g, '\\$&')}%`;
      params.push(like);
      const p = `$${params.length}`;
      where.push(
        `(i.id::text ILIKE ${p} OR i.description ILIKE ${p} OR i.category ILIKE ${p}
          OR i.location ILIKE ${p} OR i.assigned_to ILIKE ${p}
          OR u.name ILIKE ${p} OR u.email ILIKE ${p})`,
      );
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [list, count] = await Promise.all([
      query(
        `${ISSUE_SELECT} ${clause} ORDER BY i.created_at DESC, i.id DESC LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
      query(`SELECT count(*)::int AS total FROM issues i JOIN users u ON u.id = i.reporter_id ${clause}`, params),
    ]);
    res.json({ items: list.rows.map(toAdminIssue), total: count.rows[0].total, limit, offset });
  }),
);

router.get(
  '/issues/:id',
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    const { rows } = await query(`${ISSUE_SELECT} WHERE i.id = $1`, [id]);
    if (!rows[0]) throw new HttpError(404, 'Issue not found');
    const events = await query(
      `SELECT e.id, e.from_status, e.to_status, e.created_at, a.name AS actor_name
       FROM issue_events e LEFT JOIN users a ON a.id = e.actor_id
       WHERE e.issue_id = $1 ORDER BY e.created_at, e.id`,
      [id],
    );
    const responses = await query(
      `SELECT r.id, r.message, r.created_at, a.name AS admin_name
       FROM issue_responses r LEFT JOIN users a ON a.id = r.admin_id
       WHERE r.issue_id = $1 ORDER BY r.created_at, r.id`,
      [id],
    );
    res.json({ issue: toAdminIssue(rows[0]), history: events.rows, responses: responses.rows });
  }),
);

// Workflow: Open -> In Progress -> Resolved (admins may move between any of them).
router.patch(
  '/issues/:id/status',
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    const status = text(req.body?.status, 'status', { max: 20 });
    if (!STATUSES.includes(status)) throw new HttpError(422, `status must be one of: ${STATUSES.join(', ')}`);

    const found = await withTransaction(async (client) => {
      const cur = await client.query('SELECT status FROM issues WHERE id = $1 FOR UPDATE', [id]);
      if (!cur.rows[0]) return false;
      const from = cur.rows[0].status;
      if (from !== status) {
        await client.query(
          `UPDATE issues
             SET status = $2, updated_at = now(),
                 resolved_at = CASE WHEN $2 = 'Resolved' THEN now() ELSE NULL END
           WHERE id = $1`,
          [id, status],
        );
        await client.query(
          'INSERT INTO issue_events (issue_id, actor_id, from_status, to_status) VALUES ($1,$2,$3,$4)',
          [id, req.user.id, from, status],
        );
      }
      return true;
    });
    if (!found) throw new HttpError(404, 'Issue not found');

    const { rows } = await query(`${ISSUE_SELECT} WHERE i.id = $1`, [id]);
    res.json({ issue: toAdminIssue(rows[0]) });
  }),
);

// Reply to a complaint (visible to the student on tracking). Optionally changes status in the same step.
router.post(
  '/issues/:id/responses',
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    const message = text(req.body?.message, 'message', { max: 1000 });
    const status = req.body?.status;
    if (status !== undefined && status !== null && status !== '' && !STATUSES.includes(status)) {
      throw new HttpError(422, `status must be one of: ${STATUSES.join(', ')}`);
    }

    const found = await withTransaction(async (client) => {
      const cur = await client.query('SELECT status FROM issues WHERE id = $1 FOR UPDATE', [id]);
      if (!cur.rows[0]) return false;
      await client.query('INSERT INTO issue_responses (issue_id, admin_id, message) VALUES ($1,$2,$3)', [
        id,
        req.user.id,
        message,
      ]);
      const from = cur.rows[0].status;
      if (status && status !== from) {
        await client.query(
          `UPDATE issues SET status = $2, updated_at = now(),
                  resolved_at = CASE WHEN $2 = 'Resolved' THEN now() ELSE NULL END
           WHERE id = $1`,
          [id, status],
        );
        await client.query(
          'INSERT INTO issue_events (issue_id, actor_id, from_status, to_status) VALUES ($1,$2,$3,$4)',
          [id, req.user.id, from, status],
        );
      } else {
        await client.query('UPDATE issues SET updated_at = now() WHERE id = $1', [id]);
      }
      return true;
    });
    if (!found) throw new HttpError(404, 'Issue not found');

    const { rows } = await query(`${ISSUE_SELECT} WHERE i.id = $1`, [id]);
    const responses = await query(
      `SELECT r.id, r.message, r.created_at, a.name AS admin_name
       FROM issue_responses r LEFT JOIN users a ON a.id = r.admin_id
       WHERE r.issue_id = $1 ORDER BY r.created_at, r.id`,
      [id],
    );
    res.status(201).json({ issue: toAdminIssue(rows[0]), responses: responses.rows });
  }),
);

// Dashboard aggregates.
router.get(
  '/stats',
  ah(async (_req, res) => {
    const group = (col) =>
      query(`SELECT ${col} AS key, count(*)::int AS count FROM issues GROUP BY ${col} ORDER BY count DESC, key`);

    const [totals, byCategory, byPriority, byStatus, byDepartment, recent] = await Promise.all([
      query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE status = 'Open')::int AS open,
                count(*) FILTER (WHERE status = 'In Progress')::int AS in_progress,
                count(*) FILTER (WHERE status = 'Resolved')::int AS resolved,
                count(*) FILTER (WHERE priority = 'HIGH' AND status <> 'Resolved')::int AS active_high_priority,
                count(*) FILTER (WHERE priority = 'HIGH')::int AS high_priority
         FROM issues`,
      ),
      group('category'),
      group('priority'),
      group('status'),
      group('assigned_to'),
      query(`${ISSUE_SELECT} ORDER BY i.created_at DESC, i.id DESC LIMIT 5`),
    ]);

    const fill = (rows, keys) => keys.map((k) => ({ key: k, count: rows.find((r) => r.key === k)?.count ?? 0 }));

    res.json({
      totals: totals.rows[0],
      by_category: byCategory.rows.map((r) => ({ ...r, label: categoryNames[r.key] ?? r.key })),
      by_priority: fill(byPriority.rows, PRIORITIES),
      by_status: fill(byStatus.rows, STATUSES),
      by_department: byDepartment.rows.map((r) => ({ name: r.key, count: r.count })),
      recent: recent.rows.map(toAdminIssue),
    });
  }),
);

// Internal routing map (admin only, hidden from students).
router.get('/routing', (_req, res) => {
  res.json({
    items: Object.entries(routes)
      .filter(([k]) => k !== 'UNKNOWN')
      .map(([key, team]) => ({ category: key, label: categoryNames[key], team })),
  });
});

export default router;
