import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  conversationId: z.string().uuid(),
  origin: z.string().optional(),
});

type Settings = {
  enabled: boolean;
  business_info: string;
  tone: string;
  extra_instructions: string;
  signature: string;
  use_contact_context: boolean;
  use_deal_context: boolean;
  offer_booking_link: boolean;
  booking_page_id: string | null;
  suggest_escalation: boolean;
};

/**
 * Draft a suggested reply for a conversation. Reads through the caller's own
 * session (RLS applies) and calls Lovable AI server-side.
 */
export const suggestReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof schema>) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: convo, error: cErr } = await context.supabase
      .from("conversations")
      .select("id, sub_account_id, contact_id, channel")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    const conversation = convo as unknown as {
      id: string;
      sub_account_id: string;
      contact_id: string;
      channel: string;
    } | null;
    if (!conversation) throw new Error("Conversation not found");

    const { data: settingsRow } = await context.supabase
      .from("ai_assistant_settings" as never)
      .select("*")
      .eq("sub_account_id", conversation.sub_account_id)
      .maybeSingle();
    const settings = (settingsRow ?? null) as unknown as Settings | null;
    if (settings && settings.enabled === false) {
      throw new Error("The AI reply assistant is turned off for this workspace.");
    }

    const { data: msgRows } = await context.supabase
      .from("messages")
      .select("direction, channel, body, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(25);
    const messages = ((msgRows ?? []) as unknown as {
      direction: string;
      channel: string;
      body: string;
      created_at: string;
    }[])
      .slice()
      .reverse()
      .map((m) => ({ direction: m.direction, channel: m.channel, body: m.body, at: m.created_at }));

    let contact: {
      name: string;
      email: string | null;
      phone: string | null;
      stage: string | null;
    } | null = null;
    let deal: { title: string; stage: string | null; value: number | null } | null = null;

    if (settings?.use_contact_context !== false) {
      const { data: cRow } = await context.supabase
        .from("contacts")
        .select("first_name, last_name, email, phone, lifecycle_stage")
        .eq("id", conversation.contact_id)
        .maybeSingle();
      const c = cRow as unknown as {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        phone: string | null;
        lifecycle_stage: string | null;
      } | null;
      if (c) {
        contact = {
          name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "there",
          email: c.email,
          phone: c.phone,
          stage: c.lifecycle_stage,
        };
      }
    }

    if (settings?.use_deal_context !== false) {
      const { data: dRow } = await context.supabase
        .from("deals")
        .select("title, value, pipeline_stages(name)")
        .eq("contact_id", conversation.contact_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const d = dRow as unknown as {
        title: string;
        value: number | null;
        pipeline_stages: { name: string } | null;
      } | null;
      if (d) deal = { title: d.title, stage: d.pipeline_stages?.name ?? null, value: d.value };
    }

    let bookingUrl: string | null = null;
    if (settings?.offer_booking_link !== false && data.origin) {
      const query = context.supabase
        .from("booking_pages")
        .select("slug")
        .eq("sub_account_id", conversation.sub_account_id)
        .eq("enabled", true);
      const { data: bRow } = settings?.booking_page_id
        ? await query.eq("id", settings.booking_page_id).maybeSingle()
        : await query.limit(1).maybeSingle();
      const slug = (bRow as unknown as { slug: string } | null)?.slug;
      if (slug) bookingUrl = `${data.origin.replace(/\/$/, "")}/b/${slug}`;
    }

    const { data: kbRows } = await context.supabase
      .from("ai_knowledge_docs" as never)
      .select("title, content")
      .eq("sub_account_id", conversation.sub_account_id)
      .eq("enabled", true)
      .order("updated_at", { ascending: false })
      .limit(10);
    const knowledge = ((kbRows ?? []) as unknown as { title: string; content: string }[]).map((k) => ({
      title: k.title,
      content: k.content,
    }));

    const { data: fbRows } = await context.supabase
      .from("ai_draft_feedback" as never)
      .select("rating, draft, note")
      .eq("sub_account_id", conversation.sub_account_id)
      .order("created_at", { ascending: false })
      .limit(12);
    const feedback = ((fbRows ?? []) as unknown as {
      rating: "up" | "down";
      draft: string;
      note: string;
    }[]).map((f) => ({ rating: f.rating, draft: f.draft, note: f.note }));

    const { generateReplyDraft } = await import("@/lib/ai-assistant.server");
    return generateReplyDraft({
      channel: conversation.channel,
      tone: settings?.tone || "friendly and professional",
      businessInfo: settings?.business_info ?? "",
      extraInstructions: settings?.extra_instructions ?? "",
      signature: settings?.signature ?? "",
      bookingUrl,
      suggestEscalation: settings?.suggest_escalation !== false,
      contact,
      deal,
      messages,
    });
  });
