import { dateLabel } from '../utils.js';

// Shared SELECT used by both the student and admin APIs.
export const ISSUE_SELECT = `
  SELECT i.id, i.description, i.category, i.priority, i.score::float AS score,
         i.location, i.assigned_to, i.status, i.severity, i.impact, i.urgency,
         i.created_at, i.updated_at, i.resolved_at,
         u.name AS reporter_name, u.email AS reporter_email
  FROM issues i
  JOIN users u ON u.id = i.reporter_id`;

function base(row) {
  return {
    id: row.id,
    description: row.description,
    category: row.category,
    priority: row.priority,
    score: row.score,
    location: row.location,
    assigned_to: row.assigned_to,
    status: row.status,
    severity: row.severity,
    impact: row.impact,
    urgency: row.urgency,
    created_at: row.created_at,
    created_at_label: dateLabel(row.created_at),
    updated_at: row.updated_at,
    resolved_at: row.resolved_at,
  };
}

/** Student view: never exposes reporter identity. */
export const toStudentIssue = base;

/** Admin view: includes who reported it. */
export const toAdminIssue = (row) => ({
  ...base(row),
  reporter_name: row.reporter_name,
  reporter_email: row.reporter_email,
});
