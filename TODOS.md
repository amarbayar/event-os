# TODOS

## Pending Review Dashboard
**Priority:** High
**Phase:** Phase 1 (after core API routes)
**What:** Add a web dashboard page showing speaker applications not yet processed by the agent.
**Why:** If the event queue fails silently, organizers miss applications. The dashboard queries speaker_applications directly, bypassing the queue — acts as a fallback and also serves organizers who prefer web over Telegram.
**Depends on:** Speaker application API routes
**Effort:** human: ~4h / CC: ~30min

## Email Fallback for Agent Notifications
**Priority:** Medium
**Phase:** Phase 1b or Phase 2
**What:** Add email fallback (via Resend or Supabase email) when Telegram message delivery fails.
**Why:** Design doc lists "Alert via email fallback" in failure modes but no email infrastructure is in the tech stack. Single-channel dependency on Telegram is a risk for critical notifications (payment reminders, deadline alerts).
**Depends on:** Bot relay infrastructure, email service provider selection
**Effort:** human: ~1d / CC: ~30min
**Note:** Email deliverability in Mongolia may need DKIM/SPF setup.
