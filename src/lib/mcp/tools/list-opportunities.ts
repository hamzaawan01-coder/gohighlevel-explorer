import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_opportunities",
  title: "List opportunities",
  description: "List sales opportunities (deals) for the signed-in user, newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(25).describe("Maximum number of opportunities to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("deals")
      .select("id, title, value, currency, expected_close_date, contact_id, stage_id, pipeline_id, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { opportunities: data ?? [] },
    };
  },
});
