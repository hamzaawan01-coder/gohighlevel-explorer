import { createFileRoute } from "@tanstack/react-router";
import { fetchCampaignDailyInsights } from "@/lib/meta.server";

type AdAccountRow = {
  id: string;
  sub_account_id: string;
  ad_account_id: string;
  name: string | null;
  currency: string | null;
};

function leadCount(actions?: { action_type: string; value: string }[]): number {
  if (!actions) return 0;
  return actions
    .filter((a) => a.action_type === "lead" || a.action_type.endsWith("_lead"))
    .reduce((sum, a) => sum + Number(a.value ?? 0), 0);
}

/**
 * Scheduled Meta Marketing API sync.
 * Pulls daily campaign-level insights for every connected ad account that is
 * flagged for reporting and upserts them into ad_spend_daily.
 */
export const Route = createFileRoute("/api/public/hooks/sync-meta-ads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        if (!apiKey || apiKey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const sb = supabaseAdmin as any;

        const { data: conns, error: connErr } = await sb
          .from("meta_connections")
          .select("id, sub_account_id, access_token, created_by");
        if (connErr) {
          return new Response(JSON.stringify({ error: connErr.message }), { status: 500 });
        }

        const results: Array<{ sub_account_id: string; ad_account_id?: string; ok: boolean; rows?: number; error?: string }> = [];

        for (const conn of (conns ?? []) as Array<{ sub_account_id: string; access_token: string; created_by: string | null }>) {
          const { data: accts } = await sb
            .from("meta_ad_accounts")
            .select("id, sub_account_id, ad_account_id, name, currency")
            .eq("sub_account_id", conn.sub_account_id)
            .eq("use_for_reports", true);

          for (const a of (accts ?? []) as AdAccountRow[]) {
            try {
              const rows = await fetchCampaignDailyInsights(a.ad_account_id, conn.access_token, "last_7d");
              let written = 0;
              for (const r of rows) {
                if (!r.date_start || !r.campaign_id) continue;
                const patch = {
                  campaign_name: r.campaign_name ?? null,
                  spend: Number(r.spend ?? 0),
                  impressions: Number(r.impressions ?? 0),
                  clicks: Number(r.clicks ?? 0),
                  leads: leadCount(r.actions),
                  currency: a.currency ?? "GBP",
                  entry_source: "meta_sync",
                };
                const { data: existing } = await sb
                  .from("ad_spend_daily")
                  .select("id")
                  .eq("sub_account_id", a.sub_account_id)
                  .eq("platform", "meta")
                  .eq("external_campaign_id", r.campaign_id)
                  .eq("spend_date", r.date_start)
                  .maybeSingle();
                if (existing?.id) {
                  await sb.from("ad_spend_daily").update(patch).eq("id", existing.id);
                } else {
                  await sb.from("ad_spend_daily").insert({
                    ...patch,
                    sub_account_id: a.sub_account_id,
                    platform: "meta",
                    external_campaign_id: r.campaign_id,
                    spend_date: r.date_start,
                    created_by: conn.created_by,
                  });
                }
                written++;
              }
              results.push({ sub_account_id: a.sub_account_id, ad_account_id: a.ad_account_id, ok: true, rows: written });
            } catch (e) {
              results.push({
                sub_account_id: a.sub_account_id,
                ad_account_id: a.ad_account_id,
                ok: false,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }
        }

        return Response.json({ processed: results.length, results });
      },
    },
  },
});
