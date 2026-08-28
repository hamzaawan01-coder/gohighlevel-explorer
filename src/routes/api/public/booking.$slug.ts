import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { freeSlots, type Availability, type DayKey } from "@/lib/availability";

const bookSchema = z.object({
  starts_at: z.string().datetime(),
  name: z.string().min(1).max(120),
  email: z.string().email().max(255),
  phone: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
});

export const Route = createFileRoute("/api/public/booking/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: page } = await supabaseAdmin
          .from("booking_pages" as never)
          .select("slug, name, description, duration_minutes, buffer_minutes, advance_days, min_notice_minutes, timezone, availability, enabled, sub_account_id, owner_user_id")
          .eq("slug", params.slug)
          .maybeSingle();
        const p = page as unknown as {
          slug: string; name: string; description: string | null;
          duration_minutes: number; buffer_minutes: number; advance_days: number;
          min_notice_minutes: number; timezone: string;
          availability: Record<DayKey, { start: string; end: string }[]>;
          enabled: boolean; sub_account_id: string; owner_user_id: string;
        } | null;
        if (!p || !p.enabled) return new Response("Not found", { status: 404 });

        const now = new Date();
        const horizon = new Date(now.getTime() + p.advance_days * 24 * 60 * 60_000);
        const { data: taken } = await supabaseAdmin
          .from("calendar_events")
          .select("starts_at, ends_at, status")
          .eq("sub_account_id", p.sub_account_id)
          .eq("owner_user_id", p.owner_user_id)
          .gte("starts_at", now.toISOString())
          .lte("starts_at", horizon.toISOString());
        const busy = (taken ?? [])
          .filter((t) => (t as { status?: string }).status !== "cancelled")
          .map((t) => ({ starts_at: t.starts_at, ends_at: t.ends_at }));

        const slots = freeSlots(
          {
            availability: p.availability as Availability,
            durationMinutes: p.duration_minutes,
            bufferMinutes: p.buffer_minutes,
            advanceDays: p.advance_days,
            minNoticeMinutes: p.min_notice_minutes,
          },
          busy,
          now,
        );

        return Response.json({
          page: {
            slug: p.slug, name: p.name, description: p.description,
            duration_minutes: p.duration_minutes, buffer_minutes: p.buffer_minutes,
            advance_days: p.advance_days, min_notice_minutes: p.min_notice_minutes,
            timezone: p.timezone, availability: p.availability, enabled: p.enabled,
          },
          slots,
        });
      },
      POST: async ({ params, request }) => {
        let body: z.infer<typeof bookSchema>;
        try {
          body = bookSchema.parse(await request.json());
        } catch {
          return new Response("Invalid body", { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: page } = await supabaseAdmin
          .from("booking_pages" as never)
          .select("*")
          .eq("slug", params.slug)
          .maybeSingle();
        const p = page as unknown as {
          id: string; sub_account_id: string; owner_user_id: string;
          name: string; duration_minutes: number; min_notice_minutes: number; enabled: boolean;
          reminder_offsets: number[] | null; reminder_channel: "sms" | "email" | "both" | null;
          reminder_template: string | null; confirmation_enabled: boolean | null; timezone: string;
          reminder_in_app: boolean | null; allow_reschedule: boolean | null;
        } | null;
        if (!p || !p.enabled) return new Response("Not found", { status: 404 });

        const starts = new Date(body.starts_at);
        const minStart = new Date(Date.now() + p.min_notice_minutes * 60_000);
        if (starts < minStart) return new Response("Slot no longer available", { status: 409 });
        const ends = new Date(starts.getTime() + p.duration_minutes * 60_000);

        // Conflict check
        const { data: conflicts } = await supabaseAdmin
          .from("calendar_events")
          .select("id")
          .eq("sub_account_id", p.sub_account_id)
          .eq("owner_user_id", p.owner_user_id)
          .lt("starts_at", ends.toISOString())
          .gt("ends_at", starts.toISOString());
        if (conflicts && conflicts.length > 0) {
          return new Response("Slot no longer available", { status: 409 });
        }

        // Upsert contact by email
        const [first_name, ...rest] = body.name.trim().split(/\s+/);
        const last_name = rest.join(" ") || null;
        let contactId: string | null = null;
        const { data: existing } = await supabaseAdmin
          .from("contacts")
          .select("id")
          .eq("sub_account_id", p.sub_account_id)
          .eq("email", body.email)
          .maybeSingle();
        if (existing?.id) {
          contactId = existing.id;
          await supabaseAdmin.from("contacts").update({
            first_name, last_name, phone: body.phone ?? null,
          } as never).eq("id", existing.id);
        } else {
          const { data: created, error } = await supabaseAdmin.from("contacts").insert({
            sub_account_id: p.sub_account_id,
            owner_id: p.owner_user_id,
            first_name,
            last_name,
            email: body.email,
            phone: body.phone ?? null,
            lifecycle_stage: "lead",
            lead_source: "Booking",
            tags: [],
          }).select("id").single();
          if (error) return new Response("Could not create contact", { status: 500 });
          contactId = created.id;
        }

        const { data: event, error: eErr } = await supabaseAdmin
          .from("calendar_events")
          .insert({
            sub_account_id: p.sub_account_id,
            owner_user_id: p.owner_user_id,
            title: `${p.name} — ${body.name}`,
            description: body.notes ?? null,
            starts_at: starts.toISOString(),
            ends_at: ends.toISOString(),
            all_day: false,
            contact_id: contactId,
            booking_page_id: p.id,
            attendee_email: body.email,
            attendee_phone: body.phone ?? null,
            status: "confirmed",
            reschedule_token: crypto.randomUUID().replace(/-/g, ""),
            original_starts_at: starts.toISOString(),
          } as never)
          .select("id, reschedule_token")
          .single();
        if (eErr || !event) return new Response("Could not create event", { status: 500 });

        // Schedule reminders + optional instant confirmation. Never fail the
        // booking itself if reminder scheduling has a problem.
        try {
          const { scheduleRemindersForEvent, renderReminder, logAppointmentAudit, postAppointmentNote } =
            await import("@/lib/appointments.server");
          await scheduleRemindersForEvent({
            subAccountId: p.sub_account_id,
            eventId: event.id,
            startsAt: starts.toISOString(),
            offsets: p.reminder_offsets ?? [1440, 60],
            channel: p.reminder_channel ?? "sms",
            inApp: p.reminder_in_app !== false,
          });
          await logAppointmentAudit({
            subAccountId: p.sub_account_id,
            action: "booked",
            eventId: event.id,
            bookingPageId: p.id,
            contactId: contactId,
            actorLabel: body.email,
            detail: `Booked ${p.name} for ${starts.toISOString()}`,
            metadata: { source: "public booking page", slug: params.slug },
          });
          await postAppointmentNote({
            subAccountId: p.sub_account_id,
            contactId,
            body: `Appointment booked: ${p.name} on ${starts.toISOString()}`,
          });

          if (p.confirmation_enabled !== false) {
            const tz = p.timezone || "UTC";
            const date = new Intl.DateTimeFormat("en-GB", {
              timeZone: tz, weekday: "short", day: "numeric", month: "short",
            }).format(starts);
            const time = new Intl.DateTimeFormat("en-GB", {
              timeZone: tz, hour: "2-digit", minute: "2-digit",
            }).format(starts);
            const text = renderReminder(
              `Thanks {{name}} — your {{title}} is confirmed for {{date}} at {{time}}.`,
              { title: p.name, date, time, name: first_name || "there" },
            );
            const channels = p.reminder_channel === "both"
              ? (["email", "sms"] as const)
              : ([p.reminder_channel ?? "sms"] as const);
            for (const ch of channels) {
              const to = ch === "sms" ? body.phone ?? null : body.email;
              if (!to) continue;
              await supabaseAdmin.from("outbound_messages").insert({
                sub_account_id: p.sub_account_id,
                channel: ch,
                to_address: to,
                subject: ch === "email" ? `Confirmed: ${p.name}` : null,
                body_text: text,
                contact_id: contactId,
                status: "queued",
              } as never);
            }
          }
        } catch {
          // best-effort
        }

        const token = (event as { reschedule_token: string | null }).reschedule_token;
        return Response.json({
          ok: true,
          reschedule_url:
            p.allow_reschedule !== false && token ? `/booking/reschedule/${token}` : null,
        });
      },
    },
  },
});
