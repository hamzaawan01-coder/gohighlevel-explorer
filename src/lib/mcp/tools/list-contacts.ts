import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_contacts",
  title: "List contacts",
  description: "List CRM contacts for the signed-in user, newest first, with optional name/email/phone search.",
  inputSchema: {
    search: z.string().trim().optional().describe("Optional text to match against name, email or phone."),
    limit: z.number().int().min(1).max(100).default(25).describe("Maximum number of contacts to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("contacts")
      .select("id, first_name, last_name, email, phone, company, lifecycle_stage, lead_source, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (search) {
      const like = `%${search}%`;
      query = query.or(
        `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like},company.ilike.${like}`,
      );
    }
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { contacts: data ?? [] },
    };
  },
});
