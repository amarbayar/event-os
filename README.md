# Event OS

**The event management platform that Cvent charges $20K/year for, except you can clone it and run it in 5 minutes.**

We run Dev Summit in Mongolia. Every year it's the same story: 47 spreadsheets, 200 Telegram messages, one person who "definitely sent that invoice" (they didn't), and a check-in line that makes people question their life choices.

Cvent wants $20K/year + $10K implementation. Bizzabo won't even show you pricing without a sales call. Sessionize handles CFPs but not payments. Eventbrite handles tickets but not schedules. So you end up with 6 tools duct-taped together and a spreadsheet that is technically load-bearing.

Event OS replaces all of that. One app. Speakers, schedule, sponsors, booths, volunteers, media partners, marketing, check-in — plus post-confirmation checklists, a stakeholder portal, and an in-app notification system. Multi-event support so next year you don't start from zero.

Built by a small team for small teams. If you're running a tech conference with spreadsheets and prayers, this is for you.

## The agent-first difference

Most event tools give you 14 forms and say "type everything in manually." Event OS gives you a chat agent. Type naturally — "add speaker Sarah from Google, keynote on AI" — and the agent creates the record. Ask "how many sponsors are confirmed?" and it queries the database. Paste a spreadsheet and it bulk-imports everything.

The agent understands English, Mongolian (Cyrillic), and transliterated Mongolian. It enforces the same RBAC as the web UI — a coordinator can't delete records via chat any more than they can via the dashboard.

**Cmd+K** opens the agent from anywhere.

Supports **Google Gemini**, **z.ai (GLM)**, **xAI (Grok)**, **Ollama** (local), or add your own by implementing one interface. Admins pick their provider and enter their API key from the Settings UI — no `.env` editing required.

The agent also runs on **Telegram and Discord** via built-in bot relay. @mention the bot in your team's group chat and it responds with the same intelligence and RBAC as the web agent.

## What's in the box

| Module                           | What it does                                                                                                                                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agent Intelligence**           | Natural language CRUD — create, update, search, count any entity type. Bulk import from CSV/chat logs. RBAC-enforced, prompt injection hardened, multilingual. Cmd+K from anywhere.                                        |
| **Speaker Pipeline**             | CFP form → review → accept/reject. Pipeline table with inline stage/source/assignee editing.                                                                                                                               |
| **Sponsor Pipeline**             | Outreach to confirmation. Same unified pipeline model as speakers.                                                                                                                                                         |
| **Venue Pipeline**               | Multiple venue candidates, negotiations, pricing, finalization.                                                                                                                                                            |
| **Booth Management**             | Inventory, reservations, company contacts, sponsor linking.                                                                                                                                                                |
| **Volunteer Management**         | Applications, assignments, pipeline tracking.                                                                                                                                                                              |
| **Media Partners**               | TV/press/podcast pipeline with contact management.                                                                                                                                                                         |
| **Outreach CRM**                 | Proactive sourcing for all entity types. Follow-up tracking.                                                                                                                                                               |
| **Agenda Builder**               | Multi-track schedule, conflict detection (speaker double-booked? room collision?), draft/publish toggle.                                                                                                                   |
| **Marketing Calendar**           | Month-view content calendar. Click a day to add an item. Assign to team members. Platform tags (Twitter, Facebook, Instagram, LinkedIn, Telegram).                                                                         |
| **Task Board**                   | Kanban drag-and-drop (To Do → In Progress → Blocked → Done). Click cards for detail drawer with inline comments. Create/rename/delete teams.                                                                               |
| **Invitations**                  | Speaker +1s, organizer +1s, student passes. Configurable allocations. QR codes.                                                                                                                                            |
| **QR Check-in**                  | Scanner mode + dashboard mode with live stats.                                                                                                                                                                             |
| **Post-Confirmation Checklists** | When an entity is confirmed, auto-generate checklist items from templates (upload photo, submit slides, confirm travel). Track progress per entity. Admins configure templates in Settings.                                |
| **Stakeholder Portal**           | Confirmed speakers/sponsors get a login to self-service their checklist items — upload photos, submit bios, confirm travel. Organizers see submissions and approve/reject.                                                 |
| **RBAC & Team Management**       | 6 roles (owner → admin → organizer → coordinator → viewer → stakeholder). Team-scoped permissions — teams own entity types. Confirmed entities protected from non-admin deletion. Same rules enforced in web UI and agent. |
| **Notifications**                | In-app notifications for assignments, stage changes, checklist submissions, comments. Bell icon with unread badge. Mark read, bulk delete.                                                                                 |
| **Telegram & Discord Bot**       | Connect your team's chat from Settings. @mention the bot to query data, create records, manage your event. Configurable bot personality (language + mood).                                                                 |
| **AI Model Settings**            | Pick your LLM provider (Gemini, z.ai, xAI, Ollama) and enter API key from the UI. Changes apply to both web chat and messaging bots. API keys encrypted at rest.                                                           |
| **Localization**                 | English and Mongolian UI via next-intl. Locale switcher in sidebar. Agent responds in user's language.                                                                                                                     |
| **Settings**                     | Tabbed: Event details, Team management (invite/roles), Checklist templates, AI Model, Messaging (Telegram/Discord connection + bot personality).                                                                           |
| **Public Agenda**                | Attendee-facing schedule with day/track filters.                                                                                                                                                                           |
| **CFP Form**                     | Public speaker application form.                                                                                                                                                                                           |

## Tech Stack

| Layer     | Choice                                 | Why                                                                          |
| --------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| Framework | Next.js 16 (App Router)                | Server components, API routes, one deploy target                             |
| Language  | TypeScript                             | Catch bugs before your users do                                              |
| Styling   | Tailwind CSS + shadcn/ui               | Fast, accessible components out of the box                                   |
| Database  | PostgreSQL or SQLite                   | Postgres for production; SQLite for zero-setup local dev                     |
| ORM       | Drizzle                                | Type-safe, no magic, SQL when you need it                                    |
| Auth      | NextAuth.js (v5)                       | Credentials + JWT + service token for API                                    |
| Passwords | bcrypt (12 rounds)                     | Proper key stretching. Legacy SHA-256 auto-detected for migration.           |
| Agent LLM | Gemini, z.ai (GLM), xAI (Grok), Ollama | Configurable from Settings UI. Abstracted — add providers with one interface |
| Messaging | Built-in bot relay                     | Telegram + Discord bot integration, in-process adapter lifecycle             |
| i18n      | next-intl                              | English + Mongolian, cookie-based locale switching                           |
| Icons     | Lucide React                           | Consistent, tree-shakeable                                                   |

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/amarbayar/event-os.git
cd event-os
npm install
```

### 2. Set up the database

**Option A: SQLite** (zero-install, fastest way to start)

No setup needed — just set one environment variable and go.

**Option B: Local PostgreSQL**

```bash
# macOS
brew install postgresql@16
brew services start postgresql@16
createdb event_os
```

**Option C: Supabase** (cloud, free tier)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → Database** and copy the connection string

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# Pick one:
# --- SQLite (no database server needed) ---
DB_DIALECT="sqlite"
AUTH_SECRET="$(openssl rand -base64 32)"

# --- PostgreSQL ---
# DB_DIALECT="postgresql"
# DATABASE_URL="postgresql://youruser@localhost:5432/event_os"
# AUTH_SECRET="$(openssl rand -base64 32)"

# Optional — for the agent chat panel
LLM_PROVIDER="gemini"          # gemini | xai | zai | ollama
GEMINI_API_KEY="your-key"      # free at ai.google.dev
```

### 4. Push schema and seed

```bash
# SQLite
DB_DIALECT=sqlite npx drizzle-kit push
DB_DIALECT=sqlite npx tsx src/db/seed.ts

# PostgreSQL
npx drizzle-kit push
npx tsx src/db/seed.ts
```

### 5. Payments (Stripe)

Event OS includes a basic Stripe checkout integration for handling payments.

### 5.1. Configuration

Add the following to your `.env.local`:

```env
NEXT_PUBLIC_APP_URL="http://localhost:3000"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

- `NEXT_PUBLIC_APP_URL` → your app base URL (used for success/cancel redirects)
- `STRIPE_SECRET_KEY` → from Stripe Dashboard
- `STRIPE_WEBHOOK_SECRET` → generated via Stripe CLI or Dashboard

---

### 5.2. Local Testing (Stripe CLI)

We recommend using the Stripe CLI for local development.

#### 5.3. Install Stripe CLI

```bash
brew install stripe/stripe-cli/stripe
```

#### 5.4. Login

```bash
stripe login
```

#### 5.5 Start webhook forwarding

```bash
stripe listen --forward-to localhost:3000/api/payments/stripe/webhook
```

You will see output like:

```bash
Your webhook signing secret is whsec_xxx
```

Copy this value into your `.env.local` as:

```env
STRIPE_WEBHOOK_SECRET="whsec_xxx"
```

---

### 5.6. Test Payment

Use Stripe test card:

```plaintext
4242 4242 4242 4242
Any future expiry date
Any CVC
```

---

### 5.7. Payment Flow

```plaintext
Frontend → /api/payments/stripe/create-session
→ Stripe Checkout
→ webhook (/api/payments/stripe/webhook)
→ DB updated (payment marked as paid)
→ redirect to success/cancel page
```

---

### 5.8. Notes

- This is an **MVP implementation (single Stripe account)**
- Future improvement: **Stripe Connect (multi-tenant organizations)**

### 6. Run

```bash
npm run dev
```

Open `localhost:3000`. Log in with `admin@devsummit.mn` / `admin123`.

**All seeded users** (password: `admin123`):

| Name       | Email                  | Role        |
| ---------- | ---------------------- | ----------- |
| Amarbayar  | admin@devsummit.mn     | Owner       |
| Tuvshin    | tuvshin@devsummit.mn   | Organizer   |
| Oyungerel  | oyungerel@devsummit.mn | Organizer   |
| Bat-Erdene | baterdene@devsummit.mn | Coordinator |
| Sarnai     | sarnai@devsummit.mn    | Coordinator |

### Database commands

| Task        | PostgreSQL                                                                                 | SQLite                                     |
| ----------- | ------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Push schema | `npx drizzle-kit push`                                                                     | `DB_DIALECT=sqlite npx drizzle-kit push`   |
| Seed data   | `npx tsx src/db/seed.ts`                                                                   | `DB_DIALECT=sqlite npx tsx src/db/seed.ts` |
| Browse DB   | `npx drizzle-kit studio`                                                                   | `DB_DIALECT=sqlite npx drizzle-kit studio` |
| Reset DB    | `psql -d event_os -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"` then push + seed | Delete `local.db` then push + seed         |

### Environment Variables

| Variable                | Required      | What it is                                                                              |
| ----------------------- | ------------- | --------------------------------------------------------------------------------------- |
| `DB_DIALECT`            | No            | `postgresql` (default) or `sqlite`                                                      |
| `DATABASE_URL`          | PG only       | PostgreSQL connection string                                                            |
| `SQLITE_PATH`           | No            | SQLite file path (default: `local.db`)                                                  |
| `AUTH_SECRET`           | Yes           | Random string — `openssl rand -base64 32`                                               |
| `NEXTAUTH_URL`          | No            | `http://localhost:3000` for dev (auto-detected)                                         |
| `NEXT_PUBLIC_APP_URL`   | No            | Public app base URL for browser redirects and payment flows                              |
| `APP_URL`               | No            | Optional server-side base URL fallback for absolute links in emails and invites          |
| `SERVICE_TOKEN`         | No            | Random token for API service auth                                                       |
| `LLM_PROVIDER`          | No            | `gemini` (default), `xai`, `zai`, or `ollama`                                           |
| `GEMINI_API_KEY`        | No            | Free at [ai.google.dev](https://ai.google.dev)                                          |
| `XAI_API_KEY`           | No            | xAI API key                                                                             |
| `ZAI_API_KEY`           | No            | z.ai (ZhipuAI) API key                                                                  |
| `OLLAMA_URL`            | No            | Ollama URL (default: `localhost:11434`)                                                 |
| `ENCRYPTION_KEY`        | No            | 64 hex chars for API key encryption — `openssl rand -hex 32`. Falls back to AUTH_SECRET |
| `QUEUE_ENABLED`         | No            | `true` to route emails/notifications through the job queue                              |
| `MAIL_DRIVER`           | No            | `log` (default), `mailgun`, or `postmark`                                               |
| `MAIL_FROM_ADDRESS`     | No            | Sender email (default: `noreply@example.com`)                                           |
| `MAIL_FROM_NAME`        | No            | Sender name (default: `Event OS`)                                                       |
| `POSTMARK_SERVER_TOKEN` | Postmark only | Postmark API token                                                                      |
| `MAILGUN_API_KEY`       | Mailgun only  | Mailgun API key                                                                         |
| `MAILGUN_DOMAIN`        | Mailgun only  | Mailgun sending domain                                                                  |
| `FILE_STORAGE_DRIVER`   | No            | `local` (default) or `gcs`                                                              |
| `GCS_BUCKET_NAME`       | GCS only      | Bucket used for stakeholder file uploads                                                |
| `GCS_UPLOAD_PREFIX`     | No            | Object prefix inside the bucket (default: `uploads`)                                    |
| `GCS_PUBLIC_BASE_URL`   | No            | Optional CDN/custom public base URL for uploaded files                                  |
| `UPSTASH_REDIS_REST_URL`| No            | Upstash Redis REST URL; omit if Redis is not configured                                 |
| `UPSTASH_REDIS_REST_TOKEN` | No         | Upstash Redis REST token; omit if Redis is not configured                               |

### Upload storage

Stakeholder uploads support images (`jpg`, `png`, `webp`, `gif`) and documents (`pdf`, `ppt`, `pptx`, `doc`, `docx`) up to 20 MB.

- `FILE_STORAGE_DRIVER=local`: stores files on the app VM under `public/uploads`
- `FILE_STORAGE_DRIVER=gcs`: stores files in GCS and serves them from `GCS_PUBLIC_BASE_URL` or the bucket's public URL

For GCP VM deployments, prefer the VM's attached service account with bucket IAM permissions. Do not commit service-account JSON keys to the repo.

## Job Queue & Background Workers

Email sending and notifications are processed in the background via a database-backed job queue. When `QUEUE_ENABLED=true`, `mail()` and `notify()` return immediately — the actual work happens in a separate worker process with retry and exponential backoff.

### Local development

Run the worker alongside your dev server in a second terminal:

```bash
# Terminal 1 — Next.js dev server
npm run dev

# Terminal 2 — Queue worker
QUEUE_ENABLED=true DB_DIALECT=sqlite npm run queue:work
```

Without the worker running, emails and notifications fall back to synchronous inline processing (no `QUEUE_ENABLED` needed).

### How it works

```
API route → mail() / notify() → INSERT into jobs table → return immediately
                                        ↓
Queue worker (polls) → claim job → execute handler → complete / retry / fail
```

- **Adaptive polling:** 1s → 2s → 4s → ... → 10s cap when idle, resets to 1s on job found
- **Retry with backoff:** configurable per job (emails: 3 attempts, 15s base backoff)
- **Timeout:** per-job AbortController timeout (emails: 30s, notifications: 10s)
- **Failed jobs:** after max retries, moved to `failed_jobs` table for inspection
- **Graceful shutdown:** SIGTERM/SIGINT finishes the current job before exiting
- **Stale recovery:** processing jobs stuck >5 minutes are automatically released

### Worker commands

```bash
npm run queue:work                              # process high + default queues
npm run queue:work -- --queues=high,default     # explicit queue list
npm run queue:work -- --queues=high             # only high-priority queue
```

### Production deployment

The worker is a long-running Node.js process. How you run it depends on your deployment:

### App service on a GCP VM

For a single-VM deployment, run the Next.js app under `systemd` and keep uploads either on the VM disk (`FILE_STORAGE_DRIVER=local`) or in GCS (`FILE_STORAGE_DRIVER=gcs`).

Typical deploy flow:

```bash
cd /opt/event-os
git status
git pull --ff-only
npm ci --include=dev
npm run build
sudo systemctl restart event-os
sudo systemctl status event-os --no-pager
```

Recommended `event-os.service` shape:

```ini
[Unit]
Description=Event OS (Next.js)
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/event-os
EnvironmentFile=/opt/event-os/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Notes:

- Keep real secrets in `/opt/event-os/.env`, not in tracked files
- On GCP, use the VM service account for GCS access instead of a JSON key file
- If `git pull --ff-only` fails, inspect local modifications first; do not deploy over a dirty working tree blindly

**Forge (DigitalOcean/AWS)**

Add a Forge daemon — it auto-restarts on crash, same as Laravel's queue worker:

1. Go to your Forge site → **Daemons**
2. Command: `node_modules/.bin/tsx scripts/queue-worker.ts`
3. Directory: `/home/forge/your-site/current`
4. Set environment variables (same as your `.env` — `QUEUE_ENABLED`, `MAIL_DRIVER`, `POSTMARK_SERVER_TOKEN`, etc.)

**Docker / docker-compose**

Add a second service that runs the same image with a different entrypoint:

```yaml
services:
  web:
    build: .
    command: npm start
    env_file: .env

  worker:
    build: .
    command: npx tsx scripts/queue-worker.ts
    env_file: .env
    restart: unless-stopped
```

**systemd**

```ini
[Unit]
Description=Event OS Queue Worker
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/event-os
ExecStart=/usr/bin/npx tsx scripts/queue-worker.ts
Restart=always
RestartSec=5
EnvironmentFile=/opt/event-os/.env

[Install]
WantedBy=multi-user.target
```

**Vercel / serverless**

Long-running workers can't run on serverless platforms. Options:

- Use an external cron service (e.g., [cron-job.org](https://cron-job.org)) to hit an API route that processes a batch of jobs
- Run the worker on a separate $5/mo VPS (DigitalOcean, Hetzner)
- Skip the queue — without `QUEUE_ENABLED=true`, emails send synchronously inline

### Current job types

| Job                 | Queue   | Timeout | Retries | Backoff         |
| ------------------- | ------- | ------- | ------- | --------------- |
| `send-email`        | default | 30s     | 3       | 15s exponential |
| `send-notification` | default | 10s     | 3       | 5s exponential  |

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
      settings/           # Event | Team | Checklists | AI Model | Messaging tabs
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
      agent/identify/     # Platform user → Event OS user resolution
      messaging/          # Telegram, Discord, links, bot-settings, llm-settings
      me/locale/          # User locale preference
  db/
    schema.ts             # Dialect-aware barrel (exports PG or SQLite schema)
    schema.pg.ts          # Drizzle PG schema (30+ tables)
    schema.sqlite.ts      # Drizzle SQLite schema (mirrors PG)
    dialect.ts            # DB_DIALECT env detection
    seed.ts               # Dev Summit sample data (works with both dialects)
    index.ts              # Dialect-aware database connection
  lib/
    auth.ts               # NextAuth config (credentials + JWT)
    rbac.ts               # requirePermission() — role + team scope checks
    checklist.ts          # generateChecklistItems() + archiveChecklistItems()
    notify.ts             # notify() — create notifications (queue-aware)
    mail/                 # Email system (Postmark, Mailgun, log driver)
      index.ts            # mail() → queue dispatch, mailNow() → send + log
      config.ts           # Env-based driver config
      drivers/            # Postmark, Mailgun, log
      mailables/          # Email templates (portal invite, etc.)
      templates/          # Base HTML layout
    queue/                # Database-backed job queue (Laravel-inspired)
      index.ts            # dispatch(), dispatchMany(), registry, driver factory
      types.ts            # JobDefinition, QueueDriver interfaces
      drivers/database.ts # PG (FOR UPDATE SKIP LOCKED) + SQLite driver
      worker.ts           # Poll loop, retry, timeout, graceful shutdown
      jobs.ts             # send-email, send-notification
    bots/                 # Multi-platform bot relay (Discord, Telegram)
      relay.ts            # Shared core: identify → process → response
      discord.ts          # Discord.js adapter
      telegram.ts         # Telegram Bot API adapter (zero deps)
      manager.ts          # In-process lifecycle manager (auto-start from DB)
    crypto.ts             # AES-256-GCM encryption for API keys at rest
    password.ts           # bcrypt hash + compare (legacy SHA-256 compat)
    contacts.ts           # Cross-org person identity
    conflicts.ts          # Schedule conflict detection
    api-utils.ts          # Version checking, pagination, stage protection
    queries.ts            # Server-side data fetching + getActiveIds()
    agent/                # Agent intelligence system
      dispatcher.ts       # Intent routing + RBAC + bulk detection
      manage-handler.ts   # Create/update/delete with dynamic schema
      query-handler.ts    # Count/list/search with checklist status
      input-guard.ts      # Prompt injection defense + @mention gating
      sql-query.ts        # LLM-generated SQL for complex queries (validated + sandboxed)
      prompt.ts           # LLM system prompts (classify + extract)
      providers/          # Gemini, xAI, z.ai, Ollama
  components/
    sidebar.tsx           # Grouped nav + edition picker + notification bell
    pipeline-table.tsx    # Reusable table with inline editing + checklist counts
    entity-drawer.tsx     # Resizable drawer with tabs
    checklist-panel.tsx   # Checklist items + progress bars
    assigned-to-select.tsx# User dropdown for assignee fields
    chat-panel.tsx        # Agent chat (Cmd+K)
    notes-panel.tsx       # Discussion threads on entities
    portal-invite-section.tsx # Shared portal invite component (deduped from 6 pages)
    locale-switcher.tsx   # Language picker (en/mn)
    confirm-dialog.tsx    # Themed confirmation dialog (never use system alerts)
    ui/                   # shadcn/ui components
  i18n/
    request.ts            # next-intl locale resolution from cookie
  messages/
    en.json               # English translations
    mn.json               # Mongolian translations
```

## Testing

Tests run against SQLite by default — no PostgreSQL or external services needed.

### Quick start

```bash
# Set up SQLite test database
DB_DIALECT=sqlite npx drizzle-kit push
DB_DIALECT=sqlite npx tsx src/db/seed.ts

# Run unit + integration tests (no server needed)
DB_DIALECT=sqlite npx vitest run tests/unit tests/integration

# Run all tests including e2e (needs running server)
DB_DIALECT=sqlite AUTH_SECRET=test-secret SERVICE_TOKEN=test-token npm run dev &
DB_DIALECT=sqlite SERVICE_TOKEN=test-token npx vitest run

# Watch mode
DB_DIALECT=sqlite npx vitest
```

### Test structure

Tests are organized by scope:

```
tests/
  unit/           # No DB, no server — pure logic
    schema-sync   # PG ↔ SQLite schema parity
    rbac          # Permission logic
  integration/    # Needs seeded DB — tests functions directly
    checklist     # Checklist lifecycle (generate, archive, restore)
    agent-*       # Agent dispatcher, handlers, input guards, LLM security
  e2e/            # Needs running server — tests HTTP API
    pipeline      # CRUD lifecycle for all entity types
    security      # Auth enforcement, bcrypt, CSO audit regressions
```

### LLM-dependent tests

Some agent tests call the real Gemini API. They auto-skip when no API key is set. To run them locally:

```bash
GEMINI_API_KEY=your-key DB_DIALECT=sqlite npx vitest run tests/integration
```

### CI (GitHub Actions)

Tests run automatically on push to `main` and on pull requests. The workflow uses SQLite so no database service is needed.

**Three jobs:**

- **Unit & Integration** — fast (~2s), runs `tests/unit` + `tests/integration`
- **API E2E** — boots a dev server and runs `tests/e2e` through `npm run test:e2e:api`
- **Browser E2E** — runs Playwright against `tests/e2e-browser`

**To enable LLM tests in CI**, add your Gemini API key as a repository secret:

```bash
# Via GitHub CLI
gh secret set GEMINI_API_KEY --repo your-org/event-os

# Or go to: Settings → Secrets and variables → Actions → New repository secret
# Name: GEMINI_API_KEY
# Value: your-gemini-api-key
```

Without the secret, LLM tests are skipped — all other tests still run and pass.

## Security

- **RBAC:** 6 roles with team-scoped permissions. Same rules enforced on web UI, agent, and messaging bots.
- **Org isolation:** Every mutation WHERE clause includes `organizationId`. Cross-org access blocked. Field allowlists prevent mass assignment.
- **Stage protection:** Confirmed entities can't be deleted by non-admins (web UI + agent).
- **Agent hardening:** Prompt injection defense (multilingual), bulk operation blocking, sensitive field stripping, @mention gating for group chats. LLM-generated SQL validated with keyword blocking, PG function blocklist, and mandatory org scoping.
- **API key encryption:** LLM API keys stored with AES-256-GCM encryption at rest.
- **Timing-safe auth:** Service token comparison uses `crypto.timingSafeEqual` to prevent timing attacks.
- **Shell injection prevention:** All values interpolated into `execSync` commands are sanitized against shell metacharacters.
- **Upload safety:** Path traversal prevention — uploaded file paths validated to stay within the upload directory.
- **Onboarding gate:** `/api/onboarding` requires authentication after the first organization is created.
- **Password hashing:** bcrypt (12 rounds). Pre-commit hook scans for leaked credentials.
- **Automated tests** covering RBAC, agent CRUD, prompt injection, checklist lifecycle, security regressions.

Never commit `.env.local`. The `.env.example` file has safe placeholders only.

## Feature Status

### Shipped

- [x] Multi-org, multi-event support with edition switching
- [x] Agent intelligence — natural language CRUD, query, bulk import across all entity types
- [x] Agent security — RBAC enforcement, prompt injection defense, bulk operation blocking, stage protection
- [x] LLM-generated SQL — complex join/aggregation queries validated and sandboxed
- [x] Telegram + Discord bots — built-in multi-platform relay with @mention gating, in-process lifecycle
- [x] LLM settings UI — admins pick provider + model + API key from Settings (encrypted at rest)
- [x] Bot personality — configurable language + mood from Settings
- [x] Unified pipeline model (source/stage) across all entity types
- [x] Pipeline tables with inline editing + entity drawers with tabs
- [x] RBAC — 6 roles, team-scoped permissions, enforced on all API routes + agent + bots
- [x] Post-confirmation checklists (auto-generate, archive, restore)
- [x] Stakeholder portal (self-service checklist + profile)
- [x] Marketing content calendar + Kanban task board
- [x] Notifications, QR check-in, public agenda, CFP form
- [x] Localization — English + Mongolian UI (next-intl), locale switcher
- [x] UI animations — slide-in drawers, fade dialogs, prefers-reduced-motion support
- [x] Job queue — database-backed, retry with backoff, graceful shutdown, extensible driver interface
- [x] Email system — Postmark/Mailgun/log drivers, async via queue, dedup protection, email logging
- [x] Security hardened — 9 CSO audit findings resolved (command injection, mass assignment, timing attacks, path traversal, org isolation, API key encryption)
- [x] Automated tests (RBAC, agent, security, checklist) — 0 TypeScript errors

### Planned

- [ ] WhatsApp bot integration (requires cloud deployment for webhook)
- [ ] Payments — Stripe + QPay (Mongolia) via pluggable adapter
- [ ] Email communications — scheduled broadcasts, checklist reminders, bulk campaigns
- [ ] Cloud deployment (Vercel, Fly.io, or Railway)
- [ ] Dashboard analytics
- [ ] Agenda drag-and-drop editor

## Key Design Decisions

**Why both PostgreSQL and SQLite?** PostgreSQL for production and teams. SQLite for contributors who want to clone and run in under a minute with zero infrastructure. Both schemas are kept in sync by an automated test. SQLite is single-writer, so it's not suitable for high-concurrency production — use Postgres there.

**Why a unified pipeline model?** Every entity type (speaker, sponsor, venue, booth, volunteer, media) uses the same `source` (intake/outreach/sponsored) + `stage` (lead/engaged/confirmed/declined) columns. One reusable `PipelineTable` component, one `requirePermission` middleware, one mental model.

**Why bcrypt, not Argon2?** bcrypt is well-tested, has zero native dependencies (bcryptjs is pure JS), and is sufficient for our threat model. Argon2 would require native compilation which breaks some deployment targets.

**Why role-based access control?** 6 roles with team-scoped permissions. Teams own entity types — an organizer on the "Program" team can edit speakers but not sponsors. Same rules apply on every surface: web UI, API, and agent chat.

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
