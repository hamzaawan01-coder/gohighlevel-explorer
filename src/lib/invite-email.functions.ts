import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  invitationId: z.string().uuid(),
  inviteUrl: z.string().url(),
});

/**
 * Emails a team invitation to its recipient. The invitation row is read as the
 * signed-in user (RLS enforced), so only members of the inviting agency can
 * trigger the send.
 */
export const sendInvitationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof schema>) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("invitations")
      .select("id, email, role, agency_id, accepted_at")
      .eq("id", data.invitationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const invite = row as unknown as {
      id: string;
      email: string;
      role: string;
      agency_id: string;
      accepted_at: string | null;
    } | null;
    if (!invite) throw new Error("Invitation not found");
    if (invite.accepted_at) return { sent: false as const, reason: "already_accepted" };

    let agencyName = "Lead Convert";
    const { data: agency } = await context.supabase
      .from("agencies")
      .select("name")
      .eq("id", invite.agency_id)
      .maybeSingle();
    agencyName = ((agency as unknown as { name?: string } | null)?.name) || agencyName;

    let inviterName = "";
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    inviterName = ((profile as unknown as { full_name?: string | null } | null)?.full_name) || "";

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("team-invite", invite.email, {
      templateData: {
        inviteUrl: data.inviteUrl,
        agencyName,
        inviterName,
        role: invite.role,
      },
      idempotencyKey: `team-invite-${invite.id}`,
    });
    return result;
  });
