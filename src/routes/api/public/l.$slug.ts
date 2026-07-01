import { createFileRoute } from "@tanstack/react-router";

/**
 * Public trigger-link redirect. Logs the click, fires the link.clicked
 * workflow trigger, then 302s the visitor to the link's target URL.
 * Optional query params:
 *   ?c=<contact_id>  → attribute click to a contact (used in email/SMS)
 */
export const Route = createFileRoute("/api/public/l/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const url = new URL(request.url);
        const contactId = url.searchParams.get("c");

        const { data: link } = await supabaseAdmin
          .from("trigger_links")
          .select("id, sub_account_id, target_url, enabled, click_count")
          .eq("slug", params.slug)
          .maybeSingle();

        if (!link || !link.enabled) {
          return new Response("Link not found", { status: 404 });
        }

        const ua = request.headers.get("user-agent") ?? "";
        const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("cf-connecting-ip") ?? "";

        await supabaseAdmin.from("trigger_link_clicks").insert({
          link_id: link.id,
          sub_account_id: link.sub_account_id,
          contact_id: contactId,
          ip_address: ip.split(",")[0].trim() || null,
          user_agent: ua.slice(0, 512),
        });

        await supabaseAdmin
          .from("trigger_links")
          .update({ click_count: (link.click_count ?? 0) + 1 })
          .eq("id", link.id);

        // Fire link.clicked workflow trigger
        try {
          await supabaseAdmin.rpc("run_workflows", {
            _trigger: "link.clicked",
            _sub: link.sub_account_id,
            _row_id: link.id,
            _payload: { link_id: link.id, contact_id: contactId, slug: params.slug },
          });
        } catch {
          // don't block redirect on workflow errors
        }

        return new Response(null, {
          status: 302,
          headers: { Location: link.target_url, "Cache-Control": "no-store" },
        });
      },
    },
  },
});
