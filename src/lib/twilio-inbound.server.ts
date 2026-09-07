/**
 * Server-only helpers shared by the inbound Twilio webhooks (SMS + WhatsApp).
 * Keeps conversation threading and team notifications consistent per channel.
 */

type Admin = { from: (t: string) => any };

/**
 * Get-or-create the conversation for a contact on a specific channel, so an
 * SMS thread and a WhatsApp thread stay separate instead of overwriting
 * each other's channel.
 */
export async function ensureInboundConversation(
  supabaseAdmin: Admin,
  args: {
    subAccountId: string;
    contactId: string;
    channel: "sms" | "whatsapp";
    twilioNumberId: string;
  },
): Promise<{ id: string } | { error: string }> {
  const { data: rows } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("contact_id", args.contactId)
    .eq("channel", args.channel)
    .order("created_at", { ascending: true })
    .limit(1);
  const existing = (rows ?? [])[0];

  if (existing) {
    await supabaseAdmin
      .from("conversations")
      .update({ twilio_number_id: args.twilioNumberId, status: "open" })
      .eq("id", existing.id);
    return { id: existing.id };
  }

  const { data: created, error } = await supabaseAdmin
    .from("conversations")
    .insert({
      sub_account_id: args.subAccountId,
      contact_id: args.contactId,
      channel: args.channel,
      twilio_number_id: args.twilioNumberId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: created.id };
}

/**
 * Tell the workspace team about an inbound message so it shows up in the
 * in-app Inbox and the notification bell. Best effort — never fails the
 * webhook.
 */
export async function notifyInboundMessage(
  supabaseAdmin: Admin,
  args: {
    subAccountId: string;
    contactId: string;
    channel: "sms" | "whatsapp";
    senderName: string;
    body: string;
  },
): Promise<void> {
  try {
    const { data: sub } = await supabaseAdmin
      .from("sub_accounts")
      .select("agency_id")
      .eq("id", args.subAccountId)
      .single();
    if (!sub?.agency_id) return;

    const [{ data: agencyMembers }, { data: subMembers }] = await Promise.all([
      supabaseAdmin.from("agency_memberships").select("user_id").eq("agency_id", sub.agency_id),
      supabaseAdmin
        .from("sub_account_memberships")
        .select("user_id")
        .eq("sub_account_id", args.subAccountId),
    ]);

    const ids = new Set<string>();
    for (const m of [...(agencyMembers ?? []), ...(subMembers ?? [])]) {
      if (m?.user_id) ids.add(m.user_id as string);
    }
    if (ids.size === 0) return;

    const label = args.channel === "whatsapp" ? "WhatsApp" : "text";
    const preview = args.body.length > 120 ? `${args.body.slice(0, 117)}…` : args.body;

    await supabaseAdmin.from("notifications").insert(
      [...ids].map((user_id) => ({
        user_id,
        sub_account_id: args.subAccountId,
        title: `New ${label} from ${args.senderName}`,
        body: preview || `(no message text)`,
        link: `/conversations`,
      })),
    );
  } catch {
    // Notifications are a convenience; inbound delivery must still succeed.
  }
}
