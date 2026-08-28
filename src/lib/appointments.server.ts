/**
 * Server-only appointment reminder engine.
 *
 * Booking pages define reminder offsets (minutes before the appointment) and a
 * channel (sms / email / both). When a booking is made we create one
 * `appointment_reminders` row per offset+channel with `scheduled_for` set.
 * `enqueueDueReminders()` (called from the cron drain endpoint) turns every due
 * row into a normal `outbound_messages` row so the existing queue handles
 * provider selection, retries and logging.
 */

type Channel = "sms" | "email" | "in_app";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type AuditAction =
  | "booked"
  | "rescheduled"
  | "edited"
  | "cancelled"
  | "status_changed"
  | "reminder_sent"
  | "reminder_failed"
  | "reminder_skipped";

/** Append an entry to the appointment activity log. Never throws. */
export async function logAppointmentAudit(input: {
  subAccountId: string;
  action: AuditAction;
  eventId?: string | null;
  bookingPageId?: string | null;
  contactId?: string | null;
  actorUserId?: string | null;
  actorLabel?: string | null;
  channel?: string | null;
  detail?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const sb = await admin();
    await sb.from("appointment_audit").insert({
      sub_account_id: input.subAccountId,
      action: input.action,
      event_id: input.eventId ?? null,
      booking_page_id: input.bookingPageId ?? null,
      contact_id: input.contactId ?? null,
      actor_user_id: input.actorUserId ?? null,
      actor_label: input.actorLabel ?? null,
      channel: input.channel ?? null,
      detail: input.detail ?? null,
      metadata: input.metadata ?? {},
    } as never);
  } catch {
    // auditing must never break the caller
  }
}

/**
 * Keep the contact's inbox thread in step with appointment activity by posting
 * an internal note. Best-effort: never throws.
 */
export async function postAppointmentNote(input: {
  subAccountId: string;
  contactId: string | null;
  body: string;
}): Promise<void> {
  if (!input.contactId) return;
  try {
    const sb = await admin();
    const { data: existing } = await sb
      .from("conversations")
      .select("id")
      .eq("sub_account_id", input.subAccountId)
      .eq("contact_id", input.contactId)
      .eq("channel", "note")
      .maybeSingle();
    let convoId = (existing as { id: string } | null)?.id ?? null;
    if (!convoId) {
      const { data: created } = await sb
        .from("conversations")
        .insert({
          sub_account_id: input.subAccountId,
          contact_id: input.contactId,
          channel: "note",
          status: "open",
        } as never)
        .select("id")
        .single();
      convoId = (created as { id: string } | null)?.id ?? null;
    }
    if (!convoId) return;
    await sb.from("messages").insert({
      sub_account_id: input.subAccountId,
      conversation_id: convoId,
      contact_id: input.contactId,
      channel: "note",
      direction: "outbound",
      kind: "note",
      body: input.body,
    } as never);
  } catch {
    // best-effort
  }
}

export const DEFAULT_REMINDER_TEMPLATE =
  "Reminder: {{title}} on {{date}} at {{time}}. Reply here if you need to reschedule.";

export function renderReminder(
  template: string | null | undefined,
  vars: { title: string; date: string; time: string; name: string },
): string {
  const t = template?.trim() || DEFAULT_REMINDER_TEMPLATE;
  return t
    .replace(/\{\{\s*title\s*\}\}/gi, vars.title)
    .replace(/\{\{\s*date\s*\}\}/gi, vars.date)
    .replace(/\{\{\s*time\s*\}\}/gi, vars.time)
    .replace(/\{\{\s*name\s*\}\}/gi, vars.name);
}

function fmt(iso: string, timezone: string) {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { timeZone: timezone || "UTC" };
  const date = new Intl.DateTimeFormat("en-GB", {
    ...opts,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    ...opts,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return { date, time };
}

/** Create the reminder rows for a newly booked appointment. */
export async function scheduleRemindersForEvent(input: {
  subAccountId: string;
  eventId: string;
  startsAt: string;
  offsets: number[];
  channel: "sms" | "email" | "both";
  inApp?: boolean;
}): Promise<number> {
  const sb = await admin();
  const channels: Channel[] =
    input.channel === "both" ? ["sms", "email"] : [input.channel];
  if (input.inApp) channels.push("in_app");
  const startMs = new Date(input.startsAt).getTime();

  const rows = channels.flatMap((channel) =>
    (input.offsets ?? [])
      .filter((m) => Number.isFinite(m) && m > 0)
      .map((offset) => ({
        sub_account_id: input.subAccountId,
        event_id: input.eventId,
        offset_minutes: offset,
        channel,
        scheduled_for: new Date(startMs - offset * 60_000).toISOString(),
        status: "pending" as const,
      }))
      // Nothing to do for offsets already in the past.
      .filter((r) => new Date(r.scheduled_for).getTime() > Date.now() - 60_000),
  );

  if (rows.length === 0) return 0;
  const { error } = await sb
    .from("appointment_reminders")
    .upsert(rows as never, { onConflict: "event_id,offset_minutes,channel" });
  if (error) throw new Error(error.message);
  return rows.length;
}

type DueRow = {
  id: string;
  sub_account_id: string;
  event_id: string;
  offset_minutes: number;
  channel: Channel;
};

/**
 * Turn every due reminder into an outbound message. Never throws — a bad row is
 * marked failed/skipped so one appointment cannot break the cron run.
 */
export async function enqueueDueReminders(limit = 50): Promise<{
  due: number;
  queued: number;
  skipped: number;
  failed: number;
}> {
  const sb = await admin();
  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from("appointment_reminders")
    .select("id, sub_account_id, event_id, offset_minutes, channel")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as DueRow[];
  let queued = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of rows) {
    try {
      const { data: ev } = await sb
        .from("calendar_events")
        .select(
          "id, title, starts_at, status, attendee_email, attendee_phone, contact_id, booking_page_id",
        )
        .eq("id", r.event_id)
        .maybeSingle();
      const event = ev as unknown as {
        id: string;
        title: string;
        starts_at: string;
        status: string;
        attendee_email: string | null;
        attendee_phone: string | null;
        contact_id: string | null;
        booking_page_id: string | null;
      } | null;

      if (!event || event.status === "cancelled") {
        await mark(sb, r.id, "skipped", "Appointment cancelled or missing");
        skipped++;
        continue;
      }
      // Appointment already started — a reminder is pointless.
      if (new Date(event.starts_at).getTime() < Date.now() - 60_000) {
        await mark(sb, r.id, "skipped", "Appointment already started");
        skipped++;
        continue;
      }

      let template: string | null = null;
      let timezone = "UTC";
      if (event.booking_page_id) {
        const { data: page } = await sb
          .from("booking_pages" as never)
          .select("reminder_template, timezone")
          .eq("id", event.booking_page_id)
          .maybeSingle();
        const p = page as unknown as { reminder_template: string | null; timezone: string } | null;
        template = p?.reminder_template ?? null;
        timezone = p?.timezone || "UTC";
      }

      let name = "there";
      let email = event.attendee_email;
      let phone = event.attendee_phone;
      if (event.contact_id) {
        const { data: contact } = await sb
          .from("contacts")
          .select("first_name, last_name, email, phone")
          .eq("id", event.contact_id)
          .maybeSingle();
        if (contact) {
          name = contact.first_name || name;
          email = email ?? contact.email;
          phone = phone ?? contact.phone;
        }
      }

      const { date: dNow, time: tNow } = fmt(event.starts_at, timezone);

      // In-app reminders become notifications for the workspace owner instead
      // of an outbound provider message.
      if (r.channel === "in_app") {
        const { data: evOwner } = await sb
          .from("calendar_events")
          .select("owner_user_id")
          .eq("id", r.event_id)
          .maybeSingle();
        const ownerId = (evOwner as { owner_user_id: string | null } | null)?.owner_user_id ?? null;
        if (!ownerId) {
          await mark(sb, r.id, "skipped", "No owner to notify");
          skipped++;
          continue;
        }
        await sb.from("notifications").insert({
          user_id: ownerId,
          sub_account_id: r.sub_account_id,
          title: `Upcoming: ${event.title}`,
          body: `${dNow} at ${tNow}`,
          link: "/calendar",
        } as never);
        await sb
          .from("appointment_reminders")
          .update({
            status: "queued",
            delivery_status: "delivered",
            delivered_at: new Date().toISOString(),
            error: null,
          } as never)
          .eq("id", r.id);
        await logAppointmentAudit({
          subAccountId: r.sub_account_id,
          action: "reminder_sent",
          eventId: r.event_id,
          contactId: event.contact_id,
          channel: "in_app",
          detail: `In-app reminder ${r.offset_minutes} min before`,
        });
        queued++;
        continue;
      }

      const to = r.channel === "sms" ? phone : email;
      if (!to) {
        await mark(sb, r.id, "skipped", `No ${r.channel === "sms" ? "phone" : "email"} on file`);
        skipped++;
        continue;
      }

      const { date, time } = fmt(event.starts_at, timezone);
      const body = renderReminder(template, { title: event.title, date, time, name });

      const { data: msg, error: insErr } = await sb
        .from("outbound_messages")
        .insert({
          sub_account_id: r.sub_account_id,
          channel: r.channel,
          to_address: to,
          subject: r.channel === "email" ? `Reminder: ${event.title}` : null,
          body_text: body,
          contact_id: event.contact_id,
          status: "queued",
        } as never)
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);

      await sb
        .from("appointment_reminders")
        .update({
          status: "queued",
          outbound_message_id: (msg as { id: string }).id,
          error: null,
        } as never)
        .eq("id", r.id);
      await logAppointmentAudit({
        subAccountId: r.sub_account_id,
        action: "reminder_sent",
        eventId: r.event_id,
        contactId: event.contact_id,
        channel: r.channel,
        detail: `Queued ${r.channel} reminder to ${to}`,
        metadata: { outbound_message_id: (msg as { id: string }).id },
      });
      queued++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await mark(sb, r.id, "failed", msg);
      failed++;
    }
  }

  return { due: rows.length, queued, skipped, failed };
}

async function mark(
  sb: Awaited<ReturnType<typeof admin>>,
  id: string,
  status: "skipped" | "failed",
  error: string,
) {
  const { data } = await sb
    .from("appointment_reminders")
    .update({
      status,
      error,
      delivery_status: status === "failed" ? "failed" : null,
    } as never)
    .eq("id", id)
    .select("sub_account_id, event_id, channel")
    .maybeSingle();
  const row = data as unknown as
    | { sub_account_id: string; event_id: string; channel: string }
    | null;
  if (row) {
    await logAppointmentAudit({
      subAccountId: row.sub_account_id,
      action: status === "failed" ? "reminder_failed" : "reminder_skipped",
      eventId: row.event_id,
      channel: row.channel,
      detail: error,
    });
  }
}

/** Cancel every reminder that has not gone out yet for an appointment. */
export async function cancelPendingReminders(eventId: string, reason: string): Promise<void> {
  const sb = await admin();
  await sb
    .from("appointment_reminders")
    .update({ status: "skipped", error: reason } as never)
    .eq("event_id", eventId)
    .eq("status", "pending");
}

/**
 * Move pending reminders to match a new appointment start time. Reminders whose
 * new send time is already in the past are dropped.
 */
export async function reschedulePendingReminders(
  eventId: string,
  newStartsAt: string,
): Promise<number> {
  const sb = await admin();
  const { data } = await sb
    .from("appointment_reminders")
    .select("id, offset_minutes")
    .eq("event_id", eventId)
    .eq("status", "pending");
  const rows = (data ?? []) as unknown as { id: string; offset_minutes: number }[];
  const startMs = new Date(newStartsAt).getTime();
  let moved = 0;
  for (const r of rows) {
    const when = new Date(startMs - r.offset_minutes * 60_000);
    if (when.getTime() <= Date.now() - 60_000) {
      await sb
        .from("appointment_reminders")
        .update({ status: "skipped", error: "New time too close for this reminder" } as never)
        .eq("id", r.id);
      continue;
    }
    await sb
      .from("appointment_reminders")
      .update({ scheduled_for: when.toISOString(), error: null } as never)
      .eq("id", r.id);
    moved++;
  }
  return moved;
}
