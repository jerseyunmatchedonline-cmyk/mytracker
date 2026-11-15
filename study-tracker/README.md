# Study & Diet Tracker

A modern, local dashboard combining a **Study Tracker & Pomodoro Timer** with a **Diet & Calorie Tracker**.

**Key features:**
- **User authentication** — secure registration/login (bcrypt) with per-user data isolation
- **Study & Pomodoro** — animated timer, configurable intervals, subject CRUD, session logging
- **Diet & Calorie** — food logging with Open Food Facts auto-lookup, macro summaries, daily goals

---

## Architecture

The app auto-selects its database backend:

| Environment | Database | Persistence |
|---|---|---|
| Local (no `DATABASE_URL`) | SQLite (`data/app.db`) | Local disk |
| Cloud (Railway/Render free) | PostgreSQL | Cloud-hosted (free tier) |

The file `db.js` is a dispatcher: it requires `sqlite.js` locally or `pg.js` when `DATABASE_URL` is set.

---

## Local Setup

```bash
npm install
npm start
```
Then open http://localhost:3000

---

## Free Cloud Hosting (Railway / Render)

Both platforms offer a **free Postgres database** (5GB) that survives restarts — unlike their paid-only persistent disks. This app is wired to use it automatically.

### Railway
1. Sign up at [railway.app](https://railway.app) with GitHub.
2. **New Project** → **Deploy from GitHub repo** → select this repo.
3. In the service settings, add a **Postgres database** (free).
4. Go to **Variables** and set `DATABASE_URL` to the Postgres connection string (Railway auto-populates it if you add the Postgres service).
5. Set `SESSION_SECRET` to a random long string.
6. Deploy. Railway gives you a public URL like `https://study-tracker.up.railway.app`.

### Render
1. Sign up at [render.com](https://render.com) with GitHub.
2. **New Web Service** → connect this repo.
3. Under **Database**, add a **PostgreSQL** database (free, 1GB).
4. In **Environment Variables**, set `DATABASE_URL` to the Postgres connection string and `SESSION_SECRET`.
5. Deploy.

> Note: PostgreSQL connection strings on these platforms often require SSL. The adapter sets `ssl: { rejectUnauthorized: false }` by default. Set `PG_SSL=false` to disable if needed.

### Access from another device
Once deployed, open the public URL on your phone or your girlfriend's phone. Each person creates their own account — study sessions, diet logs, and subjects are isolated per user.

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (enables cloud mode) |
| `SESSION_SECRET` | Secret key for session signing (set to a random string) |
| `PORT` | Port to listen on (defaults to 3000) |