import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const statusSchema = z.object({
  eventId: z.string().uuid(),
  status: z.enum(["confirmed", "cancelled", "no_show", "completed"]),
});

/**
 * Change an appointment's status as the signed-in user (RLS enforced), then
 * record the audit entry and thread note with service-role access.
 */
export const changeAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof statusSchema>) => statusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: ev, error } = await context.supabase
      .from("calendar_events")
      .update({ status: data.status } as never)
      .eq("id", data.eventId)
      .select("id, sub_account_id, title, contact_id, booking_page_id, status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const event = ev as unknown as {
      id: string;
      sub_account_id: string;
      title: string;
      contact_id: string | null;
      booking_page_id: string | null;
    } | null;
    if (!event) throw new Error("Appointment not found");

    const { cancelPendingReminders, logAppointmentAudit, postAppointmentNote } = await import(
      "@/lib/appointments.server"
    );
    if (data.status === "cancelled") {
      await cancelPendingReminders(event.id, "Appointment cancelled");
    }
    await logAppointmentAudit({
      subAccountId: event.sub_account_id,
      action: data.status === "cancelled" ? "cancelled" : "status_changed",
      eventId: event.id,
      bookingPageId: event.booking_page_id,
      contactId: event.contact_id,
      actorUserId: context.userId,
      actorLabel: (context.claims as { email?: string } | null)?.email ?? "Team member",
      detail: `Status set to ${data.status}`,
    });
    await postAppointmentNote({
      subAccountId: event.sub_account_id,
      contactId: event.contact_id,
      body: `Appointment "${event.title}" marked ${data.status}.`,
    });
    return { ok: true };
  });
