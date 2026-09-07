import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "create_contact",
  title: "Create contact",
  description: "Create a new CRM contact owned by the signed-in user.",
  inputSchema: {
    first_name: z.string().trim().min(1).describe("Contact first name."),
    last_name: z.string().trim().optional().describe("Contact last name."),
    email: z.string().trim().email().optional().describe("Contact email address."),
    phone: z.string().trim().optional().describe("Contact phone number in E.164 format when possible."),
    company: z.string().trim().optional().describe("Company name."),
    lead_source: z.string().trim().optional().describe("Where the lead came from."),
    notes: z.string().trim().optional().describe("Free-form notes about the contact."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("contacts")
      .insert({ ...input, owner_id: ctx.getUserId() })
      .select("id, first_name, last_name, email, phone, company, created_at");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data?.[0] ?? null) }],
      structuredContent: { contact: data?.[0] ?? null },
    };
  },
});
