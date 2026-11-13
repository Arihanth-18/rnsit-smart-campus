export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Wrap async route handlers so rejections reach the error middleware (Express 4). */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const dateFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

/** "13 Nov 2026, 10:42 AM" (IST) — same style the UI used. */
export const dateLabel = (d) =>
  dateFmt.format(new Date(d)).replace(/\b(am|pm)\b/, (m) => m.toUpperCase());

export function parseId(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 2_147_483_647) throw new HttpError(400, 'Invalid id');
  return n;
}

/** Integer 1-5 with a default; rejects anything else. */
export function rating(value, field, fallback = 3) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new HttpError(422, `${field} must be an integer from 1 to 5`);
  }
  return n;
}

export function text(value, field, { max = 2000, required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(422, `${field} is required`);
    return '';
  }
  if (typeof value !== 'string') throw new HttpError(422, `${field} must be a string`);
  const v = value.trim();
  if (required && !v) throw new HttpError(422, `${field} is required`);
  if (v.length > max) throw new HttpError(422, `${field} must be at most ${max} characters`);
  return v;
}
