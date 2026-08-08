# 📝 WorkLog — Modern Minimalist Daily Work Journal

A sleek, modern, distraction-free application to log daily work, track tasks and hours, maintain productive streaks, and automatically generate daily standup reports. Built with **React**, **Node.js/Express**, **PostgreSQL**, and containerized with **Docker Compose**.

---

## ✨ Features

- 🔒 **Secure Authentication**: User sign up, login, session validation via HTTP-only JWT cookies and password hashing with `bcryptjs`.
- ⚡ **Minimalist Quick-Log**: Instant 1-line work entry bar with keyboard shortcut (`Enter`), duration steppers (`15m`, `30m`, `1h`, `2h`), and tag auto-select.
- 📋 **Rich Markdown Notes & Interactive Tasks**: Markdown editor with live preview, header formatting, code blocks, and interactive `- [ ]` checklist checkboxes that persist real-time on click.
- 📅 **Chronological Timeline**: Grouped daily logs (Today, Yesterday, This Week) with status badges (`Done`, `In Progress`, `Blocked`), duration badges, and custom color tags.
- 🔥 **Productivity Stats & Streaks**: Consecutive day logging streak counter, daily hours vs. target goal progress meter, week summaries, and 7-day activity sparklines.
- 🚀 **One-Click Standup Generator**: Aggregates yesterday's work, today's focus, and blockers formatted for Slack / Teams / Email with 1-click clipboard copy.
- 📥 **Universal Data Export**: Export complete work logs to **Markdown (`.md`)**, **Spreadsheet (`.csv`)**, or **JSON (`.json`)**.
- 🌓 **Theme Switcher**: Fluid dark & light theme modes with system preference sync and persistent local storage.
- 🐘 **PostgreSQL Database**: Relational schema with users, logs, tags, and relational associations with automatic startup migrations.
- 🐳 **Docker Compose Ready**: 1-command startup with PostgreSQL 16 container, persistent volume data, and healthcheck orchestration.

---

## 🚀 Quick Start with Docker Compose

Ensure Docker is installed and running, then execute:

```bash
docker compose up --build -d
```

Open your browser at **`http://localhost:3000`** to start logging work!

To stop containers:
```bash
docker compose down
```

---

## 🛠️ Local Development Setup

### Prerequisites
- Node.js (v18+)
- PostgreSQL database running locally (or via Docker: `docker run --name worklog_pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=worklog -p 5432:5432 -d postgres:16-alpine`)

### Installation & Run

1. **Install Dependencies**:
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

2. **Start Dev Server** (Frontend + Backend concurrently):
   ```bash
   npm run dev
   ```
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:3000`

3. **Build for Production**:
   ```bash
   npm run build
   npm start
   ```

---

## 📂 Project Architecture

```
workLog/
├── docker-compose.yml          # PostgreSQL 16 + Node.js services
├── Dockerfile                  # Multi-stage production container build
├── .env.example                # Configuration template
├── package.json                # Root scripts and server dependencies
├── tsconfig.json               # Backend TypeScript config
├── server/
│   ├── index.ts                # Express server and static SPA fallback
│   ├── config.ts               # Environment variables
│   ├── db/
│   │   ├── index.ts            # PostgreSQL connection pool & helpers
│   │   └── schema.sql          # Relational SQL schema DDL
│   ├── middleware/
│   │   ├── auth.ts             # JWT auth verification & session extraction
│   │   └── errorHandler.ts     # Centralized error handler
│   └── routes/
│       ├── auth.ts             # Sign up, Login, Logout, Profile
│       ├── logs.ts             # Log CRUD, Standup generator, Export
│       ├── tags.ts             # Tag management
│       └── stats.ts            # Streaks, hours tracked, 7-day sparklines
└── client/
    ├── vite.config.ts          # Vite configuration with API proxy
    ├── index.html              # HTML shell
    └── src/
        ├── index.css           # Modern minimalist CSS design system
        ├── main.tsx            # App bootstrapping
        ├── App.tsx             # Main view and layout orchestrator
        ├── context/
        │   ├── AuthContext.tsx # Authentication session state
        │   └── ThemeContext.tsx# Dark/Light theme state
        ├── components/
        │   ├── Navbar.tsx      # Header, streaks, goal meter, theme toggle
        │   ├── QuickLogBar.tsx # Instant 1-line work entry
        │   ├── LogCard.tsx     # Work log card with markdown & checklists
        │   ├── LogModal.tsx    # Detailed markdown editor & tag manager
        │   ├── FilterBar.tsx   # Search, date presets, and tag filters
        │   ├── StatsOverview.tsx# Productivity metrics & 7-day activity
        │   ├── StandupModal.tsx# AI/Standup report generator
        │   ├── ExportModal.tsx # Markdown, CSV, JSON exporter
        │   ├── AuthModal.tsx   # Sign In / Sign Up modal
        │   └── ProfileModal.tsx# Daily goal & user settings modal
        ├── types/
        │   └── index.ts        # TypeScript interfaces
        └── utils/
            └── api.ts          # Fetch wrapper with cookie credentials
```

---

## 📡 API Endpoints Summary

### Authentication
- `POST /api/auth/register` — Register a new account
- `POST /api/auth/login` — Sign in and receive HTTP-only JWT cookie
- `POST /api/auth/logout` — Clear session cookie
- `GET /api/auth/me` — Get current logged-in user profile
- `PUT /api/auth/profile` — Update name, theme preference, or daily goal hours

### Work Logs
- `GET /api/logs` — List logs with search, date range, tag, and status filters
- `GET /api/logs/:id` — Get single log with tags
- `POST /api/logs` — Create new work log
- `PUT /api/logs/:id` — Update log content, tags, duration, status
- `PATCH /api/logs/:id/status` — Quick toggle status (`done`, `in_progress`, `blocked`)
- `DELETE /api/logs/:id` — Delete log
- `POST /api/logs/standup/generate` — Generate structured daily standup report
- `GET /api/logs/export/:format` — Export logs as `markdown`, `csv`, or `json`

### Tags & Statistics
- `GET /api/tags` — List user tags with log counts
- `POST /api/tags` — Create or update custom tag
- `DELETE /api/tags/:id` — Delete tag
- `GET /api/stats` — Streak counter, today/week hours, 7-day sparkline
