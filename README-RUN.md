# RNSIT Smart Campus — corrected startup package

## Start the backend first

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edit `backend/.env` and set:
- `DATABASE_URL` to your PostgreSQL connection string
- `JWT_SECRET` to a random value of at least 32 characters
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` (password must be at least 8 characters)

Then run:

```powershell
npm run db:migrate
npm run dev
```

The backend must be listening at `http://localhost:4000`. Check `http://localhost:4000/api/health` and expect `{"status":"ok"}`.

## Student portal (port 5173)

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The portal automatically creates/resumes a guest student session and opens the dashboard. There is no student registration prompt.

## Admin portal (port 5174)

In a third terminal:

```powershell
cd frontend
npm run dev:admin
```

Open `http://localhost:5174/admin.html`. This page loads the separate admin login component. Use the credentials provisioned through the backend migration.

## What was corrected in this repair

- Removed React StrictMode from the portal entry points to prevent duplicate guest-session creation during development effect replay.
- Added a React error boundary to both student and admin applications. A rendering exception now shows its actual message instead of an empty/black page.
- Reworked student session bootstrap to validate stored JWTs, renew invalid sessions, validate API responses, and show the actual startup/network error with a Retry button.
- Kept student and admin entry points separate.
- Kept public complaint-number tracking at `GET /api/issues/track/:id`.

## If the portal still cannot connect

1. Verify the backend terminal has no startup error.
2. Verify `/api/health` returns `{"status":"ok"}`.
3. Verify `CORS_ORIGINS` in `backend/.env` includes both `http://localhost:5173` and `http://localhost:5174`.
4. If the browser displays an application error panel, copy the error text and browser Console error; it identifies the failing component or dependency.

The frontend production build and live database integration could not be run in this environment because npm dependency installation timed out. The JSX syntax and backend JavaScript syntax were checked successfully; this is not a claim that the full app has been browser-tested.
