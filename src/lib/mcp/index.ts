import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listContactsTool from "./tools/list-contacts";
import createContactTool from "./tools/create-contact";
import listOpportunitiesTool from "./tools/list-opportunities";
import listRecentMessagesTool from "./tools/list-conversations";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "gohighlevel-explorer",
  title: "GoHighlevel Explorer",
  version: "0.1.0",
  instructions:
    "Tools for the Leads Convert CRM. Use `list_contacts` and `create_contact` for CRM contacts, `list_opportunities` for the sales pipeline, and `list_recent_messages` for inbox activity. All data is scoped to the signed-in user's workspace.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listContactsTool, createContactTool, listOpportunitiesTool, listRecentMessagesTool],
});
