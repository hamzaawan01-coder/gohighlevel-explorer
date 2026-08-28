import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { freeSlots, isSlotBookable, type Availability } from "@/lib/availability";

const patchSchema = z.object({ starts_at: z.string().datetime() });

type EventRow = {
  id: string;
  sub_account_id: string;
  owner_user_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  contact_id: string | null;
  booking_page_id: string | null;
  attendee_email: string | null;
  original_starts_at: string | null;
};

type PageRow = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  duration_minutes: number;
  buffer_minutes: number;
  advance_days: number;
  min_notice_minutes: number;
  availability: Availability;
  allow_reschedule: boolean | null;
  reminder_channel: "sms" | "email" | "both" | null;
  confirmation_enabled: boolean | null;
};

async function load(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: ev } = await supabaseAdmin
    .from("calendar_events")
    .select(
      "id, sub_account_id, owner_user_id, title, starts_at, ends_at, status, contact_id, booking_page_id, attendee_email, original_starts_at",
    )
    .eq("reschedule_token", token)
    .maybeSingle();
  const event = ev as unknown as EventRow | null;
  if (!event || !event.booking_page_id) return { supabaseAdmin, event: null, page: null };
  const { data: pg } = await supabaseAdmin
    .from("booking_pages" as never)
    .select(
      "id, name, slug, timezone, duration_minutes, buffer_minutes, advance_days, min_notice_minutes, availability, allow_reschedule, reminder_channel, confirmation_enabled",
    )
    .eq("id", event.booking_page_id)
    .maybeSingle();
  return { supabaseAdmin, event, page: pg as unknown as PageRow | null };
}

export const Route = createFileRoute("/api/public/booking/reschedule/$token")({
  server: {
    handlers: {
      // Public read: the attendee's own appointment plus alternative slots.
      GET: async ({ params }) => {
        const { supabaseAdmin, event, page } = await load(params.token);
        if (!event || !page || page.allow_reschedule === false) {
          return new Response("Not found", { status: 404 });
        }
        const now = new Date();
        const horizon = new Date(now.getTime() + page.advance_days * 24 * 60 * 60_000);
        const { data: taken } = await supabaseAdmin
          .from("calendar_events")
          .select("id, starts_at, ends_at, status")
          .eq("sub_account_id", event.sub_account_id)
          .eq("owner_user_id", event.owner_user_id)
          .gte("starts_at", now.toISOString())
          .lte("starts_at", horizon.toISOString());
        const busy = (taken ?? [])
          .filter((t) => t.id !== event.id && (t as { status?: string }).status !== "cancelled")
          .map((t) => ({ starts_at: t.starts_at, ends_at: t.ends_at }));

        return Response.json({
          appointment: {
            title: event.title,
            starts_at: event.starts_at,
            ends_at: event.ends_at,
            status: event.status,
            timezone: page.timezone,
          },
          page: { name: page.name, duration_minutes: page.duration_minutes },
          slots: freeSlots(
            {
              availability: page.availability,
              durationMinutes: page.duration_minutes,
              bufferMinutes: page.buffer_minutes,
              advanceDays: page.advance_days,
              minNoticeMinutes: page.min_notice_minutes,
            },
            busy,
            now,
          ),
        });
      },

      // Reschedule to a new time, re-checking availability server-side.
      POST: async ({ params, request }) => {
        let body: z.infer<typeof patchSchema>;
        try {
          body = patchSchema.parse(await request.json());
        } catch {
          return new Response("Invalid body", { status: 400 });
        }
        const { supabaseAdmin, event, page } = await load(params.token);
        if (!event || !page || page.allow_reschedule === false) {
          return new Response("Not found", { status: 404 });
        }
        if (event.status === "cancelled") {
          return new Response("Appointment was cancelled", { status: 409 });
        }

        const now = new Date();
        const horizon = new Date(now.getTime() + page.advance_days * 24 * 60 * 60_000);
        const { data: taken } = await supabaseAdmin
          .from("calendar_events")
          .select("id, starts_at, ends_at, status")
          .eq("sub_account_id", event.sub_account_id)
          .eq("owner_user_id", event.owner_user_id)
          .gte("starts_at", now.toISOString())
          .lte("starts_at", horizon.toISOString());
        const busy = (taken ?? [])
          .filter((t) => t.id !== event.id && (t as { status?: string }).status !== "cancelled")
          .map((t) => ({ starts_at: t.starts_at, ends_at: t.ends_at }));

        const check = isSlotBookable(
          body.starts_at,
          {
            availability: page.availability,
            durationMinutes: page.duration_minutes,
            bufferMinutes: page.buffer_minutes,
            advanceDays: page.advance_days,
            minNoticeMinutes: page.min_notice_minutes,
          },
          busy,
          now,
        );
        if (!check.ok) return new Response(check.reason, { status: 409 });

        const starts = new Date(body.starts_at);
        const ends = new Date(starts.getTime() + page.duration_minutes * 60_000);
        const previous = event.starts_at;

        const { error: uErr } = await supabaseAdmin
          .from("calendar_events")
          .update({
            starts_at: starts.toISOString(),
            ends_at: ends.toISOString(),
            status: "confirmed",
            rescheduled_at: new Date().toISOString(),
            original_starts_at: event.original_starts_at ?? previous,
          } as never)
          .eq("id", event.id);
        if (uErr) return new Response("Could not reschedule", { status: 500 });

        const { reschedulePendingReminders, logAppointmentAudit, postAppointmentNote } =
          await import("@/lib/appointments.server");
        const moved = await reschedulePendingReminders(event.id, starts.toISOString());
        await logAppointmentAudit({
          subAccountId: event.sub_account_id,
          action: "rescheduled",
          eventId: event.id,
          bookingPageId: page.id,
          contactId: event.contact_id,
          actorLabel: event.attendee_email,
          detail: `Moved from ${previous} to ${starts.toISOString()}`,
          metadata: { previous_starts_at: previous, reminders_moved: moved },
        });
        await postAppointmentNote({
          subAccountId: event.sub_account_id,
          contactId: event.contact_id,
          body: `Appointment rescheduled: ${page.name} moved to ${starts.toISOString()}`,
        });

        // Notify the workspace owner in-app.
        await supabaseAdmin.from("notifications").insert({
          user_id: event.owner_user_id,
          sub_account_id: event.sub_account_id,
          title: `Rescheduled: ${event.title}`,
          body: `New time ${starts.toISOString()}`,
          link: "/calendar",
        } as never);

        return Response.json({ ok: true, starts_at: starts.toISOString(), reminders_moved: moved });
      },
    },
  },
});
