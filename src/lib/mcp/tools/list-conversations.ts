import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_recent_messages",
  title: "List recent messages",
  description: "List the most recent inbox messages (SMS, WhatsApp, Messenger, Instagram, email) with direction and channel.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(25).describe("Maximum number of messages to return."),
    channel: z.string().trim().optional().describe("Optional channel filter, e.g. sms, whatsapp, messenger, instagram, email."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, channel }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("messages")
      .select("id, conversation_id, channel, direction, body, delivery_status, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (channel) query = query.eq("channel", channel);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { messages: data ?? [] },
    };
  },
});
