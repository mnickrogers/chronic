# Chronic (Developer Preview)

A minimal vertical slice of the Chronic app described in `chronic_prd.md` and `chronic_engineering_spec.md`.

What’s implemented:
- FastAPI backend with SQLite (dev) and JWT cookie auth
- Orgs (personal dev org), workspaces, projects with default statuses
- Tasks with status/priority, list and board views
- WebSocket realtime updates for project task events
- Keyboard: Command-K command palette (new task + view switch), L/B to switch views

## Run locally

Backend (Postgres + Alembic)
```
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
export DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/chronic
# Create DB if needed: createdb chronic (or `psql -c 'CREATE DATABASE chronic;'`)
# Run migrations
alembic -c backend/alembic.ini upgrade head

uvicorn backend.app:app --reload --port 8000
```

Frontend
```
cd frontend
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000, sign up, create a workspace, then a project, add tasks, and try opening a second browser window to see realtime updates.

Notes
- This dev build uses SQLite and an in‑memory WebSocket broadcaster. Swap to Postgres/Redis per the spec for production.
  - Now configured for Postgres; Redis broadcaster is still in‑memory.
- Permissions are simplified to a single personal org; RLS and full roles are omitted in this slice.
- Timeline, dependencies, notifications, and email flows are stubbed for a later pass.

Migrations
- Create a new migration: `alembic -c backend/alembic.ini revision --autogenerate -m "change"`
- Apply: `alembic -c backend/alembic.ini upgrade head`
- Downgrade: `alembic -c backend/alembic.ini downgrade -1`
