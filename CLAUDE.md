# Event OS

## CRITICAL: Public Repository — Secret Safety

This is a PUBLIC open-source repository. NEVER commit:
- API keys, tokens, passwords, or credentials
- `.env`, `.env.local`, `.env.production`, or any env files
- Database connection strings
- Service tokens or auth secrets
- Private keys (*.pem, *.key)
- Any file containing real user data

Before EVERY commit:
1. Check `.gitignore` covers all secret files
2. Never use `git add -A` blindly — review staged files
3. Scan staged content for: API_KEY, SECRET, TOKEN, PASSWORD, PRIVATE_KEY, DATABASE_URL, Bearer, sk-, pk_
4. Use `.env.example` with placeholder values only — never real credentials
5. If you accidentally stage a secret, unstage it immediately. If committed, the repo history must be cleaned.

## Worktrees
- When creating a new git worktree, always copy `.env` from the main repo root into the worktree directory: `cp /path/to/repo/.env /path/to/worktree/.env`
- Worktrees do not inherit `.env` files — the app (auth, DB, etc.) will fail without it.

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Tech Stack
- Next.js 16 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Drizzle ORM + PostgreSQL (local Postgres or Supabase)
- Auth: NextAuth v5 (credentials + JWT) + service token for agent API
- Passwords: bcrypt (12 rounds) via bcryptjs
- Icons: lucide-react
- i18n: next-intl (cookie-based, no URL prefixes) — en + mn
- LLM: Gemini 2.5 Flash (default), xAI, z.ai, Ollama

## Project Structure
- `src/app/(dashboard)/` — authenticated organizer pages
- `src/app/portal/` — stakeholder self-service portal
- `src/app/(public)/` — public pages (agenda, CFP form)
- `src/app/api/` — REST API routes (52 route files)
- `src/db/` — Drizzle schema (30+ tables) and database connection
- `src/lib/` — shared utilities
- `src/components/` — shared UI components
- `src/i18n/request.ts` — next-intl locale config (reads `locale` cookie)
- `messages/en.json`, `messages/mn.json` — translation files

## Key Patterns

### Auth & RBAC
- `requirePermission(req, entityType, action)` on ALL API routes — no exceptions
- 6 roles: owner > admin > organizer > coordinator > viewer > stakeholder
- Team-scoped permissions: teams own entity types via `team_entity_types` junction table
- Owner/admin bypass team scoping. Organizer/coordinator need team membership for write access.
- Stakeholders can only read/update their own linked entity + checklist items

### Data Isolation (SECURITY CRITICAL)
- Every DB mutation (UPDATE, DELETE) WHERE clause MUST include `organizationId`
- Pattern: `.where(and(eq(table.id, id), eq(table.organizationId, ctx.orgId)))`
- Never trust cookie values without validating against session's organizationId
- `getActiveIds(userOrgId)` validates cookie edition belongs to user's org

### Entity Pipeline Model
- All entity types use unified source (intake/outreach/sponsored) + stage (lead/engaged/confirmed/declined)
- One reusable `PipelineTable` component with inline editing
- Stage transitions trigger checklist generation (confirmed) and archival (declined)

### Post-Confirmation Checklists
- `checklist_templates` define what confirmed entities need (per entity type, per edition)
- `checklist_items` auto-generated when stage → confirmed, archived on reversal, restored on re-confirm
- Templates auto-sync: new templates appear on existing confirmed entities when checklist is viewed

### Notifications
- `notify()` supports two calling patterns (discriminated union):
  - Raw: `{ title: "Hello" }` — stores string as-is
  - I18n: `{ titleKey: "assigned", titleParams: { entity: "John" }, locale: "mn" }` — resolves translation before storing
- Triggers wired into: entity assignment, stage changes, checklist submissions, comments
- Bell icon in sidebar polls every 30s for unread count
- When converting notify calls to i18n, pass the recipient's `preferredLocale` — the caller already has the user object

### Stakeholder Portal
- Confirmed entities can be "invited to portal" → creates a user with role="stakeholder"
- Stakeholder sees only their own checklist + profile at `/portal`
- `user_organizations.linkedEntityType` + `user_organizations.linkedEntityId` connects user to their entity

### Multi-Org Support
- `user_organizations` join table is the single source of truth for org membership, role, and stakeholder linking
- Users can belong to multiple orgs with per-org roles
- Auth resolves org + role from `user_organizations` on login (most recent membership)
- Legacy `users.organizationId` / `users.role` columns have been removed

## Internationalization (i18n)

### Setup
- Library: `next-intl` in "without i18n routing" mode (cookie-based, no URL prefixes)
- Locale config: `src/i18n/request.ts` reads the `locale` cookie, defaults to `"en"`
- Provider: `NextIntlClientProvider` in root layout (`src/app/layout.tsx`)
- Supported locales: `en` (English), `mn` (Mongolian)
- User preference: `users.preferredLocale` column, changed via `PATCH /api/me/locale`

### Rules for new UI strings
- **Never hardcode user-facing strings.** All new text must go through translation files.
- Add keys to both `messages/en.json` and `messages/mn.json` — keep keys in sync.
- Use ICU message format: `{name}` for params, `{count, plural, one {# item} other {# items}}` for plurals.
- Namespace keys by feature: `Common`, `Nav`, `Dashboard`, `Notifications`, `Validation`, `Auth`, `Locale`.

### How to use translations
- **Client Components:** `const t = useTranslations('Namespace');` then `t('key')` or `t('key', { param: value })`
- **Server Components:** `const t = await getTranslations('Namespace');` then `t('key')`
- **API Routes / Server Actions:** `const t = await getTranslations({ locale, namespace: 'Namespace' });` — pass explicit locale
- **Notifications:** Use `titleKey`/`titleParams`/`locale` in `notify()` calls with the recipient's `preferredLocale`
- **Toast errors:** Use `toastApiError(res, "fallback message")` from `@/lib/toast-helpers`

### Translation file structure
```json
{
  "Namespace": {
    "key": "Value with {param}",
    "pluralKey": "{count, plural, one {# item} other {# items}}"
  }
}
```

### Date/time formatting
- Use `formatDate(date, locale)` and `formatTime(date, locale)` from `@/lib/i18n/date`
- Never hardcode `"en-US"` in `toLocaleDateString()` / `toLocaleTimeString()` calls

## Type Safety

### No `as any` — zero tolerance
- **Never** cast to `as any`. Every instance must use a proper type instead.
- If a library API forces dynamic typing, isolate the cast in a single helper function (see Drizzle section below).

### NextAuth session — already typed, don't re-cast
- `Session.user` is extended via module augmentation in `src/types/next-auth.d.ts` with `id`, `role`, `organizationId`.
- Access these directly: `session.user.id`, `session.user.role`, `session.user.organizationId`.
- **Never** cast `session.user as Record<string, unknown>` — the types already cover all custom fields.
- `organizationId` is `string | null | undefined` — use `as string` only after a null check guard.

### Dynamic DB rows — use `Record<string, unknown>`
- When a DB query returns a polymorphic/dynamic row (e.g., entity from a runtime-selected table), type it as `Record<string, unknown>`.
- Access fields with `row.fieldName as string` (narrowing individual properties), not by casting the entire row to `any`.

### Drizzle dynamic table access — use `col()` helper
- Agent handlers access Drizzle table columns by dynamic string key. Use the typed `col(table, name)` helper from `src/lib/agent/types.ts` instead of `(table as any)[name]`.
- Table configs use `DrizzleTable` type (intersection of `Table` + `Record<string, any>`) — not bare `any`.
- Type filter condition arrays as `ReturnType<typeof eq>[]`, not `any[]`.
- For `db.query` dynamic lookup by entity type string (e.g., `db.query[queryName]`), a single eslint-disable `as any` is acceptable at the lookup site with a `Record<string, unknown>` result type.

### Array narrowing — use `Array.isArray()`, not double-casts
- When a union type includes arrays (e.g., `string | string[]`), narrow with `Array.isArray(value)` at runtime.
- **Never** use `as unknown as string[]` double-casts — they hide type mismatches.

### `Promise.race` with timeouts
- Type the timeout branch as `new Promise<never>((_, reject) => ...)` so the race result inherits the real promise's type.
- Then narrow the result with a typed destructure, not `as any`.

### next-intl dynamic keys — accepted exception
- `t(dynamicKey)` requires `as any` because next-intl expects literal union types from translation files. This is the **one** accepted exception — mark with `// eslint-disable-next-line @typescript-eslint/no-explicit-any`.

## UI Rules

### NEVER use system alerts
- No `window.confirm()`, `window.alert()`, `window.prompt()` anywhere
- Use `useConfirm()` hook from `@/components/confirm-dialog` for confirmations
- Use inline forms for input collection
- Use inline status messages for success/error feedback

### Complete features
When building any capability, implement the full lifecycle:
- Create, Read, Update/Edit/Rename, Delete (with themed confirmation dialog)
- Loading, empty, error, success states
- Edge cases (long text, zero results, duplicate names)

### Other conventions
- Drawers stay open after save — close only via X or Escape
- AssignedTo uses `<AssignedToSelect>` component (user dropdown), never free text
- Entity drawers use tabs: Profile/Details, Pipeline, Checklist (for confirmed)
- Checklist tab + Invite to Portal button only shown for confirmed entities

## Testing
- Run: `npx vitest run`
- Test files: `tests/` directory
- Test suites: RBAC, checklist, security (run `npx vitest run` to see full count)
- Write regression tests for every security fix
- Write tests for every new CRUD operation

## Database
- Never use raw SQL for schema changes — always edit `src/db/schema.ts` + run `npx drizzle-kit push`
- Every table has: `id` (uuid PK), `organizationId` (FK), `createdAt`
- Mutable tables add: `version` (optimistic locking), `updatedAt`
- Checklist-related tables follow same conventions
