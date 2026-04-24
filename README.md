# InternX — AI-Powered Virtual Internship Simulator

A full-stack platform that simulates real corporate internship experiences for students using AI mentorship, GitHub integration, and role-based workflows.

## Tech Stack (100% Free)

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 14 (App Router) | SSR, free on Vercel |
| Backend | FastAPI (Python) | Async, fast, great for AI |
| Database | Supabase (PostgreSQL) | Free tier, auth included |
| AI | Google Gemini 1.5 Flash | 1M tokens/day free |
| Storage | Supabase Storage | 1GB free |
| Email | Resend | 3000 emails/month free |
| CI/CD | GitHub Actions | 2000 min/month free |
| Hosting | Vercel (FE) + local/Render (BE) | Free |

## Project Structure

```
internx/
├── frontend/          # Next.js 14 app
│   ├── app/           # App Router pages & API routes
│   ├── components/    # Reusable UI components
│   ├── lib/           # Utilities, API clients, helpers
│   ├── hooks/         # Custom React hooks
│   └── types/         # TypeScript type definitions
│
├── backend/           # FastAPI Python app
│   └── app/
│       ├── routers/   # API route handlers
│       ├── models/    # Database models
│       ├── schemas/   # Pydantic schemas (request/response)
│       ├── services/  # Business logic (AI, GitHub, email)
│       └── core/      # Config, database, auth middleware
│
└── docs/              # Architecture docs
```

## Modules

1. **Auth & Role Engine** — Login, GitHub OAuth, intern/mentor/admin roles
2. **Task & Sprint Engine** — Role-based task assignment, deadlines, state machine
3. **AI Mentor Agent** — Gemini-powered mentorship, streamed feedback
4. **Code Review Pipeline** — GitHub PR analysis, automated inline comments
5. **Portfolio Generator** — Auto README, PDF certificate, public profile
6. **Dashboard & Analytics** — Skill radar, leaderboard, admin panel

## Quick Start

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

## Environment Variables

See `frontend/.env.example` and `backend/.env.example` for all required variables.
