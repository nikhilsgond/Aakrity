# collab-draw-v2

Collaborative drawing app with React + Vite frontend and Socket.IO server.

## Run

```bash
cd frontend && npm install && npm run dev
cd backend && npm install && node index.js
```

Frontend: `http://localhost:5173`  
Server: `http://localhost:3001`

## Architecture

- Frontend: Vite app for Vercel
- Backend API + Socket.IO: Express server for Render
- Auth / DB / storage: Supabase

## Setup Docs

- SQL schema: `backend/supabase/schema.sql`
- Local + deployment setup: `backend/docs/deployment.md`

## Structure

- `frontend/src/app`: app router and app-level state.
- `frontend/src/features`: feature-first modules (`canvas`, `room`, `home`, `dashboard`).
- `frontend/src/shared`: frontend-only shared UI/utilities.
- `frontend/shared`: pure frontend-safe copied utilities used for deployment isolation.
- `backend/lib`: Express + Socket.IO backend internals.
- `backend/shared`: pure backend-safe copied utilities used for deployment isolation.

See `backend/docs/architecture.md` for folder ownership rules.
