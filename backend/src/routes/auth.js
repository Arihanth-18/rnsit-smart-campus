import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { config } from '../config.js';
import { HttpError, ah, text } from '../utils.js';
import { signToken, requireAuth, requireRole } from '../middleware/auth.js';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmail(value) {
  const email = text(value, 'email', { max: 254 }).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(422, 'Enter a valid email address');
  return email;
}

function cleanPassword(value) {
  if (typeof value !== 'string' || !value) throw new HttpError(422, 'password is required');
  return value;
}

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

/** Login handler bound to one role: student and admin logins never accept each other's accounts. */
export const loginFor = (role) =>
  ah(async (req, res) => {
    const email = cleanEmail(req.body?.email);
    const password = cleanPassword(req.body?.password);

    const { rows } = await query(
      'SELECT id, name, email, role, password_hash FROM users WHERE email = $1 AND role = $2',
      [email, role],
    );
    const user = rows[0];
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, 'Invalid email or password');

    res.json({ token: signToken(user), user: publicUser(user) });
  });

const router = Router();

// Public student self-registration. Always creates role=student; admins are never created here.
router.post(
  '/register',
  authLimiter,
  ah(async (req, res) => {
    const name = text(req.body?.name, 'name', { max: 100 });
    const email = cleanEmail(req.body?.email);
    const password = cleanPassword(req.body?.password);

    if (password.length < 8) throw new HttpError(422, 'Password must be at least 8 characters');
    if (password.length > 72) throw new HttpError(422, 'Password must be at most 72 characters');
    if (config.studentEmailDomain && !email.endsWith(`@${config.studentEmailDomain}`)) {
      throw new HttpError(422, `Please use your @${config.studentEmailDomain} email address`);
    }

    const hash = await bcrypt.hash(password, 10);
    let user;
    try {
      const { rows } = await query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, 'student') RETURNING id, name, email, role`,
        [name, email, hash],
      );
      user = rows[0];
    } catch (err) {
      if (err.code === '23505') throw new HttpError(409, 'An account with this email already exists');
      throw err;
    }
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  }),
);


// Anonymous student entry: creates a limited student identity and returns a normal JWT session.
// The browser keeps this session so students reach the dashboard without a registration form.
router.post('/guest', authLimiter, ah(async (_req, res) => {
  const { randomUUID, randomBytes } = await import('node:crypto');
  const id = randomUUID();
  const email = `guest-${id}@guest.rnsit.local`;
  const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ('Student', $1, $2, 'student') RETURNING id, name, email, role`,
    [email, passwordHash],
  );
  res.status(201).json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
}));

router.post('/login', authLimiter, loginFor('student'));

router.get('/me', requireAuth, requireRole('student'), (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
