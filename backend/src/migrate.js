// Usage:
//   npm run db:migrate          -> create tables + create/update the admin account
//   npm run db:seed-demo        -> same, plus demo students and the sample issues from the prototype
import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const seedDemo = process.argv.includes('--seed-demo');

async function main() {
  const schema = await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
  console.log('Schema applied.');

  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  if (!adminEmail || adminPassword.length < 8) {
    console.warn('ADMIN_EMAIL / ADMIN_PASSWORD (min 8 chars) not set - skipping admin account.');
  } else {
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'admin')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', name = EXCLUDED.name`,
      [process.env.ADMIN_NAME || 'Campus Administrator', adminEmail, await bcrypt.hash(adminPassword, 10)],
    );
    console.log(`Admin account ready: ${adminEmail}`);
  }

  if (seedDemo) await seedDemoData();
}

async function seedDemoData() {
  const pw = process.env.DEMO_PASSWORD || '';
  if (pw.length < 8) throw new Error('Set DEMO_PASSWORD (min 8 chars) in .env to seed demo users.');
  const hash = await bcrypt.hash(pw, 10);

  const upsertStudent = async (name, email) =>
    (
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'student')
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [name, email, hash],
      )
    ).rows[0].id;

  const demo = await upsertStudent('Demo Student', 'student@rnsit.edu.in');
  const other = await upsertStudent('Other Student', 'other.student@rnsit.edu.in');

  // [id, reporter, description, category, priority, score, location, assigned_to, status, sev, imp, urg, created_at (IST)]
  const rows = [
    [1048, demo, 'Wi-Fi is not working in the library reading area.', 'NETWORK', 'HIGH', 4.35, 'Library', 'Network / IT Support', 'Open', 4, 4, 5, '2026-11-13 10:42:00+05:30'],
    [1047, demo, 'Projector in CSE Room 302 is not displaying anything.', 'IT', 'MEDIUM', 3.15, 'CSE Block, Room 302', 'IT Support', 'In Progress', 3, 3, 3, '2026-11-13 09:18:00+05:30'],
    [1046, other, 'Water leakage near the ECE block washroom.', 'FACILITY', 'HIGH', 4.1, 'ECE Block', 'Facilities / Maintenance', 'Open', 4, 4, 4, '2026-11-12 16:25:00+05:30'],
    [1045, other, 'Classroom fan is making noise in ME 204.', 'ELECTRICAL', 'LOW', 2.1, 'ME Block, Room 204', 'Electrical Maintenance', 'Resolved', 2, 2, 2, '2026-11-12 11:06:00+05:30'],
    [1044, other, 'Need clarification about the examination timetable.', 'EXAMINATION', 'LOW', 1.8, 'Not specified', 'Examination Section', 'Resolved', 1, 2, 2, '2026-11-11 14:30:00+05:30'],
    [1043, other, 'College bus route 4 arrived late today.', 'TRANSPORT', 'MEDIUM', 3.0, 'Main Gate', 'Transport Office', 'In Progress', 3, 3, 3, '2026-11-11 08:12:00+05:30'],
  ];
  for (const r of rows) {
    await pool.query(
      `INSERT INTO issues
         (id, reporter_id, description, category, priority, score, location, assigned_to, status,
          severity, impact, urgency, created_at, updated_at, resolved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13, CASE WHEN $9 = 'Resolved' THEN $13::timestamptz END)
       ON CONFLICT (id) DO NOTHING`,
      r,
    );
  }
  console.log('Demo data seeded (student@rnsit.edu.in, other.student@rnsit.edu.in).');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
