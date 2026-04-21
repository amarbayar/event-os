# Event OS

Event OS is an open-source event operations platform for small conference teams. It combines pipelines, agenda planning, tasks, stakeholder checklists, attendee operations, and an LLM-powered assistant in one Next.js app.

This README is intentionally short. Use it for setup and operational basics. Use [`.env.example`](./.env.example) for configuration and [`DESIGN.md`](./DESIGN.md) for broader product notes.

## Current scope

- Speaker, sponsor, venue, booth, volunteer, media, attendee, invitation, outreach, and campaign workflows
- Agenda builder with conflict detection
- Kanban task board
- Stakeholder portal with checklist templates, uploads, and review
- In-app notifications and email delivery
- Web chat agent plus Discord and Telegram relay
- PostgreSQL or SQLite
- Local uploads or Google Cloud Storage

## Roles

These are distinct roles. The current behavior in code is:

| Role | What it can do |
| --- | --- |
| `owner` | Full organization control, including ownership transfer and destructive org actions |
| `admin` | Full app access across the organization |
| `organizer` | Manage normal event records across the organization; broader than `coordinator`, but not an admin |
| `coordinator` | Create and update only within assigned scope; cannot delete records |
| `viewer` | Read-only workspace access |
| `stakeholder` | Portal-only access to a linked entity, checklist items, and profile data |

Notes:

- Older docs that described organizers as fully team-scoped are outdated.
- Coordinators are still the narrow, scoped operator role.
- Confirmed-entity protections still apply at the route level.

## Quick start

### 1. Install

```bash
git clone https://github.com/amarbayar/event-os.git
cd event-os
npm install
cp .env.example .env.local
```

### 2. Configure `.env.local`

Fastest local setup uses SQLite.

Minimal SQLite example:

```env
DB_DIALECT="sqlite"
AUTH_SECRET="replace-with-a-random-secret"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Optional for bots:

```env
SERVICE_TOKEN="replace-with-a-random-token"
```

Optional for the chat assistant:

```env
LLM_PROVIDER="gemini"
GEMINI_API_KEY="your-api-key"
```

PostgreSQL setup is also supported:

```env
DB_DIALECT="postgresql"
DATABASE_URL="postgresql://user:password@host:5432/dbname"
AUTH_SECRET="replace-with-a-random-secret"
```

Use [`.env.example`](./.env.example) as the source of truth for supported settings.

### 3. Push schema and seed data

SQLite:

```bash
DB_DIALECT=sqlite npx drizzle-kit push
DB_DIALECT=sqlite npx tsx src/db/seed.ts
```

PostgreSQL:

```bash
npx drizzle-kit push
npx tsx src/db/seed.ts
```

### 4. Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

Seeded local owner login:

```text
admin@devsummit.mn
admin123
```

Additional seeded organizer and coordinator accounts are defined in [`src/db/seed.ts`](./src/db/seed.ts).

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Build for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit and integration tests |
| `npm run test:e2e:api` | Run API e2e tests with a managed dev server |
| `npm run test:e2e` | Run Playwright browser e2e tests |
| `npm run queue:work` | Start the background queue worker |
| `npm run bot:discord` | Start the Discord bot relay |
| `npm run bot:telegram` | Start the Telegram bot relay |

## Queue and bots

Email and notification delivery can run inline or through the database-backed queue.

- Set `QUEUE_ENABLED=true` to route mail and notifications through the worker.
- Run `npm run queue:work` when queueing is enabled.
- Bot relay requires `SERVICE_TOKEN`.

The queue worker and bots are separate long-running processes. They are not started automatically by `npm run dev`.

## Testing

Primary test entry points:

```bash
npm run test
npm run test:e2e:api
npm run test:e2e
```

Notes:

- `npm run test:e2e:api` starts and stops its own dev server.
- Playwright browser tests use their own local server on port `3100`.
- Some LLM-backed tests depend on provider/network availability and can be slower or flaky than pure local tests.

## Configuration notes

Important config groups:

- Auth: `AUTH_SECRET`, `AUTH_PROVIDER`, `NEXT_PUBLIC_AUTH_PROVIDER`
- Database: `DB_DIALECT`, `DATABASE_URL`, `SQLITE_PATH`
- App URLs: `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, optional `APP_URL`
- Agent: `LLM_PROVIDER` and provider-specific API keys
- Storage: `FILE_STORAGE_DRIVER`, `GCS_BUCKET_NAME`, optional `GCS_PUBLIC_BASE_URL`
- Mail: `MAIL_DRIVER` plus driver-specific secrets
- Queue: `QUEUE_ENABLED`
- Bot/API relay: `SERVICE_TOKEN`

Agent provider/model settings can also be managed from the app settings UI.

## Deploying on a VM

The current deployment model is a single VM running the Next.js app under `systemd`, with optional worker and bot services alongside it.

Typical release flow:

```bash
git pull --ff-only
npm ci --include=dev
npm run build
sudo systemctl restart event-os
```

If you run queue and bot services, restart those too after deploy.

Recommended defaults for a VM deployment:

- `FILE_STORAGE_DRIVER=local` for single-VM installs, or `gcs` if you want shared object storage
- Use the VM's attached GCP service account for GCS access
- Do not commit service-account JSON keys or `.env.local`
- Do not deploy over a dirty working tree

## Repository notes

- [`DESIGN.md`](./DESIGN.md): product and architecture notes
- [`TODOS.md`](./TODOS.md): project backlog / scratchpad
- [`AGENTS.md`](./AGENTS.md): repo-specific agent instructions

## License

[MIT](./LICENSE)
