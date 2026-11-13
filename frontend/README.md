# RNSIT Smart Campus — React Frontend

A frontend-only React + Vite prototype based on the supplied Streamlit MVP. It has two separate interactive portals selected from the welcome screen.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173).

## Demo portals

### Student Portal
- Student home page with personal request counts and recent requests.
- Ask the campus AI assistant (rule-based demo responses).
- Submit a campus issue with demo category, location and priority assessment.
- View only issues associated with the student's demo email.
- View general campus information.

### Admin Portal
- Campus-wide overview and recent issue activity.
- View all submitted issues, including reporter name and email.
- Search and filter issues by status and priority.
- Open issue details and update workflow status (Open, In Progress, Resolved).
- View campus-wide charts and issue analytics.
- View the suggested department-routing map.

## Student visibility boundaries

Students can see their own submitted reports, report a new issue, use the assistant and view general campus service information. They do **not** see other students' reports, reporter details, the campus-wide analytics dashboard, admin issue-management controls or the internal suggested routing map.

Administrators can view all reports and reporter details, update issue statuses and see aggregate analytics.

## Demo behavior and limitations

- This ZIP contains only the frontend. No backend, API, database server or real authentication is included.
- Demo issues are stored in browser `localStorage`; the selected demo role is stored in `sessionStorage`.
- The role chooser is for UI demonstration only. It is not a security boundary. A production system must enforce authentication, ownership checks and role-based authorization on the backend/API.
- The AI assistant and issue classification are demo client-side logic, not a live AI service.
- Use the demo student email `student@rnsit.edu.in` to see sample student reports. The student name and email can be changed on the role-selection screen.
- Admin demo access is available through the Admin Portal card.

## Stack
- React 18
- Vite
- JavaScript
- CSS
- Recharts
- Lucide React

## Separate portal development servers

- Student portal: `npm run dev` (http://localhost:5173)
- Administrator portal: `npm run dev:admin` (http://localhost:5174/admin.html)

The administrator portal uses the backend's role-restricted `POST /api/admin/auth/login` endpoint and loads issues from `GET /api/admin/issues`. Configure `VITE_API_URL` if the API is hosted somewhere other than `http://localhost:4000/api`.


## Portal URLs
- Student portal: `http://localhost:5173` (opens the student dashboard directly and creates a persistent browser session).
- Admin portal: `http://localhost:5174/admin.html` (separate application and admin-only login).
- Student complaints are stored in PostgreSQL through the backend. After submission, use the generated complaint number in **Track Complaint**.
