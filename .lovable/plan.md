# Plan: Workflows, Conversations, Calendar (v1)

Three placeholders in the sidebar become real, in-app features. All data is scoped to the current sub-account and gated by the existing `has_subaccount_access` RLS helper. No external SMS/email/Google Calendar integrations in v1 — those are a follow-up.

## Scope

### C1. Workflows (automation engine)
Trigger → Action rules that fire from database events.

- **Triggers (v1):**
  - `contact.created`
  - `contact.stage_changed` (lifecycle_stage transitions to a chosen stage)
  - `deal.stage_changed` (moved into a chosen pipeline stage)
  - `task.completed`
- **Actions (v1):**
  - `create_task` (title, priority, due-in-N-days, assignee = trigger's owner)
  - `set_contact_stage` (change lifecycle_stage)
  - `add_contact_tag`
  - `create_notification` (in-app bell)
- Execution model: Postgres `AFTER INSERT/UPDATE` triggers on `contacts`, `deals`, `tasks` call a SECURITY DEFINER dispatcher that reads matching enabled workflows for the row's `sub_account_id` and performs the actions in the same transaction. Fast, no polling, no external HTTP.
- Every run is logged in `workflow_runs` (workflow_id, trigger_row, status, error, ran_at) so the UI can show recent activity.
- UI: `/workflows` list + a builder dialog (name, trigger dropdown + condition, ordered actions).

### C2. Notifications (dependency of Workflows)
- `notifications` table (user_id, sub_account_id, title, body, link, read_at).
- Bell in the header shows unread count and a dropdown of recent items.
- Realtime subscription so a workflow-created notification pops instantly.

### D1. Conversations (internal activity thread per contact)
- `conversations` table: one thread per contact.
- `messages` table: author_user_id, body, kind (`note` | `email_log` | `sms_log` — only `note` is user-writable in v1; the others exist so future integrations slot in without a migration).
- `/conversations` route: left pane = contacts with unread/latest snippet, right pane = thread + composer.
- Contact drawer/detail page gets an "Activity" tab reusing the same thread.

### D2. Calendar
- `calendar_events` table: title, description, starts_at, ends_at, all_day, location, contact_id (optional), deal_id (optional), owner_user_id.
- `/calendar` route: month + agenda view using shadcn Calendar + a day-panel list. Create/edit dialog.
- Tasks with a `due_at` are surfaced on the calendar read-only (union query) so the agenda shows both.
- Google Calendar sync is explicitly out of scope; hook point (an `external_id` column) is included for later.

## Explicitly deferred
- Email/SMS sending, WhatsApp, phone/voice.
- Google Calendar two-way sync.
- Time-based / cron triggers ("3 days after created"). Only immediate DB-event triggers in v1.
- Client portal (B) stays on hold.

## Technical outline

### New tables (all `sub_account_id` scoped, RLS via `has_subaccount_access`)

```text
workflows(id, sub_account_id, name, enabled, trigger_type,
          trigger_config jsonb, actions jsonb, created_by, timestamps)
workflow_runs(id, workflow_id, sub_account_id, trigger_row_id,
              status, error, ran_at)
notifications(id, user_id, sub_account_id, title, body, link,
              read_at, created_at)
conversations(id, sub_account_id, contact_id UNIQUE, last_message_at)
messages(id, conversation_id, sub_account_id, author_user_id,
         kind, body, created_at)
calendar_events(id, sub_account_id, owner_user_id, title, description,
                starts_at, ends_at, all_day, location,
                contact_id, deal_id, external_id, timestamps)
```

Grants: `authenticated` + `service_role` on every table. RLS policies gate by `has_subaccount_access(auth.uid(), sub_account_id)`; notifications additionally scope select/update to `user_id = auth.uid()`.

### Workflow dispatcher

- `public.run_workflows(_trigger text, _row_id uuid, _sub uuid, _payload jsonb)` — SECURITY DEFINER, locked search_path, loops matching enabled workflows and applies actions.
- Row triggers on `contacts` / `deals` / `tasks` compute the trigger event and payload, then call the dispatcher. Actions run in the same transaction.
- Errors captured into `workflow_runs.error`; never abort the parent insert/update.

### Files to add / edit

```text
supabase/migrations/<new>.sql          workflows, workflow_runs, notifications,
                                        conversations, messages, calendar_events,
                                        dispatcher + row triggers
src/lib/workflows.ts                    CRUD + types + trigger/action registry
src/lib/notifications.ts                fetch, mark read, realtime hook
src/lib/conversations.ts                fetch threads, send note
src/lib/calendar.ts                     fetch events (+task union), CRUD
src/routes/_authenticated/workflows.tsx list + builder dialog
src/routes/_authenticated/conversations.tsx
src/routes/_authenticated/calendar.tsx
src/components/NotificationBell.tsx     replaces the static Bell in AppShell
src/components/WorkflowBuilder.tsx      trigger + ordered actions form
src/components/EventDialog.tsx          create/edit calendar events
src/components/AppShell.tsx             wire NotificationBell, keep nav items
```

## Rollout order

1. Migration + shared libs.
2. Notifications (bell + realtime) — small, unlocks workflow output.
3. Workflows list + builder + dispatcher end-to-end.
4. Conversations (notes thread).
5. Calendar (events + task overlay).

## Risks

- Workflow triggers run in the write's transaction, so a buggy action rolls back the user's write. Mitigation: dispatcher wraps each action in `BEGIN ... EXCEPTION WHEN OTHERS THEN log to workflow_runs`.
- No time-based triggers means "remind me in 3 days" isn't possible until we add pg_cron. Called out as deferred.
- Conversations table looks like a messaging surface but is note-only in v1. UI copy makes that explicit ("Internal notes").

Approve and I'll start with the migration, then Notifications → Workflows → Conversations → Calendar.
