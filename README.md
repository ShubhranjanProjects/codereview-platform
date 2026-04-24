# ⚡ CodeReview AI Platform

Full-stack code review analytics platform — React frontend + Node.js/Express backend + Neon PostgreSQL.

---

## Project Structure

```
codereview-platform/
├── backend/
│   ├── src/
│   │   ├── index.js              ← Express server entry
│   │   ├── db.js                 ← PostgreSQL pool (Neon)
│   │   ├── middleware/
│   │   │   ├── auth.js           ← JWT middleware
│   │   │   └── errorHandler.js
│   │   └── routes/
│   │       ├── auth.js           ← POST /api/auth/login, GET /api/auth/me
│   │       ├── employees.js      ← GET /api/employees, GET /api/employees/:id/stats
│   │       ├── reviews.js        ← GET/POST /api/reviews, POST /api/reviews/analyze
│   │       └── analytics.js     ← GET /api/analytics/dashboard
│   ├── seed.js                   ← One-time DB seed script
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx               ← Entire React app (all pages)
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js            ← Proxies /api → backend:4000
│   └── package.json
└── database/
    └── schema.sql                ← Run in Neon SQL editor
```

---

## Quick Setup (Step by Step)

### Step 1 — Neon PostgreSQL

1. Go to [neon.tech](https://neon.tech) → create a free project
2. Open **SQL Editor** → paste and run `database/schema.sql`
3. Copy your **Connection String** (looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)

### Step 2 — Backend .env

```bash
cd backend
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
JWT_SECRET=any-long-random-string-at-least-32-chars
GEMINI_API_KEY=sk-ant-api03-...
GITHUB_TOKEN=ghp_...   # optional (needed for GitHub PR reviews)
PORT=4000
FRONTEND_URL=http://localhost:5173
```

Get your Anthropic key from [console.anthropic.com](https://console.anthropic.com)

### Step 3 — Install dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### Step 4 — Seed the database

```bash
cd backend
node seed.js
```

Output:
```
✓ Sarah Chen (admin)
✓ Marcus Johnson (developer)
...
✓ Marcus Johnson — 6 reviews inserted
✓ Aisha Patel   — 6 reviews inserted
...
✅  Seed complete! employees: 7, code_reviews: 36, review_issues: 72
```

To reseed fresh: `node seed.js --force`

### Step 5 — Run

**Terminal 1 — Backend:**
```bash
cd backend && npm run dev
# Server running on http://localhost:4000
```

**Terminal 2 — Frontend:**
```bash
cd frontend && npm run dev
# App running on http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173)

---

## Demo Login Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@company.com | admin123 | Admin |
| dev@company.com | dev123 | Developer |
| lead@company.com | lead123 | Lead |

---

## How the AI Review Works

When you click **"Run AI Review"** on the New Review page:

```
Browser                    Node.js Backend              Anthropic API
   │                              │                           │
   │  POST /api/reviews/analyze   │                           │
   │  { employee_id, language,    │                           │
   │    code_snippet }            │                           │
   │─────────────────────────────>│                           │
   │                              │  POST /v1/messages        │
   │                              │  x-api-key: (secret)      │
   │                              │  code + system prompt     │
   │                              │──────────────────────────>│
   │                              │                           │
   │                              │  JSON: { severity_score,  │
   │                              │  security_issues, ... }   │
   │                              │<──────────────────────────│
   │                              │                           │
   │                              │  INSERT INTO code_reviews │
   │                              │  INSERT INTO review_issues│
   │                              │  (Neon PostgreSQL)        │
   │                              │                           │
   │  { review, analysis }        │                           │
   │<─────────────────────────────│                           │
```

**Key point:** The `GEMINI_API_KEY` lives only in your `.env` file on the server. It is never sent to or exposed in the browser.

The system prompt instructs Claude to act as a senior engineer and return structured JSON with:
- `severity_score` (1–10)
- `severity_label` (critical/high/medium/low)
- `confidence` (High/Medium/Low)
- `summary` (plain English)
- `security_issues`, `performance_issues`, `code_quality`, `naming_design` (arrays)
- `improved_snippet` (suggested fix)

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Current user from token |
| GET | `/api/employees` | All employees |
| GET | `/api/employees/:id/stats` | Score trend + monthly stats |
| GET | `/api/reviews` | All reviews (filterable) |
| POST | `/api/reviews/analyze` | Run AI review + save to DB |
| POST | `/api/github/pr/analyze` | Run AI review on a GitHub PR + save to DB |
| GET | `/api/analytics/dashboard` | KPIs + language breakdown |

---

## Score Interpretation

| Score | Label | Action |
|-------|-------|--------|
| 1–4 | 🔴 Critical | Do not merge — serious issues |
| 4–6 | 🟠 High | Major refactor needed |
| 6–7.5 | 🟡 Medium | Fix before merge |
| 7.5–10 | 🟢 Low | Minor suggestions only |
