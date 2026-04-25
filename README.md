# SMB Flow

A deployable MVP SaaS platform for small business management. Unifies client management, employee tracking, Kanban project boards, time tracking, contract e-signatures, billing/invoicing, team messaging, and AI-powered MCP automation.

## Architecture

```
smb_saas/
├── apps/
│   ├── web/                 # Next.js 14+ fullstack app
│   └── mcp/                 # Python FastAPI MCP automation server
├── packages/
│   └── db/                  # Prisma schema + PostgreSQL
├── docker-compose.yml
└── README.md
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14+ App Router |
| Language | TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma 5+ |
| Auth | Auth.js (NextAuth v5) |
| API | tRPC v11 |
| Real-time | Socket.io (ready) |
| Styling | Tailwind CSS |
| MCP Server | Python 3.12, FastAPI, Playwright, mlx-lm |

## Features

- **Business Auth** — Organization-based signup/login with Google OAuth + credentials
- **Client Management** — CRUD for contacts with email, phone, company, notes
- **Employee Management** — Admin can invite, manage roles, view workload
- **Kanban Boards** — Drag-and-drop project management with task assignments
- **Time Tracking** — Start/stop timer + manual entries with billable flags
- **Contracts** — Rich-text contracts with e-signature capture
- **Invoicing** — Line-item invoices with status tracking
- **Messaging** — Real-time team conversations
- **AI Automation** — MCP server uses local LLM + Playwright to create tasks from natural language

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm 9+
- Python 3.12+
- PostgreSQL 16 (or use Docker)

### 1. Clone & Install

```bash
git clone https://github.com/akashatnitr/smb_hackathon_saas.git
cd smb_hackathon_saas
pnpm install
```

### 2. Database

```bash
# Using Docker
docker-compose up -d

# Or use local PostgreSQL
# Create database: smb_saas
# Create user: smbuser / smbpass
```

### 3. Environment

```bash
cp apps/web/.env.local apps/web/.env.local
cp apps/mcp/.env apps/mcp/.env
# Edit both files with your settings
```

### 4. Database Setup

```bash
cd packages/db
npx prisma migrate dev --name init
npx prisma db seed
```

### 5. Run Web App

```bash
cd apps/web
pnpm dev
# Open http://localhost:3000
```

Demo login:
- Admin: `admin@acme.com` / `admin123`
- Employee: `employee@acme.com` / `employee123`

### 6. Run MCP Automation Server

```bash
cd apps/mcp
./start.sh
# Or: source .venv/bin/activate && python main.py
```

The AI assistant widget appears in the bottom-right of the dashboard. Type things like:
- "Plan me an event"
- "Build a website for a client"
- "Launch a new product"

## MCP Automation

The MCP server (`apps/mcp`) connects to the web app via Playwright browser automation and exposes:

- **Natural Language Planning** — Breaks down requests into Kanban tasks
- **Auto-Assignment** — Matches tasks to employees by role
- **Board Creation** — Automatically creates new project boards

It attempts to load a local MLX model (Gemma-4) and falls back to rule-based planning if the model isn't available.

## Deployment

### Docker

```bash
docker-compose -f docker-compose.yml up --build
```

### Production Notes

- Change `NEXTAUTH_SECRET` to a strong random value
- Set up a real SMTP/Resend API key for emails
- Configure Google OAuth credentials
- Use a reverse proxy (nginx/caddy) for SSL

## GitHub Issues

All work is tracked in [GitHub Issues](https://github.com/akashatnitr/smb_hackathon_saas/issues):

1. Project Scaffold & Database
2. Authentication & Authorization
3. Client Management
4. Employee Management & Workload
5. Kanban Project Management
6. Time Tracking
7. Contracts & E-Signatures
8. Billing & Invoicing
9. Messaging & Email
10. Google Suite Integration
11. MCP Automation Server
12. Docker, Deployment & DevEx

## License

MIT
