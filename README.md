# Child Development Platform

A web-based decision support platform where parents, specialists and children
share one schedule, task list and record of observations, with an AI summary
for each role that supports decisions but never makes them.

**Current version: v0.0 (walking skeleton).** It shows a list of tasks that is
read from a SQLite database, through an Express API, into a React page.

## Tech stack
- Frontend: React (Vite)
- Backend: Node.js + Express
- Database: SQLite (`sqlite3`)

## Requirements
- Node.js (developed with v26) and npm

## How to run

### 1. Backend
```
cd backend
npm install
node seed.js
node server.js
```
`seed.js` creates `database.sqlite` with sample (synthetic) tasks. The API
runs on http://localhost:5000, and you can check it at
http://localhost:5000/api/tasks.

### 2. Frontend (in a second terminal)
```
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. You should see the heading "Task Manager" and
three tasks. The frontend forwards requests starting with `/api` to the
backend, so the backend must be running.

## Project structure
```
backend/     Express API, seed script, SQLite database file (created by seed.js)
frontend/    React (Vite) app
docs/        PMP, SRS and SDD
```

## Troubleshooting
- On Windows PowerShell, if `npm` is blocked by "running scripts is disabled",
  run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`
  or use Command Prompt.
- If the page is empty, check that the backend is running and `node seed.js`
  was run at least once.