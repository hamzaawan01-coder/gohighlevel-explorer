import { createFileRoute } from "@tanstack/react-router";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ADS_API = "https://googleads.googleapis.com/v21";

async function getAccessToken(refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${await res.text()}`);
  return (await res.json() as { access_token: string }).access_token;
}

async function syncOne(
  sb: Awaited<ReturnType<typeof import("@/integrations/supabase/client.server").getSupabaseAdmin>> | any,
  conn: { id: string; sub_account_id: string; refresh_token: string; external_customer_id: string | null; connected_by: string },
  devToken: string,
) {
  const customerId = (conn.external_customer_id || "").replace(/-/g, "");
  if (!customerId) throw new Error("no customer_id");
  const accessToken = await getAccessToken(conn.refresh_token);
  const query = `
    SELECT campaign.id, campaign.name, campaign.status,
           metrics.impressions, metrics.clicks, metrics.conversions, metrics.cost_micros
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
  `;
  const res = await fetch(`${GOOGLE_ADS_API}/customers/${customerId}/googleAds:searchStream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": devToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`ads ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const payload = await res.json() as Array<{ results?: Array<{ campaign: { id: string; name: string; status: string }; metrics: { impressions?: string; clicks?: string; conversions?: number; costMicros?: string } }> }>;

  let upserted = 0;
  for (const chunk of payload) {
    for (const row of chunk.results ?? []) {
      const extId = `google:${customerId}:${row.campaign.id}`;
      const spend = Number(row.metrics.costMicros ?? 0) / 1_000_000;
      const status = row.campaign.status === "ENABLED" ? "active" : row.campaign.status === "PAUSED" ? "paused" : "completed";
      const patch = {
        name: row.campaign.name,
        platform: "google",
        status,
        spend,
        impressions: Number(row.metrics.impressions ?? 0),
        clicks: Number(row.metrics.clicks ?? 0),
        conversions: Math.round(Number(row.metrics.conversions ?? 0)),
      };
      const { data: existing } = await sb
        .from("ad_campaigns").select("id")
        .eq("sub_account_id", conn.sub_account_id).eq("external_id", extId).maybeSingle();
      if (existing?.id) {
        await sb.from("ad_campaigns").update(patch).eq("id", existing.id);
      } else {
        await sb.from("ad_campaigns").insert({
          ...patch,
          sub_account_id: conn.sub_account_id,
          created_by: conn.connected_by,
          external_id: extId,
        });
      }
      upserted++;
    }
  }
  return upserted;
}

export const Route = createFileRoute("/api/public/hooks/sync-google-ads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        if (!apiKey || apiKey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
        }
        const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
        if (!devToken) {
          return new Response(JSON.stringify({ error: "missing GOOGLE_ADS_DEVELOPER_TOKEN" }), { status: 500 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: conns, error } = await supabaseAdmin
          .from("ad_platform_connections")
          .select("id, sub_account_id, refresh_token, external_customer_id, connected_by")
          .eq("platform", "google");
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        const results: Array<{ id: string; ok: boolean; upserted?: number; error?: string }> = [];
        for (const c of conns ?? []) {
          try {
            const upserted = await syncOne(supabaseAdmin, c as never, devToken);
            await supabaseAdmin.from("ad_platform_connections")
              .update({ last_synced_at: new Date().toISOString(), last_sync_error: null })
              .eq("id", (c as { id: string }).id);
            results.push({ id: (c as { id: string }).id, ok: true, upserted });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            await supabaseAdmin.from("ad_platform_connections")
              .update({ last_sync_error: msg })
              .eq("id", (c as { id: string }).id);
            results.push({ id: (c as { id: string }).id, ok: false, error: msg });
          }
        }
        return Response.json({ processed: results.length, results });
      },
    },
  },
});
