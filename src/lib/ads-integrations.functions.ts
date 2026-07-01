import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_ADS_API = "https://googleads.googleapis.com/v18";

function siteOrigin(): string {
  // Production redirect. Google requires exact match; only registered URIs work.
  return process.env.PUBLIC_SITE_URL || "https://gohighlevel-explorer.lovable.app";
}

function signState(payload: Record<string, string>): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string): Record<string, string> | null {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (expected !== sig) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (Number(p.exp) < Date.now()) return null;
    return p;
  } catch { return null; }
}

/** Build the Google Ads OAuth authorize URL for the caller's sub-account. */
export const startGoogleAdsConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { subAccountId: string }) => z.object({ subAccountId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    if (!clientId) throw new Error("GOOGLE_ADS_CLIENT_ID not configured");

    // Verify caller has admin access to this sub_account
    const sb = context.supabase;
    const { data: ok, error } = await sb
      .from("sub_accounts").select("id, agency_id").eq("id", data.subAccountId).maybeSingle();
    if (error || !ok) throw new Error("Sub-account not accessible");

    const state = signState({
      sub: data.subAccountId,
      uid: context.userId,
      exp: String(Date.now() + 15 * 60 * 1000),
    });

    const redirectUri = `${siteOrigin()}/api/public/oauth/google-ads/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/adwords",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });
    return { authorizeUrl: `${GOOGLE_AUTH_URL}?${params.toString()}` };
  });

async function getGoogleAccessToken(refreshToken: string): Promise<string> {
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
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  const j = await res.json() as { access_token: string };
  return j.access_token;
}

/** Sync Google Ads campaign metrics into ad_campaigns for a sub-account. */
export const syncGoogleAds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { subAccountId: string }) => z.object({ subAccountId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!devToken) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN not configured");

    const { data: conn, error } = await sb
      .from("ad_platform_connections" as never)
      .select("*")
      .eq("sub_account_id", data.subAccountId)
      .eq("platform", "google")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!conn) throw new Error("No Google Ads connection for this workspace");

    const c = conn as unknown as {
      id: string; refresh_token: string; external_customer_id: string | null;
      accessible_customers: { id: string; name?: string }[];
    };
    const customerId = (c.external_customer_id || c.accessible_customers?.[0]?.id || "").replace(/-/g, "");
    if (!customerId) throw new Error("No customer_id selected on connection");

    try {
      const accessToken = await getGoogleAccessToken(c.refresh_token);

      // GAQL — last 30 days campaign metrics
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
      if (!res.ok) throw new Error(`Google Ads API ${res.status}: ${await res.text()}`);
      const payload = await res.json() as Array<{ results?: Array<{ campaign: { id: string; name: string; status: string }; metrics: { impressions?: string; clicks?: string; conversions?: number; costMicros?: string } }> }>;

      let upserted = 0;
      for (const chunk of payload) {
        for (const row of chunk.results ?? []) {
          const extId = `google:${customerId}:${row.campaign.id}`;
          const spend = Number(row.metrics.costMicros ?? 0) / 1_000_000;
          const status = row.campaign.status === "ENABLED" ? "active" : row.campaign.status === "PAUSED" ? "paused" : "completed";

          // Look up existing by external_id
          const { data: existing } = await sb
            .from("ad_campaigns").select("id")
            .eq("sub_account_id", data.subAccountId).eq("external_id", extId).maybeSingle();

          const patch = {
            name: row.campaign.name,
            platform: "google" as const,
            status: status as "active" | "paused" | "completed",
            spend,
            impressions: Number(row.metrics.impressions ?? 0),
            clicks: Number(row.metrics.clicks ?? 0),
            conversions: Math.round(Number(row.metrics.conversions ?? 0)),
          };
          if (existing?.id) {
            await sb.from("ad_campaigns").update(patch).eq("id", existing.id);
          } else {
            await sb.from("ad_campaigns").insert({
              ...patch,
              sub_account_id: data.subAccountId,
              created_by: context.userId,
              external_id: extId,
            });
          }
          upserted++;
        }
      }

      await sb.from("ad_platform_connections" as never)
        .update({ last_synced_at: new Date().toISOString(), last_sync_error: null } as never)
        .eq("id", c.id);

      return { upserted };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sb.from("ad_platform_connections" as never)
        .update({ last_sync_error: msg } as never).eq("id", c.id);
      throw new Error(msg);
    }
  });
