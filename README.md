# Event OS

**The event management platform that Cvent charges $20K/year for, except you can clone it and run it in 5 minutes.**

We run Dev Summit in Mongolia. Every year it's the same story: 47 spreadsheets, 200 Telegram messages, one person who "definitely sent that invoice" (they didn't), and a check-in line that makes people question their life choices.

Cvent wants $20K/year + $10K implementation. Bizzabo won't even show you pricing without a sales call. Sessionize handles CFPs but not payments. Eventbrite handles tickets but not schedules. So you end up with 6 tools duct-taped together and a spreadsheet that is technically load-bearing.

Event OS replaces all of that. One app. Speakers, schedule, sponsors, booths, volunteers, media partners, marketing, check-in — plus post-confirmation checklists, a stakeholder portal, and an in-app notification system. Multi-event support so next year you don't start from zero.

Built by a small team for small teams. If you're running a tech conference with spreadsheets and prayers, this is for you.

## The agent-first difference

Most event tools give you 14 forms and say "type everything in manually." Event OS gives you a chat panel. Paste a Viber conversation, drop a spreadsheet, type "just talked to Golomt Bank, they want Gold sponsorship" — the agent figures out what type of entity it is (speaker? sponsor? venue? volunteer?), extracts structured data, asks about anything missing, and creates the records. You confirm with one click.

**Cmd+K** opens the agent from anywhere.

Supports multiple LLM providers: **Gemini 2.5 Flash** (free tier, default), **xAI**, **z.ai** (ZhipuAI/GLM), **Ollama** (local, free), or add your own by implementing one interface.

## What's in the box

| Module | What it does |
|--------|-------------|
| **Agent Chat Panel** | Paste anything — CSV, chat logs, phone notes. Agent classifies, extracts, creates records. Cmd+K from anywhere. |
| **Speaker Pipeline** | CFP form → review → accept/reject. Pipeline table with inline stage/source/assignee editing. |
| **Sponsor Pipeline** | Outreach to confirmation. Same unified pipeline model as speakers. |
| **Venue Pipeline** | Multiple venue candidates, negotiations, pricing, finalization. |
| **Booth Management** | Inventory, reservations, company contacts, sponsor linking. |
| **Volunteer Management** | Applications, assignments, pipeline tracking. |
| **Media Partners** | TV/press/podcast pipeline with contact management. |
| **Outreach CRM** | Proactive sourcing for all entity types. Follow-up tracking. |
| **Agenda Builder** | Multi-track schedule, conflict detection (speaker double-booked? room collision?), draft/publish toggle. |
| **Marketing Calendar** | Month-view content calendar. Click a day to add an item. Assign to team members. Platform tags (Twitter, Facebook, Instagram, LinkedIn, Telegram). |
| **Task Board** | Kanban drag-and-drop (To Do → In Progress → Blocked → Done). Click cards for detail drawer with inline comments. Create/rename/delete teams. |
| **Invitations** | Speaker +1s, organizer +1s, student passes. Configurable allocations. QR codes. |
| **QR Check-in** | Scanner mode + dashboard mode with live stats. |
| **Post-Confirmation Checklists** | When an entity is confirmed, auto-generate checklist items from templates (upload photo, submit slides, confirm travel). Track progress per entity. Admins configure templates in Settings. |
| **Stakeholder Portal** | Confirmed speakers/sponsors get a login to self-service their checklist items — upload photos, submit bios, confirm travel. Organizers see submissions and approve/reject. |
| **RBAC & Team Management** | 6 roles (owner → admin → organizer → coordinator → viewer → stakeholder). Role-based access control on all API routes. Team management in Settings (invite, role assignment). Team-scoped entity permissions in the backend — UI for configuring which teams own which entity types is planned. |
| **Notifications** | In-app notifications for assignments, stage changes, checklist submissions, comments. Bell icon with unread badge. Mark read, bulk delete. |
| **Settings** | Tabbed: Event details, Team management (invite/roles), Checklist templates (per entity type), Telegram connection (placeholder). |
| **Public Agenda** | Attendee-facing schedule with day/track filters. |
| **CFP Form** | Public speaker application form. |

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 16 (App Router) | Server components, API routes, one deploy target |
| Language | TypeScript | Catch bugs before your users do |
| Styling | Tailwind CSS + shadcn/ui | Fast, accessible components out of the box |
| Database | PostgreSQL | Works with local Postgres, Supabase, Neon, or any PG provider |
| ORM | Drizzle | Type-safe, no magic, SQL when you need it |
| Auth | NextAuth.js (v5) | Credentials + JWT + service token for API |
| Passwords | bcrypt (12 rounds) | Proper key stretching. Legacy SHA-256 auto-detected for migration. |
| Agent LLM | Gemini 2.5 Flash (default), xAI, z.ai, Ollama | Abstracted — add providers with one interface |
| Icons | Lucide React | Consistent, tree-shakeable |

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/amarbayar/event-os.git
cd event-os
npm install
```

### 2. Set up PostgreSQL

**Option A: Local PostgreSQL** (simplest for development)

```bash
# macOS
brew install postgresql@16
brew services start postgresql@16
createdb event_os
```

**Option B: Supabase** (cloud, free tier)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → Database** and copy the connection string

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# Required
DATABASE_URL="postgresql://youruser@localhost:5432/event_os"  # or your Supabase URL
AUTH_SECRET="$(openssl rand -base64 32)"

# Optional — for the agent chat panel
LLM_PROVIDER="gemini"          # gemini | xai | zai | ollama
GEMINI_API_KEY="your-key"      # free at ai.google.dev
```

### 4. Push schema and seed

```bash
# Create all tables
npx drizzle-kit push

# Populate with sample data (Dev Summit 2026)
npx tsx src/db/seed.ts
```

### 5. Run

```bash
npm run dev
```

Open `localhost:3000`. Log in with `admin@devsummit.mn` / `admin123`.

**All seeded users** (password: `admin123`):

| Name | Email | Role |
|------|-------|------|
| Amarbayar | admin@devsummit.mn | Owner |
| Tuvshin | tuvshin@devsummit.mn | Organizer |
| Oyungerel | oyungerel@devsummit.mn | Organizer |
| Bat-Erdene | baterdene@devsummit.mn | Coordinator |
| Sarnai | sarnai@devsummit.mn | Coordinator |

### Database commands

| Task | Command |
|------|---------|
| Push schema changes | `npx drizzle-kit push` |
| Seed sample data | `npx tsx src/db/seed.ts` |
| Browse DB in browser | `npx drizzle-kit studio` |
| Reset DB (local only) | `psql -d event_os -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"` then push + seed |

### Environment Variables

| Variable | Required | What it is |
|----------|----------|-----------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Random string — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | No | `http://localhost:3000` for dev (auto-detected) |
| `SERVICE_TOKEN` | No | Random token for API service auth |
| `LLM_PROVIDER` | No | `gemini` (default), `xai`, `zai`, or `ollama` |
| `GEMINI_API_KEY` | No | Free at [ai.google.dev](https://ai.google.dev) |
| `XAI_API_KEY` | No | xAI API key |
| `ZAI_API_KEY` | No | z.ai (ZhipuAI) API key |
| `OLLAMA_URL` | No | Ollama URL (default: `localhost:11434`) |

## Project Structure

```
src/
  app/
    (dashboard)/          # Authenticated organizer pages
      speakers/           # Speaker pipeline + checklist + portal invite
      sponsors/           # Sponsor pipeline + checklist
      volunteers/         # Volunteer pipeline + checklist
      venue/              # Venue pipeline + checklist
      booths/             # Booth management + checklist
      media/              # Media partner pipeline + checklist
      outreach/           # Proactive sourcing CRM
      agenda/             # Multi-track schedule builder
      marketing/          # Content calendar (month view)
      tasks/              # Kanban task board with teams
      attendees/          # Registration + CSV import
      invitations/        # Guest allocations
      check-in/           # QR scanner + dashboard
      settings/           # Event | Team | Checklists | Telegram tabs
      notifications/      # Notification list + mark read/delete
    portal/               # Stakeholder self-service (speakers/sponsors login here)
    login/                # Authentication
    onboarding/           # Create org + event + admin account
    api/
      speakers/           # CRUD + RBAC + checklist triggers + notifications
      sponsors/           # CRUD + RBAC + checklist triggers
      ... (all entity types follow same pattern)
      checklist-items/    # Checklist item CRUD + auto-sync templates
      checklist-templates/# Template CRUD (admin)
      notifications/      # List, mark read, bulk operations
      portal/             # Stakeholder invite, status check, profile update, me
      teams/              # Team CRUD
      users/              # User list, invite, role management
      me/                 # Current user info
      upload/             # File upload (authenticated)
      agent/process/      # LLM chat endpoint
  db/
    schema.ts             # Drizzle schema (30+ tables)
    seed.ts               # Dev Summit sample data
    index.ts              # Database connection
  lib/
    auth.ts               # NextAuth config (credentials + JWT)
    rbac.ts               # requirePermission() — role + team scope checks
    checklist.ts          # generateChecklistItems() + archiveChecklistItems()
    notify.ts             # notify() — create notifications for users
    password.ts           # bcrypt hash + compare (legacy SHA-256 compat)
    contacts.ts           # Cross-org person identity
    conflicts.ts          # Schedule conflict detection
    api-utils.ts          # Version checking, pagination
    queries.ts            # Server-side data fetching + getActiveIds()
    agent/                # LLM provider abstraction
      providers/
        gemini.ts         # Google Gemini 2.5 Flash
        xai.ts            # xAI
        zai.ts            # z.ai (ZhipuAI/GLM)
        ollama.ts         # Local Ollama
  components/
    sidebar.tsx           # Grouped nav + edition picker + notification bell
    pipeline-table.tsx    # Reusable table with inline editing + checklist counts
    entity-drawer.tsx     # Resizable drawer with tabs
    checklist-panel.tsx   # Checklist items + progress bars
    assigned-to-select.tsx# User dropdown for assignee fields
    chat-panel.tsx        # Agent chat (Cmd+K)
    notes-panel.tsx       # Discussion threads on entities
    confirm-dialog.tsx    # Themed confirmation dialog (never use system alerts)
    ui/                   # shadcn/ui components
```

## Security

- **RBAC:** 6 roles (owner → admin → organizer → coordinator → viewer → stakeholder). Team-scoped permissions via `team_entity_types` junction table.
- **Org isolation:** Every mutation WHERE clause includes `organizationId`. Cookie values validated against session. Cross-org access blocked.
- **Password hashing:** bcrypt with 12 rounds. Legacy SHA-256 hashes auto-detected for migration.
- **Auth middleware:** `requirePermission(req, entityType, action)` on all API routes. Service token validated against org existence.
- **Pre-commit hook:** Scans every commit for API keys, tokens, credentials. See `.githooks/pre-commit`.
- **No system alerts:** All confirmations use themed dialog components, never `window.confirm()` or `window.alert()`.
- **Security regression tests:** Every CSO audit finding has a test that proves it stays fixed. Run `npx vitest run tests/security.test.ts` to verify.

Never commit `.env.local`. The `.env.example` file has safe placeholders only.

## Feature Status

### Shipped

- [x] Multi-org, multi-event support with edition switching
- [x] Agent chat panel (Gemini, xAI, z.ai, Ollama)
- [x] Unified pipeline model (source/stage) across all 7 entity types
- [x] Pipeline tables with inline editing (stage, source, assignee dropdown)
- [x] Entity drawers with tabs (profile, talk/details, pipeline, checklist)
- [x] RBAC — 5 internal roles + stakeholder role, team-scoped permissions
- [x] AssignedTo user dropdown (replaces free text)
- [x] Settings: Team management, checklist templates, event details
- [x] Post-confirmation checklists (auto-generate on confirm, archive on decline, restore on re-confirm)
- [x] Stakeholder portal (self-service checklist + profile editing)
- [x] Marketing content calendar (month view, drag to schedule)
- [x] Task board (Kanban drag-drop, inline comments, team creation)
- [x] Notifications (assignment, stage change, checklist submission, comments)
- [x] QR check-in (scanner + dashboard)
- [x] Public agenda + CFP form
- [x] Notes/discussion threads on all entities
- [x] File uploads (photos, logos, slides)
- [x] Automated test suite — RBAC permissions, checklist lifecycle, security regression (run `npx vitest run` to see current count)

### Planned / In Progress

**Messaging & Agent Intelligence**
- [ ] OpenClaw integration — agent framework for structured entity management
- [ ] Telegram/Discord/WhatsApp bot — agent in group chat, `/link` account verification, RBAC-enforced
- [ ] Smart agent routing — classify user intents and route to entity handlers (create/edit/delete speakers, sponsors, booths, etc.) with permission checks and clear error messages for unauthorized access
- [ ] Agent query answering — "Do we have any speaker from Mobicom?", "How many booths are confirmed?" — agent checks permissions, queries data, responds naturally

**Payments**
- [ ] Pluggable payment providers — Stripe (global), QPay (Mongolia). Configure provider + credentials in Settings, works out of the box. Abstract adapter pattern so contributors can add their local payment provider.

**Communications**
- [ ] Email communications (scheduled broadcasts via Resend, auto-reminders for checklist items)
- [ ] Meeting management (date + link + attendees on entities)

**Infrastructure**
- [ ] Cloud deployment (Fly.io, Vercel, or Railway)
- [ ] Offline check-in support with sync
- [ ] Team → entity type configuration UI in Settings (backend exists, UI needed)
- [ ] Checklist template editing (reorder, inline edit — currently create/delete only)

**Product**
- [ ] Agenda drag-and-drop editor
- [ ] Dashboard analytics (charts, trends, progress over time)
- [ ] Multi-language support (English + Mongolian)
- [ ] Public event website generator

## Key Design Decisions

**Why PostgreSQL directly, not just Supabase?** Supabase is great for cloud, but we don't want to lock contributors into a specific provider. Local Postgres for dev, Supabase/Neon/RDS for prod — your choice.

**Why a unified pipeline model?** Every entity type (speaker, sponsor, venue, booth, volunteer, media) uses the same `source` (intake/outreach/sponsored) + `stage` (lead/engaged/confirmed/declined) columns. One reusable `PipelineTable` component, one `requirePermission` middleware, one mental model.

**Why bcrypt, not Argon2?** bcrypt is well-tested, has zero native dependencies (bcryptjs is pure JS), and is sufficient for our threat model. Argon2 would require native compilation which breaks some deployment targets.

**Why role-based access control?** 6 roles give clear permission boundaries without per-entity complexity. The backend supports team-scoped permissions (teams own entity types) — the UI for configuring team → entity type mappings is planned. For now, roles (owner/admin/organizer/coordinator/viewer/stakeholder) handle the 90% case.

**Why checklist auto-generation on confirm?** The moment an entity is confirmed, the work begins — collect their photo, get their slides, confirm travel. Auto-generating checklist items from templates means organizers never forget a step.

**Why no system alerts?** `window.confirm()` and `window.alert()` break the visual theme, feel cheap, and can't be styled. Every confirmation uses the themed `ConfirmDialog` component.

## Contributing

PRs welcome. Read `CLAUDE.md` for project conventions and the secret safety checklist.

**When building features:**
- Every DB mutation WHERE clause must include `organizationId`
- Every new API route must use `requirePermission()`
- Never use `window.confirm()`, `window.alert()`, or `window.prompt()` — use `useConfirm()` hook
- If you build create, also build edit, delete, and error handling
- Run `npx vitest run` before pushing — all tests must pass

## License

MIT — do whatever you want with it.
