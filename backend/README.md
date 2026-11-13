# RNSIT Smart Campus — Backend

Node.js + Express REST API with a **Neon (PostgreSQL)** database. It serves two fully separate sides:

| Side | Sign-in | Endpoints | Token role |
|------|---------|-----------|-----------|
| **Student portal** | `POST /api/auth/login` (+ `/register`) | `/api/auth/*`, `/api/issues/*` | `student` |
| **Admin portal** | `POST /api/admin/auth/login` | `/api/admin/*` | `admin` |

Student tokens cannot call admin endpoints (403) and admin accounts cannot sign in through the student login. Admins cannot be created through public registration — only via `npm run db:migrate`. Students only ever see their own issues, and never see reporter details.

## Setup

1. Create a Neon project, then copy the connection string (keep `?sslmode=require`).
2. `cp .env.example .env` and fill in `DATABASE_URL`, `JWT_SECRET` (32+ chars), `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
3. Install and migrate:
   ```bash
   npm install
   npm run db:migrate        # tables + admin account (re-run any time; also resets the admin password to .env)
   npm run db:seed-demo      # optional: demo students + the 6 sample issues (needs DEMO_PASSWORD)
   npm run dev               # http://localhost:4000
   ```
4. `npm test` runs the classifier/assistant unit tests (no database needed).

## API

All bodies are JSON. Authenticated calls send `Authorization: Bearer <token>`. Errors look like `{ "error": "message" }`.

### Student
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | `{name,email,password}` → `{token,user}` (role always student) |
| POST | `/api/auth/login` | `{email,password}` → `{token,user}` |
| GET | `/api/auth/me` | current student |
| POST | `/api/issues/preview` | `{description,severity,impact}` → live assessment (category, location, urgency, score, priority, assigned_to, can_submit); nothing saved |
| POST | `/api/issues` | same body → `{issue}`; category/priority/routing computed on the server; 422 if category can't be detected |
| GET | `/api/issues` | **own** issues only → `{items}` |
| GET | `/api/issues/summary` | own counts `{total,open,in_progress,resolved}` |
| GET | `/api/issues/:id` | own issue (404 if not yours) |

### Shared (any signed-in user)
`POST /api/assistant {message}` → `{answer, analysis}` · `GET /api/assistant/greeting` · `GET /api/campus-info` · `GET /api/health` (public)

### Admin
| Method | Path | Notes |
|---|---|---|
| POST | `/api/admin/auth/login` | `{email,password}` |
| GET | `/api/admin/issues` | `?status=&priority=&q=&limit=&offset=` → `{items,total}` incl. reporter name/email |
| GET | `/api/admin/issues/:id` | issue + status history |
| PATCH | `/api/admin/issues/:id/status` | `{status: "Open" | "In Progress" | "Resolved"}`, audit-logged |
| GET | `/api/admin/stats` | totals + by_category / by_priority / by_status / by_department / recent |
| GET | `/api/admin/routing` | category → team map (hidden from students) |

Issue objects use the same field names as the prototype (`id, description, category, priority, score, location, assigned_to, status, severity, impact, urgency, reporter_name, reporter_email`). `created_at` is ISO-8601; `created_at_label` is the display string (e.g. `13 Nov 2026, 10:42 AM`, IST).

## Wiring the existing frontend (small change when you're ready)

The prototype still uses `localStorage` and a demo role picker. To connect it:
- Student app: replace the role gate with email/password login → store the token, call `/api/issues`, `/api/assistant`, etc. It should open straight into the student portal.
- Admin app: a separate entry/page (e.g. `/admin`) that logs in via `/api/admin/auth/login` and uses `/api/admin/*`.
- Set `CORS_ORIGINS` to wherever each frontend is hosted.

## Deployment notes
- Set `NODE_ENV=production`, and `TRUST_PROXY=true` if behind a reverse proxy/PaaS (so rate limiting sees real IPs).
- Login/register are rate-limited (30 per 15 min per IP). Passwords are bcrypt-hashed; JWTs expire after 8h (`JWT_EXPIRES_IN`).
- Optional `STUDENT_EMAIL_DOMAIN=rnsit.edu.in` restricts student sign-ups to college emails.

## Layout
```
sql/schema.sql        users, issues, issue_events
src/app.js            middleware + route mounting
src/routes/           auth.js (student), student.js, admin.js, common.js
src/services/         classifier.js (category/location/priority/routing), assistant.js, issues.js
src/migrate.js        schema + admin + optional demo seed
test/                 unit tests
```

### Frontend CORS origins

For local development, allow both separate portal origins in `CORS_ORIGINS`:
`http://localhost:5173,http://localhost:5174`
The administrator frontend signs in through `POST /api/admin/auth/login` and sends its JWT to protected `/api/admin/*` routes.
