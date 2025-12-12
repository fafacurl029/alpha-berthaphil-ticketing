# Alpha berthaphil — IT Ticketing System (Shared, Team-Based)

This is a deployable, shared ticketing system for a BPO IT team.

## Stack
- Backend: Node.js + Express
- Database: PostgreSQL
- ORM: Prisma
- Auth: JWT + bcrypt
- Frontend: Static HTML/CSS/JS (served by the same Express server)

## Features
- Login (Admin / Staff)
- Shared tickets for all team members
- Create, assign, update status/priority, comments
- Audit activity log per ticket
- Admin user management (create/disable accounts)
- CSV export

---

## 1) Run locally (with Postgres)

### A) Create a Postgres database
Use local Postgres or create a free DB on Supabase/Neon.

### B) Setup env
Copy `.env.example` to `.env` and fill:
- `DATABASE_URL`
- `JWT_SECRET`
- `BOOTSTRAP_TOKEN`

### C) Install and run
```bash
npm install
npx prisma generate
npx prisma db push
npm start
```

Open:
- http://localhost:3000/setup.html (create first admin)
- http://localhost:3000/login.html

---

## 2) Deploy to Render (Web Service + Postgres)

### A) Put this project in GitHub
1. Create a new GitHub repo.
2. Upload all files from this folder.

### B) Create Postgres on Render
- Render Dashboard → **New** → **PostgreSQL**
- Copy the **Internal Database URL** (recommended) or External.

### C) Create Web Service
- Render Dashboard → **New** → **Web Service** → connect your GitHub repo
- Environment: Node
- Build Command:
```bash
npm install && npx prisma generate && npx prisma db push
```
- Start Command:
```bash
npm start
```

### D) Add Environment Variables (Render → Environment)
- `DATABASE_URL` = (Render Postgres URL)
- `JWT_SECRET` = long random string
- `APP_BASE_URL` = your Render service URL (e.g. https://your-app.onrender.com)
- `BOOTSTRAP_TOKEN` = long random string (keep private)

### E) Create first admin
Go to:
- `https://your-app.onrender.com/setup.html`
Enter BOOTSTRAP_TOKEN and create the admin account.

---

## Default roles
- ADMIN: full access (tickets + users)
- STAFF: ticket access only

---

## Notes
- This app uses JWT stored in browser localStorage. Keep it on trusted devices.
- For strict security, enable HTTPS only (Render already does), set stronger password policy, and add MFA if needed.
