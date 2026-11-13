import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';
import { HttpError, ah } from '../utils.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    algorithm: 'HS256',
  });
}

/** Verifies the bearer token and loads the user fresh from the database. */
export const requireAuth = ah(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }

  const { rows } = await query('SELECT id, name, email, role FROM users WHERE id = $1', [payload.sub]);
  const user = rows[0];
  // Role comes from the DB, and must still match what the token was issued for.
  if (!user || user.role !== payload.role) throw new HttpError(401, 'Invalid or expired token');

  req.user = user;
  next();
});

/** Must run after requireAuth. Student and admin APIs are strictly separate. */
export const requireRole = (role) => (req, _res, next) => {
  if (req.user?.role !== role) return next(new HttpError(403, 'You do not have access to this resource'));
  next();
};
