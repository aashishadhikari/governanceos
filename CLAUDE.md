# GovernanceOS — Claude Code Guide

This file tells Claude how to work with this project. When a user asks to set up,
run, or develop GovernanceOS, follow the instructions below.

---

## What this project is

GovernanceOS is an open-source corporate entity governance platform built with
Next.js 16, TypeScript, PostgreSQL, and Prisma 7. It manages legal entities,
directors, board meetings, regulatory compliance, licenses, and capital
requirements across a global portfolio.

---

## Key commands

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server at http://localhost:3002 |
| `npm run db:migrate` | Apply all Prisma migrations to the database |
| `npm run db:seed` | Seed demo data (Acme entities, directors, meetings, licenses) |
| `npm run db:studio` | Open Prisma Studio to browse the database |
| `npx prisma generate` | Regenerate the Prisma client after schema changes |
| `npx prisma migrate dev --name <name>` | Create and apply a new migration |
| `npx prisma migrate reset` | Drop DB, re-migrate, and re-seed (destructive) |

---

## First-time setup

When a user asks to set up or install this project, run these steps in order:

```bash
# 1. Install dependencies
npm install

# 2. Create the .env file
cp .env.example .env
```

Then ask the user for their PostgreSQL connection string and write it to `.env`:
```
DATABASE_URL="postgresql://user:password@host:5432/governanceos"
```

For a quick local database, suggest [Supabase](https://supabase.com) (free tier,
no local install needed). The connection string is on the Supabase dashboard under
Settings → Database → Connection string (URI mode).

```bash
# 3. Run migrations to create all tables
npm run db:migrate

# 4. Seed demo data
npm run db:seed

# 5. Start the dev server
npm run dev
```

The app runs at **http://localhost:3002**. Authentication is disabled by default —
the user is auto-signed in as super_admin.

---

## Project structure

```
app/                    # Next.js App Router pages and API routes
  dashboard/            # KPI dashboard
  entities/             # Entity registry + detail pages
    [id]/tor/           # Terms of Reference generator
  directors/            # Director registry
  board-meetings/       # Meeting management
  compliance/           # Compliance obligations tracker
  licenses/             # License registry
  capital/              # Regulatory capital
  alerts/               # Alert centre
  org-chart/            # Interactive corporate structure chart
  calendar/             # Key dates calendar
  api/                  # REST API handlers

components/             # Shared React components
lib/
  db/                   # Prisma queries and schema types
  tor/                  # Terms of Reference jurisdiction templates
  prisma.ts             # Prisma singleton
  audit.ts              # Audit log helper
prisma/
  schema.prisma         # 14 models, 10 enums
  seed.ts               # Demo data seed script
  data/seed-data.json   # Seed data source (Acme demo entities)
  migrations/           # SQL migration history
```

---

## Database schema

14 models: `Entity`, `Director`, `BoardMeeting`, `MeetingAttendee`,
`MeetingDocument`, `MeetingResolution`, `ComplianceObligation`, `License`,
`RegulatoryCapital`, `BankAccount`, `Alert`, `Document`, `AuditLog`, `User`

Key relationships:
- `Entity` is self-referential (parent/subsidiary tree via `parentEntityId`)
- `Director`, `License`, `BoardMeeting`, `ComplianceObligation` all belong to `Entity`
- `isLegacyEntity` flag marks legacy acquired entities

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `AUTH_ENABLED` | No | Set `true` to enable Okta SSO (default: `false`) |
| `ANTHROPIC_API_KEY` | No | For Terms of Reference Stage 2 AI analysis |
| `SLACK_WEBHOOK_URL` | No | Slack webhook for compliance alerts |
| `JIRA_BASE_URL` | No | e.g. `https://your-org.atlassian.net` |
| `JIRA_EMAIL` | No | Jira service account email |
| `JIRA_API_TOKEN` | No | Jira API token |
| `JIRA_PROJECT_KEY` | No | Jira project key |
| `NEXT_PUBLIC_JIRA_BASE_URL` | No | Jira base URL for frontend links |

---

## Common tasks

**Add a new entity** — use the "+ Add Entity" button in the UI, or insert directly
via Prisma Studio (`npm run db:studio`).

**Generate a Terms of Reference document** — navigate to any entity → click
"Terms of Reference". Stage 1 works without an API key. Stage 2 (AI clause
extraction) requires `ANTHROPIC_API_KEY` in `.env`.

**Connect Jira** — set all four `JIRA_*` variables in `.env`, then configure a
Jira automation to POST to `/api/webhooks/jira`. Edit `lib/jiraEntityMap.ts` to
map your Jira entity name patterns to GovernanceOS entity IDs.

**Connect Slack** — set `SLACK_WEBHOOK_URL` in `.env`. Compliance alerts will be
posted automatically when obligations become overdue.

**After any schema change** — always run `npx prisma generate` to update the
TypeScript client, then `npx prisma migrate dev --name <description>` to apply
it to the database.

---

## Troubleshooting

**"localhost refused to connect"** — the dev server is not running. Run `npm run dev`.

**Stale build / Runtime Error about build-manifest.json** — delete the `.next`
folder and restart: `rm -rf .next && npm run dev`.

**PrismaClientKnownRequestError: column does not exist** — the Prisma client is
out of sync with the schema. Run `npx prisma generate`, then restart the dev server.
