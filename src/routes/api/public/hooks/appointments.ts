import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

/**
 * Inbound appointment-status webhook.
 *
 * External schedulers (or a calendar sync) POST status changes here. The caller
 * must sign the raw body with APPOINTMENT_WEBHOOK_SECRET:
 *   x-appointment-signature: sha256=<hex hmac of raw body>
 *
 * Effects: updates the appointment status, cancels reminders when needed,
 * records an audit entry, and posts a note into the contact's inbox thread so
 * the conversation stays consistent with the calendar.
 */
const payloadSchema = z.object({
  event_id: z.string().uuid().optional(),
  reschedule_token: z.string().min(8).max(64).optional(),
  status: z.enum(["confirmed", "cancelled", "no_show", "completed"]),
  starts_at: z.string().datetime().optional(),
  source: z.string().max(80).optional(),
});

function verify(raw: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const provided = header.startsWith("sha256=") ? header.slice(7) : header;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/hooks/appointments")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["APPOINTMENT_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });

        const raw = await request.text();
        if (!verify(raw, request.headers.get("x-appointment-signature"), secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let body: z.infer<typeof payloadSchema>;
        try {
          body = payloadSchema.parse(JSON.parse(raw));
        } catch {
          return new Response("Invalid body", { status: 400 });
        }
        if (!body.event_id && !body.reschedule_token) {
          return new Response("event_id or reschedule_token required", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const query = supabaseAdmin
          .from("calendar_events")
          .select("id, sub_account_id, owner_user_id, title, starts_at, status, contact_id, booking_page_id");
        const { data: ev } = body.event_id
          ? await query.eq("id", body.event_id).maybeSingle()
          : await query.eq("reschedule_token", body.reschedule_token!).maybeSingle();
        const event = ev as unknown as {
          id: string;
          sub_account_id: string;
          owner_user_id: string;
          title: string;
          starts_at: string;
          status: string;
          contact_id: string | null;
          booking_page_id: string | null;
        } | null;
        if (!event) return new Response("Appointment not found", { status: 404 });

        const patch: Record<string, unknown> = { status: body.status };
        if (body.starts_at) {
          patch["starts_at"] = body.starts_at;
          patch["rescheduled_at"] = new Date().toISOString();
        }
        const { error } = await supabaseAdmin
          .from("calendar_events")
          .update(patch as never)
          .eq("id", event.id);
        if (error) return new Response("Could not update appointment", { status: 500 });

        const {
          cancelPendingReminders,
          reschedulePendingReminders,
          logAppointmentAudit,
          postAppointmentNote,
        } = await import("@/lib/appointments.server");

        let remindersMoved = 0;
        if (body.status === "cancelled") {
          await cancelPendingReminders(event.id, "Appointment cancelled by webhook");
        } else if (body.starts_at) {
          remindersMoved = await reschedulePendingReminders(event.id, body.starts_at);
        }

        await logAppointmentAudit({
          subAccountId: event.sub_account_id,
          action: body.starts_at ? "rescheduled" : "status_changed",
          eventId: event.id,
          bookingPageId: event.booking_page_id,
          contactId: event.contact_id,
          actorLabel: body.source ?? "webhook",
          detail: body.starts_at
            ? `Webhook moved appointment to ${body.starts_at} (${body.status})`
            : `Webhook set status to ${body.status}`,
          metadata: { previous_status: event.status, reminders_moved: remindersMoved },
        });

        await postAppointmentNote({
          subAccountId: event.sub_account_id,
          contactId: event.contact_id,
          body: body.starts_at
            ? `Appointment "${event.title}" rescheduled to ${body.starts_at} (${body.status}).`
            : `Appointment "${event.title}" is now ${body.status}.`,
        });

        await supabaseAdmin.from("notifications").insert({
          user_id: event.owner_user_id,
          sub_account_id: event.sub_account_id,
          title: `Appointment ${body.status}: ${event.title}`,
          body: body.starts_at ? `New time ${body.starts_at}` : null,
          link: "/calendar",
        } as never);

        return Response.json({ ok: true, reminders_moved: remindersMoved });
      },
    },
  },
});
