import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Send a campaign now: expand the segment into contacts, enqueue outbound
 * messages, create per-recipient tracking rows, update campaign counters.
 * RLS scopes everything to sub-accounts the caller can access.
 */
export const sendCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId: string }) => z.object({ campaignId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    const { data: campaign, error: cErr } = await sb
      .from("campaigns" as never)
      .select("*")
      .eq("id", data.campaignId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!campaign) throw new Error("Campaign not found");
    const c = campaign as {
      id: string;
      sub_account_id: string;
      created_by: string;
      channel: "email" | "sms";
      subject: string | null;
      body_html: string | null;
      body_text: string | null;
      segment: Record<string, unknown>;
    };

    // Build segment query
    let q = sb.from("contacts").select("id, email, phone").eq("sub_account_id", c.sub_account_id);
    const seg = c.segment ?? {};
    const stage = seg["stage"] as string | undefined;
    const tags = seg["tags"] as string[] | undefined;
    if (stage) q = q.eq("lifecycle_stage", stage);
    if (tags && tags.length) q = q.overlaps("tags", tags);
    if (c.channel === "email") q = q.not("email", "is", null);
    if (c.channel === "sms") q = q.not("phone", "is", null);

    const { data: contacts, error: contactsErr } = await q.limit(5000);
    if (contactsErr) throw new Error(contactsErr.message);
    const rows = (contacts ?? []) as { id: string; email: string | null; phone: string | null }[];

    if (rows.length === 0) {
      await sb.from("campaigns" as never).update({ status: "sent", total_recipients: 0, sent_at: new Date().toISOString() } as never).eq("id", c.id);
      return { enqueued: 0 };
    }

    // Mark sending
    await sb
      .from("campaigns" as never)
      .update({ status: "sending", total_recipients: rows.length } as never)
      .eq("id", c.id);

    let enqueued = 0;
    for (const contact of rows) {
      const to = c.channel === "email" ? contact.email : contact.phone;
      if (!to) continue;

      // Enqueue outbound message
      const { data: msg, error: mErr } = await sb
        .from("outbound_messages")
        .insert({
          sub_account_id: c.sub_account_id,
          channel: c.channel,
          to_address: to,
          subject: c.subject,
          body_html: c.body_html,
          body_text: c.body_text,
          contact_id: contact.id,
          created_by: c.created_by,
        } as never)
        .select("id")
        .single();

      const outboundId = mErr ? null : (msg as { id: string }).id;

      await sb.from("campaign_recipients" as never).insert({
        campaign_id: c.id,
        sub_account_id: c.sub_account_id,
        contact_id: contact.id,
        outbound_message_id: outboundId,
        to_address: to,
        status: mErr ? "failed" : "queued",
        error: mErr?.message ?? null,
      } as never);

      if (!mErr) enqueued++;
    }

    await sb
      .from("campaigns" as never)
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_count: enqueued,
        failed_count: rows.length - enqueued,
      } as never)
      .eq("id", c.id);

    return { enqueued, total: rows.length };
  });
